// ==========================================
// dashboard.js — Aldra Dashboard (ESTÁVEL FINAL)
// ==========================================

(function () {
  console.log("🚀 Dashboard inicializando...");

  // ==========================================
  // TOKEN — BLOQUEIO TOTAL SEM LOGIN
  // ==========================================
  const token = localStorage.getItem("token");

  if (!token) {
    console.warn("🔒 Sem token, redirecionando para login");
    location.replace("/");
    return;
  }

  // ==========================================
  // SEÇÕES DISPONÍVEIS
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
    hideAllSections();

    const sectionId = "section" + name;
    const el = document.getElementById(sectionId);

    if (!el) {
      console.warn("⚠️ Seção não encontrada:", sectionId);
      return;
    }

    el.classList.add("active");

    // Carrega CRM apenas quando necessário
    if (name === "CRM" && typeof loadClients === "function") {
      loadClients();
    }
  }

  // ==========================================
  // VALIDA TOKEN + ASSINATURA
  // ==========================================
  async function validateSession() {
    try {
      const res = await fetch("/subscription/status", {
        headers: {
          Authorization: "Bearer " + token
        }
      });

      // Token inválido → expulsa imediatamente
      if (res.status === 401) {
        console.warn("❌ Token inválido ou expirado");
        localStorage.removeItem("token");
        location.replace("/");
        return;
      }

      if (!res.ok) {
        console.warn("⚠️ Falha ao validar sessão");
        return;
      }

      const data = await res.json();
      console.log("📦 Status assinatura:", data);

      if (data.subscription_status !== "active") {
        const alertBox = document.getElementById("alert");
        if (alertBox) alertBox.style.display = "block";
      }

      // Só entra no dashboard depois de validar
      showSection("Chat");

    } catch (err) {
      console.error("❌ Erro crítico de sessão:", err.message);
      localStorage.removeItem("token");
      location.replace("/");
    }
  }

  validateSession();

  // ==========================================
  // FUNÇÕES GLOBAIS
  // ==========================================
  window.showSection = showSection;

  window.logout = function () {
    localStorage.removeItem("token");
    location.replace("/");
  };

})();
