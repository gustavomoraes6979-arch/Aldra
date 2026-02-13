// =======================================================================
// Aldra — server.js (PRODUCTION STABLE)
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
const ADMIN_EMAIL = "moraes_gu@hotmail.com";

if (!process.env.JWT_SECRET) {
  console.error("❌ JWT_SECRET não definido");
  process.exit(1);
}

if (!process.env.MP_ACCESS_TOKEN) {
  console.error("❌ MP_ACCESS_TOKEN não definido");
  process.exit(1);
}

if (!process.env.BASE_URL) {
  console.error("❌ BASE_URL não definido");
  process.exit(1);
}

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
      password TEXT,
      role TEXT DEFAULT 'user'
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

  // Garante admin sempre
  db.get(`SELECT * FROM users WHERE email=?`, [ADMIN_EMAIL], (err, user) => {
    if (!user) return;

    db.run(`UPDATE users SET role='admin' WHERE email=?`, [ADMIN_EMAIL]);
  });
});

// =======================================================================
// MIDDLEWARES
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

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito" });
  }
  next();
}

// =======================================================================
// AUTH
// =======================================================================
app.post("/auth/register", (req, res) => {
  const { name = "", email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const role = email === ADMIN_EMAIL ? "admin" : "user";

  db.run(
    `INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)`,
    [name, email, hash, role],
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

    const token = jwt.sign(
      { id: u.id, role: u.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, role: u.role });
  });
});

// =======================================================================
// ADMIN
// =======================================================================
app.get("/admin/stats", auth, adminOnly, (req, res) => {
  db.get(`SELECT COUNT(*) as total FROM users`, [], (_, users) => {
    db.get(`SELECT COUNT(*) as total FROM subscriptions WHERE status='active'`, [], (_, active) => {
      db.get(`SELECT COUNT(*) as total FROM subscriptions WHERE status='pending'`, [], (_, pending) => {

        const receita = active.total * 70;

        res.json({
          users: users.total,
          active: active.total,
          pending: pending.total,
          receita_mensal: receita
        });

      });
    });
  });
});

app.get("/admin/users", auth, adminOnly, (req, res) => {
  db.all(`
    SELECT users.id, users.name, users.email, users.role,
    subscriptions.status
    FROM users
    LEFT JOIN subscriptions ON users.id = subscriptions.user_id
    ORDER BY users.id DESC
  `, [], (_, rows) => {
    res.json(rows);
  });
});

app.post("/admin/cancel/:id", auth, adminOnly, (req, res) => {
  db.run(
    `UPDATE subscriptions SET status='pending' WHERE user_id=?`,
    [req.params.id],
    () => res.json({ success: true })
  );
});

app.post("/admin/promote/:id", auth, adminOnly, (req, res) => {
  db.run(
    `UPDATE users SET role='admin' WHERE id=?`,
    [req.params.id],
    () => res.json({ success: true })
  );
});

// =======================================================================
// PIX
// =======================================================================
app.post("/api/create-pix", auth, async (req, res) => {
  try {
    const response = await payment.create({
      body: {
        transaction_amount: 70,
        description: "Plano Mensal Aldra",
        payment_method_id: "pix",
        payer: {
          email: req.user.id + "@aldra.com"
        },
        notification_url: `${process.env.BASE_URL}/api/webhook`
      }
    });

    res.json({
      qr_code: response.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: response.point_of_interaction.transaction_data.qr_code_base64
    });

  } catch (error) {
    console.error("Erro PIX:", error);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

// =======================================================================
// WEBHOOK
// =======================================================================
app.post("/api/webhook", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const result = await payment.get({ id: paymentId });

    if (result.status === "approved") {
      const userId = parseInt(result.payer.email.split("@")[0]);

      db.run(`
        UPDATE subscriptions
        SET status='active',
        expires_at=datetime('now','+30 days')
        WHERE user_id=?
      `, [userId]);
    }

    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// =======================================================================
// STATIC + FALLBACK (EXPRESS 4 SAFE)
// =======================================================================
app.use(express.static(PUBLIC_DIR));

app.get("/*", (_, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// =======================================================================
app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});
