// ==========================================
// dashboard.js — Aldra SaaS Profissional (PIX FIX FINAL)
// ==========================================

(function () {
  console.log("🚀 Dashboard SaaS iniciando...");

  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/";
    return;
  }

  const alertBox = document.getElementById("alert");
  const crmLista = document.getElementById("crmLista");

  // ✅ IDs REAIS do seu HTML
  const pixBox = document.getElementById("pixBox");
  const pixQr = document.getElementById("qrImage");
  const pixCopiaCola = document.getElementById("pixCode");

  let subscriptionActive = false;
  let isAdmin = false;

  // ==========================================
  // LOGOUT FORÇADO
  // ==========================================
  function forceLogout() {
    localStorage.removeItem("token");
    window.location.href = "/";
  }

  // ==========================================
  // VERIFICA USUÁRIO
  // ==========================================
  async function loadUser() {
    try {
      const res = await fetch("/api/me", {
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) {
        forceLogout();
        return;
      }

      const data = await res.json();
      isAdmin = data.isAdmin;

    } catch (err) {
      console.error("Erro loadUser:", err);
      forceLogout();
    }
  }

  // ==========================================
  // VERIFICA ASSINATURA
  // ==========================================
  async function checkSubscription() {

    if (isAdmin) {
      subscriptionActive = true;
      if (alertBox) alertBox.style.display = "none";
      return;
    }

    try {
      const res = await fetch("/subscription/status", {
        headers: { Authorization: "Bearer " + token }
      });

      if (res.status === 401) {
        forceLogout();
        return;
      }

      const data = await res.json();

      console.log("📊 subscription status:", data.status);

      if (data.status === "active" || data.status === "approved") {
        subscriptionActive = true;
        if (alertBox) alertBox.style.display = "none";
      } else {
        subscriptionActive = false;
        if (alertBox) alertBox.style.display = "block";

        // 🔥 Se backend já mandar QR pendente
        const pixData = data.point_of_interaction?.transaction_data;

        if (pixData?.qr_code_base64 && pixQr) {
          pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
          if (pixBox) pixBox.style.display = "block";
        }

        if (pixData?.qr_code && pixCopiaCola) {
          pixCopiaCola.value = pixData.qr_code;
        }
      }

    } catch (err) {
      console.error("Erro checkSubscription:", err);
      forceLogout();
    }
  }

  // ==========================================
  // 🔥 PAGAMENTO PIX
  // ==========================================
  window.ativarPlano = async function () {

    try {
      const res = await fetch("/create-payment", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (!res.ok) {
        alert("Erro ao gerar pagamento.");
        return;
      }

      const data = await res.json();

      console.log("💰 pagamento:", data);

      const pixData =
        data.point_of_interaction?.transaction_data;

      if (!pixData) {
        alert("PIX não retornado pela API.");
        return;
      }

      // ✅ QR
      if (pixData.qr_code_base64 && pixQr) {
        pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
      }

      // ✅ copia e cola
      if (pixData.qr_code && pixCopiaCola) {
        pixCopiaCola.value = pixData.qr_code;
      }

      // ✅ mostrar box
      if (pixBox) pixBox.style.display = "block";
      if (alertBox) alertBox.style.display = "block";

      console.log("✅ PIX exibido");

    } catch (err) {
      console.error("Erro ativarPlano:", err);
      alert("Erro ao iniciar pagamento.");
    }
  };

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

    if (!subscriptionActive && !isAdmin) {
      alert("Sua assinatura está inativa.");
      return;
    }

    hideAllSections();

    const el = document.getElementById("section" + name);
    if (el) el.classList.add("active");

    if (name === "CRM") loadClients();
  }

  window.showSection = showSection;

  // ==========================================
  // CRM
  // ==========================================
  async function loadClients() {

    try {
      const res = await fetch("/api/crm", {
        headers: { Authorization: "Bearer " + token }
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

      if (!crmLista) return;

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
      console.error(err);
    }
  }

  window.salvarCliente = async function () {

    if (!subscriptionActive && !isAdmin) {
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
      console.error(err);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================
  window.logout = function () {
    forceLogout();
  };

  // ==========================================
  // INIT
  // ==========================================
  async function init() {
    await loadUser();
    await checkSubscription();
    showSection("PDF");
  }

  init();

})();