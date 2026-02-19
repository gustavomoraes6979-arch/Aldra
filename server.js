// =======================================================================
// Aldra — server.js (COM PAGAMENTO PIX FUNCIONANDO)
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

    db.get(`SELECT * FROM users WHERE id=?`, [decoded.id], (err, user) => {
      if (err) return res.status(500).json({ error: "Erro interno" });
      if (!user) return res.status(401).json({ error: "Usuário inválido" });

      req.user = user;
      req.user.is_admin = user.email === ADMIN_EMAIL;

      next();
    });
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =======================================================================
// 🔥 ROTA /api/me (ESSENCIAL)
// =======================================================================

app.get("/api/me", auth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    isAdmin: req.user.is_admin
  });
});

// =======================================================================
// 🔥 STATUS DA ASSINATURA
// =======================================================================

app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT * FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (err, sub) => {
      if (err) return res.status(500).json({ error: "Erro DB" });

      if (!sub) {
        return res.json({ status: "pending" });
      }

      res.json({
        status: sub.status,
        payment_id: sub.payment_id
      });
    }
  );
});

// =======================================================================
// 🔥 CRIAR PAGAMENTO PIX
// =======================================================================

app.post("/create-payment", auth, async (req, res) => {
  try {
    const body = {
      transaction_amount: PLAN_PRICE,
      description: "Assinatura Aldra",
      payment_method_id: "pix",
      payer: {
        email: req.user.email
      }
    };

    const result = await payment.create({ body });

    const paymentId = result.id;

    db.run(
      `UPDATE subscriptions
       SET payment_id=?, status='pending'
       WHERE user_id=?`,
      [paymentId, req.user.id]
    );

    res.json(result);
  } catch (err) {
    console.error("Erro criar pagamento:", err);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
  }
});

// =======================================================================
// 🔥 WEBHOOK MERCADO PAGO (CONFIRMA PAGAMENTO)
// =======================================================================

app.post("/webhook/mp", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const result = await payment.get({ id: paymentId });

    if (result.status === "approved") {
      db.run(
        `UPDATE subscriptions
         SET status='active',
             expires_at=datetime('now','+30 day')
         WHERE payment_id=?`,
        [paymentId]
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro webhook:", err);
    res.sendStatus(500);
  }
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