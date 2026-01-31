import express from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import fs from "fs";
import axios from "axios";
import path from "path";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Torna a pasta public acessível
app.use(express.static("public"));

// ✅ Multer (upload) — opcional
const upload = multer({ dest: "uploads/" });

// ✅ Funções simples
function extractCNPJs(text) {
  const regex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
  return text.match(regex) || [];
}

function extractDates(text) {
  const regex = /\d{2}\/\d{2}\/\d{4}/g;
  return text.match(regex) || [];
}

function extractValues(text) {
  const regex = /R\$ ?\d+(\.\d{3})*,\d{2}/g;
  return text.match(regex) || [];
}

// ✅ OCR + IA
app.post("/analyze", upload.single("document"), async (req, res) => {
  try {
    let extractedText = "";

    // ✅ Se veio arquivo → faz OCR
    if (req.file) {
      console.log("📄 Iniciando OCR...");
      const ocrResult = await Tesseract.recognize(req.file.path, "por", {
        logger: (m) => console.log(m),
      });

      extractedText = ocrResult.data.text;
      console.log("✅ OCR concluído!");
    }

    // ✅ Se não veio OCR, tenta pegar texto via JSON
    if (!extractedText && req.body?.text) {
      extractedText = req.body.text;
      console.log("ℹ️ Usando texto enviado via JSON");
    }

    if (!extractedText) {
      return res
        .status(400)
        .json({ error: "Nenhum texto encontrado (arquivo ou 'text')" });
    }

    // ✅ Extrações básicas
    const keyData = {
      cnpjs: extractCNPJs(extractedText),
      dates: extractDates(extractedText),
      values: extractValues(extractedText),
    };

    let aiResult = {};

    try {
      console.log("🤖 Enviando para análise IA Groq…");

      const groqResponse = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "Você é um analista especialista. Extraia riscos, alertas e sugestões.",
            },
            { role: "user", content: extractedText },
          ],
          max_tokens: 200,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
        }
      );

      aiResult = groqResponse.data.choices[0].message.content;
    } catch (analysisError) {
      console.log("❌ Erro IA:", analysisError);
      aiResult = { error: "Falha na IA" };
    }

    // ✅ Salva result
    const outputDir = "public/data";
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const resultData = {
      extractedText,
      keyData,
      aiResult,
      createdAt: new Date(),
    };

    fs.writeFileSync(
      path.join(outputDir, "latest.json"),
      JSON.stringify(resultData, null, 2)
    );

    console.log("✅ Salvo em public/data/latest.json");

    res.json(resultData);
  } catch (error) {
    console.error("ERRO GERAL:", error);
    res.status(500).json({ error: "Erro no processamento" });
  }
});

// ✅ Servidor
app.listen(3000, () => {
  console.log("✅ Servidor rodando em http://localhost:3000");
});
