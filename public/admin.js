// =====================================================
// Admin.js — Aldra (VERSÃO COMPATÍVEL COM SERVER)
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
  carregarPainel();
});

async function carregarPainel() {
  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/";
    return;
  }

  try {
    await carregarStats(token);
    await carregarUsuarios(token);
  } catch (err) {
    console.error("Erro admin:", err);
    alert("Erro ao carregar painel administrativo");
    logoutForcado();
  }
}

// =====================================================
// STATS
// =====================================================
async function carregarStats(token) {
  const res = await fetch("/admin/stats", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 401 || res.status === 403) {
    logoutForcado();
    return;
  }

  if (!res.ok) {
    throw new Error("Erro ao buscar stats");
  }

  const data = await res.json();

  document.getElementById("totalUsers").innerText =
    data.totalUsers || 0;

  document.getElementById("activeUsers").innerText =
    data.activeSubscriptions || 0;

  document.getElementById("pendingUsers").innerText =
    (data.totalUsers || 0) - (data.activeSubscriptions || 0);

  document.getElementById("monthlyRevenue").innerText =
    "R$ " + (data.monthlyRevenue || 0).toLocaleString("pt-BR");
}

// =====================================================
// USERS TABLE
// =====================================================
async function carregarUsuarios(token) {
  const res = await fetch("/admin/users", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 401 || res.status === 403) {
    logoutForcado();
    return;
  }

  if (!res.ok) {
    throw new Error("Erro ao carregar usuários");
  }

  const users = await res.json();
  renderUsuarios(users);
}

function renderUsuarios(users) {
  const tbody = document.getElementById("usersBody");
  tbody.innerHTML = "";

  users.forEach(user => {
    const tr = document.createElement("tr");

    let statusClass = "status-pending";
    if (user.status === "active") statusClass = "status-active";

    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name || "-"}</td>
      <td>${user.email}</td>
      <td>${user.role || "user"}</td>
      <td class="${statusClass}">
        ${user.status || "inactive"}
      </td>
      <td class="actions">
        <button class="btn-primary"
          onclick="cancelar(${user.id})"
          ${user.status !== "active" ? "disabled" : ""}>
          Cancelar
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// =====================================================
// ACTIONS
// =====================================================
async function cancelar(id) {
  if (!confirm("Cancelar assinatura deste usuário?")) return;
  await adminAction(`/admin/cancel/${id}`);
}

async function adminAction(url) {
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401 || res.status === 403) {
    logoutForcado();
    return;
  }

  if (!res.ok) {
    alert("Erro na operação");
    return;
  }

  carregarPainel();
}

// =====================================================
// LOGOUT FORÇADO
// =====================================================
function logoutForcado() {
  localStorage.removeItem("token");
  alert("Acesso restrito ao administrador.");
  window.location.href = "/dashboard.html";
}
