// controllers/webhookController.js

import axios from "axios";
import sqlite3 from "sqlite3";

// ==============================
// DATABASE
// ==============================
const db = new sqlite3.Database("./adminIA.db");

// ==============================
// MERCADO PAGO CONFIG
// ==============================
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;

const mp = axios.create({
  baseURL: "https://api.mercadopago.com",
  headers: {
    Authorization: `Bearer ${MP_TOKEN}`,
    "Content-Type": "application/json"
  }
});

export default {

  /**
   * ============================================================
   * WEBHOOK MERCADO PAGO (PIX)
   * ============================================================
   * - Atualiza cobrança
   * - Ativa / renova assinatura
   * - Idempotente
   * - Sempre responde 200
   */
  async mercadoPago(req, res) {
    try {
      console.log("📩 Webhook Mercado Pago recebido:");
      console.log(JSON.stringify(req.body, null, 2));

      // ============================================================
      // 1️⃣ IDENTIFICAR PAYMENT ID
      // ============================================================
      const paymentId =
        req.body?.data?.id ||
        req.body?.data?.payment?.id ||
        null;

      if (!paymentId) {
        console.log("⚠ Evento ignorado (sem paymentId)");
        return res.sendStatus(200);
      }

      // ============================================================
      // 2️⃣ CONSULTAR PAGAMENTO NO MERCADO PAGO
      // ============================================================
      const mpRes = await mp.get(`/v1/payments/${paymentId}`);
      const payment = mpRes.data;

      const status = payment.status; // approved | pending | rejected
      const userId = payment.external_reference; // 🔑 vínculo correto

      console.log(`💳 Pagamento ${paymentId} | Status: ${status}`);
      console.log(`👤 User ID (external_reference): ${userId}`);

      if (!userId) {
        console.log("⚠ Pagamento sem external_reference");
        return res.sendStatus(200);
      }

      // ============================================================
      // 3️⃣ BUSCAR COBRANÇA
      // ============================================================
      const billing = await new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM billings WHERE external_id = ?`,
          [paymentId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Se não existir billing, cria (fallback seguro)
      if (!billing) {
        console.log("ℹ Cobrança não encontrada, criando registro");

        await new Promise((resolve, reject) => {
          db.run(
            `
            INSERT INTO billings (user_id, external_id, status, amount, created_at)
            VALUES (?, ?, ?, ?, ?)
            `,
            [
              userId,
              paymentId,
              status,
              payment.transaction_amount || 0,
              new Date().toISOString()
            ],
            err => (err ? reject(err) : resolve())
          );
        });
      }

      // ============================================================
      // 4️⃣ IDEMPOTÊNCIA
      // ============================================================
      if (billing && billing.status === "approved") {
        console.log("ℹ Cobrança já processada");
        return res.sendStatus(200);
      }

      // ============================================================
      // 5️⃣ ATUALIZAR STATUS DA COBRANÇA
      // ============================================================
      await new Promise((resolve, reject) => {
        db.run(
          `
          UPDATE billings
          SET status = ?
          WHERE external_id = ?
          `,
          [status, paymentId],
          err => (err ? reject(err) : resolve())
        );
      });

      // ============================================================
      // 6️⃣ SE NÃO APROVADO → ENCERRA
      // ============================================================
      if (status !== "approved") {
        console.log("ℹ Pagamento ainda não aprovado");
        return res.sendStatus(200);
      }

      // ============================================================
      // 7️⃣ ATIVAR / RENOVAR ASSINATURA
      // ============================================================
      const user = await new Promise((resolve, reject) => {
        db.get(
          `
          SELECT subscription_expires_at
          FROM users
          WHERE id = ?
          `,
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        console.log("❌ Usuário não encontrado:", userId);
        return res.sendStatus(200);
      }

      const now = new Date();
      let baseDate = now;

      if (user.subscription_expires_at) {
        const exp = new Date(user.subscription_expires_at);
        if (exp > now) baseDate = exp;
      }

      const newExpire = new Date(baseDate);
      newExpire.setDate(newExpire.getDate() + 30);

      await new Promise((resolve, reject) => {
        db.run(
          `
          UPDATE users
          SET subscription_status = 'active',
              subscription_expires_at = ?
          WHERE id = ?
          `,
          [newExpire.toISOString(), userId],
          err => (err ? reject(err) : resolve())
        );
      });

      console.log(
        `🎉 Assinatura do usuário ${userId} ativa até ${newExpire.toISOString()}`
      );

      return res.sendStatus(200);

    } catch (err) {
      console.error(
        "❌ ERRO NO WEBHOOK:",
        err.response?.data || err.message
      );

      // ⚠️ SEMPRE 200 PARA EVITAR RETRY INFINITO
      return res.sendStatus(200);
    }
  }

};
