// services/dbService.js
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// ========================================
// PATH DO BANCO (mesmo do server.js)
// ========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "database.db");
const db = new sqlite3.Database(DB_PATH);

// ========================================
// USERS
// ========================================
export function createUser({ email, password, active, subscription_expires }) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO users (email, password, active, subscription_expires)
      VALUES (?, ?, ?, ?)
      `,
      [email, password, active, subscription_expires],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      }
    );
  });
}

export function findUserByEmail(email) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM users WHERE email = ?`,
      [email],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

export function findUserById(id) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM users WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

// ========================================
// DOCUMENTOS
// ========================================
export function saveDocument(user_id, filename, text) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO documents (user_id, filename, text)
      VALUES (?, ?, ?)
      `,
      [user_id, filename, text],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      }
    );
  });
}

// ========================================
// ANÁLISES
// ========================================
export function saveAnalysis(document_id, risks, alerts, suggestions, raw_json) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO analyses (document_id, risks, alerts, suggestions, raw_json)
      VALUES (?, ?, ?, ?, ?)
      `,
      [document_id, risks, alerts, suggestions, raw_json],
      function (err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      }
    );
  });
}

export default db;
