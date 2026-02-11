// ==========================================
// crm.js — Aldra CRM (NODE 22 + SERVER ATUAL)
// ==========================================

(function () {
  console.log("📊 CRM carregado");

  const token = localStorage.getItem("token");
  if (!token) {
    location.replace("/");
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token
  };

  const nomeInput = document.getElementById("crmNome");
  const emailInput = document.getElementById("crmEmail");
  const telefoneInput = document.getElementById("crmTelefone");
  const lista = document.getElementById("crmLista");

  // ==========================================
  // CARREGAR CLIENTES
  // ==========================================
  async function carregarClientes() {
    lista.innerHTML = "<tr><td colspan='3'>Carregando...</td></tr>";

    try {
      const res = await fetch("/api/crm", { headers });

      if (!res.ok) {
        lista.innerHTML =
          "<tr><td colspan='3'>Assinatura inativa</td></tr>";
        return;
      }

      const clientes = await res.json();
      lista.innerHTML = "";

      if (!clientes.length) {
        lista.innerHTML =
          "<tr><td colspan='3'>Nenhum cliente cadastrado</td></tr>";
        return;
      }

      clientes.forEach(c => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${c.name}</td>
          <td>${c.email}</td>
          <td>${c.phone || "-"}</td>
        `;
        lista.appendChild(tr);
      });

    } catch (err) {
      console.error(err);
      lista.innerHTML =
        "<tr><td colspan='3'>Erro ao carregar CRM</td></tr>";
    }
  }

  // ==========================================
  // SALVAR CLIENTE
  // ==========================================
  window.salvarCliente = async function () {
    const name = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const phone = telefoneInput.value.trim();

    if (!name || !email) {
      alert("Nome e email são obrigatórios");
      return;
    }

    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers,
        body: JSON.stringify({ name, email, phone })
      });

      if (!res.ok) {
        alert("Erro ao salvar cliente");
        return;
      }

      nomeInput.value = "";
      emailInput.value = "";
      telefoneInput.value = "";

      carregarClientes();

    } catch {
      alert("Erro de conexão com o servidor");
    }
  };

  // ==========================================
  // EXPOR PARA O DASHBOARD
  // ==========================================
  window.carregarClientes = carregarClientes;

})();
