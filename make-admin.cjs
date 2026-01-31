const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./adminIA.db");

db.serialize(() => {
  db.run(
    "ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'",
    err => {
      if (err) console.log("ℹ️ Coluna role já existia");
      else console.log("✅ Coluna role criada");
    }
  );

  db.run(
    "UPDATE users SET role='admin' WHERE email='moraes_gu@hotmail.com'",
    function (err) {
      if (err) console.error(err);
      else console.log("🚀 Usuário promovido a ADMIN");
    }
  );
});

db.close();
