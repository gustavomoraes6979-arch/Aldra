// controllers/aiController.js

import {
  analyzeText,
  rewriteProfessional,
  explainContract,
  generateContractTemplate
} from "../services/aiService.js";

// ===============================
// ANALISAR TEXTO
// ===============================
export async function analyze(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto não enviado." });
    }

    const result = await analyzeText(text);
    res.json({ aiResult: result });

  } catch (err) {
    console.error("Erro ao analisar texto:", err);
    res.status(500).json({ error: "Erro ao analisar texto" });
  }
}

// ===============================
// EXPLICAR CONTRATO
// ===============================
export async function explain(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto não enviado." });
    }

    const result = await explainContract(text);
    res.json({ explanation: result });

  } catch (err) {
    console.error("Erro ao explicar contrato:", err);
    res.status(500).json({ error: "Erro ao explicar contrato" });
  }
}

// ===============================
// REESCRITA PROFISSIONAL
// ===============================
export async function rewrite(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto não enviado." });
    }

    const result = await rewriteProfessional(text);
    res.json({ rewritten: result });

  } catch (err) {
    console.error("Erro ao reescrever:", err);
    res.status(500).json({ error: "Erro ao reescrever texto" });
  }
}

// ===============================
// GERAR CONTRATO
// ===============================
export async function generateContract(req, res) {
  try {
    const { contractType, companyName, clientName, extraInfo } = req.body;

    if (!contractType || !companyName || !clientName) {
      return res.status(400).json({ error: "Campos obrigatórios não enviados." });
    }

    const contract = await generateContractTemplate(
      contractType,
      companyName,
      clientName,
      extraInfo || ""
    );

    res.json({ contract });

  } catch (err) {
    console.error("Erro ao gerar contrato:", err);
    res.status(500).json({ error: "Erro ao gerar contrato" });
  }
}
