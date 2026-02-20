// =======================================================================
// Aldra — server.js (FIX STATIC + RENDER + ADMIN OK)
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
const PLAN_PRICE = 70;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não definido");
if (!process.env.MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN não definido");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim(),
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
      payment_id TEXT,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// =======================================================================
// AUTH
// =======================================================================

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer "))
    return res.status(401).json({ error: "Token ausente" });

  try {
    const decoded = jwt.verify(
      authHeader.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );

    db.get(
      `SELECT * FROM users WHERE id=?`,
      [decoded.id],
      (err, user) => {
        if (err) return res.status(500).json({ error: "Erro interno" });
        if (!user) return res.status(401).json({ error: "Usuário inválido" });

        req.user = user;
        req.user.is_admin = user.email === ADMIN_EMAIL;
        next();
      }
    );
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =======================================================================
// ADMIN MIDDLEWARE
// =======================================================================

function adminOnly(req, res, next) {
  if (!req.user?.is_admin)
    return res.status(403).json({ error: "Acesso restrito" });
  next();
}

// =======================================================================
// REGISTER
// =======================================================================

app.post("/auth/register", (req, res) => {
  let { name = "", email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  email = email.toLowerCase().trim();
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name,email,password) VALUES (?,?,?)`,
    [name, email, hash],
    function (err) {
      if (err)
        return res.status(400).json({ error: "Email já existe" });

      db.run(
        `INSERT INTO subscriptions (user_id,status) VALUES (?, 'pending')`,
        [this.lastID]
      );

      res.json({ success: true });
    }
  );
});

// =======================================================================
// LOGIN
// =======================================================================

app.post("/auth/login", (req, res) => {
  let { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  email = email.toLowerCase().trim();

  db.get(
    `SELECT * FROM users WHERE email=?`,
    [email],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Erro interno" });
      if (!user)
        return res.status(404).json({ error: "Usuário não encontrado" });

      if (!bcrypt.compareSync(password, user.password))
        return res.status(401).json({ error: "Senha incorreta" });

      const isAdmin = user.email === ADMIN_EMAIL;

      const token = jwt.sign(
        { id: user.id, is_admin: isAdmin },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.json({ token, is_admin: isAdmin });
    }
  );
});

// =======================================================================
// ADMIN ROTAS
// =======================================================================

app.get("/admin/stats", auth, adminOnly, (req, res) => {
  db.get(`SELECT COUNT(*) as total FROM users`, (err, totalUsers) => {
    db.get(
      `SELECT COUNT(*) as active FROM subscriptions WHERE status='active'`,
      (err2, activeUsers) => {
        db.get(
          `SELECT COUNT(*) as pending FROM subscriptions WHERE status='pending'`,
          (err3, pendingUsers) => {
            const receita = (activeUsers?.active || 0) * PLAN_PRICE;

            res.json({
              users: totalUsers?.total || 0,
              active: activeUsers?.active || 0,
              pending: pendingUsers?.pending || 0,
              receita_mensal: receita,
            });
          }
        );
      }
    );
  });
});

app.get("/admin/users", auth, adminOnly, (req, res) => {
  db.all(
    `SELECT u.id, u.name, u.email, s.status
     FROM users u
     LEFT JOIN subscriptions s ON u.id = s.user_id`,
    (err, rows) => {
      if (err)
        return res.status(500).json({ error: "Erro ao buscar usuários" });

      res.json(rows);
    }
  );
});

app.post("/admin/cancel/:id", auth, adminOnly, (req, res) => {
  db.run(
    `UPDATE subscriptions
     SET status='pending', payment_id=NULL, expires_at=NULL
     WHERE user_id=?`,
    [req.params.id],
    function (err) {
      if (err)
        return res.status(500).json({ error: "Erro ao cancelar" });

      res.json({ success: true });
    }
  );
});

// =======================================================================
// 🔥 STATIC (ORDEM CORRETA)
// =======================================================================

// SERVE arquivos estáticos primeiro
app.use(express.static(PUBLIC_DIR));

// 🔥 fallback SOMENTE para rotas que não são arquivos
app.get("*", (req, res) => {
  if (req.path.includes(".")) {
    return res.status(404).end();
  }
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================

app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});