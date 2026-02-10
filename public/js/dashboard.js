// ==========================================
// dashboard.js — Aldra Dashboard (ANTI-LOOP)
// ==========================================

(function () {
  console.log("🚀 Dashboard carregado");

  const token = localStorage.getItem("token");

  if (!token) {
    location.replace("/");
    return;
  }

  // ==========================================
  // SEÇÕES
  // ==========================================
  const sections = ["sectionChat", "sectionCRM"];

  function showSection(name) {
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });

    const active = document.getElementById("section" + name);
    if (active) active.style.display = "block";
  }

  showSection("Chat");

  // ==========================================
  // ASSINATURA / VALIDA TOKEN
  // ==========================================
  async function checkSubscription() {
    try {
      const res = await fetch("/subscription/status", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      if (res.status === 401) {
        console.warn("🔒 Token inválido, limpando sessão");
        localStorage.removeItem("token");
        location.replace("/");
        return;
      }

      if (!res.ok) return;

      const data = await res.json();

      if (data.subscription_status !== "active") {
        const alertBox = document.getElementById("alert");
        if (alertBox) alertBox.style.display = "block";
      }

    } catch (err) {
      console.warn("⚠️ Erro ao validar assinatura:", err.message);
    }
  }

  checkSubscription();

  // ==========================================
  // FUNÇÕES GLOBAIS
  // ==========================================
  window.showSection = showSection;

  window.logout = function () {
    localStorage.removeItem("token");
    location.replace("/");
  };
})();
