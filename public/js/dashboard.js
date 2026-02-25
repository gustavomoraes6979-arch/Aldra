// ==========================================
// dashboard.js — CLIENTE
// ==========================================

console.log("🚀 Dashboard CLIENTE carregado");

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

  async function safeJson(res) {
    try {
      const text = await res.text();
      if (!text || text.trim().startsWith("<")) return {};
      return JSON.parse(text);
    } catch {
      return {};
    }
  }

  function showAlert() {
    subscriptionActive = false;
    alertBox.style.display = "block";
  }

  function hideAlert() {
    subscriptionActive = true;
    alertBox.style.display = "none";
    pixBox.style.display = "none";
  }

  function renderPix(data) {

    const pixData =
      data?.point_of_interaction?.transaction_data ||
      data?.transaction_data;

    if (!pixData) {
      alert("Erro ao gerar PIX.");
      return;
    }

    if (pixData.qr_code_base64) {
      pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
    }

    if (pixData.qr_code) {
      pixCopiaCola.value = pixData.qr_code;
    }

    pixBox.style.display = "block";
  }

  async function checkSubscription() {

    try {

      const res = await fetch("/subscription/status", {
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) {
        showAlert();
        return;
      }

      const data = await safeJson(res);

      console.log("Status cliente:", data);

      if (data.status === "active" || data.status === "approved") {
        hideAlert();
      } else {
        showAlert();
      }

    } catch (err) {
      console.error(err);
      showAlert();
    }
  }

  window.ativarPlano = async function () {

    try {

      pixBox.style.display = "none";

      const res = await fetch("/subscription/create", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (!res.ok) {
        alert("Erro ao criar pagamento.");
        return;
      }

      const data = await safeJson(res);

      renderPix(data);

    } catch (err) {
      console.error(err);
      alert("Erro ao criar pagamento.");
    }
  };

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

    if (!subscriptionActive) {
      alert("Sua assinatura está inativa.");
      return;
    }

    hideAllSections();

    const el = document.getElementById("section" + name);
    if (el) el.classList.add("active");

    if (name === "CRM") loadClients();
  }

  window.showSection = showSection;

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

  window.logout = function () {
    localStorage.removeItem("token");
    window.location.href = "/";
  };

  async function init() {
    await checkSubscription();
    setInterval(checkSubscription, 5000);
    showSection("PDF");
  }

  init();

})();