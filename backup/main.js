// main.js — Autenticação + assinatura + sincronização automática

// Helper
function $(sel) {
  return document.querySelector(sel);
}

// Elementos
const registerBtn = $("#registerBtn");
const loginBtn = $("#loginBtn");
const createPaymentBtn = $("#createPaymentBtn");

const authSection = $("#authSection");
const afterLogin = $("#afterLogin");
const msg = $("#msg");

// =======================================================
// ⭐ Atualizar header
// =======================================================
function updateHeader() {
  const u = JSON.parse(localStorage.getItem("adminia_user") || "{}");

  const headerUser = $("#headerUser");
  const logoutBtn = $("#headerLogout");

  if (headerUser) headerUser.innerText = u?.name || "Convidado";
  if (logoutBtn) logoutBtn.style.display = u?.name ? "inline-flex" : "none";
}

// =======================================================
// ⭐ REGISTRO
// =======================================================
registerBtn?.addEventListener("click", async () => {
  const name = $("#name")?.value?.trim();
  const email = $("#email")?.value?.trim();
  const password = $("#password")?.value?.trim();

  if (!name || !email || !password) {
    msg.innerText = "Preencha todos os campos.";
    msg.style.color = "var(--danger)";
    return;
  }

  const res = await fetch("/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password })
  });

  const j = await res.json();
  msg.style.color = res.ok ? "green" : "var(--danger)";
  msg.innerText = res.ok ? "Registrado com sucesso! Faça login." : j.error;
});

// =======================================================
// ⭐ LOGIN — sincroniza assinatura + expiração
// =======================================================
loginBtn?.addEventListener("click", async () => {
  const email = $("#email")?.value?.trim();
  const password = $("#password")?.value?.trim();

  if (!email || !password) {
    msg.innerText = "Preencha email e senha.";
    msg.style.color = "var(--danger)";
    return;
  }

  const res = await fetch("/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const j = await res.json();

  if (!res.ok) {
    msg.innerText = j.error || "Erro no login.";
    msg.style.color = "var(--danger)";
    return;
  }

  // Salvar sessão
  localStorage.setItem("adminia_token", j.token);
  localStorage.setItem("adminia_user", JSON.stringify(j.user));

  updateHeader();

  // Redirecionar se inativo
  if (j.user.active === 0) {
    window.location.href = "/ativar";
    return;
  }

  // Redirecionar se expirado
  if (j.user.subscription_expires) {
    if (new Date(j.user.subscription_expires) < new Date()) {
      window.location.href = "/ativar";
      return;
    }
  }

  authSection.style.display = "none";
  afterLogin.style.display = "block";
});

// =======================================================
// ⭐ Sincronizar usuário com backend (/users/me)
// =======================================================
async function syncUser() {
  try {
    const token = localStorage.getItem("adminia_token");
    if (!token) return null;

    const res = await fetch("/users/me", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (!res.ok) return null;

    const j = await res.json();

    // O backend retorna os campos soltos → salvar tudo como objeto user
    const userObj = {
      id: j.id,
      name: j.name,
      email: j.email,
      active: j.active,
      subscription_expires: j.subscription_expires
    };

    localStorage.setItem("adminia_user", JSON.stringify(userObj));
    return userObj;

  } catch {
    return null;
  }
}

// =======================================================
// ⭐ Checar assinatura automaticamente ao abrir site
// =======================================================
async function checkActivationStatus() {
  let user = JSON.parse(localStorage.getItem("adminia_user") || "{}");
  if (!user?.id) return;

  // sincroniza sempre antes de checar
  const updated = await syncUser();
  if (!updated) return;
  user = updated;

  // Não ativo
  if (user.active === 0) {
    window.location.href = "/ativar";
    return;
  }

  // Expirado
  if (user.subscription_expires) {
    if (new Date(user.subscription_expires) < new Date()) {
      window.location.href = "/ativar";
      return;
    }
  }
}

// =======================================================
// ⭐ Pagamento antigo (opcional)
// =======================================================
createPaymentBtn?.addEventListener("click", async () => {
  const user = JSON.parse(localStorage.getItem("adminia_user") || "{}");

  if (!user?.id) {
    alert("Faça login antes.");
    return;
  }

  const res = await fetch("/payment/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });

  const j = await res.json();

  if (!res.ok || !j.init_point) {
    alert("Erro ao gerar pagamento.");
    return;
  }

  window.open(j.init_point, "_blank");
});

// =======================================================
// ⭐ LOAD — executado quando a página abre
// =======================================================
window.addEventListener("load", async () => {
  updateHeader();

  let user = JSON.parse(localStorage.getItem("adminia_user") || "{}");

  if (user?.id) {
    await checkActivationStatus();
    authSection.style.display = "none";
    afterLogin.style.display = "block";
  }
});

// =======================================================
// ⭐ LOGOUT
// =======================================================
$("#headerLogout")?.addEventListener("click", () => {
  localStorage.removeItem("adminia_user");
  localStorage.removeItem("adminia_token");
  window.location.href = "/";
});
