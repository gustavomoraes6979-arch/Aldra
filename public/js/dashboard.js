// ==========================================
// dashboard.js — CLIENTE (ERP ALDRA COMPLETO)
// ==========================================

console.log("🚀 Dashboard Aldra carregado");

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
const estoqueLista = document.getElementById("estoqueLista");
const financeiroLista = document.getElementById("financeiroLista");

const chatInput = document.getElementById("chatInput");
const chatBox = document.getElementById("chatBox");

let subscriptionActive = false;

// ==========================================
// SAFE JSON
// ==========================================

async function safeJson(res) {

try {

const text = await res.text();

if (!text || text.trim().startsWith("<"))
return {};

return JSON.parse(text);

} catch {

return {};

}

}

// ==========================================
// ALERTA ASSINATURA
// ==========================================

function showAlert() {

subscriptionActive = false;

if (alertBox)
alertBox.style.display = "block";

}

function hideAlert() {

subscriptionActive = true;

if (alertBox)
alertBox.style.display = "none";

if (pixBox)
pixBox.style.display = "none";

console.log("✅ Assinatura ativa");

}

// ==========================================
// RENDER PIX
// ==========================================

function renderPix(data) {

const pixData =
data?.point_of_interaction?.transaction_data ||
data?.transaction_data;

if (!pixData) {
alert("Erro ao gerar PIX.");
return;
}

if (pixData.qr_code_base64 && pixQr)
pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;

if (pixData.qr_code && pixCopiaCola)
pixCopiaCola.value = pixData.qr_code;

if (pixBox)
pixBox.style.display = "block";

}

// ==========================================
// VERIFICAR ASSINATURA
// ==========================================

async function checkSubscription() {

try {

const res = await fetch("/subscription/check", {
headers: {
Authorization: "Bearer " + token
}
});

if (!res.ok) {
showAlert();
return;
}

const data = await safeJson(res);

console.log("Status assinatura:", data.status);

if (data.status === "active") {

hideAlert();

} else {

showAlert();

}

} catch (err) {

console.error("Erro verificar assinatura:", err);
showAlert();

}

}

// ==========================================
// CRIAR PIX
// ==========================================

window.ativarPlano = async function () {

try {

if (pixBox)
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

// ==========================================
// SEÇÕES
// ==========================================

const sections = [

"sectionPDF",
"sectionContrato",
"sectionCobranca",
"sectionRelatorios",
"sectionChat",
"sectionCRM",
"sectionEstoque",
"sectionFinanceiro",
"sectionFiscal",
"sectionCertidoes",
"sectionAdmin"

];

function hideAllSections() {

sections.forEach(id => {

const el = document.getElementById(id);

if (el)
el.classList.remove("active");

});

}

// ==========================================
// MOSTRAR SEÇÃO
// ==========================================

function showSection(name) {

if (!subscriptionActive) {

alert("⚠️ Sua assinatura está inativa.");
return;

}

hideAllSections();

const el = document.getElementById("section" + name);

if (el)
el.classList.add("active");

if (name === "CRM") loadClients();
if (name === "Estoque") loadProdutos();
if (name === "Financeiro") loadFinanceiro();

}

window.showSection = showSection;

// ==========================================
// CRM
// ==========================================

async function loadClients() {

try {

const res = await fetch("/crm", {
headers: {
Authorization: "Bearer " + token
}
});

const data = await safeJson(res);

if (!crmLista || !Array.isArray(data))
return;

crmLista.innerHTML = "";

data.forEach(client => {

const row = document.createElement("tr");

row.innerHTML = `
<td>${client.name || ""}</td>
<td>${client.email || ""}</td>
<td>${client.phone || ""}</td>
`;

crmLista.appendChild(row);

});

} catch (err) {

console.error("Erro CRM:", err);

}

}

// ==========================================
// SALVAR CLIENTE
// ==========================================

window.salvarCliente = async function () {

const nome = document.getElementById("crmNome").value;
const email = document.getElementById("crmEmail").value;
const telefone = document.getElementById("crmTelefone").value;

if (!nome)
return alert("Informe o nome.");

try {

await fetch("/crm", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: "Bearer " + token
},
body: JSON.stringify({
name: nome,
email,
phone: telefone
})
});

loadClients();

} catch (err) {

console.error(err);

}

};

// ==========================================
// ESTOQUE
// ==========================================

async function loadProdutos() {

try {

const res = await fetch("/products", {
headers: {
Authorization: "Bearer " + token
}
});

const data = await safeJson(res);

if (!estoqueLista)
return;

estoqueLista.innerHTML = "";

data.forEach(p => {

const row = document.createElement("tr");

row.innerHTML = `
<td>${p.name}</td>
<td>${p.sku}</td>
<td>${p.quantity}</td>
<td>${p.price}</td>
`;

estoqueLista.appendChild(row);

});

} catch (err) {

console.error(err);

}

}

// ==========================================
// FINANCEIRO
// ==========================================

async function loadFinanceiro() {

try {

const res = await fetch("/finance/accounts", {
headers: {
Authorization: "Bearer " + token
}
});

const data = await safeJson(res);

if (!financeiroLista)
return;

financeiroLista.innerHTML = "";

data.forEach(conta => {

const row = document.createElement("tr");

row.innerHTML = `
<td>${conta.description}</td>
<td>${conta.type}</td>
<td>${conta.value}</td>
<td>${conta.status}</td>
`;

financeiroLista.appendChild(row);

});

} catch (err) {

console.error(err);

}

}

// ==========================================
// CHAT IA
// ==========================================

window.enviarMensagemIA = async function () {

const msg = chatInput.value;

if (!msg) return;

chatBox.innerHTML += `<div><b>Você:</b> ${msg}</div>`;

chatInput.value = "";

try {

const res = await fetch("/ai/chat", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: "Bearer " + token
},
body: JSON.stringify({ message: msg })
});

const data = await safeJson(res);

chatBox.innerHTML += `<div><b>IA:</b> ${data.reply}</div>`;

chatBox.scrollTop = chatBox.scrollHeight;

} catch (err) {

console.error(err);

}

};

// ==========================================
// IA ANALISE
// ==========================================

window.analisarEmpresa = async function () {

try {

const res = await fetch("/ai/analyze", {
method: "POST",
headers: {
Authorization: "Bearer " + token
}
});

const data = await safeJson(res);

alert(data.analysis || "Sem análise");

} catch {

alert("Erro ao analisar empresa");

}

};

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

await checkSubscription();

/* verifica pagamento automaticamente */
setInterval(checkSubscription, 4000);

showSection("PDF");

}

init();

})();