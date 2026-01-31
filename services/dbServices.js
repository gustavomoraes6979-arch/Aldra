// services/dbService.js
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// Caminho correto para o banco SQLite
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "adminia.db");

// Abrir conexão
const db = new sqlite3.Database(DB_PATH);

// ======================================
// SALVAR DOCUMENTO
// ======================================
export function saveDocument(userId, filename, text) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO documents (user_id, filename, text) VALUES (?, ?, ?)`,
      [userId, filename, text],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// ======================================
// SALVAR ANÁLISE
// ======================================
export function saveAnalysis(documentId, aiResult) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO analyses (document_id, risks, alerts, suggestions, raw_json)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        documentId,
        JSON.stringify(aiResult.risks),
        JSON.stringify(aiResult.alerts),
        JSON.stringify(aiResult.suggestions),
        JSON.stringify(aiResult),
      ],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

// ======================================
// LISTAR DOCUMENTOS DO USUÁRIO
// ======================================
export function listUserDocuments(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM documents WHERE user_id = ? ORDER BY id DESC`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

// ======================================
// PEGAR UMA ANÁLISE ESPECÍFICA
// ======================================
export function getAnalysisByDocument(documentId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM analyses WHERE document_id = ?`,
      [documentId],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

export default {
  saveDocument,
  saveAnalysis,
  listUserDocuments,
  getAnalysisByDocument,
};
