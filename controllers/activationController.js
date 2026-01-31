// controllers/activationController.js
import db from "../database/database.js";
import QRCode from "qrcode";

/* ============================================================
   0) GERAR PIX ESTÁTICO DA ASSINATURA (GET /activation/pix)
============================================================ */
async function getPixData(req, res) {
  try {
    const PIX_KEY = "462.047.558-03"; // sua chave real
    const MERCHANT_NAME = "AdminIA";
    const AMOUNT = "60.00"; // assinatura fixa

    // Payload copia-e-cola (sem quebras de linha)
    const payload = `
000201
26580014BR.GOV.BCB.PIX01${PIX_KEY.length}${PIX_KEY}
52040000
5303986
5406${AMOUNT}
5802BR
5909${MERCHANT_NAME}
6009SaoPaulo
62070503***`.replace(/\n/g, "");

    // Gerar QRCode base64
    const qr_base64 = await QRCode.toDataURL(payload);

    return res.json({
      copia_e_cola: payload,
      qr_base64,
      amount: AMOUNT,
      pix_key: PIX_KEY
    });

  } catch (err) {
    console.error("Erro em getPixData:", err);
    return res.status(500).json({ error: "Erro ao gerar PIX da assinatura." });
  }
}

/* ============================================================
   1) STATUS (GET /activation/status/:userId)
   - Verifica expiração automática
   - Desativa se vencido
============================================================ */
async function status(req, res) {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "Id ausente" });

    db.get(
      `
      SELECT id, active, subscription_expires
      FROM users
      WHERE id = ?
      `,
      [userId],
      (err, row) => {
        if (err) {
          console.error("DB error status:", err);
          return res.status(500).json({ error: "Erro no banco" });
        }

        if (!row)
          return res.status(404).json({ error: "Usuário não encontrado" });

        let active = row.active;
        const expires = row.subscription_expires;

        // Desativação automática se expirado
        if (expires) {
          const expDate = new Date(expires);
          const now = new Date();

          if (expDate < now) {
            active = 0;

            // Atualiza o banco automaticamente
            db.run(
              `UPDATE users SET active = 0 WHERE id = ?`,
              [userId],
              (err2) => {
                if (err2)
                  console.error("Erro ao desativar assinatura expirada:", err2);
              }
            );
          }
        }

        return res.json({
          id: row.id,
          active,
          subscription_expires: expires
        });
      }
    );
  } catch (err) {
    console.error("Status error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}

/* ============================================================
   2) CONFIRMAR PAGAMENTO (POST /activation/confirm)
   - Ativa assinatura
   - Renova cumulativamente (+30 dias)
============================================================ */
async function confirm(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Usuário inválido" });

    const today = new Date();

    db.get(
      `SELECT subscription_expires FROM users WHERE id = ?`,
      [userId],
      (err, row) => {
        if (err) {
          console.error("DB error confirm SELECT:", err);
          return res.status(500).json({ error: "Erro no banco" });
        }

        let baseDate = today;

        // Se ainda válida → soma a partir do vencimento
        if (row?.subscription_expires) {
          const expires = new Date(row.subscription_expires);

          if (!isNaN(expires) && expires > today) {
            baseDate = expires;
          }
        }

        // Novo vencimento + 30 dias
        const newExpiration = new Date(baseDate);
        newExpiration.setDate(newExpiration.getDate() + 30);

        const ISOexp = newExpiration.toISOString();

        db.run(
          `
          UPDATE users
          SET active = 1, subscription_expires = ?
          WHERE id = ?
        `,
          [ISOexp, userId],
          function (err2) {
            if (err2) {
              console.error("DB error confirm UPDATE:", err2);
              return res.status(500).json({ error: "Erro ao ativar assinatura" });
            }

            return res.json({
              message: "Assinatura ativada / renovada com sucesso",
              active: 1,
              subscription_expires: ISOexp
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Confirm error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}

/* ============================================================
   3) ATIVAÇÃO MANUAL POR ID (ADMIN)
============================================================ */
async function activateById(req, res) {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: "Id ausente" });

    const today = new Date();
    const expiration = new Date();
    expiration.setDate(today.getDate() + 30);

    const ISOexp = expiration.toISOString();

    db.run(
      `
      UPDATE users
      SET active = 1, subscription_expires = ?
      WHERE id = ?
    `,
      [ISOexp, userId],
      function (err) {
        if (err) {
          console.error("DB error activateById:", err);
          return res
            .status(500)
            .json({ error: "Erro ao ativar usuário manualmente" });
        }

        return res.json({
          message: "Usuário ativado por 30 dias",
          id: userId,
          subscription_expires: ISOexp
        });
      }
    );
  } catch (err) {
    console.error("activateById error:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
}

/* ============================================================
   EXPORTA TUDO
============================================================ */
export default {
  getPixData,
  status,
  confirm,
  activateById
};
