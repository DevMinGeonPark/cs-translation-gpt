# CS Translation GPT

> 다국어 CS 상담 보조 크롬 확장(Manifest V3). 상담사가 **외국어 문의를 드래그하면 사이드바에 한국어 번역 + 회신 초안을 동시에 표시**하고, 회신 초안은 **과거 답변(RAG) 검색**으로 톤·정책을 맞춘다.

원본은 Hiredivercity에서 외국인 RC(외국인등록증) 발급 다국어 온라인 CS 업무 중, 1건당 평균 처리시간을 줄이기 위해 만든 사내 도구다. 본 저장소는 그 개념을 **클린룸으로 재구현한 포트폴리오 버전**이다(사내 코드/데이터 미포함, 예시 데이터는 합성).

## 동작 흐름

```
[CS 풀 화면에서 영어 문의 드래그]
        │  (mouseup → 트리거 버튼 / 우클릭 메뉴)
        ▼
[content script] 선택 텍스트 추출 → background로 전달
        ▼
[background service worker]
   1) RAG: examples(과거 답변) 임베딩 → 코사인 유사도 top-k 검색
   2) GPT: 용어사전(CoT) + RAG 예시 주입 → 번역/요약/회신(JSON) 생성
        ▼
[사이드바] 번역 · 요약 · 추천 회신(복사) · 적용 용어 · RAG 참고 예시 표시
```

## 왜 이렇게 설계했나 (의사결정)

- **번역 + 회신 동시 제공**: 단순 번역기는 "내용 파악"만 해결. CS는 회신 작성까지가 일이라, 회신 초안을 같이 줘서 단계를 합쳤다.
- **용어사전 고정(CoT)**: 일반 번역기가 "Korea University"를 엉뚱하게 의역해 신뢰도가 떨어지는 문제 → 고유명사/비자코드/정책 용어를 system prompt에 고정.
- **RAG로 답변 일관성**: 같은 유형 문의(RC 발급 기간, 주소 정정, 대리 수령 등)에 매번 다른 톤으로 답하지 않도록 과거 답변을 검색해 few-shot으로 주입.
- **키는 background에만**: API 키가 상담 페이지(content script)에 노출되지 않도록 모든 OpenAI 호출은 service worker에서만.

## 구조

```
manifest.json              # MV3
src/
  background.js            # 요청 오케스트레이션 (RAG → GPT)
  content/
    content.js            # 드래그 감지 + 사이드바 UI
    sidebar.css
  popup/                   # 설정(API키/모델/Top-K/용어사전)
    popup.html, popup.js
  lib/
    openai.js             # Chat Completions + Embeddings
    rag.js                # 임베딩 인덱스 캐시 + 코사인 검색 (+키워드 폴백)
    prompts.js            # 용어사전 CoT + RAG 주입 + JSON 출력 강제
  data/
    glossary.json         # 용어사전(고유명사/비자코드) — 합성
    examples.json         # 과거 답변 예시(RAG 지식) — 합성
```

## 설치 / 사용

1. `chrome://extensions` → 우상단 **개발자 모드** ON → **압축해제된 확장 프로그램 로드** → 이 폴더 선택
2. 확장 아이콘 클릭 → **OpenAI API Key** 입력 후 저장 (모델/Top-K/용어사전도 여기서)
3. 아무 페이지에서 외국어 텍스트를 드래그 → 떠오르는 **"CS 번역+회신"** 버튼 클릭 (또는 우클릭 → "CS 번역 + 회신 추천")
4. 오른쪽 사이드바에서 번역·요약·추천 회신 확인, 회신은 **복사** 버튼으로 바로 사용

> API 키가 없으면 RAG는 **키워드 폴백**으로 동작하지만, 번역/회신 생성은 키가 필요하다.

## 기술 스택

Manifest V3 · JavaScript(ES Modules, service worker) · Chrome Extension API(storage/contextMenus/scripting) · OpenAI Chat Completions(JSON mode) · OpenAI Embeddings · 코사인 유사도 RAG

## 한계 / TODO

- 임베딩 인덱스는 `chrome.storage.local` 캐시(예시 변경 시 자동 재계산). 예시가 커지면 벡터DB로 분리 필요.
- 번역 언어 자동 감지는 모델에 위임 — 저신뢰 입력에 대한 가드 보강 여지.
- 회신 톤/정책을 조직별로 분리하려면 glossary/examples를 프로파일 단위로 확장.
