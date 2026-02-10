// =======================================================================
// Aldra — server.js (AUTH + ASSINATURA + CRM COMPLETO + IA GROQ)
// =======================================================================

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

dotenv.config();

// =======================================================================
// VALIDAÇÕES
// =======================================================================
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido");
  process.exit(1);
}
if (!process.env.GROQ_API_KEY) {
  console.error("❌ GROQ_API_KEY não definido");
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
app.use(express.static(PUBLIC_DIR));

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
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer "))
    return res.status(401).json({ error: "Token ausente" });

  jwt.verify(h.replace("Bearer ", ""), process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: "Token inválido" });
    req.user = decoded;
    next();
  });
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
        return res.status(403).json({ error: "Assinatura inativa" });
      }
      next();
    }
  );
}

// =======================================================================
// AUTH
// =======================================================================
app.post("/auth/register", (req, res) => {
  const { name = "", email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name,email,password) VALUES (?,?,?)`,
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email já existe" });

      db.run(
        `INSERT OR IGNORE INTO subscriptions (user_id,status) VALUES (?,?)`,
        [this.lastID, "pending"]
      );

      res.json({ success: true });
    }
  );
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email=?`, [email], (_, u) => {
    if (!u) return res.status(404).json({ error: "Usuário não encontrado" });
    if (!bcrypt.compareSync(password, u.password))
      return res.status(401).json({ error: "Senha incorreta" });

    db.run(
      `INSERT OR IGNORE INTO subscriptions (user_id,status) VALUES (?,?)`,
      [u.id, "pending"]
    );

    const token = jwt.sign({ id: u.id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ token });
  });
});

// =======================================================================
// ASSINATURA
// =======================================================================
app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT * FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (_, sub) => {
      if (!sub) return res.json({ subscription_status: "pending" });

      res.json({
        subscription_status: sub.status,
        subscription_expires_at: sub.expires_at
      });
    }
  );
});

app.post("/subscription/activate", auth, (req, res) => {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  db.run(
    `UPDATE subscriptions SET status='active', expires_at=? WHERE user_id=?`,
    [expires.toISOString(), req.user.id],
    () => res.json({ success: true })
  );
});

// =======================================================================
// CRM — COMPLETO
// =======================================================================

// LISTAR
app.get("/api/crm", auth, assinaturaAtiva, (req, res) => {
  db.all(
    `SELECT * FROM crm_clients WHERE user_id=? ORDER BY created_at DESC`,
    [req.user.id],
    (_, rows) => res.json(rows)
  );
});

// CRIAR
app.post("/api/crm", auth, assinaturaAtiva, (req, res) => {
  const { name, email, phone = "", status = "lead", notes = "" } = req.body;

  if (!name || !email)
    return res.status(400).json({ error: "Nome e email obrigatórios" });

  db.run(
    `
    INSERT INTO crm_clients (user_id,name,email,phone,status,notes)
    VALUES (?,?,?,?,?,?)
    `,
    [req.user.id, name, email, phone, status, notes],
    function () {
      res.json({ success: true, id: this.lastID });
    }
  );
});

// EDITAR
app.put("/api/crm/:id", auth, assinaturaAtiva, (req, res) => {
  const { name, email, phone, status, notes } = req.body;

  db.run(
    `
    UPDATE crm_clients
    SET name=?, email=?, phone=?, status=?, notes=?
    WHERE id=? AND user_id=?
    `,
    [name, email, phone, status, notes, req.params.id, req.user.id],
    function () {
      res.json({ success: this.changes > 0 });
    }
  );
});

// DELETAR
app.delete("/api/crm/:id", auth, assinaturaAtiva, (req, res) => {
  db.run(
    `DELETE FROM crm_clients WHERE id=? AND user_id=?`,
    [req.params.id, req.user.id],
    function () {
      res.json({ success: this.changes > 0 });
    }
  );
});

// =======================================================================
// IA GROQ
// =======================================================================
async function groq(prompt) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    })
  });

  const j = await r.json();
  return j.choices?.[0]?.message?.content || "Erro IA";
}

// =======================================================================
// FRONTEND
// =======================================================================
app.get("/", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

app.get(/^\/(?!auth|api|health|subscription).*/, (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

// =======================================================================
// START
// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});
