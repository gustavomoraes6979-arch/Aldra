import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export async function generateContract(data) {
  const { contractType, companyName, clientName, extraInfo } = data;

  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY não configurada no .env");
  }

  const prompt = `
Você é uma IA especializada em gerar contratos jurídicos profissionais.
Gere um contrato COMPLETO, claro, objetivo, seguindo normas brasileiras.

Dados recebidos:

- Tipo de contrato: ${contractType}
- Empresa contratante: ${companyName}
- Cliente / Contratado: ${clientName}
- Informações adicionais: ${extraInfo}

Gere o contrato em linguagem formal jurídica, com:

 • Título
 • Identificação das partes
 • Objeto do contrato
 • Obrigações da contratante
 • Obrigações da contratada
 • Preço / forma de pagamento (se aplicável)
 • Prazos
 • Rescisão
 • Foro
 • Assinaturas

Retorne APENAS o texto do contrato, sem explicações.
  `;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 2000
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err) {
    console.error("Erro ao gerar contrato:", err.response?.data || err);
    throw new Error("Falha ao gerar contrato");
  }
}
