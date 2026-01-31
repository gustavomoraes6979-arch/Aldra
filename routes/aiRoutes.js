// routes/aiRoutes.js
import express from "express";

import {
  analyze,
  explain,
  rewrite,
  generateContract
} from "../controllers/aiController.js";

import { auth } from "../middleware/authMiddleware.js"; 
import { requireSubscription } from "../middleware/subscriptionMiddleware.js";

const router = express.Router();

// ============================================================
// TODAS AS ROTAS DE IA AGORA SÃO PROTEGIDAS
// (login obrigatório + assinatura ativa)
// ============================================================

router.post("/analyze", auth, requireSubscription, analyze);
router.post("/explain", auth, requireSubscription, explain);
router.post("/rewrite", auth, requireSubscription, rewrite);
router.post("/generate-contract", auth, requireSubscription, generateContract);

export default router;
