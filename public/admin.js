// =====================================
// Admin.js — Aldra (JWT automático)
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  loadUsers();
});

async function loadUsers() {
  const token = localStorage.getItem("token");

  if (!token) {
    location.href = "/";
    return;
  }

  try {
    const res = await fetch("/admin/users", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401 || res.status === 403) {
      location.href = "/dashboard";
      return;
    }

    const users = await res.json();
    renderStats(users);
    renderUsers(users);

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar painel admin");
  }
}

function renderStats(users) {
  document.getElementById("totalUsers").innerText = users.length;
  document.getElementById("activeUsers").innerText =
    users.filter(u => u.subscription_status === "active").length;
  document.getElementById("blockedUsers").innerText =
    users.filter(u => u.subscription_status === "blocked").length;
  document.getElementById("pendingUsers").innerText =
    users.filter(u => u.subscription_status !== "active" && u.subscription_status !== "blocked").length;
}

function renderUsers(users) {
  const tbody = document.getElementById("usersBody");
  tbody.innerHTML = "";

  users.forEach(user => {
    const tr = document.createElement("tr");

    let statusClass = "status-pending";
    if (user.subscription_status === "active") statusClass = "status-active";
    if (user.subscription_status === "blocked") statusClass = "status-blocked";

    const expires = user.subscription_expires_at
      ? new Date(user.subscription_expires_at).toLocaleDateString("pt-BR")
      : "-";

    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name || "-"}</td>
      <td>${user.email}</td>
      <td class="${statusClass}">${user.subscription_status}</td>
      <td>${expires}</td>
      <td>
        <button class="btn"
          onclick="activate(${user.id})"
          ${user.subscription_status === "active" ? "disabled" : ""}>
          Ativar
        </button>

        <button class="btn-danger"
          onclick="block(${user.id})"
          ${user.subscription_status === "blocked" ? "disabled" : ""}>
          Bloquear
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

async function activate(id) {
  if (!confirm("Ativar assinatura por 30 dias?")) return;
  await adminAction(`/admin/confirm-payment/${id}`);
}

async function block(id) {
  if (!confirm("Bloquear usuário?")) return;
  await adminAction(`/admin/block-user/${id}`);
}

async function adminAction(url) {
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    alert("Erro na operação");
    return;
  }

  loadUsers();
}
