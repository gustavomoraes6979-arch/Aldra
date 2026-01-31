// auth.js
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const resp = await fetch("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || "Login falhou");
    // salvar token
    localStorage.setItem("token", json.token);
    window.location.href = "/dashboard.html";
  } catch (err) {
    document.getElementById("msg").innerText = "Erro: " + err.message;
  }
});
