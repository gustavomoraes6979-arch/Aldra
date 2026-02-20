// =======================================================================
// Aldra — server.js (PIX + SUBSCRIPTION + STATIC FIX FINAL)
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
const mpPayment = new Payment(mpClient);

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
// 🔥 CRIAR PIX
// =======================================================================

app.post("/subscription/create", auth, async (req, res) => {
  try {
    const paymentData = await mpPayment.create({
      body: {
        transaction_amount: PLAN_PRICE,
        description: "Assinatura Aldra",
        payment_method_id: "pix",
        payer: {
          email: req.user.email,
        },
      },
    });

    const tx =
      paymentData.point_of_interaction?.transaction_data || null;

    if (!tx) {
      return res.status(500).json({ error: "PIX não retornado" });
    }

    // salva pagamento
    db.run(
      `UPDATE subscriptions
       SET payment_id=?, status='pending'
       WHERE user_id=?`,
      [paymentData.id, req.user.id]
    );

    res.json(paymentData);
  } catch (err) {
    console.error("Erro ao criar PIX:", err);
    res.status(500).json({ error: "Erro ao gerar pagamento" });
  }
});

// =======================================================================
// 🔥 STATUS DA ASSINATURA
// =======================================================================

app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT status, expires_at FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (err, row) => {
      if (!row) return res.json({ status: "pending" });

      res.json({
        status: row.status,
        expires_at: row.expires_at,
      });
    }
  );
});

// =======================================================================
// 🔥 WEBHOOK MERCADO PAGO
// =======================================================================

app.post("/webhook/mercadopago", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const paymentInfo = await mpPayment.get({ id: paymentId });

    if (paymentInfo.status !== "approved") {
      return res.sendStatus(200);
    }

    // ativa assinatura
    db.run(
      `UPDATE subscriptions
       SET status='active',
           expires_at=datetime('now','+30 days')
       WHERE payment_id=?`,
      [paymentId]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook erro:", err);
    res.sendStatus(200);
  }
});

// =======================================================================
// AUTH BÁSICO (login/register mantidos iguais)
// =======================================================================

app.post("/auth/register", (req, res) => {
  let { name = "", email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  email = email.toLowerCase().trim();
  const hash = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name,email,password) VALUES (?,?,?)`,
    [name, email, hash],
    function (err) {
      if (err) return res.status(400).json({ error: "Email já existe" });

      db.run(
        `INSERT INTO subscriptions (user_id,status) VALUES (?, 'pending')`,
        [this.lastID]
      );

      res.json({ success: true });
    }
  );
});

app.post("/auth/login", (req, res) => {
  let { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  email = email.toLowerCase().trim();

  db.get(`SELECT * FROM users WHERE email=?`, [email], (err, user) => {
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Senha incorreta" });

    const isAdmin = user.email === ADMIN_EMAIL;

    const token = jwt.sign(
      { id: user.id, is_admin: isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, is_admin: isAdmin });
  });
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