// =======================================================================
// Aldra — server.js (VERSÃO COMPLETA + PIX ATIVO)
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
// AUTH MIDDLEWARE
// =======================================================================

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    db.get(
      `SELECT * FROM users WHERE id = ?`,
      [decoded.id],
      (err, user) => {
        if (err) {
          console.error("Erro DB auth:", err);
          return res.status(500).json({ error: "Erro interno" });
        }

        if (!user) {
          return res.status(401).json({ error: "Usuário inválido" });
        }

        req.user = user;
        req.user.is_admin = user.email === ADMIN_EMAIL;
        next();
      }
    );
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// =======================================================================
// 🔥 SUBSCRIPTION STATUS (NOVA)
// =======================================================================

app.get("/subscription/status", auth, (req, res) => {
  db.get(
    `SELECT * FROM subscriptions WHERE user_id = ?`,
    [req.user.id],
    (err, sub) => {
      if (err) {
        console.error("Erro subscription status:", err);
        return res.status(500).json({ error: "Erro interno" });
      }

      if (!sub) {
        return res.json({ status: "pending" });
      }

      res.json({
        status: sub.status,
        payment_id: sub.payment_id || null,
      });
    }
  );
});

// =======================================================================
// 🔥 CRIAR PIX (NOVA)
// =======================================================================

app.post("/subscription/create", auth, async (req, res) => {
  try {
    // verifica se já tem assinatura ativa
    const sub = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM subscriptions WHERE user_id=?`,
        [req.user.id],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (sub?.status === "active") {
      return res.json({ status: "active" });
    }

    // cria pagamento PIX
    const mpPayment = await payment.create({
      body: {
        transaction_amount: PLAN_PRICE,
        description: "Aldra — Plano Mensal",
        payment_method_id: "pix",
        payer: {
          email: req.user.email,
        },
      },
    });

    const tx = mpPayment.point_of_interaction?.transaction_data;

    // salva no banco
    db.run(
      `UPDATE subscriptions
       SET payment_id=?, status='pending'
       WHERE user_id=?`,
      [mpPayment.id, req.user.id]
    );

    // 🔥 RETORNA NO FORMATO QUE SEU DASHBOARD ESPERA
    res.json({
      status: "pending",
      point_of_interaction: {
        transaction_data: {
          qr_code_base64: tx?.qr_code_base64,
          qr_code: tx?.qr_code,
        },
      },
    });
  } catch (error) {
    console.error("Erro criar PIX:", error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// =======================================================================
// ========================== ADMIN ROTAS ================================
// =======================================================================

// (todo seu admin permanece IGUAL — não mexi)

// STATS
app.get("/admin/stats", auth, (req, res, next) => {
  if (!req.user?.is_admin) return res.status(403).json({ error: "Acesso restrito" });
  next();
}, (req, res) => {
  db.get(`SELECT COUNT(*) as total FROM users`, (err, totalUsers) => {
    if (err) return res.status(500).json({ error: "Erro stats users" });

    db.get(
      `SELECT COUNT(*) as active FROM subscriptions WHERE status='active'`,
      (err2, activeUsers) => {
        if (err2) return res.status(500).json({ error: "Erro stats active" });

        db.get(
          `SELECT COUNT(*) as pending FROM subscriptions WHERE status='pending'`,
          (err3, pendingUsers) => {
            if (err3)
              return res.status(500).json({ error: "Erro stats pending" });

            const receita = (activeUsers?.active || 0) * PLAN_PRICE;

            res.json({
              users: totalUsers?.total || 0,
              active: activeUsers?.active || 0,
              pending: pendingUsers?.pending || 0,
              receita_mensal: receita,
            });
          }
        );
      }
    );
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
// START
// =======================================================================

app.listen(PORT, () => {
  console.log(`🚀 Aldra ONLINE na porta ${PORT}`);
});