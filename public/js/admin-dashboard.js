console.log("Admin dashboard carregado");

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/admin-auth.html";
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ==============================
// MÉTRICAS (USA /admin/stats)
// ==============================
async function loadMetrics() {
  try {
    const res = await fetch("/admin/stats", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Erro métricas");

    const data = await safeJson(res);

    document.getElementById("metricUsers").innerText = data.users || 0;
    document.getElementById("metricActive").innerText = data.active || 0;
    document.getElementById("metricRevenue").innerText =
      "R$ " + (data.receita_mensal || 0);
    document.getElementById("metricPending").innerText = data.pending || 0;

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar painel administrativo");
  }
}

// ==============================
// USUÁRIOS (USA /admin/users)
// ==============================
async function loadUsers() {
  try {
    const res = await fetch("/admin/users", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) throw new Error("Erro usuários");

    const users = await safeJson(res);

    const table = document.getElementById("usersTable");
    table.innerHTML = "";

    users.forEach(user => {

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.name || "-"}</td>
        <td>${user.email}</td>
        <td>${user.status || "pending"}</td>
        <td>
          ${
            user.status === "active"
              ? `<button class="btn-cancel" onclick="cancelSub('${user.id}')">Cancelar</button>`
              : "—"
          }
        </td>
      `;

      table.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    alert("Erro ao carregar usuários");
  }
}

// ==============================
// CANCELAR ASSINATURA
// ==============================
async function cancelSub(userId) {
  try {
    await fetch("/admin/cancel/" + userId, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    loadUsers();
    loadMetrics();

  } catch (err) {
    console.error(err);
    alert("Erro ao cancelar assinatura");
  }
}

// ==============================
// LOGOUT
// ==============================
function logout() {
  localStorage.removeItem("token");
  window.location.href = "/";
}

// ==============================

loadMetrics();
loadUsers();