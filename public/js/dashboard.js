// ==========================================
// dashboard.js — Aldra Dashboard (FINAL ESTÁVEL)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Dashboard iniciado");

  // ==========================================
  // TOKEN
  // ==========================================
  const token = localStorage.getItem("token");
  if (!token) {
    location.replace("/");
    return;
  }

  // ==========================================
  // SEÇÕES (ALINHADO COM dashboard.html)
  // ==========================================
  const sections = ["sectionChat", "sectionCRM"];

  function showSection(name) {
    sections.forEach(sec => {
      const el = document.getElementById(sec);
      if (el) el.style.display = "none";
    });

    const active = document.getElementById("section" + name);
    if (active) active.style.display = "block";

    if (name === "CRM" && typeof carregarClientes === "function") {
      carregarClientes();
    }
  }

  // seção inicial
  showSection("Chat");

  // ==========================================
  // ASSINATURA (SEM LOOP)
  // ==========================================
  (async function checkSubscription() {
    try {
      const res = await fetch("/subscription/status", {
        headers: { Authorization: "Bearer " + token }
      });

      if (!res.ok) return;

      const data = await res.json();
      console.log("📦 Subscription:", data);

      if (data.subscription_status !== "active") {
        const alert = document.getElementById("alert");
        if (alert) alert.style.display = "block";
      }
    } catch (err) {
      console.warn("⚠️ Falha ao validar assinatura:", err.message);
    }
  })();

  // ==========================================
  // MENU
  // ==========================================
  window.showSection = showSection;

  // ==========================================
  // LOGOUT
  // ==========================================
  window.logout = function () {
    localStorage.removeItem("token");
    location.replace("/");
  };
});
