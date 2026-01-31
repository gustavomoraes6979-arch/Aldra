// dashboard.js
document.getElementById("logout").addEventListener("click", () => {
  localStorage.removeItem("token");
  window.location.href = "/";
});

// criar link de pagamento (exemplo)
async function createPayment() {
  const token = localStorage.getItem("token");
  const resp = await fetch("/api/payment/create", {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  });
  const json = await resp.json();
  if (resp.ok && json.init_point) {
    window.open(json.init_point, "_blank");
  } else {
    alert("Erro ao criar pagamento: " + (json.error || JSON.stringify(json)));
  }
}
