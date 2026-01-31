// routes/pdfRoutes.js
import express from "express";
import multer from "multer";
import { extractTextFromPDF } from "../services/pdfService.js";
import { analyzeText } from "../services/aiService.js";
import { saveDocument, saveAnalysis } from "../services/dbService.js";

import { auth } from "../middleware/authMiddleware.js";          
import { requireSubscription } from "../middleware/subscriptionMiddleware.js"; 

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// ==========================================
// POST /pdf/analyze — Upload + IA
// (PROTEGIDO: login + assinatura válida)
// ==========================================
router.post(
  "/analyze",
  auth,                     // 🔒 exige token válido
  requireSubscription,      // 🔒 exige assinatura válida
  upload.single("file"),    // upload do PDF
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      // 1 — Extrair texto do PDF
      const extractedText = await extractTextFromPDF(req.file.path);

      // 2 — Enviar texto à IA
      const aiResult = await analyzeText(extractedText);

      // 3 — Identificar dados relevantes
      const keyData = {
        qtd_caracteres: extractedText.length,
        qtd_palavras: extractedText.split(/\s+/).length,
        possui_cpf: extractedText.includes("CPF"),
        possui_cnpj: extractedText.includes("CNPJ")
      };

      // 4 — Salvar o documento
      const docId = await saveDocument(
        req.user.id,
        req.file.originalname,
        extractedText
      );

      // 5 — Salvar análise
      await saveAnalysis(
        docId,
        JSON.stringify(aiResult.risks || []),
        JSON.stringify(aiResult.alerts || []),
        JSON.stringify(aiResult.suggestions || []),
        JSON.stringify(aiResult)
      );

      return res.json({
        extractedText,
        keyData,
        aiResult
      });

    } catch (err) {
      console.error("PDF analysis error:", err);
      return res.status(500).json({
        error: "Erro ao processar PDF.",
        details: err.message
      });
    }
  }
);

export default router;
