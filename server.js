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

dotenv.config();

// =======================================================================
// CONFIG
// =======================================================================

const ADMIN_EMAIL = "moraes_gu@hotmail.com".toLowerCase();
const PLAN_PRICE = 1;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET não definido");
if (!process.env.MP_ACCESS_TOKEN) throw new Error("MP_ACCESS_TOKEN não definido");

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN.trim(),
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

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
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

  db.run(`
  CREATE TABLE IF NOT EXISTS crm_clients(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    phone TEXT,
    email TEXT,
    pipeline_stage TEXT DEFAULT 'lead',
    deal_value REAL DEFAULT 0,
    last_contact DATETIME,
    next_followup DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`
  CREATE TABLE IF NOT EXISTS accounts(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    description TEXT,
    value REAL,
    due_date DATETIME,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`
  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    sku TEXT,
    cost REAL,
    price REAL,
    quantity INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

function adminOnly(req, res, next) {

  if (!req.user?.is_admin)
    return res.status(403).json({ error: "Admin apenas" });

  next();

}

// =======================================================================
// REGISTER
// =======================================================================

app.post("/auth/register", async (req, res) => {

  try {

    const { name, email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Dados inválidos" });

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

  } catch {

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
        : "/dashboard.html",
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
// PROTEÇÃO DO ADMIN (CRÍTICO)
// =======================================================================

app.get("/admin-dashboard.html", auth, adminOnly, (req, res) => {

  res.sendFile(path.join(PUBLIC_DIR, "admin-dashboard.html"));

});

// =======================================================================
// ADMIN API
// =======================================================================

app.get("/admin/stats", auth, adminOnly, async (req, res) => {

  const users = await dbGet(`SELECT COUNT(*) as total FROM users`);

  const subs = await dbGet(
    `SELECT COUNT(*) as active FROM subscriptions WHERE status='active'`
  );

  res.json({
    users: users.total,
    active_subscriptions: subs.active
  });

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