// =======================================
// LOGIN.JS — ALDRA (VERSÃO PROFISSIONAL)
// =======================================

// 🔥 Detecta ambiente automaticamente
const API_BASE =
  window.location.hostname.includes("localhost")
    ? "http://localhost:3000"
    : "";

// =======================================
// FUNÇÃO SEGURA JSON
// =======================================

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// =======================================
// AUTO LOGIN (IMPORTANTE)
// =======================================

async function checkAutoLogin() {

  const token = localStorage.getItem("token");

  if (!token) return;

  try {

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) return;

    const data = await res.json();

    if (data?.email) {

      // usuário já logado
      window.location.href = "/dashboard.html";

    }

  } catch (err) {

    console.warn("Auto login falhou", err);

  }

}

// executa ao carregar página
checkAutoLogin();

// =======================================
// LOGIN
// =======================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

  loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("msg");

    msg.style.color = "black";
    msg.textContent = "Aguarde...";

    if (!email || !password) {

      msg.textContent = "Preencha todos os campos.";
      msg.style.color = "red";
      return;

    }

    try {

      const res = await fetch(`${API_BASE}/auth/login`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({ email, password })

      });

      const data = await safeJson(res);

      if (!data) {

        msg.textContent = "Erro inesperado. Tente novamente.";
        msg.style.color = "red";
        return;

      }

      if (!res.ok) {

        msg.textContent = data.error || "Erro no login.";
        msg.style.color = "red";
        return;

      }

      // =======================================
      // SALVA TOKEN
      // =======================================

      localStorage.setItem("token", data.token);

      msg.textContent = "Login efetuado!";
      msg.style.color = "green";

      setTimeout(() => {

        window.location.href = "/dashboard.html";

      }, 600);

    } catch (err) {

      console.error(err);

      msg.textContent = "Erro de conexão com o servidor.";
      msg.style.color = "red";

    }

  });

}

// =======================================
// REGISTRO
// =======================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {

  registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const name = document.getElementById("regName")?.value.trim() || "";
    const email = document.getElementById("regEmail").value.trim().toLowerCase();
    const password = document.getElementById("regPassword").value.trim();
    const regMsg = document.getElementById("regMsg");

    regMsg.style.color = "black";
    regMsg.textContent = "Criando conta...";

    if (!email || !password) {

      regMsg.textContent = "Preencha todos os campos.";
      regMsg.style.color = "red";
      return;

    }

    if (password.length < 4) {

      regMsg.textContent = "A senha deve ter no mínimo 4 caracteres.";
      regMsg.style.color = "red";
      return;

    }

    try {

      const res = await fetch(`${API_BASE}/auth/register`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({ name, email, password })

      });

      const data = await safeJson(res);

      if (res.ok) {

        regMsg.textContent = "Conta criada com sucesso! Agora faça o login.";
        regMsg.style.color = "green";

        if (document.getElementById("regName"))
          document.getElementById("regName").value = "";

        document.getElementById("regEmail").value = "";
        document.getElementById("regPassword").value = "";

      } else {

        regMsg.textContent = data?.error || "Erro ao registrar.";
        regMsg.style.color = "red";

      }

    } catch (err) {

      console.error(err);

      regMsg.textContent = "Erro de conexão com o servidor.";
      regMsg.style.color = "red";

    }

  });

}