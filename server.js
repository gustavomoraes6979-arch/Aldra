// =======================================================================
// Aldra — server.js (PRODUÇÃO ESTÁVEL — RENDER SAFE)
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
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE"]
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// =======================================================================
// HEALTH CHECK (RENDER)
// =======================================================================
app.get("/health", (_, res) => res.json({ status: "ok" }));

// =======================================================================
// FRONTEND
// =======================================================================
app.get("/", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

app.get("/payment", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "payment.html"))
);

app.get("/dashboard", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "dashboard.html"))
);

app.get("/crm", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "crm.html"))
);

app.get("/admin", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"))
);

// =======================================================================
// DATABASE
// =======================================================================
const db = new sqlite3.Database(
  path.join(__dirname, "adminIA.db"),
  err => {
    if (err) console.error("❌ Erro SQLite:", err);
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
// AUTH JWT (JSON SAFE)
// =======================================================================
function auth(req, res, next) {
  try {
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
  } catch {
    res.status(401).json({ error: "Falha de autenticação" });
  }
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
// SUBSCRIPTION STATUS (BLINDADO)
// =======================================================================
app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT subscription_status, subscription_expires_at
     FROM users WHERE id=?`,
    [req.user.id],
    (_, user) => {
      if (!user)
        return res.json({ subscription_status: "none" });

      if (
        user.subscription_status === "active" &&
        user.subscription_expires_at &&
        new Date(user.subscription_expires_at) < new Date()
      ) {
        db.run(
          `UPDATE users SET subscription_status='expired' WHERE id=?`,
          [req.user.id]
        );
        return res.json({ subscription_status: "expired" });
      }

      res.json({
        subscription_status: user.subscription_status,
        subscription_expires_at: user.subscription_expires_at
      });
    }
  );
});

// =======================================================================
// PIX (COPIA E COLA)
// =======================================================================
app.get("/api/pix", auth, (_, res) => {
  const chavePix = "46204755803";
  const nome = "ALDRA";
  const cidade = "SAO PAULO";
  const valor = "70.00";

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++)
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  }

  const payload =
    "00020126360014BR.GOV.BCB.PIX01" +
    chavePix.length.toString().padStart(2, "0") +
    chavePix +
    "52040000530398654" +
    valor.length.toString().padStart(2, "0") +
    valor +
    "5802BR59" +
    nome.length.toString().padStart(2, "0") +
    nome +
    "60" +
    cidade.length.toString().padStart(2, "0") +
    cidade +
    "62070503***6304";

  res.json({ pix: payload + crc16(payload) });
});

// =======================================================================
// ADMIN
// =======================================================================
app.get("/admin/users", adminAuth, (_, res) => {
  db.all(
    `SELECT id, name, email, role, subscription_status, subscription_expires_at
     FROM users ORDER BY id DESC`,
    [],
    (_, rows) => res.json(rows)
  );
});

app.post("/admin/confirm-payment/:id", adminAuth, (req, res) => {
  const exp = new Date();
  exp.setDate(exp.getDate() + 30);

  db.run(
    `UPDATE users
     SET subscription_status='active',
         subscription_expires_at=?
     WHERE id=?`,
    [exp.toISOString(), req.params.id],
    function () {
      if (!this.changes)
        return res.status(404).json({ error: "Usuário não encontrado" });
      res.json({ success: true });
    }
  );
});

// =======================================================================
// START
// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra rodando na porta ${PORT}`);
});
