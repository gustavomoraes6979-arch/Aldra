// routes/userRoutes.js

import express from "express";
import {
  registerUser,
  loginUser,
  getCurrentUser
} from "../controllers/userController.js";

import { auth } from "../middleware/authMiddleware.js";

const router = express.Router();

// =====================================
// AUTENTICAÇÃO (PADRÃO API)
// =====================================

// Registro
router.post("/register", registerUser);

// Login
router.post("/login", loginUser);

// Dados do usuário logado
router.get("/me", auth, getCurrentUser);

export default router;
