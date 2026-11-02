(() => {
  // ---------------- 테마 (시스템/라이트/다크, ramalok.kr 메인과 동일) ----------------
  const THEME_KEY = "bbald_theme";
  function applyTheme(mode) {
    const de = document.documentElement;
    if (mode === "light" || mode === "dark") de.setAttribute("data-theme", mode);
    else de.removeAttribute("data-theme");
    document.querySelectorAll(".theme-sw button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    });
  }
  function setTheme(mode) {
    try { localStorage.setItem(THEME_KEY, mode); } catch {}
    applyTheme(mode);
  }
  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; }
  }
  document.querySelectorAll(".theme-sw").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) setTheme(btn.dataset.mode);
    });
  });
  applyTheme(storedTheme());

  const chatEl = document.getElementById("chat");
  const composer = document.getElementById("composer");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const providerSelect = document.getElementById("providerSelect");
  const modelSelect = document.getElementById("modelSelect");
  const creditValueEl = document.getElementById("usagePctValue");
  const creditDisplay = document.getElementById("creditDisplay");
  const creditRawDisplay = document.getElementById("creditRawDisplay");
  const usageRawValue = document.getElementById("usageRawValue");
  const usageDetailList = document.getElementById("usageDetailList");
  const usageRingFill = document.getElementById("usageRingFill");
  const usageBarFill = document.getElementById("usageBarFill");
  const usageBarFillSettings = document.getElementById("usageBarFillSettings");
  const moodBadge = document.getElementById("moodBadge");
  const secretBadge = document.getElementById("secretBadge");
  const kstClock = document.getElementById("kstClock");
  const smartState = document.getElementById("smartState");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsBackdrop = document.getElementById("settingsBackdrop");
  const closeSettings = document.getElementById("closeSettings");
  const newChatBtn = document.getElementById("newChatBtn");
  const incognitoBtn = document.getElementById("incognitoBtn");
  const convList = document.getElementById("convList");
  const convEmptyHint = document.getElementById("convEmptyHint");

  const attachBtn = document.getElementById("attachBtn");
  const attachUrlBtn = document.getElementById("attachUrlBtn");
  const fileInput = document.getElementById("fileInput");
  const attachPreview = document.getElementById("attachPreview");
  const attachThumb = document.getElementById("attachThumb");
  const attachRemove = document.getElementById("attachRemove");

  const accountAvatar = document.getElementById("accountAvatar");
  const accountName = document.getElementById("accountName");
  const accountSub = document.getElementById("accountSub");
  const authBtn = document.getElementById("authBtn");
  const profilePicUrlInput = document.getElementById("profilePicUrl");
  const newEmailInput = document.getElementById("newEmail");
  const newPasswordInput = document.getElementById("newPassword");
  const changePwBtn = document.getElementById("changePwBtn");

  const chatWrap = document.querySelector(".chat-wrap");
  const stickerBtn = document.getElementById("stickerBtn");

  const modelDescEl = document.getElementById("modelDesc");
  const noticesBtn = document.getElementById("noticesBtn");
  const noticesBackdrop = document.getElementById("noticesBackdrop");
  const closeNotices = document.getElementById("closeNotices");

  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const menuToggle = document.getElementById("menuToggle");

  // provider별 모델 목록(실제 모델명/설명/비용 배율/로그인 필요 여부) — 서버
  // (src/worker.js의 MODEL_INFO)와 값이 맞아야 한다. "모델명과 설명, 상세설정"
  // 요청 반영: provider를 바꾸면 모델 선택도 그 provider의 진짜 모델들로 바뀐다.
  const MODEL_CATALOG = {
    builtin: [
      { value: "default", label: "🦕 빨드 두뇌", desc: "서버에 내장된 빨드만의 반응이다능 (AI 호출 없음, 제일 가벼움)", cost: 1 },
    ],
    cloudflare: [
      { value: "default", label: "☁️ Cloudflare 두뇌", desc: "Cloudflare Workers AI(Llama 계열)로 답한다능", cost: 1 },
    ],
    anthropic: [
      { value: "haiku-4.5", label: "⚡ 빨드 라이트", desc: "claude-haiku-4.5 — 가장 빠르고 가벼운 두뇌. 짧은 대화에 딱!", cost: 1, memberOnly: false },
      { value: "sonnet-5", label: "🦕 빨드 기본", desc: "claude-sonnet-5 — 속도와 똑똑함의 균형. 평소엔 이걸로!", cost: 1.5, memberOnly: false },
      { value: "opus-5.5", label: "🧠 빨드 딥씽킹", desc: "claude-opus-5.5 — 가장 깊게 생각하는 두뇌. 사용량을 많이 씀", cost: 3, memberOnly: true },
      { value: "fable-5.1", label: "📖 빨드 스토리", desc: "claude-fable-5.1 — 표현력 풍부한 창작 두뇌", cost: 2, memberOnly: true },
    ],
    openai: [
      { value: "gpt-4o-mini", label: "⚡ 챗지피티 라이트", desc: "gpt-4o-mini — 빠르고 가벼운 ChatGPT 두뇌", cost: 1, memberOnly: false },
      { value: "gpt-4o", label: "🧠 챗지피티 딥씽킹", desc: "gpt-4o — 더 똑똑한 ChatGPT 두뇌", cost: 2, memberOnly: true },
    ],
    gemini: [
      { value: "gemini-3.8-flash", label: "⚡ 제미나이 라이트", desc: "gemini-3.8-flash — 빠른 제미나이 두뇌", cost: 1, memberOnly: false },
      { value: "gemini-3.8-pro", label: "🧠 제미나이 딥씽킹", desc: "gemini-3.8-pro — 더 깊은 제미나이 두뇌", cost: 2, memberOnly: true },
    ],
  };
  function isMemberOnlyModel(provider, model) {
    return MODEL_CATALOG[provider]?.find((m) => m.value === model)?.memberOnly === true;
  }

  // 구글 로그인으로 받은 OAuth 액세스 토큰(제미나이 권한 스코프 포함). 있으면
  // 게스트/회원이 제미나이 API 키를 직접 안 넣어도 그 구글 계정 권한으로 호출된다
  // (계정에 Generative Language API가 허용돼 있을 때만 실제로 동작한다).
  let googleGeminiAccessToken = null;

  // ---------------- 로컬에 남겨도 되는 값만 localStorage에 저장 ----------------
  // 크레딧/사용량과 대화 기록은 더 이상 localStorage에 안 둔다 — 크레딧은 항상
  // 서버(KV)가 유일한 출처고, 대화 기록은 "로그인하면 서버에 저장, 게스트는
  // 저장 안 함"이라는 요구사항 때문에 로컬 캐시를 두면 오히려 혼란을 일으킨다
  // (예: 게스트로 쓴 내용이 새로고침해도 남아있으면 "저장 안 됨"이 아니게 됨).
  const LS_KEY = "bbald_ai_prefs_v2";

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { keys: {}, profilePic: "" };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  const state = loadState();
  state.keys = state.keys || {};
  state.profilePic = state.profilePic || "";
  let creditsCap = 100;

  let pendingAttachment = null; // { dataUrl, mimeType }
  let currentUser = null;
  let currentIdToken = null;

  // 현재 화면에 떠있는 대화. 게스트/시크릿 모드에서는 메모리에만 있다가
  // 새로고침하면 사라진다("미저장"). 로그인 + 일반 모드에서는 매 응답마다
  // 서버(/api/conversations)에 올려서 ChatGPT/Claude처럼 목록에서 다시 꺼내볼 수 있다.
  let currentMessages = [];
  let currentConvId = null;
  let conversationsCache = [];
  let isIncognito = false;

  const USAGE_RING_CIRCUMFERENCE = 113.1; // 2 * PI * r(18)

  function renderCredits(value, cap) {
    if (typeof cap === "number" && cap > 0) creditsCap = cap;
    const pct = Math.max(0, Math.round((value / creditsCap) * 100));
    const ringPct = Math.min(100, pct);

    creditValueEl.textContent = pct;
    if (creditDisplay) creditDisplay.textContent = pct;
    const rawText = `${Math.max(0, Math.round(value))} / ${Math.round(creditsCap)}`;
    if (usageRawValue) usageRawValue.textContent = rawText;
    if (creditRawDisplay) creditRawDisplay.textContent = rawText;

    const offset = USAGE_RING_CIRCUMFERENCE * (1 - ringPct / 100);
    usageRingFill.style.strokeDashoffset = offset;
    const lowPower = pct <= 15;
    usageRingFill.style.stroke = lowPower ? "#e05a5a" : "var(--purple-deep)";
    if (usageBarFill) {
      usageBarFill.style.width = `${ringPct}%`;
      usageBarFill.style.background = lowPower ? "#e05a5a" : "var(--grad)";
    }
    if (usageBarFillSettings) {
      usageBarFillSettings.style.width = `${ringPct}%`;
      usageBarFillSettings.style.background = lowPower ? "#e05a5a" : "var(--grad)";
    }
  }

  async function syncCreditsFromServer() {
    try {
      const uid = currentUser?.uid || "";
      const res = await fetch(`api/credits${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.credits === "number") renderCredits(data.credits, data.cap);
      }
    } catch {}
  }

  const PROVIDER_LABELS = {
    builtin: "빨드 기본", cloudflare: "Cloudflare", anthropic: "Claude", openai: "ChatGPT", gemini: "Gemini",
  };
  async function refreshUsageDetail() {
    if (!usageDetailList) return;
    usageDetailList.innerHTML = `<p class="hint">불러오는 중...</p>`;
    try {
      const uid = currentUser?.uid || "";
      const res = await fetch(`api/usage${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`);
      if (!res.ok) throw new Error("응답 실패");
      const data = await res.json();
      renderCredits(data.credits, data.cap);
      const rows = Object.entries(data.today || {})
        .map(([provider, info]) => {
          const label = PROVIDER_LABELS[provider] || provider;
          return `<div class="usage-detail-row"><span>${label}</span><span>${info.used} / ${info.enabled ? info.limit : "∞"}</span></div>`;
        })
        .join("");
      usageDetailList.innerHTML = rows || `<p class="hint">아직 오늘 사용한 기록이 없다능!</p>`;
    } catch {
      usageDetailList.innerHTML = `<p class="hint">상세 사용 정보를 못 불러왔다능...</p>`;
    }
  }

  renderCredits(100, 100);
  profilePicUrlInput.value = state.profilePic;
  document.getElementById("key-anthropic").value = state.keys.anthropic || "";
  document.getElementById("key-openai").value = state.keys.openai || "";
  document.getElementById("key-gemini").value = state.keys.gemini || "";

  // ---------------- 계정 / 프로필 ----------------
  function renderAccount() {
    const customPic = state.profilePic.trim();
    const googlePic = currentUser?.photoURL;
    const picUrl = customPic || googlePic;

    accountAvatar.innerHTML = "";
    if (picUrl) {
      const img = document.createElement("img");
      img.src = picUrl;
      img.alt = "프로필";
      accountAvatar.appendChild(img);
    } else {
      accountAvatar.textContent = "USER";
    }

    if (currentUser) {
      accountName.textContent = currentUser.displayName || currentUser.email || "회원";
      accountSub.textContent = "로그인됨";
      authBtn.textContent = "로그아웃";
    } else {
      accountName.textContent = "게스트";
      accountSub.textContent = window.BBALD_FIREBASE_ENABLED
        ? "로그인하면 가입 보너스!"
        : "Firebase 설정 후 로그인 가능";
      authBtn.textContent = "로그인";
    }
    updateModelLocks();
  }

  // provider가 바뀌면 그 provider의 진짜 모델 목록으로 다시 그린다. 게스트는
  // 고급 모델(딥씽킹류)을 아예 고를 수 없게 UI에서부터 막는다 — 서버에서도
  // 똑같이 막지만, 눌렀다가 403을 받고 나서야 알게 하는 것보단 미리 막는 게 낫다.
  function rebuildModelOptions() {
    const provider = providerSelect.value;
    const models = MODEL_CATALOG[provider] || [];
    const isGuest = !currentUser;
    const prevValue = modelSelect.value;
    modelSelect.innerHTML = "";
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.value;
      const locked = isGuest && m.memberOnly;
      opt.disabled = locked;
      opt.textContent = locked ? `${m.label} 🔒` : m.label;
      modelSelect.appendChild(opt);
    }
    const stillValid = models.some((m) => m.value === prevValue && !(isGuest && m.memberOnly));
    modelSelect.value = stillValid ? prevValue : (models.find((m) => !(isGuest && m.memberOnly)) || models[0])?.value || "";
    updateModelDesc();
  }
  function updateModelLocks() {
    rebuildModelOptions();
  }

  // 가입 보너스는 서버(KV)가 계정당 1회만 지급을 허용한다 (claimSignupBonus).
  async function grantSignupBonusIfNeeded(user) {
    if (!user) return;
    try {
      const res = await fetch("api/bonus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "signup", uid: user.uid }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.granted) {
        renderCredits(data.balance, data.cap);
        addMessage("assistant", `가입한다능?! 축하한다능! 첫 가입 보너스로 빨드 파워 ${Math.round((data.amount / (data.cap || creditsCap)) * 100)}% 채워줬다능! 🎉🦕`);
      } else if (typeof data.balance === "number") {
        renderCredits(data.balance, data.cap);
      }
    } catch {}
  }

  // ---------------- 서버 저장 대화 목록 (로그인 회원만) ----------------
  function setConvEmptyHint(text) {
    if (convEmptyHint) convEmptyHint.textContent = text;
  }

  function renderConvList() {
    if (!convList) return;
    convList.querySelectorAll(".conv-item").forEach((el) => el.remove());
    if (!currentUser) {
      setConvEmptyHint("로그인하면 대화가 계정에 저장돼서 나중에 다시 볼 수 있다능!");
      if (convEmptyHint) convEmptyHint.hidden = false;
      return;
    }
    if (!conversationsCache.length) {
      setConvEmptyHint("아직 저장된 대화가 없다능! 대화를 시작해봐바~");
      if (convEmptyHint) convEmptyHint.hidden = false;
      return;
    }
    if (convEmptyHint) convEmptyHint.hidden = true;
    for (const conv of conversationsCache) {
      const item = document.createElement("div");
      item.className = "conv-item" + (conv.id === currentConvId ? " active" : "");
      const titleSpan = document.createElement("span");
      titleSpan.className = "conv-item-title";
      titleSpan.textContent = conv.title || "새 대화";
      item.appendChild(titleSpan);
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "conv-item-del";
      delBtn.textContent = "✕";
      delBtn.title = "대화 삭제";
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await deleteConversationRemote(conv.id);
      });
      item.appendChild(delBtn);
      item.addEventListener("click", () => loadConversationById(conv.id));
      convList.appendChild(item);
    }
  }

  async function getFreshIdToken() {
    if (!currentUser) return null;
    try {
      currentIdToken = await currentUser.getIdToken();
      return currentIdToken;
    } catch {
      return currentIdToken;
    }
  }

  async function refreshConversationList() {
    if (!currentUser) {
      conversationsCache = [];
      renderConvList();
      return;
    }
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch("api/conversations", { headers: { "x-user-token": idToken || "" } });
      if (res.ok) {
        const data = await res.json();
        conversationsCache = data.items || [];
      }
    } catch {}
    renderConvList();
  }

  async function loadConversationById(id) {
    if (!currentUser) return;
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch(`api/conversations/${encodeURIComponent(id)}`, {
        headers: { "x-user-token": idToken || "" },
      });
      if (!res.ok) return;
      const conv = await res.json();
      currentConvId = conv.id;
      currentMessages = Array.isArray(conv.messages) ? conv.messages : [];
      isIncognito = false;
      updateSecretBadge();
      chatEl.innerHTML = "";
      if (!currentMessages.length) {
        addGreeting();
      } else {
        for (const m of currentMessages) addMessage(m.role === "assistant" ? "assistant" : "user", m.content, { skipStore: true });
      }
      renderConvList();
      closeSidebar();
    } catch {}
  }

  async function deleteConversationRemote(id) {
    if (!currentUser) return;
    try {
      const idToken = await getFreshIdToken();
      await fetch(`api/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-user-token": idToken || "" },
      });
      conversationsCache = conversationsCache.filter((c) => c.id !== id);
      if (currentConvId === id) {
        currentConvId = null;
        currentMessages = [];
        chatEl.innerHTML = "";
        addGreeting();
      }
      renderConvList();
    } catch {}
  }

  // 로그인 + 시크릿 모드가 아닐 때만 서버에 저장한다. 실패해도 채팅 자체는
  // 계속되게(조용히 무시) 한다 — 저장은 "덧붙는 기능"이지 핵심 기능을 막으면 안 됨.
  async function persistCurrentConversation() {
    if (!currentUser || isIncognito || !currentMessages.length) return;
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch("api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-token": idToken || "" },
        body: JSON.stringify({ id: currentConvId, messages: currentMessages }),
      });
      if (res.ok) {
        const record = await res.json();
        currentConvId = record.id;
        const idx = conversationsCache.findIndex((c) => c.id === record.id);
        const summary = { id: record.id, title: record.title, updatedAt: record.updatedAt };
        if (idx >= 0) conversationsCache[idx] = summary;
        else conversationsCache.unshift(summary);
        renderConvList();
      }
    } catch {}
  }

  // 게스트로 대화하다가 중간에 로그인하면, 지금까지 나눈 대화를 자동으로
  // 그 계정에 저장해준다 ("자동으로 채팅을 그 계정에 저장"). 시크릿 모드였으면
  // 원래도 저장될 대화가 아니었으니 건너뛴다.
  async function autoSaveGuestHistoryOnLogin() {
    if (isIncognito || !currentMessages.length) return;
    currentConvId = null; // 게스트 때는 서버 id가 없었으니 새로 만든다
    await persistCurrentConversation();
  }

  window.addEventListener("bbald-auth-changed", async (e) => {
    const previousUser = currentUser;
    currentUser = e.detail.user;
    if (currentUser) {
      await getFreshIdToken();
      grantSignupBonusIfNeeded(currentUser);
      if (!previousUser) await autoSaveGuestHistoryOnLogin();
      await refreshConversationList();
    } else {
      currentIdToken = null;
      googleGeminiAccessToken = null;
      conversationsCache = [];
      syncCreditsFromServer();
    }
    renderAccount();
    renderConvList();
  });

  authBtn.addEventListener("click", async () => {
    if (!window.bbaldAuth) return;
    if (currentUser) {
      await window.bbaldAuth.signOutUser();
    } else {
      const result = await window.bbaldAuth.signInGoogle();
      if (result?.googleAccessToken) googleGeminiAccessToken = result.googleAccessToken;
    }
  });

  profilePicUrlInput.addEventListener("change", () => {
    state.profilePic = profilePicUrlInput.value.trim();
    saveState();
    renderAccount();
  });

  changePwBtn.addEventListener("click", async () => {
    if (!window.bbaldAuth) return;
    const email = newEmailInput.value.trim();
    const pw = newPasswordInput.value.trim();
    try {
      if (email) await window.bbaldAuth.changeEmail(email);
      if (pw) await window.bbaldAuth.changePassword(pw);
      if (email || pw) alert("변경됐다능!");
    } catch (err) {
      alert(`변경 실패다능... ${err.message || err}`);
    }
  });

  renderAccount();

  // --- KST 실시간 시계 + 노을 똑똑함 정도 ---
  const SEOUL_LAT = 37.5665;
  const SEOUL_LON = 126.978;
  const THREE_PM_MIN = 15 * 60;
  const DEFAULT_SUNSET_MIN = 18 * 60 + 30;
  const FADE_OUT_MINUTES = 180;

  function computeSmartLevel(hour, minute, sunsetMin) {
    const t = hour * 60 + minute;
    if (sunsetMin <= THREE_PM_MIN) return t >= THREE_PM_MIN ? 1 : 0;
    if (t < THREE_PM_MIN) return 0;
    if (t <= sunsetMin) return (t - THREE_PM_MIN) / (sunsetMin - THREE_PM_MIN);
    const fadeEnd = sunsetMin + FADE_OUT_MINUTES;
    if (t <= fadeEnd) return 1 - (t - sunsetMin) / FADE_OUT_MINUTES;
    return 0;
  }

  function getLocalKstGuess() {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date());
      const get = (t) => parts.find((p) => p.type === t)?.value;
      return { hour: Number(get("hour")), minute: Number(get("minute")) };
    } catch {
      const d = new Date();
      return { hour: d.getHours(), minute: d.getMinutes() };
    }
  }

  function getLocalSunsetMin() {
    try {
      if (window.SunCalc) {
        const times = window.SunCalc.getTimes(new Date(), SEOUL_LAT, SEOUL_LON);
        if (times?.sunset instanceof Date && !isNaN(times.sunset)) {
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit",
          }).formatToParts(times.sunset);
          const get = (t) => parts.find((p) => p.type === t)?.value;
          return Number(get("hour")) * 60 + Number(get("minute"));
        }
      }
    } catch {}
    return DEFAULT_SUNSET_MIN;
  }

  function formatHHMM(totalMin) {
    return `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
  }

  function updateMoodUI(hour, minute, level, sunsetLabel) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    kstClock.textContent = `${hh}:${mm}`;
    const sunsetNote = sunsetLabel ? ` · 오늘 일몰 ${sunsetLabel}` : "";

    if (level <= 0.05) {
      smartState.textContent = `멍청 모드${sunsetNote}`;
      moodBadge.textContent = "🌙 아직 멍청한 시간";
    } else if (level <= 0.4) {
      smartState.textContent = `노을 다가오는 중 (살짝 또렷)${sunsetNote}`;
      moodBadge.textContent = "🌤️ 노을이 다가오는 중";
    } else if (level <= 0.75) {
      smartState.textContent = `노을 모드 (제법 또렷)${sunsetNote}`;
      moodBadge.textContent = "🌇 노을 모드! 조금 똑똑해짐";
    } else {
      smartState.textContent = `노을 절정 (오늘 중 제일 또렷)${sunsetNote}`;
      moodBadge.textContent = "🌅 노을 절정! 오늘 제일 또렷함";
    }
  }

  async function refreshClock() {
    try {
      const res = await fetch("api/time");
      if (res.ok) {
        const data = await res.json();
        updateMoodUI(data.hour, data.minute, data.level, data.sunsetLabel);
        return;
      }
    } catch {}
    const local = getLocalKstGuess();
    const sunsetMin = getLocalSunsetMin();
    const level = computeSmartLevel(local.hour, local.minute, sunsetMin);
    updateMoodUI(local.hour, local.minute, level, formatHHMM(sunsetMin));
  }
  refreshClock();
  setInterval(refreshClock, 30000);

  // --- 메시지 렌더링 ---
  function addMessage(role, text, opts = {}) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}${opts.extraClass ? " " + opts.extraClass : ""}`;

    if (role === "user") {
      const av = document.createElement("div");
      av.className = "avatar user-avatar";
      const customPic = state.profilePic.trim();
      const googlePic = currentUser?.photoURL;
      const picUrl = customPic || googlePic;
      if (picUrl) {
        const img = document.createElement("img");
        img.src = picUrl;
        img.alt = "나";
        av.appendChild(img);
      } else {
        av.textContent = "USER";
      }
      wrap.appendChild(av);
    } else {
      const img = document.createElement("img");
      img.className = "avatar";
      img.src = "icon-64.png";
      img.alt = "빨드";
      wrap.appendChild(img);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    if (opts.imageDataUrl) {
      const img = document.createElement("img");
      img.className = "bubble-image";
      img.src = opts.imageDataUrl;
      img.alt = "첨부 이미지";
      bubble.appendChild(img);
    }
    if (text) {
      const p = document.createElement("div");
      p.textContent = text;
      bubble.appendChild(p);
    }

    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addGreeting() {
    addMessage("assistant", "안뇽!! 빨드다능! 🦕 무엇이든 물어봐바~ (근데 어려운 건 잘 모를 수도 있다능 히히)", { skipStore: true });
  }

  // ---------------- 생각 중 표시 (클로드 데스크톱의 "대화 압축 중"처럼) ----------------
  // 멘트는 전부 빨드식 말투(다능체)다. 10번 중 6번은 빨드가 "먹는 시간"(영양
  // 떨어짐/충전중/초콜릿 먹는 중 등)을 가지면서 10초~1분 길게 기다리고, 나머지
  // 4번은 그냥 짧게 생각하는 중이라고만 한다.
  const LOADING_PHRASES_EATING = [
    "영양 떨어짐... 충전 중이다능 🔌",
    "초콜릿 먹는 중... 쫌만 기다려달라능 🍫",
    "두뇌 배터리 충전 중... 삐빅 삐빅 🔋",
    "간식 먹는 중... 금방 돌아온다능 🍪",
    "두뇌 과열... 식히는 중이다능 🧊",
    "생각하다가 깜빡 졺... 다시 깨는 중이다능 😴",
    "꼬리에 힘주고 생각하는 중이다능 🦕",
  ];
  const LOADING_PHRASES_QUICK = [
    "생각 중이다능...",
    "빨드가 열심히 생각하고 있다능...",
    "음... 잠깐만 기다려달라능",
    "곰곰이 생각하는 중이다능...",
  ];
  function pickLoadingPhrase(isEating) {
    const pool = isEating ? LOADING_PHRASES_EATING : LOADING_PHRASES_QUICK;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let loadingRotateTimer = null;
  function addLoadingBubble(isEating) {
    const wrap = document.createElement("div");
    wrap.className = "msg assistant loading";
    wrap.id = "loadingBubble";
    const img = document.createElement("img");
    img.className = "avatar";
    img.src = "icon-64.png";
    img.alt = "빨드";
    wrap.appendChild(img);
    const bubble = document.createElement("div");
    bubble.className = "bubble loading-bubble";
    bubble.textContent = pickLoadingPhrase(isEating);
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    chatEl.scrollTop = chatEl.scrollHeight;
    // 먹는 시간(10초~1분)일 때는 기다리는 동안 멘트를 몇 초마다 바꿔준다.
    if (isEating) {
      loadingRotateTimer = setInterval(() => {
        const b = document.querySelector("#loadingBubble .loading-bubble");
        if (b) b.textContent = pickLoadingPhrase(true);
      }, 4000);
    }
  }
  function removeLoadingBubble() {
    if (loadingRotateTimer) { clearInterval(loadingRotateTimer); loadingRotateTimer = null; }
    document.getElementById("loadingBubble")?.remove();
  }

  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }
  input.addEventListener("input", autoResize);

  // ---------------- 첨부 이미지 (업로드 / URL / 붙여넣기) — 게스트는 로그인해야 쓸 수 있다 ----------------
  function setAttachment(dataUrl, mimeType) {
    pendingAttachment = { dataUrl, mimeType };
    attachThumb.src = dataUrl;
    attachPreview.hidden = false;
  }
  function clearAttachment() {
    pendingAttachment = null;
    attachThumb.src = "";
    attachPreview.hidden = true;
  }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function urlToDataUrl(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function requireLoginForImages() {
    if (currentUser) return true;
    addMessage("assistant", "이미지 첨부는 로그인하면 쓸 수 있다능! 게스트는 아직 안 된다능 🔒", { extraClass: "snack" });
    return false;
  }

  attachBtn.addEventListener("click", () => {
    if (!requireLoginForImages()) return;
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setAttachment(dataUrl, file.type);
    fileInput.value = "";
  });
  attachUrlBtn.addEventListener("click", async () => {
    if (!requireLoginForImages()) return;
    const url = prompt("이미지 URL을 붙여넣어줘바!");
    if (!url) return;
    try {
      const dataUrl = await urlToDataUrl(url);
      setAttachment(dataUrl, "image/*");
    } catch {
      alert("이미지를 못 가져왔다능... URL을 확인해줘!");
    }
  });
  attachRemove.addEventListener("click", clearAttachment);

  input.addEventListener("paste", async (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        if (!currentUser) { e.preventDefault(); requireLoginForImages(); break; }
        const file = item.getAsFile();
        if (file) {
          const dataUrl = await fileToDataUrl(file);
          setAttachment(dataUrl, file.type);
        }
        e.preventDefault();
        break;
      }
    }
  });

  // ---------------- 대화 전송 ----------------
  composer.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !pendingAttachment) return;

    const provider = providerSelect.value;
    const model = modelSelect.value;
    const apiKey = state.keys[provider] || "";
    const attachment = pendingAttachment;

    addMessage("user", text, { imageDataUrl: attachment?.dataUrl });
    currentMessages.push({ role: "user", content: text || "(이미지 첨부)" });
    input.value = "";
    clearAttachment();
    autoResize();
    sendBtn.disabled = true;

    // 10번 중 6번은 빨드가 "먹는 시간"(영양 떨어짐/초콜릿 먹는 중 등)을 가지며
    // 10초~1분 사이 랜덤으로 오래 기다리고, 나머지 4번은 짧게 생각만 하고 바로
    // 응답한다 — 실제 응답이 더 빨리 와도 먹는 시간일 땐 최소 그 시간만큼 기다림.
    const isEatingTime = Math.random() < 0.6;
    addLoadingBubble(isEatingTime);
    const eatingTimeMs = isEatingTime ? 10000 + Math.random() * 50000 : 0;
    const eatingTimer = eatingTimeMs ? new Promise((resolve) => setTimeout(resolve, eatingTimeMs)) : Promise.resolve();
    const useGoogleGemini = provider === "gemini" && !apiKey && !!googleGeminiAccessToken;

    let res;
    try {
      const [fetchRes] = await Promise.all([
        fetch("api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: text,
            history: currentMessages.slice(-10),
            provider,
            model,
            apiKey,
            uid: currentUser?.uid || null,
            image: attachment ? { dataUrl: attachment.dataUrl, mimeType: attachment.mimeType } : null,
            googleAccessToken: useGoogleGemini ? googleGeminiAccessToken : null,
          }),
        }),
        eatingTimer,
      ]);
      res = fetchRes;
    } catch (err) {
      removeLoadingBubble();
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      addMessage(
        "assistant",
        offline
          ? "빨드 인터넷이 끊겼다능... 다시 시도해줘!"
          : `빨드한테 요청이 안 갔다능... (${err.message || "네트워크 오류"})`,
        { extraClass: "error" }
      );
      sendBtn.disabled = false;
      return;
    }

    try {
      const data = await res.json();
      removeLoadingBubble();

      if (!res.ok) {
        if (typeof data.credits === "number") renderCredits(data.credits, data.cap);
        addMessage("assistant", data.error || data.reply || "빨드가 넘어졌다능...", {
          extraClass: data.dailyLimitReached ? "snack" : "error",
        });
      } else {
        addMessage("assistant", data.reply);
        currentMessages.push({ role: "assistant", content: data.reply });
        renderCredits(data.credits, data.cap);
        if (data.snack) {
          addMessage("assistant", data.snack, { extraClass: "snack" });
        }
        if (typeof data.smartLevel === "number") {
          const local = getLocalKstGuess();
          updateMoodUI(local.hour, local.minute, data.smartLevel, data.sunset);
        }
        await persistCurrentConversation();
      }
    } catch (err) {
      removeLoadingBubble();
      addMessage(
        "assistant",
        `빨드 응답을 이해 못했다능... (서버가 이상한 응답을 줬다능, status ${res.status})`,
        { extraClass: "error" }
      );
    } finally {
      sendBtn.disabled = false;
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      composer.requestSubmit();
    }
  });

  function startNewChat() {
    currentConvId = null;
    currentMessages = [];
    chatEl.innerHTML = "";
    addGreeting();
    renderConvList();
  }

  newChatBtn.addEventListener("click", startNewChat);

  // ---------------- 시크릿(임시) 채팅 모드 — 켜져 있으면 로그인 상태여도 서버에
  // 저장하지 않는다. 다른 모드로 섞이지 않게 새 대화로 시작한다. ----------------
  function updateSecretBadge() {
    if (secretBadge) secretBadge.hidden = !isIncognito;
    if (incognitoBtn) incognitoBtn.classList.toggle("active", isIncognito);
  }
  incognitoBtn?.addEventListener("click", () => {
    isIncognito = !isIncognito;
    updateSecretBadge();
    startNewChat();
    addMessage(
      "assistant",
      isIncognito
        ? "시크릿 모드 켜졌다능! 이번 대화는 저장 안 된다능 🕶️"
        : "시크릿 모드 꺼졌다능! 이제부터 다시 저장된다능 🦕",
      { extraClass: "snack", skipStore: true }
    );
  });
  updateSecretBadge();

  // ---------------- 설정 모달 ----------------
  settingsBtn.addEventListener("click", () => {
    settingsBackdrop.classList.add("open");
    refreshUsageDetail();
  });
  closeSettings.addEventListener("click", () => settingsBackdrop.classList.remove("open"));
  settingsBackdrop.addEventListener("click", (e) => {
    if (e.target === settingsBackdrop) settingsBackdrop.classList.remove("open");
  });

  // ---------------- 공지사항 모달 ----------------
  noticesBtn.addEventListener("click", () => noticesBackdrop.classList.add("open"));
  closeNotices.addEventListener("click", () => noticesBackdrop.classList.remove("open"));
  noticesBackdrop.addEventListener("click", (e) => {
    if (e.target === noticesBackdrop) noticesBackdrop.classList.remove("open");
  });

  // ---------------- 모바일 사이드바 토글 ----------------
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("open");
  }
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.add("open");
  });
  sidebarBackdrop.addEventListener("click", closeSidebar);
  sidebar.querySelectorAll("button").forEach((el) => {
    if (el.id === "incognitoBtn") return; // 자체 핸들러가 있고, 클릭해도 사이드바를 닫을 필요는 없음
    el.addEventListener("click", closeSidebar);
  });

  // ---------------- 모델 설명 (상세설정: 실제 모델명 + 비용 배율을 같이 보여준다) ----------------
  function updateModelDesc() {
    const provider = providerSelect.value;
    const m = (MODEL_CATALOG[provider] || []).find((x) => x.value === modelSelect.value);
    modelDescEl.textContent = m ? `${m.desc} · 사용량 비용 ×${m.cost}${m.memberOnly ? " · 로그인 필요" : ""}` : "";
  }
  providerSelect.addEventListener("change", rebuildModelOptions);
  modelSelect.addEventListener("change", () => {
    if (isMemberOnlyModel(providerSelect.value, modelSelect.value) && !currentUser) {
      rebuildModelOptions();
      addMessage("assistant", "그 두뇌는 로그인해야 빌릴 수 있다능! 게스트는 라이트/기본만 쓸 수 있어 🔒", { extraClass: "snack" });
      return;
    }
    updateModelDesc();
  });
  rebuildModelOptions();

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

  // ---------------- 무작위 빨드 스티커 이벤트 ----------------
  const stickerBadge = stickerBtn.querySelector(".sticker-badge");
  let stickerTimer = null;
  function scheduleSticker() {
    const delay = 90000 + Math.random() * 150000;
    stickerTimer = setTimeout(showSticker, delay);
  }
  function showSticker() {
    const bounds = chatWrap.getBoundingClientRect();
    const maxX = Math.max(0, bounds.width - 64);
    const maxY = Math.max(0, bounds.height - 64);
    stickerBtn.style.left = `${Math.random() * maxX}px`;
    stickerBtn.style.top = `${Math.random() * maxY}px`;
    stickerBadge.textContent = "🎁";
    stickerBtn.hidden = false;

    const hideTimer = setTimeout(() => {
      stickerBtn.hidden = true;
      scheduleSticker();
    }, 4000);

    stickerBtn.onclick = async () => {
      clearTimeout(hideTimer);
      stickerBtn.hidden = true;
      try {
        const res = await fetch("api/bonus", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "sticker", uid: currentUser?.uid || null }),
        });
        const data = await res.json();
        if (data.granted) {
          renderCredits(data.balance, data.cap);
          const pctGained = Math.round((data.amount / (data.cap || creditsCap)) * 100);
          addMessage("assistant", `짠! 빨드 스티커 찾았다능! 보너스 사용량 +${pctGained}% 선물이다능! 🎁🦕`, { extraClass: "snack" });
        } else {
          addMessage("assistant", "어? 방금 막 빨드 간식 다 먹었나보다... 쬐끔 있다 또 찾아봐줘!", { extraClass: "snack" });
        }
      } catch {
        addMessage("assistant", "스티커를 못 받았다능... 네트워크가 이상한가봐!", { extraClass: "error" });
      }
      scheduleSticker();
    };
  }
  scheduleSticker();

  // ---------------- 초기 상태: 서버 크레딧 동기화 + 인사 ----------------
  // index.html에 미리 박아둔 인사 말풍선은 지우고 JS가 다시 그린다 (중복 방지).
  chatEl.innerHTML = "";
  syncCreditsFromServer();
  addGreeting();
  renderConvList();
})();
