const fields = ["apiKey", "model", "embedModel", "topK"];
const DEFAULTS = { model: "gpt-4o-mini", embedModel: "text-embedding-3-small", topK: 3 };

async function load() {
  const s = await chrome.storage.sync.get([...fields, "glossary"]);
  document.getElementById("apiKey").value = s.apiKey || "";
  document.getElementById("model").value = s.model || DEFAULTS.model;
  document.getElementById("embedModel").value = s.embedModel || DEFAULTS.embedModel;
  document.getElementById("topK").value = s.topK || DEFAULTS.topK;
  document.getElementById("glossary").value = s.glossary
    ? JSON.stringify(s.glossary, null, 2)
    : "";
}

async function save() {
  const status = document.getElementById("status");
  const payload = {
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("model").value.trim() || DEFAULTS.model,
    embedModel: document.getElementById("embedModel").value.trim() || DEFAULTS.embedModel,
    topK: Math.max(1, Math.min(8, Number(document.getElementById("topK").value) || DEFAULTS.topK)),
  };
  const raw = document.getElementById("glossary").value.trim();
  if (raw) {
    try {
      payload.glossary = JSON.parse(raw);
    } catch {
      status.style.color = "#b91c1c";
      status.textContent = "용어사전 JSON 형식 오류";
      return;
    }
  } else {
    payload.glossary = null;
  }
  await chrome.storage.sync.set(payload);
  status.style.color = "#16a34a";
  status.textContent = "저장됨 ✓";
  setTimeout(() => (status.textContent = ""), 1500);
}

document.getElementById("save").addEventListener("click", save);
load();
