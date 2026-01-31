// controllers/paymentController.js

import {
  createMercadoPagoPayment,
  getPaymentStatus
} from "../services/paymentService.js";
import sqlite3 from "sqlite3";

const db = new sqlite3.Database("./adminIA.db");

// ==================================================
// CONFIG
// ==================================================
const SUBSCRIPTION_AMOUNT = 70;
const SUBSCRIPTION_DAYS = 30;

// ==================================================
// CRIAR PAGAMENTO PIX
// POST /api/payment/create
// ==================================================
export async function createPayment(req, res) {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email;

    // 1️⃣ Verificar cobrança pendente
    const existing = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT external_id, status
        FROM billings
        WHERE user_id = ?
          AND status IN ('pending', 'in_process')
        ORDER BY id DESC
        LIMIT 1
        `,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (existing) {
      return res.json({
        status: existing.status,
        message: "Já existe um pagamento em andamento."
      });
    }

    // 2️⃣ Criar pagamento no Mercado Pago
    const payment = await createMercadoPagoPayment({
      description: "Assinatura Mensal Aldra",
      amount: SUBSCRIPTION_AMOUNT,
      email: userEmail,
      external_reference: String(userId)
    });

    // 🔴 VALIDAÇÃO CRÍTICA DO PIX
    const pixData =
      payment?.point_of_interaction?.transaction_data;

    if (!pixData?.qr_code || !pixData?.qr_code_base64) {
      console.error("❌ PIX não retornado pelo Mercado Pago:", payment);
      return res.status(500).json({
        error: "Mercado Pago não retornou o QR Code do PIX"
      });
    }

    // 3️⃣ Registrar cobrança
    db.run(
      `
      INSERT INTO billings (
        user_id,
        external_id,
        status,
        amount,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        userId,
        payment.id,
        payment.status,
        SUBSCRIPTION_AMOUNT,
        new Date().toISOString()
      ]
    );

    // 4️⃣ Retornar PIX (GARANTIDO)
    return res.json({
      paymentId: payment.id,
      status: payment.status,
      qr_code: pixData.qr_code,
      qr_code_base64: pixData.qr_code_base64
    });

  } catch (err) {
    console.error("❌ Erro no createPayment:", err);
    res.status(500).json({ error: err.message || "Erro ao gerar pagamento PIX" });
  }
}

// ==================================================
// CONSULTAR STATUS DO PAGAMENTO
// GET /api/payment/status/:paymentId
// ==================================================
export async function checkPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;

    // 1️⃣ Buscar cobrança
    const billing = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT status
        FROM billings
        WHERE external_id = ? AND user_id = ?
        `,
        [paymentId, userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    if (!billing) {
      return res.status(404).json({ error: "Pagamento não encontrado" });
    }

    if (billing.status === "approved") {
      return res.json({ status: "approved" });
    }

    // 2️⃣ Consultar Mercado Pago
    const payment = await getPaymentStatus(paymentId);
    const status = payment.status;

    // 3️⃣ Atualizar status
    db.run(
      `
      UPDATE billings
      SET status = ?
      WHERE external_id = ? AND user_id = ?
      `,
      [status, paymentId, userId]
    );

    if (status !== "approved") {
      return res.json({ status });
    }

    // ==================================================
    // 4️⃣ ATIVAR ASSINATURA
    // ==================================================
    const user = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT subscription_expires_at
        FROM users
        WHERE id = ?
        `,
        [userId],
        (err, row) => (err ? reject(err) : resolve(row))
      );
    });

    const now = new Date();
    let baseDate = now;

    if (user?.subscription_expires_at) {
      const expire = new Date(user.subscription_expires_at);
      if (expire > now) baseDate = expire;
    }

    const newExpire = new Date(baseDate);
    newExpire.setDate(newExpire.getDate() + SUBSCRIPTION_DAYS);

    db.run(
      `
      UPDATE users
      SET subscription_status = 'active',
          subscription_expires_at = ?
      WHERE id = ?
      `,
      [newExpire.toISOString(), userId]
    );

    console.log(
      `✅ Assinatura ativada: usuário ${userId} até ${newExpire.toISOString()}`
    );

    return res.json({ status: "approved" });

  } catch (err) {
    console.error("❌ Erro ao verificar pagamento:", err);
    res.status(500).json({ error: "Erro ao verificar pagamento" });
  }
}
