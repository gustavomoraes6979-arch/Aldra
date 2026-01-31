import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

async function listarModelos() {
  try {
    const res = await axios.get("https://api.groq.com/openai/v1/models", {
      headers: {
        Authorization: "Bearer " + process.env.GROQ_API_KEY
      }
    });

    console.log("Modelos disponíveis:");
    res.data.data.forEach(m => console.log(" -", m.id));

  } catch (err) {
    console.error("Erro:", err.response?.data || err.message);
  }
}

listarModelos();
