console.log("Admin dashboard carregado");

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/admin-auth.html";
}

async function safeJson(res){
  try{
    return await res.json();
  }catch{
    return {};
  }
}

async function loadMetrics(){
  const res = await fetch("/admin/metrics", {
    headers:{ Authorization:"Bearer "+token }
  });

  const data = await safeJson(res);

  document.getElementById("metricUsers").innerText = data.totalUsers || 0;
  document.getElementById("metricActive").innerText = data.activeSubscriptions || 0;
  document.getElementById("metricRevenue").innerText = "R$ " + (data.monthlyRevenue || 0);
  document.getElementById("metricPending").innerText = data.pendingPayments || 0;
}

async function loadUsers(){

  const res = await fetch("/admin/users", {
    headers:{ Authorization:"Bearer "+token }
  });

  const users = await safeJson(res);

  const table = document.getElementById("usersTable");
  table.innerHTML = "";

  users.forEach(user => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.subscription_status || "inactive"}</td>
      <td>${user.payment_status || "none"}</td>
      <td>
        ${
          user.subscription_status !== "active"
          ? `<button class="btn-approve" onclick="approve('${user.id}')">Aprovar</button>`
          : "—"
        }
      </td>
    `;

    table.appendChild(tr);

  });
}

async function approve(userId){

  await fetch("/admin/approve/"+userId,{
    method:"POST",
    headers:{ Authorization:"Bearer "+token }
  });

  loadUsers();
  loadMetrics();
}

function logout(){
  localStorage.removeItem("token");
  window.location.href = "/";
}

loadMetrics();
loadUsers();