// controllers/userController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import {
  createUser,
  findUserByEmail,
  findUserById
} from "../services/dbService.js";

// ==================================================
// REGISTER
// ==================================================
export async function registerUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Preencha todos os campos." });

    const existing = await findUserByEmail(email);
    if (existing)
      return res.status(400).json({ error: "E-mail já registrado." });

    const hashed = await bcrypt.hash(password, 10);

    // Usuário é criado inativo, igual ao server.js
    const user = await createUser({
      email,
      password: hashed,
      active: 0,
      subscription_expires: null
    });

    return res.json({
      success: true,
      message: "Usuário criado com sucesso!",
      user: {
        id: user.id,
        email,
        active: 0,
        subscription_expires: null
      }
    });

  } catch (err) {
    console.error("Erro no registerUser:", err);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
}


// ==================================================
// LOGIN
// ==================================================
export async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Preencha email e senha." });

    const user = await findUserByEmail(email);
    if (!user)
      return res.status(400).json({ error: "Usuário não encontrado." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ error: "Senha incorreta." });

    // TOKEN
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET || "segredo123",
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      token,
      active: user.active,
      subscription_expires: user.subscription_expires
    });

  } catch (err) {
    console.error("Erro no loginUser:", err);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
}


// ==================================================
// GET /users/me
// ==================================================
export async function getCurrentUser(req, res) {
  try {
    const userId = req.user?.id;

    if (!userId)
      return res.status(401).json({ error: "Token inválido." });

    const user = await findUserById(userId);
    if (!user)
      return res.status(404).json({ error: "Usuário não encontrado." });

    return res.json({
      id: user.id,
      email: user.email,
      active: user.active,
      subscription_expires: user.subscription_expires
    });

  } catch (err) {
    console.error("Erro no getCurrentUser:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
