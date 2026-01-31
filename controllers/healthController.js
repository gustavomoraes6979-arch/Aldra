// controllers/healthController.js
export function healthCheck(req, res) {
  res.json({
    ok: true,
    uptime: process.uptime()
  });
}
