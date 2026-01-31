// ==========================================
// ativar.js — PIX + Confirmação manual (CORRIGIDO)
// ==========================================

// --------------------------
// Verifica se o usuário está logado
// --------------------------
(function checkAuth() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
  }
})();


// --------------------------
// GERAR PIX
// --------------------------
document.getElementById("gerarPix").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  msg.style.color = "black";
  msg.textContent = "Gerando QR Code...";

  try {
    const res = await fetch("/api/payment/pix/static", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      msg.textContent = data.error || "Erro ao gerar PIX.";
      msg.style.color = "red";
      return;
    }

    document.getElementById("pixArea").style.display = "block";
    document.getElementById("qrText").textContent = data.qrCode;

    msg.textContent = "Use o app do seu banco para pagar via PIX.";
    msg.style.color = "green";

  } catch (err) {
    msg.textContent = "Erro de conexão com o servidor.";
    msg.style.color = "red";
  }
});


// --------------------------
// CONFIRMAR PAGAMENTO
// --------------------------
document.getElementById("confirmarPagamento").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  msg.style.color = "black";
  msg.textContent = "Confirmando pagamento...";

  try {
    const res = await fetch("/api/activation/confirm", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      msg.textContent = data.error || "Erro ao ativar assinatura.";
      msg.style.color = "red";
      return;
    }

    msg.textContent = "Assinatura ativada! Redirecionando...";
    msg.style.color = "green";

    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 1500);

  } catch (err) {
    msg.textContent = "Erro de conexão.";
    msg.style.color = "red";
  }
});
