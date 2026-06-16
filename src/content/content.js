// Content script — 페이지에서 텍스트를 드래그하면 작은 버튼이 뜨고,
// 클릭(또는 우클릭 메뉴/자동 모드)하면 사이드바에 번역 + 추천 회신을 표시한다.

(() => {
  const PANEL_ID = "csgpt-panel";
  const BTN_ID = "csgpt-trigger";
  let lastText = "";

  // --- 드래그 후 떠오르는 트리거 버튼 ---
  function showTriggerButton(x, y, text) {
    removeTriggerButton();
    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "CS 번역+회신";
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      run(text);
      removeTriggerButton();
    });
    document.body.appendChild(btn);
  }
  function removeTriggerButton() {
    document.getElementById(BTN_ID)?.remove();
  }

  document.addEventListener("mouseup", (e) => {
    if (e.target?.closest?.(`#${PANEL_ID}, #${BTN_ID}`)) return;
    const sel = window.getSelection();
    const text = (sel?.toString() || "").trim();
    if (text.length >= 2) {
      lastText = text;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      showTriggerButton(window.scrollX + r.left, window.scrollY + r.bottom + 6, text);
    } else {
      removeTriggerButton();
    }
  });

  // 우클릭 컨텍스트 메뉴에서 트리거
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "CS_TRIGGER" && msg.text) run(msg.text);
  });

  // --- 사이드바 ---
  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="csgpt-head">
        <span>CS Translation GPT</span>
        <button class="csgpt-close" title="닫기">×</button>
      </div>
      <div class="csgpt-body"></div>`;
    panel.querySelector(".csgpt-close").addEventListener("click", () => panel.remove());
    document.body.appendChild(panel);
    return panel;
  }

  function section(title, content, opts = {}) {
    const copyBtn = opts.copy
      ? `<button class="csgpt-copy" data-copy="${encodeURIComponent(content)}">복사</button>`
      : "";
    return `<div class="csgpt-sec"><div class="csgpt-sec-title">${title}${copyBtn}</div><div class="csgpt-sec-content">${escapeHtml(
      content
    )}</div></div>`;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function render(body, state) {
    if (state.loading) {
      body.innerHTML = `<div class="csgpt-loading">처리 중… (번역 + RAG 검색 + 회신 생성)</div>`;
      return;
    }
    if (state.error) {
      body.innerHTML = `<div class="csgpt-error">${escapeHtml(state.error)}</div>`;
      return;
    }
    const d = state.data;
    const sources = (d.retrieved || [])
      .map((r) => `<li>${escapeHtml(r.question)} <em>(${(r.score ?? 0).toFixed(2)})</em></li>`)
      .join("");
    body.innerHTML = [
      section(`번역 <small>(${escapeHtml(d.sourceLang || "?")})</small>`, d.translation || ""),
      section("요약", d.summary || ""),
      section("추천 회신", d.suggestedReply || "", { copy: true }),
      d.usedTerms?.length
        ? `<div class="csgpt-sec"><div class="csgpt-sec-title">적용 용어</div><div class="csgpt-sec-content">${d.usedTerms
            .map(escapeHtml)
            .join(", ")}</div></div>`
        : "",
      sources
        ? `<div class="csgpt-sec"><div class="csgpt-sec-title">RAG 참고 예시</div><ul class="csgpt-src">${sources}</ul></div>`
        : "",
    ].join("");

    body.querySelectorAll(".csgpt-copy").forEach((b) =>
      b.addEventListener("click", () => {
        navigator.clipboard.writeText(decodeURIComponent(b.dataset.copy));
        b.textContent = "복사됨";
        setTimeout(() => (b.textContent = "복사"), 1200);
      })
    );
  }

  function run(text) {
    const panel = ensurePanel();
    const body = panel.querySelector(".csgpt-body");
    render(body, { loading: true });
    chrome.runtime.sendMessage({ type: "CS_PROCESS", text }, (resp) => {
      if (chrome.runtime.lastError) {
        render(body, { error: chrome.runtime.lastError.message });
        return;
      }
      if (!resp?.ok) render(body, { error: resp?.error || "알 수 없는 오류" });
      else render(body, { data: resp.data });
    });
  }
})();
