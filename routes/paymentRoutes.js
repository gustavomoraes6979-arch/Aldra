// routes/paymentRoutes.js

import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * ============================================================
 * AUTH JWT
 * ============================================================
 */
function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token inválido ou ausente" });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: "Token inválido ou expirado" });
  }
}

/**
 * ============================================================
 * GERAR PIX FIXO (CPF)
 * ============================================================
 * POST /api/payment/create
 */
router.post("/create", auth, async (req, res) => {
  try {
    const PIX_KEY = "46204755803"; // CPF
    const AMOUNT = "70.00";
    const MERCHANT_NAME = "ALDRA";
    const CITY = "SAO PAULO";
    const TXID = "ALDRA" + Date.now();

    /**
     * PIX Copia e Cola (formato padrão)
     */
    const pixPayload =
      `000201` +
      `26360014BR.GOV.BCB.PIX` +
      `0114${PIX_KEY}` +
      `52040000` +
      `5303986` +
      `5405${AMOUNT}` +
      `5802BR` +
      `5911${MERCHANT_NAME}` +
      `6009${CITY}` +
      `62130509${TXID}` +
      `6304`;

    res.json({
      success: true,
      pix_code: pixPayload,
      amount: AMOUNT
    });

  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

export default router;
