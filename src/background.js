// 백그라운드 서비스 워커 — content script의 처리 요청을 받아
// (1) RAG 검색 → (2) GPT 번역+회신 생성 → 결과 반환. API 키는 여기서만 사용.

import { chatJSON } from "./lib/openai.js";
import { ensureIndex, retrieve } from "./lib/rag.js";
import { buildSystemPrompt, buildUserPrompt } from "./lib/prompts.js";

const DEFAULTS = {
  model: "gpt-5.4-mini",
  embedModel: "text-embedding-3-small",
  topK: 3,
};

async function loadJSON(path) {
  const res = await fetch(chrome.runtime.getURL(path));
  return res.json();
}

async function getSettings() {
  const s = await chrome.storage.sync.get(["apiKey", "model", "embedModel", "topK", "glossary"]);
  return { ...DEFAULTS, ...s };
}

async function getGlossary(settings) {
  if (settings.glossary && Object.keys(settings.glossary).length) return settings.glossary;
  return loadJSON("src/data/glossary.json");
}

async function process(customerText) {
  const settings = await getSettings();
  if (!settings.apiKey) throw new Error("API 키가 설정되지 않았습니다. 확장 아이콘 → 설정에서 입력하세요.");

  const [glossary, examples] = await Promise.all([
    getGlossary(settings),
    loadJSON("src/data/examples.json"),
  ]);

  // 1) RAG: 과거 답변 예시 검색
  const index = await ensureIndex({
    apiKey: settings.apiKey,
    examples,
    embedModel: settings.embedModel,
  });
  const retrieved = await retrieve({
    apiKey: settings.apiKey,
    query: customerText,
    index,
    k: settings.topK,
    embedModel: settings.embedModel,
  });

  // 2) GPT: 번역 + 요약 + 회신 초안
  const result = await chatJSON({
    apiKey: settings.apiKey,
    model: settings.model,
    system: buildSystemPrompt(glossary),
    user: buildUserPrompt(customerText, retrieved),
  });

  return { ...result, retrieved: retrieved.map((r) => ({ question: r.question, score: r.score })) };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CS_PROCESS") {
    process(msg.text)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
    return true; // async
  }
});

// 우클릭 컨텍스트 메뉴로도 트리거 가능
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "cs-translate",
    title: "CS 번역 + 회신 추천",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "cs-translate" && info.selectionText && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "CS_TRIGGER", text: info.selectionText });
  }
});
