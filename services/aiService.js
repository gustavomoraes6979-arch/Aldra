// services/aiService.js
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ===============================
// 1 — ANALISAR TEXTO
// ===============================
export async function analyzeText(text) {
  const prompt = `
Você é uma IA jurídica administrativa. Analise o texto abaixo e retorne:

{
  "riscos": [...],
  "alertas": [...],
  "sugestoes": [...]
}

TEXTO: """${text}"""
  `;

  const response = await client.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: prompt }]
  });

  return safeJSON(response.choices[0].message.content);
}

// ===============================
// 2 — REESCRITA PROFISSIONAL
// ===============================
export async function rewriteProfessional(text) {
  const prompt = `
Reescreva o texto abaixo com uma linguagem profissional, clara, objetiva e formal.

Texto original:
"""${text}"""
  `;

  const response = await client.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: prompt }]
  });

  return response.choices[0].message.content;
}

// ===============================
// 3 — EXPLICAR CONTRATO
// ===============================
export async function explainContract(text) {
  const prompt = `
Explique o contrato abaixo como se fosse para um leigo entender,
sem perder detalhes importantes. Liste:

- Resumo geral
- Pontos críticos
- Obrigações das partes
- Prazos relevantes
- Riscos escondidos
- Recomendações finais

CONTRATO:
"""${text}"""
  `;

  const response = await client.chat.completions.create({
    model: "llama3-8b-8192",
    messages: [{ role: "user", content: prompt }]
  });

  return response.choices[0].message.content;
}

// ===============================
// 4 — GERAR CONTRATO
// ===============================
export async function generateContractTemplate(type, company, client, extra) {
  const prompt = `
Gere um contrato COMPLETO e PROFISSIONAL do tipo: "${type}"

Empresa contratante: ${company}
Cliente / contratado: ${client}

Informações adicionais:
${extra}

❗ IMPORTANTE:
- O contrato deve ser bem formatado.
- O contrato deve conter cláusulas reais.
- Nunca invente dados sensíveis.
- Não coloque aspas ou markdown.

Agora gere o contrato completo:
  `;

  const response = await client.chat.completions.create({
    model: "llama3-70b-8192",
    messages: [{ role: "user", content: prompt }]
  });

  return response.choices[0].message.content;
}

// ===============================
// FUNÇÃO DE PARSE SEGURO (JSON)
// ===============================
function safeJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: "IA não retornou JSON válido", raw: text };
  }
}
