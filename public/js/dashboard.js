// ==========================================
// dashboard.js — Aldra Dashboard (Compatível Server Blindado)
// ==========================================

(function () {
  console.log("🚀 Dashboard inicializando...");

  const token = localStorage.getItem("token");

  // ==========================================
  // BLOQUEIO TOTAL SEM TOKEN
  // ==========================================
  if (!token) {
    console.warn("🔒 Token ausente. Redirecionando...");
    window.location.href = "/";
    return;
  }

  const alertBox = document.getElementById("alert");
  const crmLista = document.getElementById("crmLista");

  let subscriptionActive = false;

  // ==========================================
  // VALIDA TOKEN TESTANDO CRM
  // ==========================================
  async function validateSession() {
    try {
      const res = await fetch("/api/crm", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (res.status === 401) {
        forceLogout();
        return;
      }

      if (res.status === 403) {
        subscriptionActive = false;
        if (alertBox) alertBox.style.display = "block";
        return;
      }

      if (res.ok) {
        subscriptionActive = true;
        if (alertBox) alertBox.style.display = "none";
      }

    } catch (err) {
      console.error("Erro crítico:", err);
      forceLogout();
    }
  }

  // ==========================================
  // LOGOUT FORÇADO
  // ==========================================
  function forceLogout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  // ==========================================
  // SEÇÕES
  // ==========================================
  const sections = [
    "sectionPDF",
    "sectionContrato",
    "sectionCobranca",
    "sectionRelatorios",
    "sectionChat",
    "sectionCRM"
  ];

  function hideAllSections() {
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove("active");
    });
  }

  function showSection(name) {
    hideAllSections();

    const sectionId = "section" + name;
    const el = document.getElementById(sectionId);

    if (!el) return;

    if (name === "CRM" && !subscriptionActive) {
      alert("Sua assinatura precisa estar ativa para usar o CRM.");
      return;
    }

    el.classList.add("active");

    if (name === "CRM") {
      loadClients();
    }
  }

  window.showSection = showSection;

  // ==========================================
  // CRM
  // ==========================================
  async function loadClients() {
    if (!subscriptionActive) return;

    try {
      const res = await fetch("/api/crm", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (res.status === 401) {
        forceLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao carregar CRM.");
        return;
      }

      const data = await res.json();

      crmLista.innerHTML = "";

      data.forEach(client => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${client.name}</td>
          <td>${client.email}</td>
          <td>${client.phone || ""}</td>
        `;
        crmLista.appendChild(row);
      });

    } catch (err) {
      console.error("Erro ao carregar CRM:", err);
    }
  }

  window.salvarCliente = async function () {
    if (!subscriptionActive) {
      alert("Assinatura necessária.");
      return;
    }

    const nome = document.getElementById("crmNome").value.trim();
    const email = document.getElementById("crmEmail").value.trim();
    const telefone = document.getElementById("crmTelefone").value.trim();

    if (!nome || !email) {
      alert("Nome e email são obrigatórios.");
      return;
    }

    try {
      const res = await fetch("/api/crm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token
        },
        body: JSON.stringify({
          name: nome,
          email: email,
          phone: telefone
        })
      });

      if (res.status === 401) {
        forceLogout();
        return;
      }

      if (!res.ok) {
        alert("Erro ao salvar cliente.");
        return;
      }

      document.getElementById("crmNome").value = "";
      document.getElementById("crmEmail").value = "";
      document.getElementById("crmTelefone").value = "";

      loadClients();

    } catch (err) {
      console.error("Erro ao salvar cliente:", err);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================
  window.logout = function () {
    forceLogout();
  };

  // ==========================================
  // INICIALIZAÇÃO
  // ==========================================
  validateSession().then(() => {
    showSection("PDF");
  });

})();
