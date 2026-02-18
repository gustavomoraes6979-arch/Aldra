// =======================================================================
// Aldra — server.js (ADMIN 100% BLINDADO + API ME)
// =======================================================================

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { fileURLToPath } from "url";

dotenv.config();

// =======================================================================
// CONFIG
// =======================================================================
const ADMIN_EMAIL = "moraes_gu@hotmail.com".toLowerCase();

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido");
  process.exit(1);
}

if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ MP_ACCESS_TOKEN não definido");
  process.exit(1);
}

if (!process.env.BASE_URL) {
  console.error("❌ BASE_URL não definido");
  process.exit(1);
}

// =======================================================================
// MERCADO PAGO
// =======================================================================
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim()
});
const payment = new Payment(client);

// =======================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================================================================
// DATABASE
// =======================================================================
const db = new sqlite3.Database(path.join(__dirname, "adminIA.db"));

db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      status TEXT DEFAULT 'pending',
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

});

// =======================================================================
// MIDDLEWARE AUTH
// =======================================================================
function auth(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const decoded = jwt.verify(
      authHeader.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );

    db.get(`SELECT * FROM users WHERE id=?`, [decoded.id], (err, user) => {

      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Erro interno" });
      }

      if (!user) {
        return res.status(401).json({ error: "Usuário inválido" });
      }

      req.user = user;
      next();
    });

  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =======================================================================
// ADMIN BLINDADO
// =======================================================================
function adminOnly(req, res, next) {

  if (!req.user || req.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Acesso restrito ao proprietário" });
  }

  next();
}

// =======================================================================
// AUTH
// =======================================================================
app.post("/auth/register", (req, res) => {

  let { name = "", email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  email = email.toLowerCase().trim();

  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name,email,password) VALUES (?,?,?)`,
    [name, email, hash],
    function (err) {

      if (err) {
        return res.status(400).json({ error: "Email já existe" });
      }

      db.run(
        `INSERT INTO subscriptions (user_id,status)
         VALUES (?, 'pending')`,
        [this.lastID]
      );

      res.json({ success: true });
    }
  );
});

app.post("/auth/login", (req, res) => {

  let { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  email = email.toLowerCase().trim();

  db.get(`SELECT * FROM users WHERE email=?`, [email], (err, user) => {

    if (err) {
      return res.status(500).json({ error: "Erro interno" });
    }

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;

    res.json({ token, isAdmin });
  });
});

// =======================================================================
// API ME
// =======================================================================
app.get("/api/me", auth, (req, res) => {

  const isAdmin = req.user.email.toLowerCase() === ADMIN_EMAIL;

  res.json({
    email: req.user.email,
    isAdmin
  });
});

// =======================================================================
// ADMIN ROUTES
// =======================================================================
app.get("/admin/stats", auth, adminOnly, (req, res) => {

  db.get(`SELECT COUNT(*) as total FROM users`, [], (_, users) => {
    db.get(`SELECT COUNT(*) as total FROM subscriptions WHERE status='active'`, [], (_, active) => {
      db.get(`SELECT COUNT(*) as total FROM subscriptions WHERE status='pending'`, [], (_, pending) => {

        const receita = active.total * 70;

        res.json({
          users: users.total,
          active: active.total,
          pending: pending.total,
          receita_mensal: receita
        });

      });
    });
  });

});

app.get("/admin/users", auth, adminOnly, (req, res) => {

  db.all(`
    SELECT users.id, users.name, users.email,
    subscriptions.status
    FROM users
    LEFT JOIN subscriptions ON users.id = subscriptions.user_id
    ORDER BY users.id DESC
  `, [], (_, rows) => {
    res.json(rows);
  });

});

// =======================================================================
// STATIC
// =======================================================================
app.use(express.static(PUBLIC_DIR));

app.get("/*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});
