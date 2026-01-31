// controllers/billingController.js
import billingService from "../services/billingService.js";

export default {

  /* ============================================================
     GERAR PIX
  ============================================================ */
  async gerarPix(req, res) {
    try {
      if (!req.user || !req.user.id)
        return res.status(401).json({ error: "Usuário não autenticado." });

      const { value, name, email } = req.body;

      // -----------------------------
      // Validações
      // -----------------------------
      if (!name || !email || !value)
        return res.status(400).json({ error: "Preencha nome, email e valor." });

      const valorNum = Number(value);
      if (isNaN(valorNum) || valorNum <= 0)
        return res.status(400).json({ error: "Valor inválido." });

      // -----------------------------
      // Criar PIX
      // -----------------------------
      const pix = await billingService.gerarPix({
        value: valorNum,
        name,
        email,
        user_id: req.user.id
      });

      return res.json(pix);

    } catch (err) {
      console.error("Erro em gerarPix:", err);
      return res.status(500).json({ error: "Erro ao gerar PIX: " + err.message });
    }
  },


  /* ============================================================
     GERAR BOLETO
  ============================================================ */
  async gerarBoleto(req, res) {
    try {
      if (!req.user || !req.user.id)
        return res.status(401).json({ error: "Usuário não autenticado." });

      const {
        value,
        name,
        email,
        document,
        zip_code,
        street,
        number,
        neighborhood,
        city,
        state
      } = req.body;

      // -----------------------------
      // Validações
      // -----------------------------
      if (
        !name || !email || !document ||
        !zip_code || !street || !number ||
        !neighborhood || !city || !state ||
        !value
      ) {
        return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
      }

      const valorNum = Number(value);
      if (isNaN(valorNum) || valorNum <= 0)
        return res.status(400).json({ error: "Valor inválido." });

      // -----------------------------
      // Criar BOLETO
      // -----------------------------
      const boleto = await billingService.gerarBoleto({
        value: valorNum,
        name,
        email,
        document,
        zip_code,
        street,
        number,
        neighborhood,
        city,
        state,
        user_id: req.user.id
      });

      return res.json(boleto);

    } catch (err) {
      console.error("Erro em gerarBoleto:", err);
      return res.status(500).json({ error: "Erro ao gerar boleto: " + err.message });
    }
  }

};
