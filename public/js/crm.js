// ============================================
// CRM.JS — Aldra (SIMPLES, COMPLETO E FUNCIONAL)
// Compatível com crm.html + server.js atual
// ============================================

const token = localStorage.getItem("token");
if (!token) location.href = "/";

const headers = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + token
};

let editId = null;

// ============================================
// UTIL
// ============================================
function escapeHtml(t) {
  return String(t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================
// LOAD CLIENTES
// ============================================
async function loadClients() {
  const box = document.getElementById("clients");
  box.innerHTML = "<i>Carregando clientes...</i>";

  try {
    const res = await fetch("/api/crm", { headers });
    const data = await res.json();
    box.innerHTML = "";

    if (!data.length) {
      box.innerHTML = "<small>Nenhum cliente cadastrado.</small>";
      return;
    }

    data.forEach(c => {
      const div = document.createElement("div");
      div.className = "card client";
      div.innerHTML = `
        <b>${escapeHtml(c.name)}</b><br>
        ${escapeHtml(c.email || "")}<br>
        ${escapeHtml(c.phone || "")}<br>
        <small>Status: ${escapeHtml(c.status)}</small><br>
        <small>${escapeHtml(c.notes || "")}</small><br><br>

        <button onclick='openEdit(${JSON.stringify(c)})'>Editar</button>
        <button class="btn-ai" onclick="aiSuggest(${c.id})">IA 💡</button>
        <button class="btn-danger" onclick="deleteClient(${c.id})">Excluir</button>
      `;
      box.appendChild(div);
    });

  } catch (e) {
    box.innerHTML = "<span style='color:red'>Erro ao carregar CRM</span>";
  }
}

// ============================================
// CREATE CLIENT
// ============================================
async function createClient() {
  const body = {
    name: name.value.trim(),
    email: email.value.trim(),
    phone: phone.value.trim(),
    status: status.value,
    notes: notes.value.trim()
  };

  if (!body.name) {
    msg.style.color = "red";
    msg.innerText = "Nome é obrigatório";
    return;
  }

  try {
    const res = await fetch("/api/crm", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error();

    msg.style.color = "green";
    msg.innerText = "Cliente salvo com sucesso!";

    name.value = "";
    email.value = "";
    phone.value = "";
    notes.value = "";
    status.value = "lead";

    loadClients();

  } catch {
    msg.style.color = "red";
    msg.innerText = "Erro ao salvar cliente";
  }
}

// ============================================
// EDITAR
// ============================================
function openEdit(c) {
  editId = c.id;
  eName.value = c.name;
  eEmail.value = c.email || "";
  ePhone.value = c.phone || "";
  eStatus.value = c.status;
  eNotes.value = c.notes || "";
  editModal.style.display = "flex";
}

function closeEdit() {
  editModal.style.display = "none";
}

async function saveEdit() {
  try {
    await fetch("/api/crm/" + editId, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        name: eName.value.trim(),
        email: eEmail.value.trim(),
        phone: ePhone.value.trim(),
        status: eStatus.value,
        notes: eNotes.value.trim()
      })
    });

    closeEdit();
    loadClients();

  } catch {
    alert("Erro ao editar cliente");
  }
}

// ============================================
// DELETE
// ============================================
async function deleteClient(id) {
  if (!confirm("Excluir este cliente?")) return;

  try {
    await fetch("/api/crm/" + id, {
      method: "DELETE",
      headers
    });

    loadClients();
  } catch {
    alert("Erro ao excluir cliente");
  }
}

// ============================================
// IA
// ============================================
async function aiSuggest(id) {
  try {
    const res = await fetch("/api/crm/ai/" + id, { headers });
    const data = await res.json();
    alert("💡 Sugestão da IA:\n\n" + (data.text || "Sem resposta"));
  } catch {
    alert("Erro ao consultar IA");
  }
}

// INIT
loadClients();
