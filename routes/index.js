import express from "express";

const router = express.Router();

// Exemplo de teste
router.get("/", (req, res) => {
  res.json({ message: "API AdminIA está funcionando!" });
});

export default router;
