// ============================================
// CRM.JS — Aldra (COMPLETO + IA)
// ============================================

const token = localStorage.getItem("token");
if (!token) location.href = "/";

const clientsById = {};

// ============================================
// UTIL
// ============================================
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function escapeHtml(t) {
  return String(t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function loading(el, text = "Processando...") {
  el.innerHTML = `<i>${text}</i>`;
}

// ============================================
// CLIENTES
// ============================================
async function loadClients() {
  const box = document.getElementById("clients");
  loading(box, "Carregando clientes...");

  const res = await fetch("/api/crm/clients", {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await safeJson(res);
  box.innerHTML = "";

  if (!data?.length) {
    box.innerHTML = "<i>Nenhum cliente cadastrado.</i>";
    return;
  }

  data.forEach(c => clientsById[c.id] = c);

  data.forEach(c => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <b>${escapeHtml(c.name)}</b><br>
      <small>Email:</small> ${escapeHtml(c.email || "-")}<br>
      <small>Telefone:</small> ${escapeHtml(c.phone || "-")}<br>
      <small>Status:</small> ${escapeHtml(c.status)}<br>
      <small>Notas:</small> ${escapeHtml(c.notes || "-")}<br><br>

      <div class="client-actions">
        <button class="small" onclick="openEdit(${c.id})">✏️ Editar</button>
        <button class="small" onclick="openTimeline(${c.id})">📜 Histórico</button>
        <button class="small" onclick="openTasks(${c.id})">📌 Tarefas</button>
        <button class="small" onclick="analyzeClientIA(${c.id})">🤖 IA</button>
        <button class="small btn-danger" onclick="deleteClient(${c.id})">Excluir</button>
      </div>
    `;
    box.appendChild(card);
  });
}

async function createClient() {
  const payload = {
    name: cName.value.trim(),
    email: cEmail.value.trim(),
    phone: cPhone.value.trim(),
    status: cStatus.value,
    notes: cNotes.value.trim()
  };

  if (!payload.name) return alert("Nome obrigatório.");

  await fetch("/api/crm/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify(payload)
  });

  cName.value = cEmail.value = cPhone.value = cNotes.value = "";
  cStatus.value = "lead";
  loadClients();
}

async function deleteClient(id) {
  if (!confirm("Excluir cliente?")) return;

  await fetch(`/api/crm/clients/${id}`, {
    method: "DELETE",
    headers: { Authorization: "Bearer " + token }
  });

  loadClients();
}

// ============================================
// EDITAR
// ============================================
function openEdit(id) {
  const c = clientsById[id];
  editId.value = id;
  eName.value = c.name;
  eEmail.value = c.email || "";
  ePhone.value = c.phone || "";
  eStatus.value = c.status;
  eNotes.value = c.notes || "";
  document.getElementById("editModal").style.display = "flex";
}

function closeEdit() {
  document.getElementById("editModal").style.display = "none";
}

async function saveEdit() {
  const id = editId.value;

  await fetch(`/api/crm/clients/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
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
}

// ============================================
// HISTÓRICO
// ============================================
function openTimeline(id) {
  timelineClientId.value = id;
  loadTimeline(id);
  document.getElementById("timelineModal").style.display = "flex";
}

function closeTimeline() {
  document.getElementById("timelineModal").style.display = "none";
}

async function loadTimeline(id) {
  const box = document.getElementById("timelineContent");
  loading(box, "Carregando histórico...");

  const res = await fetch(`/api/crm/timeline/${id}`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await safeJson(res);
  box.innerHTML = "";

  if (!data?.length) {
    box.innerHTML = "<i>Nenhum histórico.</i>";
    return;
  }

  data.forEach(i => {
    const div = document.createElement("div");
    div.className = "timeline-item";
    div.innerHTML = `
      ${escapeHtml(i.text)}<br>
      <small>${i.created_at}</small>
    `;
    box.appendChild(div);
  });
}

async function addTimelineEntry() {
  const id = timelineClientId.value;
  const text = timelineNewEntry.value.trim();
  if (!text) return;

  await fetch(`/api/crm/timeline/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ text })
  });

  timelineNewEntry.value = "";
  loadTimeline(id);
}

// ============================================
// TAREFAS
// ============================================
function openTasks(id) {
  taskClientId.value = id;
  loadTasks(id);
  document.getElementById("tasksModal").style.display = "flex";
}

function closeTasks() {
  document.getElementById("tasksModal").style.display = "none";
}

async function loadTasks(id) {
  const box = document.getElementById("tasksList");
  loading(box, "Carregando tarefas...");

  const res = await fetch(`/api/crm/tasks/${id}`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await safeJson(res);
  box.innerHTML = "";

  if (!data?.length) {
    box.innerHTML = "<i>Nenhuma tarefa.</i>";
    return;
  }

  data.forEach(t => {
    const div = document.createElement("div");
    div.className = "task-item";
    div.innerHTML = `
      ${escapeHtml(t.text)}<br>
      <small>Prazo: ${t.due_date || "-"}</small><br>
      <small>Status: ${t.done ? "Concluída" : "Pendente"}</small><br><br>
      ${!t.done ? `<button class="small" onclick="finishTask(${t.id})">✔ Concluir</button>` : ""}
    `;
    box.appendChild(div);
  });
}

async function createTask() {
  const id = taskClientId.value;
  const text = taskText.value.trim();
  const due_date = taskDate.value;

  if (!text) return alert("Descrição obrigatória.");

  await fetch(`/api/crm/tasks/${id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ text, due_date })
  });

  taskText.value = "";
  taskDate.value = "";
  loadTasks(id);
}

async function finishTask(id) {
  await fetch(`/api/crm/tasks/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ done: true })
  });

  loadTasks(taskClientId.value);
}

// ============================================
// IA — GROQ CRM
// ============================================
async function analyzeClientIA(id) {
  const client = clientsById[id];
  if (!client) return;

  const prompt = `
Cliente:
Nome: ${client.name}
Email: ${client.email || "-"}
Telefone: ${client.phone || "-"}
Status: ${client.status}
Notas: ${client.notes || "-"}

Analise o cliente e sugira:
- Resumo
- Próximas ações
- Estratégia de abordagem
`;

  alert("🤖 A IA está analisando o cliente...");

  const res = await fetch("/api/ai/crm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ prompt })
  });

  const data = await safeJson(res);
  if (!data?.response) {
    alert("Erro ao gerar análise da IA.");
    return;
  }

  eNotes.value = `${client.notes || ""}\n\n🤖 IA:\n${data.response}`;
  editId.value = id;
  document.getElementById("editModal").style.display = "flex";
}

// INIT
loadClients();
