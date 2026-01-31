// routes/webhookRoutes.js

import express from "express";
import webhookController from "../controllers/webhookController.js";

const router = express.Router();

/**
 * ============================================================
 * WEBHOOK MERCADO PAGO
 * ============================================================
 * ⚠️ IMPORTANTE:
 * - NÃO usa autenticação
 * - Mercado Pago exige resposta 200
 * - Raw body salvo para validações futuras
 */
router.post(
  "/mp",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }),
  async (req, res) => {
    try {
      await webhookController.mercadoPago(req, res);
    } catch (err) {
      console.error("❌ Erro no webhook MP:", err);
      // Sempre responde 200 para evitar retry infinito
      res.sendStatus(200);
    }
  }
);

/**
 * ============================================================
 * ROTA DE TESTE (OPCIONAL)
 * ============================================================
 */
router.get("/mp", (req, res) => {
  res.json({ status: "Webhook Mercado Pago ativo" });
});

export default router;
