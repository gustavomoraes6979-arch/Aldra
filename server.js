// =======================================================================
// Aldra — server.js (AUTH + ASSINATURA + CRM + PROTEÇÃO REAL)
// =======================================================================

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

dotenv.config();

// =======================================================================
// VALIDAÇÕES
// =======================================================================
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido");
  process.exit(1);
}

// =======================================================================
// PATHS
// =======================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

// =======================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// =======================================================================
// MIDDLEWARES
// =======================================================================
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

  db.run(`
    CREATE TABLE IF NOT EXISTS crm_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      email TEXT,
      phone TEXT,
      status TEXT DEFAULT 'lead',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// =======================================================================
// AUTH MIDDLEWARE
// =======================================================================
function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    req.user = jwt.verify(
      authHeader.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =======================================================================
// PROTEÇÃO REAL DO DASHBOARD
// =======================================================================
function protectDashboard(req, res, next) {
  const token = req.query.token;

  if (!token) {
    return res.redirect("/");
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.redirect("/");
  }
}

// =======================================================================
// ASSINATURA
// =======================================================================
function assinaturaAtiva(req, res, next) {
  db.get(
    `SELECT status FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (_, sub) => {
      if (!sub || sub.status !== "active") {
        return res.status(403).json({
          error: "Assinatura inativa",
          code: "SUBSCRIPTION_INACTIVE"
        });
      }
      next();
    }
  );
}

// =======================================================================
// AUTH ROUTES
// =======================================================================
app.post("/auth/register", (req, res) => {
  const { name = "", email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name,email,password) VALUES (?,?,?)`,
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email já existe" });

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
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email=?`, [email], (_, u) => {
    if (!u) return res.status(404).json({ error: "Usuário não encontrado" });

    if (!bcrypt.compareSync(password, u.password)) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    const token = jwt.sign({ id: u.id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ token });
  });
});

// =======================================================================
// SUBSCRIPTION STATUS
// =======================================================================
app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT status, expires_at FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (_, sub) => {
      res.json({
        subscription_status: sub?.status || "pending",
        subscription_expires_at: sub?.expires_at || null
      });
    }
  );
});

// =======================================================================
// CRM (PROTEGIDO)
// =======================================================================
app.get("/api/crm", auth, assinaturaAtiva, (req, res) => {
  db.all(
    `SELECT * FROM crm_clients WHERE user_id=? ORDER BY created_at DESC`,
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

app.post("/api/crm", auth, assinaturaAtiva, (req, res) => {
  const { name, email, phone = "" } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Nome e email obrigatórios" });
  }

  db.run(
    `INSERT INTO crm_clients (user_id,name,email,phone)
     VALUES (?,?,?,?)`,
    [req.user.id, name, email, phone],
    function () {
      res.json({ success: true, id: this.lastID });
    }
  );
});

// =======================================================================
// FRONTEND
// =======================================================================

// Login
app.get("/", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// 🔐 Dashboard protegido corretamente
app.get("/dashboard.html", protectDashboard, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "dashboard.html"));
});

// Arquivos estáticos (DEPOIS da proteção)
app.use(express.static(PUBLIC_DIR));

// Fallback SPA
app.get("*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});
