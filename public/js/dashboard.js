// ==========================================
// dashboard.js — Aldra SaaS (PIX BOTÃO FIXO)
// ==========================================

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
  }

  // ==========================================
  // RENDER PIX
  // ==========================================
  function renderPix(data) {

    const pixData =
      data?.point_of_interaction?.transaction_data ||
      data?.transaction_data;

    if (!pixData) return;

    if (pixData.qr_code_base64) {
      pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
    }

    if (pixData.qr_code) {
      pixCopiaCola.value = pixData.qr_code;
    }

    pixBox.style.display = "block";
  }

  // ==========================================
  // VERIFICA ASSINATURA
  // ==========================================
  async function checkSubscription() {

    if (isAdmin) {
      subscriptionActive = true;
      alertBox.style.display = "none";
      return;
    }

    try {
      const res = await fetch("/subscription/status", {
        headers: { Authorization: "Bearer " + token }
      });

      const data = await safeJson(res);

      if (data.status === "active" || data.status === "approved") {
        subscriptionActive = true;
        alertBox.style.display = "none";
        return;
      }

      // assinatura pendente → mostra botão
      subscriptionActive = false;
      alertBox.style.display = "block";

    } catch (err) {
      console.error(err);
    }
  }

  // ==========================================
  // BOTÃO ASSINAR (MANUAL)
  // ==========================================
  window.ativarPlano = async function () {

    try {

      const res = await fetch("/subscription/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      const data = await safeJson(res);

      if (res.ok) {
        renderPix(data);
      }

    } catch (err) {
      console.error("Erro ao criar PIX:", err);
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
    await loadUser();
    await checkSubscription();
    showSection("PDF");
  }

  init();

})();