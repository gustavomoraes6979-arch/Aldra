// middlewares/validateMercadoPagoIP.js

export function validateMercadoPagoIP(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress;

  console.log("🌐 IP recebido no webhook:", ip);

  // Prefixos conhecidos usados pelo Mercado Pago
  const allowedPrefixes = ["34.", "18."];

  const allowed = allowedPrefixes.some(prefix =>
    ip?.includes(prefix)
  );

  if (!allowed) {
    console.log("🚫 Webhook BLOQUEADO | IP não autorizado");
    return res.sendStatus(403);
  }

  next();
}
