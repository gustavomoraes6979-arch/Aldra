// =======================================================================
// Aldra — server.js (ADMIN AUTO + ASSINATURA + DASHBOARD + PIX + ALERTAS)
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
const PORT = 3000;

// =======================================================================
// MIDDLEWARES
// =======================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

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
const db = new sqlite3.Database(path.join(__dirname, "adminIA.db"));

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
// AUTH JWT
// =======================================================================
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ error: "Token inválido" });

  jwt.verify(
    header.replace("Bearer ", ""),
    process.env.JWT_SECRET,
    (err, decoded) => {
      if (err) return res.status(403).json({ error: "Token expirado" });
      req.user = decoded;
      next();
    }
  );
}

// =======================================================================
// ADMIN AUTOMÁTICO (ROLE)
// =======================================================================
function adminAuth(req, res, next) {
  auth(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Acesso restrito ao admin" });
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
// SUBSCRIPTION STATUS
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

      res.json(user);
    }
  );
});

// =======================================================================
// PIX CPF (COPIA E COLA)
// =======================================================================
app.get("/api/pix", auth, (_, res) => {
  const chavePix = "46204755803";
  const nomeRecebedor = "ALDRA";
  const cidade = "SAO PAULO";
  const valor = "70.00";
  const descricao = "Assinatura Aldra";

  function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      }
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
    nomeRecebedor.length.toString().padStart(2, "0") +
    nomeRecebedor +
    "60" +
    cidade.length.toString().padStart(2, "0") +
    cidade +
    "62070503***6304";

  res.json({ pix: payload + crc16(payload) });
});

// =======================================================================
// ADMIN ROUTES
// =======================================================================
app.get("/admin/users", adminAuth, (_, res) => {
  db.all(
    `SELECT id, name, email, role, subscription_status, subscription_expires_at 
     FROM users ORDER BY id DESC`,
    [],
    (_, rows) => res.json(rows)
  );
});

app.post("/admin/confirm-payment/:userId", adminAuth, (req, res) => {
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);

  db.run(
    `UPDATE users 
     SET subscription_status='active',
         subscription_expires_at=?
     WHERE id=?`,
    [expires.toISOString(), req.params.userId],
    function () {
      if (this.changes === 0)
        return res.status(404).json({ error: "Usuário não encontrado" });

      res.json({ success: true });
    }
  );
});

app.post("/admin/block-user/:userId", adminAuth, (req, res) => {
  db.run(
    `UPDATE users SET subscription_status='blocked' WHERE id=?`,
    [req.params.userId],
    function () {
      if (this.changes === 0)
        return res.status(404).json({ error: "Usuário não encontrado" });

      res.json({ success: true });
    }
  );
});

// =======================================================================
// 🔔 NOTIFICAÇÃO AUTOMÁTICA DE RENOVAÇÃO
// =======================================================================
setInterval(() => {
  const now = new Date();

  db.all(
    `SELECT id, email, subscription_expires_at 
     FROM users 
     WHERE subscription_status='active'`,
    [],
    (_, users) => {
      users.forEach(u => {
        if (!u.subscription_expires_at) return;

        const diff =
          Math.ceil(
            (new Date(u.subscription_expires_at) - now) /
              (1000 * 60 * 60 * 24)
          );

        if ([7, 3, 1].includes(diff)) {
          console.log(
            `🔔 Aviso: Usuário ${u.email} vence em ${diff} dia(s)`
          );
        }
      });
    }
  );
}, 1000 * 60 * 60 * 12); // a cada 12h

// =======================================================================
// START
// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra rodando em http://localhost:${PORT}`);
  console.log("👑 Admin automático por role");
});
