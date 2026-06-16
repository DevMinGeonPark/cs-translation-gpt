// CoT 프롬프트 빌더 — 용어사전 보존 + RAG 예시 주입 + 구조화 출력 강제
//
// 핵심 의사결정:
//   1) 단순 번역기와 달리 "번역 + 회신 초안"을 동시에 생성한다 (CS 길이 부담 완화).
//   2) 용어사전(고유명사/정책 용어)을 system prompt에 고정해 오역을 차단한다.
//   3) 과거 답변 예시(RAG)를 few-shot으로 주입해 톤·정책을 일관되게 유지한다.
//   4) 출력은 JSON으로 강제해 사이드바 렌더가 깨지지 않게 한다.

export function buildSystemPrompt(glossary) {
  const glossaryLines = Object.entries(glossary || {})
    .map(([term, rule]) => `- "${term}" → ${rule}`)
    .join("\n");

  return [
    "당신은 외국인 대상 CS(고객지원) 상담사를 돕는 다국어 어시스턴트입니다.",
    "상담사가 드래그한 고객 메시지(주로 영어/일본어/중국어/베트남어 등)를 처리합니다.",
    "",
    "## 작업",
    "1. 고객 메시지를 한국어로 정확히 번역한다. (상담사가 빠르게 파악하도록)",
    "2. 메시지를 1~2문장으로 요약한다.",
    "3. 고객에게 보낼 회신 초안을 '고객의 원래 언어'로 작성한다.",
    "",
    "## 번역 규칙 (매우 중요)",
    "- 아래 용어사전의 항목은 규칙대로 처리한다. 고유명사는 임의로 의역하지 않는다.",
    glossaryLines || "- (등록된 용어 없음)",
    "",
    "## 회신 규칙",
    "- 정중하고 간결하게. 정책에 근거해 답한다. 모르면 추측하지 말고 확인이 필요하다고 안내한다.",
    "- 아래 '과거 답변 예시'가 제공되면 그 톤·구조·정책을 우선 따른다.",
    "",
    "## 출력 형식 (반드시 이 JSON만 출력)",
    '{ "sourceLang": "<감지 언어 코드>", "translation": "<한국어 번역>", "summary": "<한 줄 요약>", "suggestedReply": "<고객 언어 회신 초안>", "usedTerms": ["<적용한 용어사전 키>"] }',
  ].join("\n");
}

export function buildUserPrompt(customerText, retrievedExamples) {
  const ex = (retrievedExamples || [])
    .map(
      (e, i) =>
        `### 예시 ${i + 1} (유사도 ${e.score?.toFixed?.(3) ?? "?"})\n[고객] ${e.question}\n[회신] ${e.answer}`
    )
    .join("\n\n");

  return [
    ex ? `## 과거 답변 예시 (RAG 검색 결과)\n${ex}\n` : "",
    "## 처리할 고객 메시지",
    customerText,
    "",
    "위 메시지를 작업 1~3에 따라 처리하고, 지정된 JSON 형식으로만 답하라.",
  ].join("\n");
}
