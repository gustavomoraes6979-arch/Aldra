// database/database.js
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "../adminia.db");
const db = new sqlite3.Database(dbPath);

// ===============================================
// 🆕 MIGRAÇÃO AUTOMÁTICA — ADICIONAR subscription_expires
// ===============================================

db.serialize(() => {
  db.get(
    "PRAGMA table_info(users)",
    (err, columns) => {
      if (err) {
        console.error("Erro ao checar colunas:", err);
        return;
      }

      // Buscar se a coluna subscription_expires já existe
      db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) {
          console.error("Erro ao listar colunas:", err);
          return;
        }

        const exists = rows.some(r => r.name === "subscription_expires");

        if (!exists) {
          console.log("🆕 Criando coluna 'subscription_expires' no banco...");
          db.run(
            "ALTER TABLE users ADD COLUMN subscription_expires TEXT DEFAULT NULL",
            (err) => {
              if (err) console.error("Erro ao criar coluna:", err);
              else console.log("✅ Coluna 'subscription_expires' criada com sucesso!");
            }
          );
        } else {
          console.log("✔️ Coluna 'subscription_expires' já existe.");
        }
      });
    }
  );
});

export default db;
