// middleware/authMiddleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "segredo123";

export const auth = (req, res, next) => {
  try {
    const url = req.originalUrl;

    // =====================================
    // ROTAS TOTALMENTE LIVRES
    // =====================================
    const freeRoutes = [
      "/users/login",
      "/users/register",
      "/payment/webhook",
      "/activation",
      "/assinatura/pix",
      "/api"
    ];

    // Se começar com qualquer rota livre → permitir
    if (freeRoutes.some(route => url.startsWith(route))) {
      return next();
    }

    // =====================================
    // PERMITIR ARQUIVOS ESTÁTICOS
    // =====================================
    const isStatic =
      url.match(/\.(html|css|js|png|jpg|jpeg|svg|webp|gif|ico)$/i);

    if (isStatic) {
      return next();
    }

    // =====================================
    // VERIFICA TOKEN JWT
    // =====================================
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Token ausente." });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token ausente." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Token inválido." });
    }

    // Guarda informações seguras para o restante do sistema
    req.user = {
      id: decoded.id,
      email: decoded.email || null
    };

    // =====================================
    // DASHBOARD
    // Requer apenas token válido
    // =====================================
    if (url.startsWith("/dashboard")) {
      return next();
    }

    // =====================================
    // ROTAS INTERNAS
    // subscriptionMiddleware ficará responsável pela assinatura
    // =====================================
    return next();

  } catch (err) {
    console.error("Erro no authMiddleware:", err);
    return res.status(401).json({ error: "Token inválido." });
  }
};
