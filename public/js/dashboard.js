// ==========================================
// dashboard.js — Aldra SaaS (PIX DEFINITIVO v3)
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

  // PIX elements
  const pixBox = document.getElementById("pixBox");
  const pixQr = document.getElementById("qrImage");
  const pixCopiaCola = document.getElementById("pixCode");

  let subscriptionActive = false;
  let isAdmin = false;
  let pixRendered = false;

  // ==========================================
  // LOGOUT
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

      if (!text) return {};

      if (text.trim().startsWith("<")) {
        console.error("❌ Backend retornou HTML:", text.slice(0, 120));
        return {};
      }

      return JSON.parse(text);
    } catch (err) {
      console.error("⚠️ JSON inválido");
      return {};
    }
  }

  // ==========================================
  // TOKEN
  // ==========================================
  function decodeToken() {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return {};
    }
  }

  async function loadUser() {
    const decoded = decodeToken();
    isAdmin = !!decoded?.is_admin;
    console.log("👑 Admin:", isAdmin);
  }

  // ==========================================
  // 🔥 RENDER PIX ROBUSTO
  // ==========================================
  function renderPix(data) {
    if (!data || pixRendered) return;

    console.log("🔍 renderPix recebeu:", data);

    const pixData =
      data?.point_of_interaction?.transaction_data ||
      data?.transaction_data ||
      data?.pix ||
      data;

    if (!pixData) {
      console.warn("⚠️ Nenhum PIX no payload");
      return;
    }

    const base64 =
      pixData?.qr_code_base64 ||
      pixData?.qrCodeBase64 ||
      pixData?.qr_code_base_64;

    const copia =
      pixData?.qr_code ||
      pixData?.qrCode ||
      pixData?.copia_cola;

    // QR
    if (base64 && pixQr) {
      pixQr.src = "data:image/png;base64," + base64;
      console.log("✅ QR carregado");
    }

    // Copia e cola
    if (copia && pixCopiaCola) {
      pixCopiaCola.value = copia;
      console.log("✅ Copia e cola preenchido");
    }

    // mostra box
    if (pixBox && (base64 || copia)) {
      pixBox.style.display = "block";
      pixRendered = true;
      console.log("✅ PIX exibido");
    }
  }

  // ==========================================
  // 🔥 CRIA PIX AUTOMÁTICO
  // ==========================================
  async function createPixIfNeeded() {
    if (pixRendered || isAdmin) return;

    try {
      console.log("💰 Criando PIX automático...");

      const res = await fetch("/subscription/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await safeJson(res);
      console.log("💰 resposta create:", data);

      if (res.ok) {
        renderPix(data);
      }
    } catch (err) {
      console.error("❌ erro ao criar PIX:", err);
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

      // assinatura ativa
      if (data.status === "active" || data.status === "approved") {
        subscriptionActive = true;
        if (alertBox) alertBox.style.display = "none";
        return;
      }

      // assinatura inativa
      subscriptionActive = false;
      if (alertBox) alertBox.style.display = "block";

      // tenta renderizar PIX vindo do status
      renderPix(data);

      // 🔥 se não veio PIX → cria automaticamente
      if (!pixRendered) {
        await createPixIfNeeded();
      }

    } catch (err) {
      console.error("❌ Erro checkSubscription:", err);
    }
  }

  // ==========================================
  // BOTÃO MANUAL
  // ==========================================
  window.ativarPlano = async function () {
    pixRendered = false;
    await createPixIfNeeded();

    if (alertBox) alertBox.style.display = "block";
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