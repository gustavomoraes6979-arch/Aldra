// services/paymentService.js
import axios from "axios";
import crypto from "crypto";

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_API = "https://api.mercadopago.com";

/**
 * ============================================================
 * CRIAR PAGAMENTO PIX — ALDRA (FIX DEFINITIVO)
 * ============================================================
 */
export async function createMercadoPagoPayment({
  description,
  amount,
  email,
  external_reference
}) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN não configurado");
  }

  const transactionAmount = Number(Number(amount).toFixed(2));

  if (!transactionAmount || transactionAmount < 0.01) {
    throw new Error(`transaction_amount inválido: ${transactionAmount}`);
  }

  const body = {
    transaction_amount: transactionAmount,
    currency_id: "BRL",
    description,
    payment_method_id: "pix",

    installments: 1,

    external_reference: String(external_reference),

    payer: {
      email: email || `cliente_${external_reference}@aldra.com`
    },

    payment_method_options: {
      pix: {
        expires_in: 3600 // 1 hora
      }
    },

    metadata: {
      product: "assinatura_aldra",
      plan: "mensal"
    }
  };

  if (process.env.BASE_URL) {
    body.notification_url = `${process.env.BASE_URL}/api/webhook/mp`;
  }

  const idempotencyKey = crypto.randomUUID();

  try {
    const response = await axios.post(
      `${MP_API}/v1/payments`,
      body,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey
        },
        timeout: 15000
      }
    );

    const payment = response.data;

    // 🔴 GARANTIA DE PIX
    if (
      !payment.point_of_interaction ||
      !payment.point_of_interaction.transaction_data ||
      !payment.point_of_interaction.transaction_data.qr_code
    ) {
      console.error("❌ PIX criado sem QR Code:", payment);
      throw new Error("PIX não retornou QR Code");
    }

    return payment;

  } catch (err) {
    console.error("❌ ERRO MERCADO PAGO PIX");

    if (err.response?.data) {
      console.error("Status:", err.response.status);
      console.error(
        "Response:",
        JSON.stringify(err.response.data, null, 2)
      );
    } else {
      console.error(err.message);
    }

    throw new Error("Erro ao criar pagamento PIX");
  }
}

/**
 * ============================================================
 * CONSULTAR STATUS DO PAGAMENTO
 * ============================================================
 */
export async function getPaymentStatus(paymentId) {
  if (!MP_ACCESS_TOKEN) {
    throw new Error("MP_ACCESS_TOKEN não configurado");
  }

  try {
    const response = await axios.get(
      `${MP_API}/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`
        },
        timeout: 10000
      }
    );

    return response.data;

  } catch (err) {
    console.error("❌ Erro ao consultar pagamento");

    if (err.response?.data) {
      console.error(
        JSON.stringify(err.response.data, null, 2)
      );
    } else {
      console.error(err.message);
    }

    throw new Error("Erro ao consultar status do pagamento");
  }
}
