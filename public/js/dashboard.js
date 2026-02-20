// ==========================================
// dashboard.js — Aldra SaaS (PIX REATIVADO)
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

  // IDs do HTML
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
  // SAFE JSON
  // ==========================================
  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      console.error("⚠️ Resposta não é JSON válido");
      return {};
    }
  }

  // ==========================================
  // DECODIFICA TOKEN (fallback)
  // ==========================================
  function decodeToken() {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload;
    } catch {
      return {};
    }
  }

  // ==========================================
  // VERIFICA USUÁRIO (COM FALLBACK)
  // ==========================================
  async function loadUser() {
    try {
      // tenta endpoint (se existir)
      const res = await fetch("/api/me", {
        headers: { Authorization: "Bearer " + token }
      });

      if (res.ok) {
        const data = await safeJson(res);
        isAdmin = !!data.isAdmin;
        console.log("👑 Admin via API:", isAdmin);
        return;
      }

      // 🔥 fallback pelo token
      const decoded = decodeToken();
      isAdmin = !!decoded.is_admin;
      console.log("👑 Admin via token:", isAdmin);

    } catch (err) {
      console.warn("⚠️ loadUser fallback ativado");
      const decoded = decodeToken();
      isAdmin = !!decoded.is_admin;
    }
  }

  // ==========================================
  // VERIFICA ASSINATURA
  // ==========================================
  async function checkSubscription() {

    // 👑 ADMIN LIBERADO
    if (isAdmin) {
      subscriptionActive = true;
      if (alertBox) alertBox.style.display = "none";
      return;
    }

    try {
      const res = await fetch("/subscription/status", {
        headers: { Authorization: "Bearer " + token }
      });

      // se endpoint não existir, não trava
      if (!res.ok) {
        console.warn("⚠️ subscription/status não disponível");
        subscriptionActive = false;
        if (alertBox) alertBox.style.display = "block";
        return;
      }

      const data = await safeJson(res);
      console.log("📊 subscription status:", data);

      // ✅ STATUS ATIVO
      if (data.status === "active" || data.status === "approved") {
        subscriptionActive = true;
        if (alertBox) alertBox.style.display = "none";
        return;
      }

      // 🔴 NÃO ATIVO
      subscriptionActive = false;
      if (alertBox) alertBox.style.display = "block";

      renderPix(data);

    } catch (err) {
      console.error("Erro checkSubscription:", err);
    }
  }

  // ==========================================
  // RENDER PIX (ROBUSTO)
  // ==========================================
  function renderPix(data) {
    const pixData =
      data?.point_of_interaction?.transaction_data ||
      data?.transaction_data ||
      data?.pix ||
      null;

    if (!pixData) {
      console.warn("⚠️ Nenhum PIX encontrado");
      return;
    }

    // QR
    if (pixData.qr_code_base64 && pixQr) {
      pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
    }

    // copia e cola
    if (pixData.qr_code && pixCopiaCola) {
      pixCopiaCola.value = pixData.qr_code;
    }

    if (pixBox) pixBox.style.display = "block";

    console.log("✅ PIX renderizado");
  }

  // ==========================================
  // PAGAMENTO PIX
  // ==========================================
  window.ativarPlano = async function () {
    try {
      const res = await fetch("/subscription/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (!res.ok) {
        alert("Erro ao gerar pagamento.");
        return;
      }

      const data = await safeJson(res);
      console.log("💰 pagamento:", data);

      renderPix(data);

      if (alertBox) alertBox.style.display = "block";

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
        console.warn("⚠️ CRM indisponível");
        return;
      }

      const data = await safeJson(res);

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