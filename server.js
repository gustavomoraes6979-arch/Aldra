// =======================================================================
// Aldra — server.js (FULL FIX: PIX + ADMIN + CRM)
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

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim(),
});
const payment = new Payment(mpClient);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS crm (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT,
      email TEXT,
      phone TEXT
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
// 🔥 API ME (corrige admin)
// =======================================================================

app.get("/api/me", auth, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    isAdmin: req.user.is_admin,
  });
});

// =======================================================================
// 🔥 SUBSCRIPTION STATUS
// =======================================================================

app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT * FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (err, sub) => {
      if (err) return res.status(500).json({ error: "Erro interno" });

      res.json({
        status: sub?.status || "pending",
      });
    }
  );
});

// =======================================================================
// 🔥 CRIAR PIX
// =======================================================================

app.post("/subscription/create", auth, async (req, res) => {
  try {
    const pix = await payment.create({
      body: {
        transaction_amount: PLAN_PRICE,
        description: "Aldra SaaS",
        payment_method_id: "pix",
        payer: {
          email: req.user.email,
        },
      },
    });

    db.run(
      `UPDATE subscriptions SET payment_id=?, status='pending' WHERE user_id=?`,
      [pix.id, req.user.id]
    );

    res.json(pix);
  } catch (err) {
    console.error("Erro criar PIX:", err);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

// =======================================================================
// 🔥 WEBHOOK MERCADO PAGO
// =======================================================================

app.post("/webhook/mp", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const info = await payment.get({ id: paymentId });

    if (info.status === "approved") {
      db.run(
        `UPDATE subscriptions SET status='active' WHERE payment_id=?`,
        [paymentId]
      );
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook erro:", err);
    res.sendStatus(200);
  }
});

// =======================================================================
// 🔥 CRM
// =======================================================================

app.get("/api/crm", auth, (req, res) => {
  db.all(
    `SELECT * FROM crm WHERE user_id=?`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json([]);
      res.json(rows);
    }
  );
});

app.post("/api/crm", auth, (req, res) => {
  const { name, email, phone } = req.body;

  db.run(
    `INSERT INTO crm (user_id,name,email,phone) VALUES (?,?,?,?)`,
    [req.user.id, name, email, phone],
    () => res.json({ success: true })
  );
});

// =======================================================================
// STATIC
// =======================================================================

app.use(express.static(PUBLIC_DIR));

app.get("*", (req, res) => {
  if (req.path.includes(".")) return res.status(404).end();
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================

app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});