import { generateContract } from "../services/contractService.js";

export async function createContract(req, res) {
  try {
    const { contractType, companyName, clientName, extraInfo } = req.body;

    // Verificação simples
    if (!contractType || !companyName || !clientName) {
      return res.status(400).json({
        error: "Preencha: tipo, empresa e cliente."
      });
    }

    const contractText = await generateContract({
      contractType,
      companyName,
      clientName,
      extraInfo: extraInfo || "Nenhuma informação adicional."
    });

    return res.json({
      success: true,
      contract: contractText
    });

  } catch (err) {
    console.error("Erro no contractController:", err.message);
    res.status(500).json({
      error: "Erro ao gerar contrato"
    });
  }
}
