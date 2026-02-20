// ==========================================
// dashboard.js — Aldra SaaS (PIX DEFINITIVO v2)
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
  // SAFE JSON ULTRA ROBUSTO
  // ==========================================
  async function safeJson(res) {
    try {
      const text = await res.text();

      // 🔥 evita erro Unexpected token '<'
      if (text.trim().startsWith("<")) {
        console.error("❌ Backend retornou HTML:", text.slice(0, 120));
        return {};
      }

      return JSON.parse(text);
    } catch (err) {
      console.error("⚠️ Resposta não é JSON válido");
      return {};
    }
  }

  // ==========================================
  // DECODIFICA TOKEN
  // ==========================================
  function decodeToken() {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return {};
    }
  }

  // ==========================================
  // LOAD USER
  // ==========================================
  async function loadUser() {
    try {
      const decoded = decodeToken();
      isAdmin = !!decoded?.is_admin;
      console.log("👑 Admin:", isAdmin);
    } catch (err) {
      console.warn("⚠️ Falha ao decodificar token");
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

      const data = await safeJson(res);
      console.log("📊 subscription status:", data);

      if (!res.ok) {
        subscriptionActive = false;
        if (alertBox) alertBox.style.display = "block";
        renderPix(data);
        return;
      }

      if (data.status === "active" || data.status === "approved") {
        subscriptionActive = true;
        if (alertBox) alertBox.style.display = "none";
        return;
      }

      subscriptionActive = false;
      if (alertBox) alertBox.style.display = "block";

      renderPix(data);

    } catch (err) {
      console.error("❌ Erro checkSubscription:", err);
    }
  }

  // ==========================================
  // 🔥 RENDER PIX SUPER ROBUSTO v2
  // ==========================================
  function renderPix(data) {
    console.log("🔍 renderPix recebeu:", data);

    if (!data) return;

    const pixData =
      data?.point_of_interaction?.transaction_data ||
      data?.transaction_data ||
      data?.pix ||
      data;

    const base64 =
      pixData?.qr_code_base64 ||
      pixData?.qrCodeBase64 ||
      pixData?.qr_code_base_64;

    const copia =
      pixData?.qr_code ||
      pixData?.qrCode ||
      pixData?.copia_cola;

    // QR IMAGE
    if (base64 && pixQr) {
      pixQr.src = "data:image/png;base64," + base64;
      console.log("✅ QR carregado");
    } else {
      console.warn("⚠️ qr_code_base64 não encontrado");
    }

    // COPIA E COLA
    if (copia && pixCopiaCola) {
      pixCopiaCola.value = copia;
      console.log("✅ Copia e cola preenchido");
    }

    // MOSTRA BOX
    if (pixBox && (base64 || copia)) {
      pixBox.style.display = "block";
    }
  }

  // ==========================================
  // CRIAR PAGAMENTO PIX
  // ==========================================
  window.ativarPlano = async function () {
    try {
      console.log("💰 Criando pagamento PIX...");

      const res = await fetch("/subscription/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await safeJson(res);
      console.log("💰 resposta create:", data);

      if (!res.ok) {
        alert(data.error || "Erro ao gerar pagamento.");
        return;
      }

      renderPix(data);

      if (alertBox) alertBox.style.display = "block";

    } catch (err) {
      console.error("❌ Erro ativarPlano:", err);
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

      if (!res.ok) return;

      const data = await safeJson(res);

      if (!crmLista || !Array.isArray(data)) return;

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