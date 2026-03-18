// ==========================================
// dashboard.js — CLIENTE (ALDRA FINAL FIX)
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

const adminBtn = document.getElementById("adminBtn");

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
// 🔥 ATUALIZA STATUS GLOBAL (NOVO)
// ==========================================

function updateSubscription(status){
  if(status === "active"){
    hideAlert();
  }else{
    showAlert();
  }
}


// ==========================================
// VERIFICAR USUÁRIO
// ==========================================

async function checkUser(){

  try{

    const res = await fetch("/auth/me",{
      headers:{ Authorization:"Bearer "+token }
    });

    if(res.status === 401){
      logout();
      return;
    }

    const data = await safeJson(res);

    // ADMIN
    if(data.is_admin){
      isAdmin = true;
      if(adminBtn) adminBtn.style.display="inline-block";
    }

    // 🔥 ATUALIZA STATUS
    updateSubscription(data.subscription_status);

  }catch(err){
    console.error("Erro usuário:",err);
    showAlert();
  }

}


// ==========================================
// 🔥 VERIFICAÇÃO REAL + SINCRONIZAÇÃO
// ==========================================

async function checkPaymentStatus(){

  try{

    const res = await fetch("/subscription/status",{
      headers:{ Authorization:"Bearer "+token }
    });

    const data = await res.json();

    if(data.status === "active"){

      updateSubscription("active");

      console.log("✅ Assinatura ativada automaticamente");

      return true;

    }

    return false;

  }catch(err){

    console.error("Erro pagamento:",err);
    return false;

  }

}


// ==========================================
// ALERTA ASSINATURA
// ==========================================

function showAlert(){
  subscriptionActive = false;
  if(alertBox) alertBox.style.display="block";
}

function hideAlert(){
  subscriptionActive = true;
  if(alertBox) alertBox.style.display="none";
  if(pixBox) pixBox.style.display="none";
  console.log("✅ Assinatura ativa");
}


// ==========================================
// RENDER PIX
// ==========================================

function renderPix(data){

  const pixData =
  data?.point_of_interaction?.transaction_data ||
  data?.transaction_data;

  if(!pixData){
    alert("Erro ao gerar PIX.");
    return;
  }

  if(pixData.qr_code_base64 && pixQr)
    pixQr.src = "data:image/png;base64," + pixData.qr_code_base64;

  if(pixData.qr_code && pixCopiaCola)
    pixCopiaCola.value = pixData.qr_code;

  if(pixBox)
    pixBox.style.display="block";

}


// ==========================================
// CRIAR PIX
// ==========================================

window.ativarPlano = async function(){

  try{

    if(pixBox) pixBox.style.display="none";

    const res = await fetch("/subscription/create",{
      method:"POST",
      headers:{ Authorization:"Bearer "+token }
    });

    if(!res.ok){
      alert("Erro ao criar pagamento.");
      return;
    }

    const data = await safeJson(res);

    renderPix(data);

    startPaymentCheck();

  }catch(err){

    console.error(err);
    alert("Erro ao criar pagamento.");

  }

};


// ==========================================
// 🔥 LOOP DE PAGAMENTO MELHORADO
// ==========================================

function startPaymentCheck(){

  let tries = 0;

  const interval = setInterval(async ()=>{

    tries++;

    const pago = await checkPaymentStatus();

    if(pago){
      clearInterval(interval);
      alert("✅ Pagamento confirmado! Ferramentas liberadas.");
      return;
    }

    if(tries > 30){
      clearInterval(interval);
      console.log("⏹️ Parando verificação");
    }

  },4000);

}


// ==========================================
// SEÇÕES
// ==========================================

const sections=[
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

function hideAllSections(){
  sections.forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.remove("active");
  });
}


// ==========================================
// MOSTRAR SEÇÃO
// ==========================================

function showSection(name){

  if(!subscriptionActive){
    alert("⚠️ Sua assinatura está inativa.");
    return;
  }

  if(name==="Admin" && !isAdmin){
    alert("🚫 Acesso restrito ao administrador.");
    return;
  }

  hideAllSections();

  const el=document.getElementById("section"+name);

  if(el) el.classList.add("active");

  if(name==="CRM") loadClients();
  if(name==="Estoque") loadProdutos();
  if(name==="Financeiro") loadFinanceiro();

}

window.showSection = showSection;


// ==========================================
// CRM
// ==========================================

async function loadClients(){

  try{

    const res = await fetch("/crm",{
      headers:{ Authorization:"Bearer "+token }
    });

    const data = await safeJson(res);

    if(!crmLista || !Array.isArray(data)) return;

    crmLista.innerHTML="";

    data.forEach(client=>{
      const row=document.createElement("tr");
      row.innerHTML=`
      <td>${client.name||""}</td>
      <td>${client.email||""}</td>
      <td>${client.phone||""}</td>
      `;
      crmLista.appendChild(row);
    });

  }catch(err){
    console.error("Erro CRM:",err);
  }

}


// ==========================================
// ESTOQUE
// ==========================================

async function loadProdutos(){

  try{

    const res=await fetch("/products",{
      headers:{ Authorization:"Bearer "+token }
    });

    const data=await safeJson(res);

    if(!estoqueLista) return;

    estoqueLista.innerHTML="";

    data.forEach(p=>{
      const row=document.createElement("tr");
      row.innerHTML=`
      <td>${p.name}</td>
      <td>${p.sku}</td>
      <td>${p.quantity}</td>
      <td>${p.price}</td>
      `;
      estoqueLista.appendChild(row);
    });

  }catch(err){
    console.error(err);
  }

}


// ==========================================
// FINANCEIRO
// ==========================================

async function loadFinanceiro(){

  try{

    const res=await fetch("/finance/accounts",{
      headers:{ Authorization:"Bearer "+token }
    });

    const data=await safeJson(res);

    if(!financeiroLista) return;

    financeiroLista.innerHTML="";

    data.forEach(conta=>{
      const row=document.createElement("tr");
      row.innerHTML=`
      <td>${conta.description}</td>
      <td>${conta.type}</td>
      <td>${conta.value}</td>
      <td>${conta.status}</td>
      `;
      financeiroLista.appendChild(row);
    });

  }catch(err){
    console.error(err);
  }

}


// ==========================================
// LOGOUT
// ==========================================

window.logout=function(){
  localStorage.removeItem("token");
  window.location.href="/";
};


// ==========================================
// INIT
// ==========================================

async function init(){

  await checkUser();

  // 🔥 sincroniza sempre
  setInterval(async ()=>{
    await checkUser();
    await checkPaymentStatus();
  },10000);

  showSection("PDF");

}

init();

})();