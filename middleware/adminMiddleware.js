// middleware/adminMiddleware.js

export function isAdmin(req, res, next) {
  try {
    const adminEmail = "moraes_gu@hotmail.com"; // 👉 seu e-mail admin

    if (!req.user || !req.user.email) {
      return res.status(401).json({ error: "Usuário não autenticado." });
    }

    if (req.user.email !== adminEmail) {
      return res.status(403).json({ error: "Acesso restrito ao administrador." });
    }

    next();
  } catch (err) {
    console.error("Erro no isAdmin:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
