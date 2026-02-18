// =======================================================================
// Aldra — server.js (SaaS PROFISSIONAL + ASSINATURA REAL)
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
if (!process.env.BASE_URL) throw new Error("BASE_URL não definido");

// =======================================================================
// MERCADO PAGO
// =======================================================================

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

});

// =======================================================================
// AUTH
// =======================================================================

function auth(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const decoded = jwt.verify(
      authHeader.replace("Bearer ", ""),
      process.env.JWT_SECRET
    );

    db.get(`SELECT * FROM users WHERE id=?`, [decoded.id], (err, user) => {

      if (err) return res.status(500).json({ error: "Erro interno" });
      if (!user) return res.status(401).json({ error: "Usuário inválido" });

      req.user = user;
      next();
    });

  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {

  if (!req.user || req.user.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Acesso restrito" });
  }

  next();
}

// =======================================================================
// REGISTER
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

      if (err)
        return res.status(400).json({ error: "Email já existe" });

      db.run(
        `INSERT INTO subscriptions (user_id,status)
         VALUES (?, 'pending')`,
        [this.lastID]
      );

      res.json({ success: true });
    }
  );
});

// =======================================================================
// LOGIN
// =======================================================================

app.post("/auth/login", (req, res) => {

  let { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  email = email.toLowerCase().trim();

  db.get(`SELECT * FROM users WHERE email=?`, [email], (err, user) => {

    if (err) return res.status(500).json({ error: "Erro interno" });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const isAdmin = user.email.toLowerCase() === ADMIN_EMAIL;

    res.json({ token, isAdmin });
  });
});

// =======================================================================
// CRIAR PAGAMENTO
// =======================================================================

app.post("/create-payment", auth, async (req, res) => {

  try {

    const body = {
      transaction_amount: PLAN_PRICE,
      description: "Assinatura Aldra - 30 dias",
      payment_method_id: "pix",
      payer: {
        email: req.user.email
      }
    };

    const result = await payment.create({ body });

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }

});

// =======================================================================
// WEBHOOK MERCADO PAGO
// =======================================================================

app.post("/webhook", async (req, res) => {

  try {

    const { type, data } = req.body;

    if (type === "payment") {

      const paymentInfo = await payment.get({ id: data.id });

      if (paymentInfo.status === "approved") {

        const email = paymentInfo.payer.email.toLowerCase();

        db.get(`SELECT * FROM users WHERE email=?`, [email], (err, user) => {

          if (!user) return;

          const expires = new Date();
          expires.setDate(expires.getDate() + 30);

          db.run(`
            UPDATE subscriptions
            SET status='active',
                expires_at=?
            WHERE user_id=?`,
            [expires.toISOString(), user.id]
          );

        });

      }

    }

    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }

});

// =======================================================================
// STATUS DA ASSINATURA
// =======================================================================

app.get("/subscription/status", auth, (req, res) => {

  db.get(`
    SELECT * FROM subscriptions
    WHERE user_id=?`,
    [req.user.id],
    (err, sub) => {

      if (!sub)
        return res.json({ status: "none" });

      if (sub.status !== "active")
        return res.json({ status: "inactive" });

      const now = new Date();
      const expires = new Date(sub.expires_at);

      if (expires < now) {

        db.run(`
          UPDATE subscriptions
          SET status='expired'
          WHERE user_id=?`,
          [req.user.id]
        );

        return res.json({ status: "expired" });
      }

      res.json({
        status: "active",
        expires_at: sub.expires_at
      });

    }
  );

});

// =======================================================================
// ADMIN
// =======================================================================

app.get("/admin/stats", auth, adminOnly, (req, res) => {

  db.get(`SELECT COUNT(*) as total FROM users`, [], (_, users) => {
    db.get(`SELECT COUNT(*) as total FROM subscriptions WHERE status='active'`, [], (_, active) => {
      db.get(`SELECT COUNT(*) as total FROM subscriptions WHERE status='pending'`, [], (_, pending) => {

        res.json({
          users: users.total,
          active: active.total,
          pending: pending.total,
          receita_mensal: active.total * PLAN_PRICE
        });

      });
    });
  });

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
