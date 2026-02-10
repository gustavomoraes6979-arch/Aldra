// ==========================================
// dashboard.js — Aldra Dashboard (ESTÁVEL)
// ==========================================

(function () {
  console.log("🚀 Dashboard carregado");

  // ==========================================
  // TOKEN
  // ==========================================
  const token = localStorage.getItem("token");
  if (!token) {
    location.replace("/");
    return;
  }

  // ==========================================
  // SEÇÕES (IDs reais do HTML)
  // ==========================================
  const sections = ["sectionChat", "sectionCRM"];

  function showSection(name) {
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    const active = document.getElementById("section" + name);
    if (active) active.style.display = "block";

    // 👉 carrega CRM somente ao entrar
    if (name === "CRM" && typeof carregarClientes === "function") {
      carregarClientes();
    }
  }

  // seção inicial
  showSection("Chat");

  // ==========================================
  // ASSINATURA (SEM REDIRECT / SEM LOOP)
  // ==========================================
  async function checkSubscription() {
    try {
      const res = await fetch("/subscription/status", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (!res.ok) return;

      const data = await res.json();
      console.log("📦 Subscription:", data);

      if (data.subscription_status !== "active") {
        const alertBox = document.getElementById("alert");
        if (alertBox) alertBox.style.display = "block";
      }
    } catch (err) {
      console.warn("⚠️ Falha ao validar assinatura:", err.message);
      // NÃO derruba o dashboard
    }
  }

  checkSubscription();

  // ==========================================
  // FUNÇÕES GLOBAIS (HTML)
  // ==========================================
  window.showSection = showSection;

  window.logout = function () {
    localStorage.removeItem("token");
    location.replace("/");
  };
})();
