// controllers/pdfController.js
import { processPdf } from "../services/pdfService.js";
import { analyzeText, generateContractTemplate } from "../services/aiService.js";
import { saveDocument, saveAnalysis } from "../services/dbService.js";

export const pdfController = {
  
  // ========================================
  // 1) Enviar PDF → extrair texto → IA → salvar no banco
  // ========================================
  analyzePdf: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum PDF enviado" });
      }

      // 1) Extrai texto e dados
      const { extractedText, keyData } = await processPdf(req.file.buffer);

      // 2) IA analisa o documento
      const aiResult = await analyzeText(extractedText);

      // 3) Salva documento no banco
      const documentId = await saveDocument(
        req.user?.id || null,
        req.file.originalname,
        extractedText
      );

      // 4) Salva análise no banco
      const analysisId = await saveAnalysis(documentId, aiResult);

      // 5) Resposta para frontend
      res.json({
        success: true,
        documentId,
        extractedText,
        keyData,
        aiResult,
      });

    } catch (err) {
      console.error("Erro no pdfController:", err);
      res.status(500).json({ error: "Erro ao analisar PDF" });
    }
  },

  // ========================================
  // 2) Gerar modelo de contrato a partir do PDF
  // ========================================
  generateContract: async (req, res) => {
    try {
      const { text } = req.body;

      const contract = await generateContractTemplate(text);

      res.json({ success: true, contract });

    } catch (err) {
      console.error("Erro ao gerar contrato:", err);
      res.status(500).json({ error: "Erro ao gerar contrato" });
    }
  },

};
