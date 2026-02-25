// =======================================================================
// Aldra — server.js (ADMIN PROFISSIONAL + PIX SEPARADO)
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
  accessToken: process.env.MP_ACCESS_TOKEN.trim(),
});
const payment = new Payment(client);

// =======================================================================
// PATHS
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
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    db.get(`SELECT * FROM users WHERE id=?`, [decoded.id], (err, user) => {
      if (err || !user)
        return res.status(401).json({ error: "Usuário inválido" });

      req.user = user;
      req.user.is_admin = user.email === ADMIN_EMAIL;
      next();
    });
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.is_admin)
    return res.status(403).json({ error: "Acesso restrito" });
  next();
}

// =======================================================================
// REGISTER
// =======================================================================

app.post("/auth/register", (req, res) => {
  let { name = "", email, password } = req.body;

  email = email?.toLowerCase().trim();
  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

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

// =======================================================================
// LOGIN
// =======================================================================

app.post("/auth/login", (req, res) => {
  let { email, password } = req.body;

  email = email?.toLowerCase().trim();
  if (!email || !password)
    return res.status(400).json({ error: "Dados inválidos" });

  db.get(`SELECT * FROM users WHERE email=?`, [email], (err, user) => {
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado" });

    if (!bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: "Senha incorreta" });

    const isAdmin = user.email === ADMIN_EMAIL;

    const token = jwt.sign(
      { id: user.id, is_admin: isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      is_admin: isAdmin,
      redirect: isAdmin ? "/admin-dashboard.html" : "/dashboard.html",
    });
  });
});

// =======================================================================
// =========================== PIX (CLIENTE) ==============================
// =======================================================================

app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT * FROM subscriptions WHERE user_id=?`,
    [req.user.id],
    (_, sub) => {
      if (!sub) return res.json({ status: "pending" });
      res.json({ status: sub.status });
    }
  );
});

app.post("/subscription/create", auth, async (req, res) => {
  try {
    const result = await payment.create({
      body: {
        transaction_amount: PLAN_PRICE,
        description: "Assinatura Aldra",
        payment_method_id: "pix",
        payer: { email: req.user.email },
      },
    });

    db.run(
      `UPDATE subscriptions SET payment_id=?, status='pending' WHERE user_id=?`,
      [result.id, req.user.id]
    );

    res.json(result);
  } catch (err) {
    console.error("Erro PIX:", err);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

app.post("/webhook", async (req, res) => {
  try {
    if (req.body.type !== "payment") return res.sendStatus(200);

    const paymentId = req.body.data.id;
    const paymentInfo = await payment.get({ id: paymentId });

    if (paymentInfo.status === "approved") {
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
// ========================== ADMIN PROFISSIONAL ==========================
// =======================================================================

// MÉTRICAS
app.get("/admin/metrics", auth, adminOnly, (req, res) => {
  db.get(`SELECT COUNT(*) as total FROM users`, (_, totalUsers) => {
    db.get(
      `SELECT COUNT(*) as active FROM subscriptions WHERE status='active'`,
      (_, activeUsers) => {
        db.get(
          `SELECT COUNT(*) as pending FROM subscriptions WHERE status='pending'`,
          (_, pendingUsers) => {
            const receita = (activeUsers?.active || 0) * PLAN_PRICE;

            res.json({
              totalUsers: totalUsers?.total || 0,
              activeSubscriptions: activeUsers?.active || 0,
              pendingPayments: pendingUsers?.pending || 0,
              monthlyRevenue: receita,
            });
          }
        );
      }
    );
  });
});

// LISTA COMPLETA
app.get("/admin/users", auth, adminOnly, (req, res) => {
  db.all(
    `
    SELECT 
      u.id,
      u.name,
      u.email,
      s.status as subscription_status,
      s.payment_id,
      s.expires_at
    FROM users u
    LEFT JOIN subscriptions s ON u.id=s.user_id
    `,
    (_, rows) => res.json(rows)
  );
});

// APROVAR MANUAL
app.post("/admin/approve/:id", auth, adminOnly, (req, res) => {
  db.run(
    `
    UPDATE subscriptions
    SET status='active',
        expires_at=datetime('now','+30 day')
    WHERE user_id=?
    `,
    [req.params.id],
    () => res.json({ success: true })
  );
});

// CANCELAR
app.post("/admin/cancel/:id", auth, adminOnly, (req, res) => {
  db.run(
    `
    UPDATE subscriptions
    SET status='pending',
        payment_id=NULL,
        expires_at=NULL
    WHERE user_id=?
    `,
    [req.params.id],
    () => res.json({ success: true })
  );
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
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`)
);