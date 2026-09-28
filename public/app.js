(() => {
  const chatEl = document.getElementById("chat");
  const composer = document.getElementById("composer");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const providerSelect = document.getElementById("providerSelect");
  const modelSelect = document.getElementById("modelSelect");
  const creditValueEl = document.getElementById("creditValue");
  const creditInput = document.getElementById("creditInput");
  const resetCreditsBtn = document.getElementById("resetCreditsBtn");
  const moodBadge = document.getElementById("moodBadge");
  const kstClock = document.getElementById("kstClock");
  const smartState = document.getElementById("smartState");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsBackdrop = document.getElementById("settingsBackdrop");
  const closeSettings = document.getElementById("closeSettings");
  const newChatBtn = document.getElementById("newChatBtn");

  const LS_KEY = "bbald_ai_state_v1";

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { credits: 100, keys: {}, history: [] };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  const state = loadState();
  if (typeof state.credits !== "number") state.credits = 100;
  state.keys = state.keys || {};
  state.history = state.history || [];

  creditValueEl.textContent = state.credits;
  creditInput.value = state.credits;
  document.getElementById("key-anthropic").value = state.keys.anthropic || "";
  document.getElementById("key-openai").value = state.keys.openai || "";
  document.getElementById("key-gemini").value = state.keys.gemini || "";

  // --- KST 실시간 시계 (오프라인이면 로컬 컴퓨터 시간으로 대체) ---
  function getLocalKstGuess() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value;
      return { hour: Number(get("hour")), minute: Number(get("minute")), source: "local-intl" };
    } catch {
      const d = new Date();
      return { hour: d.getHours(), minute: d.getMinutes(), source: "local-raw" };
    }
  }

  function updateMoodUI(hour, minute, isSmart) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    kstClock.textContent = `${hh}:${mm}`;
    smartState.textContent = isSmart ? "노을 모드 (조금 똑똑함)" : "멍청 모드";
    moodBadge.textContent = isSmart ? "🌅 노을 모드! 조금 똑똑해짐" : "🌙 아직 멍청한 시간";
  }

  async function refreshClock() {
    try {
      const res = await fetch("/api/time");
      if (res.ok) {
        const data = await res.json();
        updateMoodUI(data.hour, data.minute, data.isSmart);
        return;
      }
    } catch {}
    const local = getLocalKstGuess();
    updateMoodUI(local.hour, local.minute, local.hour >= 15 && local.hour < 24);
  }
  refreshClock();
  setInterval(refreshClock, 30000);

  // --- 메시지 렌더링 ---
  function addMessage(role, text, extraClass) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}${extraClass ? " " + extraClass : ""}`;
    if (role !== "user") {
      const img = document.createElement("img");
      img.className = "avatar";
      img.src = "/icon-64.png";
      img.alt = "빨드";
      wrap.appendChild(img);
    }
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }
  input.addEventListener("input", autoResize);

  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const provider = providerSelect.value;
    const model = modelSelect.value;
    const apiKey = state.keys[provider] || "";

    addMessage("user", text);
    state.history.push({ role: "user", content: text });
    input.value = "";
    autoResize();
    sendBtn.disabled = true;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: state.history.slice(-10),
          provider,
          model,
          apiKey,
          credits: state.credits,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        addMessage("assistant", data.error || "빨드가 넘어졌다능...", "error");
      } else {
        addMessage("assistant", data.reply);
        state.history.push({ role: "assistant", content: data.reply });
        state.credits = data.credits;
        creditValueEl.textContent = state.credits;
        creditInput.value = state.credits;
        if (data.snack) {
          addMessage("assistant", data.snack, "snack");
        }
        if (typeof data.isSmart === "boolean") {
          moodBadge.textContent = data.isSmart ? "🌅 노을 모드! 조금 똑똑해짐" : "🌙 아직 멍청한 시간";
          smartState.textContent = data.isSmart ? "노을 모드 (조금 똑똑함)" : "멍청 모드";
        }
      }
    } catch (err) {
      addMessage("assistant", "빨드 인터넷이 끊겼다능... 다시 시도해줘!", "error");
    } finally {
      sendBtn.disabled = false;
      saveState();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  newChatBtn.addEventListener("click", () => {
    state.history = [];
    saveState();
    chatEl.innerHTML = "";
    addMessage("assistant", "안뇽!! 새 대화 시작이다능 🦕");
  });

  // --- 설정 모달 ---
  settingsBtn.addEventListener("click", () => settingsBackdrop.classList.add("open"));
  closeSettings.addEventListener("click", () => settingsBackdrop.classList.remove("open"));
  settingsBackdrop.addEventListener("click", (e) => {
    if (e.target === settingsBackdrop) settingsBackdrop.classList.remove("open");
  });

  function bindKeyInput(id, providerKey) {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
      state.keys[providerKey] = el.value.trim();
      saveState();
    });
  }
  bindKeyInput("key-anthropic", "anthropic");
  bindKeyInput("key-openai", "openai");
  bindKeyInput("key-gemini", "gemini");

  creditInput.addEventListener("change", () => {
    const v = Math.max(0, Number(creditInput.value) || 0);
    state.credits = v;
    creditValueEl.textContent = v;
    saveState();
  });

  resetCreditsBtn.addEventListener("click", () => {
    state.credits = 100;
    creditValueEl.textContent = 100;
    creditInput.value = 100;
    saveState();
  });
})();
