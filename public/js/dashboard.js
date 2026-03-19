// ==========================================
// dashboard.js — ALDRA ERP COMPLETO
// ==========================================

console.log("🚀 Aldra Dashboard iniciado");

(function () {

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/";
  return;
}

// ELEMENTOS
const alertBox = document.getElementById("alert");
const pixBox = document.getElementById("pixBox");
const pixQr = document.getElementById("qrImage");
const pixCopiaCola = document.getElementById("pixCode");

const crmLista = document.getElementById("crmLista");
const estoqueLista = document.getElementById("estoqueLista");
const financeiroLista = document.getElementById("financeiroLista");

const adminBtn = document.getElementById("adminBtn");

// ESTADO
let subscriptionActive = false;
let isAdmin = false;

// ==========================================
// SAFE JSON
// ==========================================

async function safeJson(res){
  try{
    const text = await res.text();
    if(!text || text.trim().startsWith("<")) return {};
    return JSON.parse(text);
  }catch{
    return {};
  }
}

// ==========================================
// ALERTA
// ==========================================

function showAlert(){
  subscriptionActive = false;
  alertBox.style.display="block";
}

function hideAlert(){
  subscriptionActive = true;
  alertBox.style.display="none";
  pixBox.style.display="none";
  console.log("✅ Assinatura ativa");
}

function updateSubscription(status){
  status === "active" ? hideAlert() : showAlert();
}

// ==========================================
// USER
// ==========================================

async function checkUser(){

  const res = await fetch("/auth/me",{
    headers:{ Authorization:"Bearer "+token }
  });

  if(res.status === 401){
    logout();
    return;
  }

  const data = await safeJson(res);

  if(data.is_admin){
    isAdmin = true;
    adminBtn.style.display="inline-block";
  }

  updateSubscription(data.subscription_status);
}

// ==========================================
// PAGAMENTO
// ==========================================

async function checkPaymentStatus(){

  const res = await fetch("/subscription/status",{
    headers:{ Authorization:"Bearer "+token }
  });

  const data = await res.json();

  if(data.status === "active"){
    updateSubscription("active");
    return true;
  }

  return false;
}

// PIX
window.ativarPlano = async function(){

  const res = await fetch("/subscription/create",{
    method:"POST",
    headers:{ Authorization:"Bearer "+token }
  });

  const data = await safeJson(res);

  const pixData =
    data?.point_of_interaction?.transaction_data ||
    data?.transaction_data;

  if(!pixData){
    alert("Erro PIX");
    return;
  }

  pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;
  pixCopiaCola.value = pixData.qr_code;
  pixBox.style.display="block";

  startPaymentCheck();
};

function startPaymentCheck(){

  const interval = setInterval(async ()=>{

    const pago = await checkPaymentStatus();

    if(pago){
      clearInterval(interval);
      alert("✅ Pagamento confirmado!");
    }

  },4000);
}

// ==========================================
// SEÇÕES
// ==========================================

const sections = [
"sectionPDF","sectionContrato","sectionCobranca",
"sectionRelatorios","sectionChat","sectionCRM",
"sectionEstoque","sectionFinanceiro","sectionFiscal",
"sectionCertidoes","sectionAdmin"
];

function hideAllSections(){
  sections.forEach(id=>{
    document.getElementById(id)?.classList.remove("active");
  });
}

window.showSection = function(name){

  if(!subscriptionActive){
    alert("⚠️ Assinatura inativa");
    return;
  }

  if(name==="Admin" && !isAdmin){
    alert("🚫 Apenas admin");
    return;
  }

  hideAllSections();

  document.getElementById("section"+name)?.classList.add("active");

  if(name==="CRM") loadClients();
  if(name==="Estoque") loadProdutos();
  if(name==="Financeiro") loadFinanceiro();
};

// ==========================================
// CRM
// ==========================================

window.salvarCliente = async function(){

  const name = document.getElementById("crmNome").value;
  const email = document.getElementById("crmEmail").value;
  const phone = document.getElementById("crmTelefone").value;

  await fetch("/crm",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+token
    },
    body: JSON.stringify({ name,email,phone })
  });

  loadClients();
};

async function loadClients(){

  const res = await fetch("/crm",{ headers:{ Authorization:"Bearer "+token }});
  const data = await safeJson(res);

  crmLista.innerHTML="";

  data.forEach(c=>{
    const row=document.createElement("tr");

    row.innerHTML=`
    <td>${c.name}</td>
    <td>${c.email}</td>
    <td>${c.phone}</td>
    <td><button onclick="deleteClient(${c.id})">🗑️</button></td>
    `;

    crmLista.appendChild(row);
  });
}

window.deleteClient = async function(id){
  await fetch("/crm/"+id,{ method:"DELETE", headers:{ Authorization:"Bearer "+token }});
  loadClients();
};

// ==========================================
// ESTOQUE
// ==========================================

window.addProduto = async function(){

  const name = prompt("Produto:");
  const sku = prompt("SKU:");
  const quantity = prompt("Quantidade:");
  const price = prompt("Preço:");

  await fetch("/products",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+token
    },
    body: JSON.stringify({ name,sku,quantity,price })
  });

  loadProdutos();
};

async function loadProdutos(){

  const res = await fetch("/products",{ headers:{ Authorization:"Bearer "+token }});
  const data = await safeJson(res);

  estoqueLista.innerHTML="";

  data.forEach(p=>{
    const row=document.createElement("tr");

    row.innerHTML=`
    <td>${p.name}</td>
    <td>${p.sku}</td>
    <td>${p.quantity}</td>
    <td>${p.price}</td>
    <td><button onclick="deleteProduto(${p.id})">🗑️</button></td>
    `;

    estoqueLista.appendChild(row);
  });
}

window.deleteProduto = async function(id){
  await fetch("/products/"+id,{ method:"DELETE", headers:{ Authorization:"Bearer "+token }});
  loadProdutos();
};

// ==========================================
// FINANCEIRO
// ==========================================

window.addConta = async function(){

  const description = prompt("Descrição:");
  const type = prompt("Tipo (entrada/saida):");
  const value = prompt("Valor:");

  await fetch("/finance/accounts",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+token
    },
    body: JSON.stringify({ description,type,value })
  });

  loadFinanceiro();
};

async function loadFinanceiro(){

  const res = await fetch("/finance/accounts",{ headers:{ Authorization:"Bearer "+token }});
  const data = await safeJson(res);

  financeiroLista.innerHTML="";

  data.forEach(f=>{
    const row=document.createElement("tr");

    row.innerHTML=`
    <td>${f.description}</td>
    <td>${f.type}</td>
    <td>${f.value}</td>
    <td>${f.status}</td>
    <td><button onclick="deleteConta(${f.id})">🗑️</button></td>
    `;

    financeiroLista.appendChild(row);
  });
}

window.deleteConta = async function(id){
  await fetch("/finance/accounts/"+id,{ method:"DELETE", headers:{ Authorization:"Bearer "+token }});
  loadFinanceiro();
};

// ==========================================
// LOGOUT
// ==========================================

window.logout = function(){
  localStorage.removeItem("token");
  window.location.href="/";
};

// ==========================================
// INIT
// ==========================================

async function init(){

  await checkUser();

  setInterval(async ()=>{
    await checkUser();
    await checkPaymentStatus();
  },10000);

  showSection("PDF");
}

init();

})();