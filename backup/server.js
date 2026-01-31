// server.js — AdminIA 6.1 (Assinatura + PIX/Boleto + Webhook MercadoPago + Segurança)

import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";
import QRCode from "qrcode";

// Middlewares
import { auth } from "./middleware/authMiddleware.js";
import { requireSubscription } from "./middleware/subscriptionMiddleware.js";

// Rotas
import indexRoutes from "./routes/index.js";
import pdfRoutes from "./routes/pdfRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import activationRoutes from "./routes/activationRoutes.js";
import webhookMPRoutes from "./routes/webhookMP.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Arquivos públicos
app.use(express.static(path.join(__dirname, "public")));

// Página inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================================
// BANCO DE DADOS
// =====================================
const DB_PATH = path.join(__dirname, "adminia.db");
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT,
      active INTEGER DEFAULT 0,
      subscription_expires TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      filename TEXT,
      text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER,
      risks TEXT,
      alerts TEXT,
      suggestions TEXT,
      raw_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      client_name TEXT,
      client_email TEXT,
      amount REAL,
      type TEXT,
      status TEXT DEFAULT 'pending',
      external_id TEXT,
      qr_code TEXT,
      copy_paste TEXT,
      boleto_pdf TEXT,
      boleto_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ======================================================
// 🔔 WEBHOOK MERCADO PAGO (via controller)
// ======================================================
app.use("/webhook", webhookMPRoutes);

// =====================================
// ROTAS LIVRES
// =====================================
app.use("/api", indexRoutes);
app.use("/users", userRoutes);
app.use("/activation", activationRoutes);

// Página de ativação
app.get("/ativar", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "ativar.html"));
});

// =====================================
// ROTAS PROTEGIDAS (LOGIN + ASSINATURA)
// =====================================

// ⚠️ SOMENTE APIs — NÃO HTML
app.use("/pdf", auth, requireSubscription, pdfRoutes);
app.use("/ai", auth, requireSubscription, aiRoutes);
app.use("/payment", auth, requireSubscription, paymentRoutes);
app.use("/contracts", auth, requireSubscription, contractRoutes);
app.use("/billing", auth, requireSubscription, billingRoutes);

// =====================================
// DASHBOARD (HTML) — SEM AUTENTICAÇÃO AQUI
// O FRONT-END FAZ A VERIFICAÇÃO DO TOKEN
// =====================================

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// =====================================
// ASSINATURA PIX FIXO
// =====================================
app.post("/assinatura/pix", async (req, res) => {
  try {
    const PIX_KEY = "462.047.558-03";
    const MERCHANT_NAME = "AdminIA";
    const AMOUNT = "60.00";

    const payload = `
000201
26580014BR.GOV.BCB.PIX01${PIX_KEY.length}${PIX_KEY}
52040000
5303986
5406${AMOUNT}
5802BR
5909${MERCHANT_NAME}
6009SaoPaulo
62070503***`.replace(/\n/g, "");

    const qrBase64 = await QRCode.toDataURL(payload);

    res.json({
      copia_e_cola: payload,
      qr_base64: qrBase64,
      amount: AMOUNT
    });
  } catch (err) {
    console.error("Erro ao gerar PIX:", err);
    res.status(500).json({ error: "Erro ao gerar PIX da assinatura." });
  }
});

// =====================================
// INICIAR SERVIDOR
// =====================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔔 Webhook Mercado Pago ativo em: http://localhost:${PORT}/webhook/mp`);
});
