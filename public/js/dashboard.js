// ==========================================
// dashboard.js — Aldra Dashboard (FINAL + ALERTA RENOVAÇÃO)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Dashboard iniciado");

  // ==========================================
  // SEÇÕES DISPONÍVEIS
  // ==========================================
  const sections = [
    "sectionPdf",
    "sectionChat",
    "sectionContrato",
    "sectionRelatorios",
    "sectionCobrancas",
    "sectionCRM"
  ];

  function showSection(id) {
    let valid = false;

    sections.forEach(sec => {
      const el = document.getElementById(sec);
      if (!el) return;

      if (sec === id) {
        el.style.display = "block";
        valid = true;
      } else {
        el.style.display = "none";
      }
    });

    if (!valid) {
      const fallback = sections.find(s => document.getElementById(s));
      if (fallback) document.getElementById(fallback).style.display = "block";
    }

    if (id === "sectionCRM") loadCRM();
  }

  // ==========================================
  // INIT DASHBOARD
  // ==========================================
  function initDashboard() {
    console.log("✅ Assinatura ativa, acesso liberado");
    const first =
      sections.find(s => document.getElementById(s)) || "sectionPdf";
    showSection(first);
  }

  // ==========================================
  // ALERTA DE RENOVAÇÃO
  // ==========================================
  function showRenewAlert(days) {
    const alertBox = document.getElementById("renewAlert");
    if (!alertBox) return;

    alertBox.innerHTML = `
      <div style="
        background:#fff3cd;
        color:#856404;
        padding:15px;
        border-radius:8px;
        margin-bottom:15px;
        display:flex;
        justify-content:space-between;
        align-items:center;
      ">
        <span>⚠️ Sua assinatura vence em <b>${days} dia(s)</b>.</span>
        <button onclick="location.href='/payment'"
          style="
            background:#f0ad4e;
            border:none;
            padding:8px 14px;
            border-radius:6px;
            cursor:pointer;
            font-weight:bold;
          ">
          Renovar agora
        </button>
      </div>
    `;
  }

  // ==========================================
  // VERIFICAÇÃO DE ACESSO + ASSINATURA
  // ==========================================
  async function verifyAccess() {
    const token = localStorage.getItem("token");

    if (!token) {
      location.href = "/";
      return;
    }

    try {
      const res = await fetch("/subscription/status", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        localStorage.removeItem("token");
        location.href = "/";
        return;
      }

      const data = await res.json();
      console.log("📦 Subscription:", data);

      if (
        data.subscription_status !== "active" ||
        (data.subscription_expires_at &&
          new Date(data.subscription_expires_at) < new Date())
      ) {
        location.href = "/payment";
        return;
      }

      // ===== ALERTA RENOVAÇÃO =====
      if (data.subscription_expires_at) {
        const now = new Date();
        const expires = new Date(data.subscription_expires_at);
        const diff = Math.ceil(
          (expires - now) / (1000 * 60 * 60 * 24)
        );

        if ([7, 3, 1].includes(diff)) {
          showRenewAlert(diff);
        }
      }

      initDashboard();
    } catch (err) {
      console.error("❌ Falha ao validar assinatura:", err);
      alert("Erro ao validar acesso");
      location.href = "/";
    }
  }

  verifyAccess();

  // ==========================================
  // MENU
  // ==========================================
  const bind = (btn, section) => {
    const el = document.getElementById(btn);
    if (el) el.addEventListener("click", () => showSection(section));
  };

  bind("btnPdf", "sectionPdf");
  bind("btnChat", "sectionChat");
  bind("btnContrato", "sectionContrato");
  bind("btnRelatorios", "sectionRelatorios");
  bind("btnCobrancas", "sectionCobrancas");
  bind("btnCRM", "sectionCRM");

  // ==========================================
  // API HELPER
  // ==========================================
  async function api(url, method = "GET", body = null) {
    const token = localStorage.getItem("token");
    if (!token) {
      location.href = "/";
      return;
    }

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    };

    if (body) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("token");
      location.href = "/";
      return;
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro na API");

    return data;
  }

  // ==========================================
  // CHAT IA
  // ==========================================
  document.getElementById("chatSend")?.addEventListener("click", async () => {
    const input = document.getElementById("chatInput");
    const output = document.getElementById("chatOutput");
    if (!input || !output) return;

    const msg = input.value.trim();
    if (!msg) return;

    input.value = "";
    output.value += `\nVocê: ${msg}`;

    try {
      const r = await api("/api/ai/chat", "POST", { message: msg });
      const reply =
        r?.choices?.[0]?.message?.content || "Sem resposta";
      output.value += `\nIA: ${reply}`;
    } catch (e) {
      output.value += `\nErro: ${e.message}`;
    }
  });

  // ==========================================
  // CRM (LAZY LOAD)
  // ==========================================
  function loadCRM() {
    const iframe = document.querySelector("#sectionCRM iframe");
    if (iframe && !iframe.src) {
      iframe.src = "/crm";
    }
  }

  // ==========================================
  // LOGOUT GLOBAL
  // ==========================================
  window.logout = function () {
    localStorage.removeItem("token");
    location.href = "/";
  };
});
