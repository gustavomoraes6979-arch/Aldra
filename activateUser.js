// activateUser.js
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "adminia.db");
const db = new sqlite3.Database(DB_PATH);

const email = "moraes_gu@hotmail.com"; // coloque o email do usuário que quer ativar
const subscriptionDurationDays = 30; // tempo da assinatura

const now = new Date();
const expires = new Date(now.getTime() + subscriptionDurationDays * 24 * 60 * 60 * 1000);

db.run(
  `UPDATE users SET active = 1, subscription_expires = ? WHERE email = ?`,
  [expires.toISOString(), email],
  function (err) {
    if (err) {
      console.error("Erro ao ativar usuário:", err);
    } else if (this.changes === 0) {
      console.log("Usuário não encontrado!");
    } else {
      console.log(`Usuário ${email} ativado com sucesso! Expira em ${expires}`);
    }
    db.close();
  }
);
