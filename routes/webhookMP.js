// routes/webhookMP.js

import express from "express";
import webhookController from "../controllers/webhookController.js";

const router = express.Router();

/**
 * ============================================================
 * WEBHOOK MERCADO PAGO
 * ============================================================
 * - NÃO usa autenticação
 * - Precisa aceitar qualquer Content-Type
 * - Deve responder rápido (status 200)
 *
 * Endpoint público:
 * POST /webhook/mp
 */
router.post(
  "/mp",
  express.json({
    type: "*/*",
    verify: (req, res, buf) => {
      // Guarda o corpo bruto (boa prática p/ validação futura)
      req.rawBody = buf.toString();
    }
  }),
  webhookController.receberEvento
);

export default router;
