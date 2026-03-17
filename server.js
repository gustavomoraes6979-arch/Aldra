// =======================================================================
// Aldra — server.js (VERSÃO FINAL FUNCIONANDO NO RENDER)
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
// CONFIG
// =======================================================================

const ADMIN_EMAIL = "moraes_gu@hotmail.com".toLowerCase();
const PLAN_PRICE = 1;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não definido");
if (!process.env.MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN não definido");

// 🔥 IMPORT CORRIGIDO
const client = new mercadopago.MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim(),
});

const payment = new mercadopago.Payment(client);

// =======================================================================
// PATH
// =======================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

// =======================================================================
// APP
// =======================================================================

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// =======================================================================
// DATABASE
// =======================================================================

const db = new sqlite3.Database(path.join(__dirname, "adminIA.db"));

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

db.serialize(() => {

  db.run(`
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`
  CREATE TABLE IF NOT EXISTS subscriptions(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    status TEXT DEFAULT 'pending',
    payment_id TEXT,
    expires_at DATETIME
  )`);

});

// =======================================================================
// AUTH
// =======================================================================

async function auth(req, res, next) {

  const header = req.headers.authorization;

  if (!header)
    return res.status(401).json({ error: "Token ausente" });

  try {

    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await dbGet(`SELECT * FROM users WHERE id=?`, [decoded.id]);

    if (!user)
      return res.status(401).json({ error: "Usuário inválido" });

    user.is_admin = user.email === ADMIN_EMAIL;

    req.user = user;

    next();

  } catch {

    res.status(401).json({ error: "Token inválido" });

  }

}

// =======================================================================
// AUTH ME
// =======================================================================

app.get("/auth/me", auth, async (req, res) => {

  const sub = await dbGet(
    `SELECT status FROM subscriptions WHERE user_id=?`,
    [req.user.id]
  );

  res.json({
    email: req.user.email,
    is_admin: req.user.is_admin,
    subscription_status: sub?.status || "pending"
  });

});

// =======================================================================
// CRIAR PIX
// =======================================================================

app.post("/subscription/create", auth, async (req, res) => {

  try {

    const result = await payment.create({
      body: {
        transaction_amount: PLAN_PRICE,
        description: "Assinatura Aldra",
        payment_method_id: "pix",
        payer: { email: req.user.email }
      }
    });

    console.log("PIX criado ID:", result.id);

    await dbRun(
      `UPDATE subscriptions
       SET payment_id=?, status='pending'
       WHERE user_id=?`,
      [result.id, req.user.id]
    );

    res.json(result);

  } catch (err) {

    console.error("Erro ao criar PIX:", err);
    res.status(500).json({ error: "Erro PIX" });

  }

});

// =======================================================================
// STATUS
// =======================================================================

app.get("/subscription/status", auth, async (req, res) => {

  try {

    const sub = await dbGet(
      `SELECT payment_id,status FROM subscriptions WHERE user_id=?`,
      [req.user.id]
    );

    if (!sub?.payment_id)
      return res.json({ status: sub?.status || "pending" });

    const paymentData = await payment.get({ id: sub.payment_id });

    console.log("STATUS MP:", paymentData.status);

    if (
      paymentData.status === "approved" ||
      paymentData.status === "authorized"
    ) {

      await dbRun(
        `UPDATE subscriptions SET status='active' WHERE user_id=?`,
        [req.user.id]
      );

      console.log("✅ ASSINATURA ATIVADA");

      return res.json({ status: "active" });

    }

    return res.json({ status: "pending" });

  } catch (err) {

    console.error("Erro ao verificar pagamento:", err);
    return res.json({ status: "pending" });

  }

});

// =======================================================================
// WEBHOOK
// =======================================================================

app.post("/webhook/mercadopago", async (req, res) => {

  try {

    const paymentId = req.body?.data?.id;

    if (!paymentId)
      return res.sendStatus(200);

    const paymentData = await payment.get({ id: paymentId });

    console.log("WEBHOOK STATUS:", paymentData.status);

    if (
      paymentData.status === "approved" ||
      paymentData.status === "authorized"
    ) {

      await dbRun(
        `UPDATE subscriptions
         SET status='active'
         WHERE payment_id=?`,
        [paymentId]
      );

      console.log("✅ ATIVADO VIA WEBHOOK");

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

app.get("/*", (_, res) =>
  res.sendFile(path.join(PUBLIC_DIR, "index.html"))
);

// =======================================================================

app.listen(PORT, () =>
  console.log(`🚀 Aldra rodando na porta ${PORT}`)
);