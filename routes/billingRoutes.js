// routes/billingRoutes.js
import express from "express";
import billingController from "../controllers/billingController.js";
import { auth } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ============================================================
   EMITIR COBRANÇA VIA PIX
   Endpoint: POST /billing/pix
   Requer token → req.user.id disponível
============================================================ */
router.post("/pix", auth, billingController.gerarPix);

/* ============================================================
   EMITIR BOLETO
   Endpoint: POST /billing/boleto
   Requer token → req.user.id disponível
============================================================ */
router.post("/boleto", auth, billingController.gerarBoleto);

export default router;
