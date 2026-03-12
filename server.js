// =======================================================================
// Aldra — server.js (ERP + IA GROQ COMPLETO ESTÁVEL)
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
import crypto from "crypto";

dotenv.config();

// =======================================================================
// CONFIG
// =======================================================================

const ADMIN_EMAIL = "moraes_gu@hotmail.com".toLowerCase();
const PLAN_PRICE = Number(1.00);

const BASE_URL = process.env.BASE_URL || "https://aldra.onrender.com";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não definido");
if (!process.env.MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN não definido");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim()
});

const payment = new Payment(mpClient);

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
// REGISTER
// =======================================================================

app.post("/auth/register", async (req, res) => {

  try {

    const { name, email, password } = req.body;

    const hash = bcrypt.hashSync(password, 10);

    const result = await dbRun(
      `INSERT INTO users(name,email,password) VALUES(?,?,?)`,
      [name, email.toLowerCase(), hash]
    );

    await dbRun(
      `INSERT INTO subscriptions(user_id,status)
       VALUES(?, 'pending')`,
      [result.lastID]
    );

    res.json({ success: true });

  } catch (err) {

    console.log("Erro registro:", err);

    res.status(400).json({ error: "Email já existe" });

  }

});

// =======================================================================
// LOGIN
// =======================================================================

app.post("/auth/login", async (req, res) => {

  const { email, password } = req.body;

  const user = await dbGet(
    `SELECT * FROM users WHERE email=?`,
    [email.toLowerCase()]
  );

  if (!user)
    return res.status(404).json({ error: "Usuário não encontrado" });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: "Senha incorreta" });

  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    redirect:
      user.email === ADMIN_EMAIL
        ? "/admin-dashboard.html"
        : "/dashboard.html"
  });

});

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

    const idempotencyKey = crypto.randomUUID();

    const result = await payment.create({
      body: {
        transaction_amount: PLAN_PRICE,
        description: "Assinatura Aldra",
        payment_method_id: "pix",
        payer: {
          email: req.user.email
        },
        notification_url: `${BASE_URL}/webhook/mercadopago`
      },
      requestOptions: {
        idempotencyKey
      }
    });

    const paymentId = result.body.id;

    console.log("PIX criado:", paymentId);

    await dbRun(
      `UPDATE subscriptions
       SET payment_id=?, status='pending'
       WHERE user_id=?`,
      [paymentId, req.user.id]
    );

    res.json(result.body);

  } catch (err) {

    console.log("ERRO MERCADO PAGO:", err);

    res.status(500).json({
      error: "Erro ao criar pagamento",
      details: err.message
    });

  }

});

// =======================================================================
// WEBHOOK
// =======================================================================

app.post("/webhook/mercadopago", async (req, res) => {

  try {

    const paymentId =
      req.body?.data?.id ||
      req.body?.id ||
      req.query?.id;

    if (!paymentId)
      return res.sendStatus(200);

    const paymentData = await payment.get({ id: paymentId });

    const status = paymentData.body?.status;

    console.log("Webhook status:", status);

    if (status === "approved") {

      await dbRun(
        `UPDATE subscriptions
         SET status='active'
         WHERE payment_id=?`,
        [paymentId]
      );

      console.log("Assinatura ativada");

    }

    res.sendStatus(200);

  } catch (err) {

    console.log("Erro webhook:", err);

    res.sendStatus(500);

  }

});

// =======================================================================
// VERIFICAR PAGAMENTO
// =======================================================================

app.get("/subscription/check", auth, async (req, res) => {

  try {

    const sub = await dbGet(
      `SELECT * FROM subscriptions WHERE user_id=?`,
      [req.user.id]
    );

    if (!sub?.payment_id)
      return res.json({ status: "pending" });

    const paymentData = await payment.get({
      id: sub.payment_id
    });

    const status = paymentData.body?.status;

    if (status === "approved") {

      await dbRun(
        `UPDATE subscriptions
         SET status='active'
         WHERE user_id=?`,
        [req.user.id]
      );

      return res.json({ status: "active" });

    }

    res.json({ status });

  } catch (err) {

    console.log("Erro verificar pagamento:", err);

    res.json({ status: "pending" });

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
  console.log(`🚀 Aldra ERP rodando na porta ${PORT}`)
);