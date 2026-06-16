// 경량 RAG — 과거 CS 답변 예시를 임베딩해 코사인 유사도로 top-k 검색.
//
// 설계:
//   - examples.json(질문/답변 쌍)을 최초 1회 임베딩하고 chrome.storage.local에 캐시한다.
//   - 캐시 키는 예시 본문 해시 + 임베딩 모델명 → 예시가 바뀌면 자동 재계산.
//   - 임베딩 키가 없거나 호출 실패 시 키워드 폴백(토큰 교집합)으로 동작한다.

import { embed } from "./openai.js";

const CACHE_KEY = "rag_cache_v1";

function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function keywordScore(query, doc) {
  const norm = (s) => new Set(s.toLowerCase().match(/[a-z0-9가-힣]+/g) || []);
  const q = norm(query);
  const d = norm(doc);
  let hit = 0;
  for (const t of q) if (d.has(t)) hit++;
  return q.size ? hit / q.size : 0;
}

// 예시 임베딩 빌드(+캐시)
export async function ensureIndex({ apiKey, examples, embedModel }) {
  const signature = await sha256(JSON.stringify(examples) + "|" + embedModel);
  const cached = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY];
  if (cached && cached.signature === signature) return cached;

  if (!apiKey) return { signature, vectors: null, examples }; // 키워드 폴백 모드

  const inputs = examples.map((e) => `${e.question}\n${e.answer}`);
  const vectors = await embed({ apiKey, model: embedModel, input: inputs });
  const index = { signature, vectors, examples };
  await chrome.storage.local.set({ [CACHE_KEY]: index });
  return index;
}

export async function retrieve({ apiKey, query, index, k = 3, embedModel }) {
  const { examples, vectors } = index;
  if (vectors && apiKey) {
    const [qv] = await embed({ apiKey, model: embedModel, input: [query] });
    return examples
      .map((e, i) => ({ ...e, score: cosine(qv, vectors[i]) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
  // 폴백: 키워드 교집합
  return examples
    .map((e) => ({ ...e, score: keywordScore(query, `${e.question} ${e.answer}`) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
