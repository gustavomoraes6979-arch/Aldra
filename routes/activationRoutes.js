// routes/activationRoutes.js
import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { isAdmin } from "../middleware/adminMiddleware.js"; // ✅ ADICIONADO
import activationController from "../controllers/activationController.js";

const router = express.Router();

/**
 * ============================================================
 * 1) GERAR PIX ESTÁTICO DA ASSINATURA
 * ============================================================
 * Retorna:
 *  - código copia e cola
 *  - QRCode base64
 *  - valor fixo (R$ 60,00)
 * 
 * Rota: GET /activation/pix
 */
router.get("/pix", activationController.getPixData);

/**
 * ============================================================
 * 2) STATUS DA ASSINATURA
 * ============================================================
 * Verifica se um usuário está ativo e quando expira.
 * Usado no login, dashboard e avisos.
 * 
 * Rota: GET /activation/status/:userId
 */
router.get("/status/:userId", activationController.status);

/**
 * ============================================================
 * 3) CONFIRMAR PAGAMENTO (Usuário logado)
 * ============================================================
 * Quando o usuário clica “Já paguei”.
 * Renova +30 dias ou ativa pela primeira vez.
 * 
 * Rota: POST /activation/confirm
 * Requer token JWT
 */
router.post("/confirm", auth, activationController.confirm);

/**
 * ============================================================
 * 4) ATIVAÇÃO MANUAL (Somente ADMIN)
 * ============================================================
 * Usado apenas para testes internos ou ativação manual.
 * 
 * Rota: POST /activation/activate/:userId
 * Requer:
 *   - Token JWT válido
 *   - E-mail de administrador
 */
router.post(
  "/activate/:userId",
  auth,       // precisa estar logado
  isAdmin,    // precisa ser ADMIN
  activationController.activateById
);

export default router;
