// middleware/subscriptionMiddleware.js
import db from "../database/database.js";

export const requireSubscription = (req, res, next) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Usuário não identificado" });
  }

  db.get(
    `SELECT active, subscription_expires 
     FROM users 
     WHERE id = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error("Erro no DB (requireSubscription):", err);
        return res.status(500).json({ error: "Erro interno no banco" });
      }

      if (!row) {
        return res.status(401).json({ error: "Usuário não encontrado" });
      }

      // ⚠️ VERIFICA SE A CONTA ESTÁ ATIVA
      if (row.active !== 1) {
        return res.status(403).json({
          error: "Conta inativa. Vá para /ativar para reativar sua assinatura."
        });
      }

      // ⚠️ VERIFICA DATA DE EXPIRAÇÃO
      const now = new Date();
      const expires = row.subscription_expires
        ? new Date(row.subscription_expires)
        : null;

      if (!expires || isNaN(expires.getTime())) {
        return res.status(403).json({
          error: "Sua assinatura não possui data válida. Renove em /ativar."
        });
      }

      if (expires <= now) {
        return res.status(403).json({
          error: "Sua assinatura expirou. Renove em /ativar."
        });
      }

      // 🔥 Tudo OK → libera a rota
      next();
    }
  );
};
