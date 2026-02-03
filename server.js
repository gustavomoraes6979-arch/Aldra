// =======================================================================
// Aldra — server.js (RENDER FINAL — FUNCIONAL)
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
// VALIDAÇÃO CRÍTICA
// =======================================================================
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido no Render");
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

// FRONTEND
app.use(express.static(PUBLIC_DIR));

// =======================================================================
// HEALTH CHECK
// =======================================================================
app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

// =======================================================================
// DATABASE
// =======================================================================
const db = new sqlite3.Database(
  path.join(__dirname, "adminIA.db"),
  err => {
    if (err) console.error("❌ SQLite erro:", err);
    else console.log("✅ SQLite conectado");
  }
);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    subscription_status TEXT DEFAULT 'pending',
    subscription_expires_at TEXT
  )
`);

// =======================================================================
// AUTH MIDDLEWARE
// =======================================================================
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "Token ausente" });

  jwt.verify(
    header.replace("Bearer ", ""),
    process.env.JWT_SECRET,
    (err, decoded) => {
      if (err)
        return res.status(401).json({ error: "Token inválido" });
      req.user = decoded;
      next();
    }
  );
}

function adminAuth(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Acesso negado" });
    next();
  });
}

// =======================================================================
// AUTH ROUTES
// =======================================================================
app.post("/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
    [name, email, hash],
    err => {
      if (err)
        return res.status(400).json({ error: "Email já cadastrado" });
      res.json({ success: true });
    }
  );
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email=?`, [email], (_, user) => {
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  });
});

// =======================================================================
// SUBSCRIPTION
// =======================================================================
app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT subscription_status, subscription_expires_at FROM users WHERE id=?`,
    [req.user.id],
    (_, user) => {
      if (!user)
        return res.json({ subscription_status: "none" });
      res.json(user);
    }
  );
});

// =======================================================================
// PIX
// =======================================================================
app.get("/api/pix", auth, (_, res) => {
  res.json({ pix: "PIX_ATIVO" });
});

// =======================================================================
// ADMIN
// =======================================================================
app.get("/admin/users", adminAuth, (_, res) => {
  db.all(
    `SELECT id, name, email, role, subscription_status FROM users`,
    [],
    (_, rows) => res.json(rows)
  );
});

// =======================================================================
// 🔥 FALLBACK CORRETO (SÓ FRONTEND)
// =======================================================================
app.get(/^\/(?!auth|api|admin|subscription|health).*/, (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================
// START
// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});
