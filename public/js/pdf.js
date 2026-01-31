// pdf.js
const form = document.getElementById("pdfForm");
const resultEl = document.getElementById("result");
const loadingEl = document.getElementById("loading");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = form.file.files[0];
  if (!file) return alert("Escolha um PDF");

  const token = localStorage.getItem("token");
  if (!token) return alert("Faça login primeiro");

  const fd = new FormData();
  fd.append("file", file);

  loadingEl.style.display = "block";
  resultEl.textContent = "";

  try {
    const resp = await fetch("/api/pdf/analyze", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Erro na análise");
    // mostrar resultado amigável:
    const { extractedText, keyData, aiResult } = json;
    let out = "=== Key Data ===\n";
    out += "CNPJs: " + (keyData.cnpjs.join(", ") || "Nenhum") + "\n";
    out += "Dates: " + (keyData.dates.join(", ") || "Nenhuma") + "\n";
    out += "Values: " + (keyData.values.join(", ") || "Nenhum") + "\n\n";
    out += "=== IA Analysis ===\n" + JSON.stringify(aiResult, null, 2) + "\n\n";
    out += "=== Extracted text (preview) ===\n" + extractedText.slice(0, 2000);
    resultEl.textContent = out;
  } catch (err) {
    resultEl.textContent = "Erro: " + err.message;
  } finally {
    loadingEl.style.display = "none";
  }
});
