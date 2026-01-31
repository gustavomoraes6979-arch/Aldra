// services/pdfService.js
import fs from "fs";
import pdfParse from "pdf-parse";

// ===============================================
// Extrair texto de um PDF
// ===============================================
export async function extractTextFromPDF(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(buffer);

    return pdfData.text || "";
  } catch (err) {
    console.error("Erro ao extrair texto do PDF:", err);
    return "";
  }
}
