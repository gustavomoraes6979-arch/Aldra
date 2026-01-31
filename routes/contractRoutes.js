import express from "express";
import { createContract } from "../controllers/contractController.js";

const router = express.Router();

// ROTA: Gerar contrato
router.post("/create", createContract);

export default router;
