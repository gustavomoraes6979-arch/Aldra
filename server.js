// =======================================================================
// Aldra — server.js (AUTH + ASSINATURA + CRM + PIX + WEBHOOK)
// =======================================================================

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mercadopago from "mercadopago";
import { fileURLToPath } from "url";

dotenv.config();

// =======================================================================
// VALIDAÇÕES
// =======================================================================
if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido");
  process.exit(1);
}

if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ MP_ACCESS_TOKEN não definido");
  process.exit(1);
}

// =======================================================================
// MERCADO PAGO CONFIG
// =======================================================================
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

// =======================================================================
// PATHS
// =======================================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

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
// GERAR PIX — PLANO R$70
// =======================================================================
app.post("/api/create-pix", auth, async (req, res) => {
  try {
    const payment = await mercadopago.payment.create({
      transaction_amount: 70,
      description: "Plano Mensal Aldra",
      payment_method_id: "pix",
      payer: {
        email: req.user.id + "@aldra.com"
      },
      notification_url: `${process.env.BASE_URL}/api/webhook`
    });

    res.json({
      qr_code: payment.body.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        payment.body.point_of_interaction.transaction_data.qr_code_base64,
      payment_id: payment.body.id
    });
  } catch (error) {
    console.error("Erro ao gerar PIX:", error);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

// =======================================================================
// WEBHOOK MERCADO PAGO
// =======================================================================
app.post("/api/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;

    if (!paymentId) return res.sendStatus(200);

    const payment = await mercadopago.payment.findById(paymentId);

    if (payment.body.status === "approved") {
      const userId = parseInt(payment.body.payer.email.split("@")[0]);

      db.run(
        `UPDATE subscriptions SET status='active',
         expires_at=datetime('now','+30 days')
         WHERE user_id=?`,
        [userId]
      );

      console.log("✅ Assinatura ativada para usuário", userId);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro webhook:", err);
    res.sendStatus(500);
  }
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
// CRM
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

  db.run(
    `INSERT INTO crm_clients (user_id,name,email,phone)
     VALUES (?,?,?,?)`,
    [req.user.id, name, email, phone],
    function () {
      res.json({ success: true });
    }
  );
});

// =======================================================================
// FRONTEND
// =======================================================================
app.get("/", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use(express.static(PUBLIC_DIR));

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});
