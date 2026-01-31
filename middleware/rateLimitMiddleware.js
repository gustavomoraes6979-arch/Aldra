// middleware/rateLimitMiddleware.js

// Memória temporária (reinicia quando o servidor reinicia)
const requestCounts = new Map();

export const rateLimit = (limit = 60, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip;

    const now = Date.now();
    const entry = requestCounts.get(ip) || { count: 0, start: now };

    // Expira janela
    if (now - entry.start >= windowMs) {
      entry.count = 0;
      entry.start = now;
    }

    entry.count += 1;
    requestCounts.set(ip, entry);

    if (entry.count > limit) {
      return res.status(429).json({
        error: "Limite de requisições excedido. Aguarde alguns segundos."
      });
    }

    next();
  };
};
