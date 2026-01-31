// services/billingService.js
import axios from "axios";
import dotenv from "dotenv";
import db from "../database/database.js";

dotenv.config();

const MP_TOKEN = process.env.MP_ACCESS_TOKEN;

// ==============================
// AXIOS MERCADO PAGO
// ==============================
const mp = axios.create({
  baseURL: "https://api.mercadopago.com",
  headers: {
    Authorization: `Bearer ${MP_TOKEN}`,
    "Content-Type": "application/json"
  }
});

// ==============================
// IDEMPOTENCY
// ==============================
function idempotency() {
  return "idemp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 10);
}

// ==============================
// NORMALIZAR VALOR (suporta 10,00 / 10.00 / R$ 10,00)
// ==============================
function normalizeValue(value) {
  if (!value) return 0;

  return Number(
    String(value)
      .replace("R$", "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );
}

// =====================================================
// SERVICE PRINCIPAL
// =====================================================
export default {

  /* =====================================================
     GERAR PIX
  ===================================================== */
  async gerarPix({ value, name, email, user_id }) {
    const amount = normalizeValue(value);

    if (amount <= 0) throw new Error("Valor inválido. Use ex: 10.00");

    const body = {
      transaction_amount: amount,
      description: "Cobrança AdminIA",
      payment_method_id: "pix",
      payer: {
        email,
        first_name: name
      }
    };

    try {
      const res = await mp.post("/v1/payments", body, {
        headers: { "X-Idempotency-Key": idempotency() }
      });

      const trx = res.data.point_of_interaction?.transaction_data;

      if (!trx)
        throw new Error("Mercado Pago não retornou dados de PIX.");

      const data = {
        external_id: res.data.id,
        qr_code_base64: trx.qr_code_base64,
        copy_paste: trx.qr_code
      };

      // Salvar no banco
      db.run(
        `INSERT INTO billings 
        (user_id, client_name, client_email, amount, type, status, external_id, qr_code, copy_paste)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          name,
          email,
          amount,
          "pix",
          "pending",
          data.external_id,
          data.qr_code_base64,
          data.copy_paste
        ]
      );

      return {
        id: data.external_id,
        qr_code_base64: data.qr_code_base64,
        copiar_cola: data.copy_paste
      };

    } catch (err) {
      console.error("Erro PIX MercadoPago:", err.response?.data || err.message);
      throw new Error("Erro ao gerar PIX.");
    }
  },

  /* =====================================================
     GERAR BOLETO
  ===================================================== */
  async gerarBoleto({
    value,
    name,
    email,
    document,
    user_id,
    zip_code,
    street,
    number,
    neighborhood,
    city,
    state
  }) {

    const amount = normalizeValue(value);
    if (amount <= 0) throw new Error("Valor inválido. Use ex: 10.00");

    const doc = document.replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14)
      throw new Error("CPF/CNPJ inválido.");

    const type = doc.length === 11 ? "CPF" : "CNPJ";

    const nomeSplit = name.trim().split(" ");
    const first_name = nomeSplit.shift();
    const last_name = nomeSplit.join(" ") || first_name;

    // Validar endereço
    if (!zip_code || !street || !number || !neighborhood || !city || !state) {
      throw new Error("Endereço incompleto. Preencha todos os campos.");
    }

    const body = {
      transaction_amount: amount,
      description: "Cobrança AdminIA",
      payment_method_id: "bolbradesco",
      payer: {
        email,
        first_name,
        last_name,
        identification: {
          type,
          number: doc
        },
        address: {
          zip_code,
          street_name: street,
          street_number: number,
          neighborhood,
          city,
          federal_unit: state
        }
      }
    };

    try {
      const res = await mp.post("/v1/payments", body, {
        headers: { "X-Idempotency-Key": idempotency() }
      });

      const data = {
        external_id: res.data.id,
        boleto_url: res.data.transaction_details?.external_resource_url,
        barcode: res.data.barcode?.content
      };

      if (!data.boleto_url)
        throw new Error("Falha ao gerar boleto no Mercado Pago.");

      // salvar no banco
      db.run(
        `INSERT INTO billings
        (user_id, client_name, client_email, amount, type, status, external_id, boleto_pdf, boleto_code)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user_id,
          name,
          email,
          amount,
          "boleto",
          "pending",
          data.external_id,
          data.boleto_url,   // aqui está correto
          data.barcode
        ]
      );

      return data;

    } catch (err) {
      console.error("Erro Boleto MercadoPago:", err.response?.data || err.message);
      throw new Error("Erro ao gerar Boleto.");
    }
  }
};
