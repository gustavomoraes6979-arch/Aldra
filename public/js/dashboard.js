// ==========================================
// dashboard.js — Aldra SaaS (VERSÃO 3 - CACHE FIX)
// ==========================================

console.log("🚀 dashboard.js V3 carregado");

(function () {

  const token = localStorage.getItem("token");

  if (!token) {
    window.location.href = "/";
    return;
  }

  const alertBox = document.getElementById("alert");
  const pixBox = document.getElementById("pixBox");
  const pixQr = document.getElementById("qrImage");
  const pixCopiaCola = document.getElementById("pixCode");
  const crmLista = document.getElementById("crmLista");

  let subscriptionActive = false;
  let isAdmin = false;

  // ==========================================
  // SAFE JSON
  // ==========================================
  async function safeJson(res) {
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith("<")) return {};
      return JSON.parse(text);
    } catch {
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
    console.log("Usuário admin:", isAdmin);
  }

  // ==========================================
  // CONTROLE ALERTA
  // ==========================================
  function showAlert() {
    subscriptionActive = false;
    if (alertBox) alertBox.style.display = "block";
  }

  function hideAlert() {
    subscriptionActive = true;
    if (alertBox) alertBox.style.display = "none";
    if (pixBox) pixBox.style.display = "none";
  }

  // ==========================================
  // RENDER PIX
  // ==========================================
  function renderPix(data) {

    const pixData =
      data?.point_of_interaction?.transaction_data ||
      data?.transaction_data;

    console.log("📦 PIX DATA:", pixData);

    if (!pixData) {
      alert("Erro ao gerar PIX.");
      return;
    }

    if (pixData.qr_code_base64 && pixQr) {
      pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
    }

    if (pixData.qr_code && pixCopiaCola) {
      pixCopiaCola.value = pixData.qr_code;
    }

    if (pixBox) pixBox.style.display = "block";
  }

  // ==========================================
  // VERIFICA ASSINATURA
  // ==========================================
  async function checkSubscription() {

    if (isAdmin) {
      hideAlert();
      return;
    }

    try {

      const res = await fetch("/subscription/status", {
        headers: { Authorization: "Bearer " + token }
      });

      console.log("Status HTTP:", res.status);

      if (!res.ok) {
        showAlert();
        return;
      }

      const data = await safeJson(res);

      console.log("📡 Status recebido:", data);

      if (data.status === "active" || data.status === "approved") {
        hideAlert();
      } else {
        showAlert();
      }

    } catch (err) {
      console.error("Erro ao verificar assinatura:", err);
      showAlert();
    }
  }

  // ==========================================
  // BOTÃO ASSINAR
  // ==========================================
  window.ativarPlano = async function () {

    try {

      if (pixBox) pixBox.style.display = "none";

      const res = await fetch("/subscription/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      console.log("Criar assinatura HTTP:", res.status);

      if (!res.ok) {
        alert("Erro ao criar pagamento.");
        return;
      }

      const data = await safeJson(res);

      renderPix(data);

    } catch (err) {
      console.error("Erro ao criar PIX:", err);
      alert("Erro ao criar pagamento.");
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
      console.error("Erro CRM:", err);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================
  window.logout = function () {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  // ==========================================
  // INIT
  // ==========================================
  async function init() {
    console.log("🔄 Inicializando dashboard...");
    await loadUser();
    await checkSubscription();

    setInterval(checkSubscription, 5000);

    showSection("PDF");
  }

  init();

})();