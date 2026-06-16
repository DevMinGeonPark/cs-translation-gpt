// OpenAI API 클라이언트 (Chat Completions + Embeddings)
// service worker(백그라운드)에서만 호출 — API 키가 content script/페이지에 노출되지 않게 한다.

const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const EMBED_URL = "https://api.openai.com/v1/embeddings";

export async function chatJSON({ apiKey, model, system, user, temperature = 0.2 }) {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI chat ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    // JSON 모드여도 방어적으로 처리
    return { translation: content, summary: "", suggestedReply: "", usedTerms: [] };
  }
}

export async function embed({ apiKey, model = "text-embedding-3-small", input }) {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI embed ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.data.map((d) => d.embedding);
}
