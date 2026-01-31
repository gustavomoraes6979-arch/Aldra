// ============================================
// CRM.JS — versão final (IA + histórico + tarefas)
// ============================================

const token = localStorage.getItem("token");
if (!token) window.location.href = "/login";

// Cache dos clientes
const clientsById = {};

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

// ============================================
// CRIAR CLIENTE
// ============================================
async function createClient() {
  const nome = cName.value.trim();
  const email = cEmail.value.trim();
  const telefone = cPhone.value.trim();
  const notas = cNotes.value.trim();
  const status = cStatus.value;

  if (!nome) {
    crmMsg.textContent = "O nome do cliente é obrigatório.";
    crmMsg.style.color = "red";
    return;
  }

  crmMsg.textContent = "Salvando...";
  crmMsg.style.color = "black";

  try {
    const res = await fetch("/api/crm/clientes/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ nome, email, telefone, empresa: "", notas, status })
    });

    const data = await safeJson(res);

    if (!res.ok || !data?.success) {
      crmMsg.textContent = data?.error || "Erro ao salvar";
      crmMsg.style.color = "red";
      return;
    }

    crmMsg.textContent = "Cliente salvo!";
    crmMsg.style.color = "green";

    cName.value = "";
    cEmail.value = "";
    cPhone.value = "";
    cNotes.value = "";
    cStatus.value = "lead";

    loadClients();

  } catch {
    crmMsg.textContent = "Erro interno.";
    crmMsg.style.color = "red";
  }
}

// ============================================
// LISTAR CLIENTES
// ============================================
async function loadClients() {
  const box = document.getElementById("clients");
  box.innerHTML = "Carregando...";

  try {
    const res = await fetch("/api/crm/clientes", {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);

    if (!res.ok) {
      box.innerHTML = "Erro ao carregar clientes.";
      return;
    }

    box.innerHTML = "";
    if (!data?.length) {
      box.innerHTML = "Nenhum cliente cadastrado";
      return;
    }

    data.forEach(c => clientsById[c.id] = c);

    data.forEach(c => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <b>${escapeHtml(c.nome)}</b><br>
        <small>Email:</small> ${escapeHtml(c.email || "-")}<br>
        <small>Telefone:</small> ${escapeHtml(c.telefone || "-")}<br>
        <small>Status:</small> ${escapeHtml(c.status || "lead")}<br>
        <small>Notas:</small> ${escapeHtml(c.notas || "Nenhuma")}<br><br>

        <div class="client-actions">
          <button class="small" onclick="openEdit(${c.id})">✏️ Editar</button>
          <button class="small" onclick="openTimeline(${c.id})">📜 Histórico</button>
          <button class="small" onclick="openTasks(${c.id})">📌 Tarefas</button>
          <button class="small" onclick="generateSummary(${c.id})">🧠 Resumo IA</button>
          <button class="small btn-danger" onclick="deleteClient(${c.id})">Excluir</button>
        </div>

        <div id="summary-${c.id}" class="summary" style="display:none"></div>
      `;

      box.appendChild(card);
    });

  } catch {
    box.innerHTML = "Erro ao carregar.";
  }
}

// ============================================
// EDITAR CLIENTE
// ============================================
function openEdit(id) {
  const c = clientsById[id];
  if (!c) return alert("Cliente não encontrado!");

  editId.value = id;
  eName.value = c.nome || "";
  eEmail.value = c.email || "";
  ePhone.value = c.telefone || "";
  eStatus.value = c.status || "lead";
  eNotes.value = c.notas || "";

  document.getElementById("editModal").style.display = "flex";
}

function closeEdit() {
  document.getElementById("editModal").style.display = "none";
}

async function saveEdit() {
  const id = editId.value;
  const nome = eName.value.trim();

  if (!nome) return alert("O nome é obrigatório.");

  const payload = {
    id,
    nome,
    email: eEmail.value.trim(),
    telefone: ePhone.value.trim(),
    empresa: "",
    notas: eNotes.value.trim(),
    status: eStatus.value
  };

  try {
    const res = await fetch("/api/crm/clientes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(payload)
    });

    const data = await safeJson(res);

    if (!res.ok || !data?.success) {
      alert(data?.error || "Erro ao editar");
      return;
    }

    closeEdit();
    loadClients();

  } catch {
    alert("Erro interno ao editar");
  }
}

// ============================================
// IA RESUMO DO CLIENTE
// ============================================
async function generateSummary(id) {
  const area = document.getElementById(`summary-${id}`);
  const cli = clientsById[id];

  area.style.display = "block";
  area.textContent = "Gerando resumo...";

  const res = await fetch("/api/crm/ia/resumo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ cliente: cli })
  });

  const data = await safeJson(res);
  area.textContent = data?.result || "Erro ao gerar resumo";
}

// ============================================
// EXCLUIR CLIENTE
// ============================================
async function deleteClient(id) {
  if (!confirm("Excluir cliente?")) return;

  await fetch("/api/crm/clientes/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ id })
  });

  loadClients();
}

// ============================================
// HISTÓRICO (TIMELINE)
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
  box.innerHTML = "Carregando...";

  const res = await fetch(`/api/crm/historico/${id}`, {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await safeJson(res);
  box.innerHTML = "";

  if (!data?.length) {
    box.innerHTML = "<i>Nenhum evento ainda.</i>";
    return;
  }

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "timeline-item";
    div.innerHTML = `
      <b>${escapeHtml(item.tipo)}</b><br>
      ${escapeHtml(item.descricao)}<br>
      <small>${item.created_at}</small>
    `;
    box.appendChild(div);
  });
}

async function addTimelineEntry() {
  const cliente_id = timelineClientId.value;
  const descricao = timelineNewEntry.value.trim();
  if (!descricao) return;

  await fetch("/api/crm/historico/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      cliente_id,
      tipo: "Anotação",
      descricao
    })
  });

  timelineNewEntry.value = "";
  loadTimeline(cliente_id);
}

// ============================================
// TAREFAS (FOLLOW-UP)
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
  box.innerHTML = "Carregando...";

  const res = await fetch(`/api/crm/tarefas/${id}`, {
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
      <b>${escapeHtml(t.titulo)}</b><br>
      <small>${escapeHtml(t.descricao || "")}</small><br>
      <small>Prazo: ${t.data_limite}</small><br>
      <small>Status: ${t.status}</small><br><br>

      <button class="small" onclick="finishTask(${t.id})">✔ Concluir</button>
    `;

    box.appendChild(div);
  });
}

async function createTask() {
  const cliente_id = taskClientId.value;
  const descricao = taskDesc.value.trim();
  const data_limite = taskDate.value;

  if (!descricao || !data_limite)
    return alert("Descrição e prazo são obrigatórios.");

  await fetch("/api/crm/tarefas/add", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      cliente_id,
      titulo: "Tarefa",
      descricao,
      data_limite
    })
  });

  taskDesc.value = "";
  taskDate.value = "";

  loadTasks(cliente_id);
}

async function finishTask(id) {
  await fetch("/api/crm/tarefas/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      id,
      status: "concluida"
    })
  });

  loadTasks(taskClientId.value);
}

// ============================================
// UTIL
// ============================================
function escapeHtml(t) {
  return String(t || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

loadClients();
