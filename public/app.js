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
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");
  const lightboxClose = document.getElementById("lightboxClose");

  const accountAvatar = document.getElementById("accountAvatar");
  const accountName = document.getElementById("accountName");
  const accountSub = document.getElementById("accountSub");
  const authBtn = document.getElementById("authBtn");
  const newEmailInput = document.getElementById("newEmail");
  const newPasswordInput = document.getElementById("newPassword");
  const changePwBtn = document.getElementById("changePwBtn");

  const billingSection = document.getElementById("billingSection");
  const billingDivider = document.getElementById("billingDivider");
  const planStatus = document.getElementById("planStatus");
  const unifiedCreditsLine = document.getElementById("unifiedCreditsLine");
  const couponInput = document.getElementById("couponInput");
  const couponBtn = document.getElementById("couponBtn");

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
  // 모든 AI가 똑같은 4단계(라이트/기본/딥씽킹/스토리)를 갖는다. 선택창의 value는
  // 단계 키(lite/basic/deep/story)라서 AI를 바꿔도 같은 단계가 그대로 유지되고,
  // 실제로 어떤 모델이 불려가는지는 서버(src/worker.js MODEL_IDS)가 AI별로 정한다.
  const TIERS = [
    { value: "lite", label: "⚡ 빨드 라이트", desc: "가장 빠르고 가벼운 두뇌. 짧은 대화에 딱!", cost: 1, memberOnly: false },
    { value: "basic", label: "🦕 빨드 기본", desc: "속도와 똑똑함의 균형. 평소엔 이걸로!", cost: 1.5, memberOnly: false },
    { value: "deep", label: "🧠 빨드 딥씽킹", desc: "가장 깊게 생각하는 두뇌. 사용량을 많이 씀", cost: 3, memberOnly: true },
    { value: "story", label: "📖 빨드 스토리", desc: "표현력 풍부한 창작 두뇌", cost: 2, memberOnly: true },
  ];
  const REAL_MODEL = {
    builtin: { lite: "빨드 내장 반응", basic: "빨드 내장 반응", deep: "빨드 내장 반응", story: "빨드 내장 반응" },
    cloudflare: {
      lite: "llama-3.1-8b", basic: "llama-3.3-70b", deep: "llama-3.3-70b", story: "llama-3.3-70b",
    },
    anthropic: { lite: "claude-haiku-4.5", basic: "claude-sonnet-5", deep: "claude-opus-5.5", story: "claude-fable-5.1" },
    openai: { lite: "gpt-5.1-mini", basic: "gpt-5.1", deep: "gpt-5.1-pro", story: "gpt-5.1-creative" },
    gemini: {
      lite: "gemini-3.8-flash-lite", basic: "gemini-3.8-flash", deep: "gemini-3.8-pro", story: "gemini-3.8-pro-creative",
    },
  };
  const MODEL_CATALOG = Object.fromEntries(
    Object.keys(REAL_MODEL).map((prov) => [
      prov,
      TIERS.map((t) => ({ ...t, desc: `${REAL_MODEL[prov][t.value]} — ${t.desc}` })),
    ])
  );
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
    return { keys: {} };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  const state = loadState();
  state.keys = state.keys || {};
  let creditsCap = 100;
  // 로그인/로그아웃이 바뀔 때마다 올라가는 세대 번호. 크레딧을 서버에서 받아오는
  // 함수(syncCreditsFromServer/refreshUsageDetail/refreshBillingSection/
  // grantSignupBonusIfNeeded)는 전부 비동기라서, 예를 들어 "게스트 크레딧
  // 조회"가 느리게 끝나는 사이 로그인이 돼서 "회원 크레딧"이 먼저 화면에
  // 반영된 뒤, 뒤늦게 도착한 게스트 응답이 그걸 덮어써버리는 경쟁 상태가 있었다
  // ("크레딧 숫자가 섞이고 난리"의 원인). 요청을 보낼 때의 세대 번호를 기억해뒀다가,
  // 응답이 왔을 때 세대가 바뀌었으면(=그 사이 로그인 상태가 바뀌었으면) 그냥 버린다.
  let creditsGen = 0;

  // 게스트를 구분하는 브라우저 고유 ID. 같은 와이파이/통신사 망(IP)을 쓰는 다른 사람과
  // 크레딧이 섞이지 않게 서버로 보낸다 (로그인하면 계정 uid가 우선이라 쓰이지 않음).
  function guestId() {
    try {
      let id = localStorage.getItem("bbald_guest_id");
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-xxxxxxxx`).replace(/[^A-Za-z0-9-]/g, "");
        localStorage.setItem("bbald_guest_id", id);
      }
      return id;
    } catch {
      return "";
    }
  }
  const guestHeaders = () => (currentUser ? {} : { "x-guest-id": guestId() });

  let pendingAttachments = []; // [{ dataUrl, mimeType }] — 이미지 여러 장 첨부
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
    // 서버가 cap을 넘는 값을 줄 일은 없지만, 혹시 어긋나도 화면엔 100%/최대치까지만 보인다.
    value = Math.min(Math.max(0, value), creditsCap);
    const pct = Math.round((value / creditsCap) * 100);
    const ringPct = pct;

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

  // 자동 재충전 안내: "다음 충전 1시간 20분 후 · 오늘 남은 충전 4/5"
  const refillNote = document.getElementById("refillNote");
  let refillTimer = null;
  function renderRefill(refill) {
    if (!refillNote) return;
    clearTimeout(refillTimer);
    if (!refill) { refillNote.textContent = ""; return; }
    const draw = () => {
      if (!refill.nextAt) { refillNote.textContent = `충전 ${refill.left}/${refill.max}회 남음`; return; }
      const min = Math.max(0, Math.ceil((refill.nextAt - Date.now()) / 60000));
      const t = min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;
      refillNote.textContent = `다음 충전 ${t} 후 · 남은 충전 ${refill.left}/${refill.max}`;
      if (min > 0) refillTimer = setTimeout(draw, 30000);
      else refillNote.textContent = "곧 충전돼요! 잠시 후 다시 확인해봐요";
    };
    if (refill.left === 0 && refill.nextAt) {
      const min = Math.max(0, Math.ceil((refill.nextAt - Date.now()) / 60000));
      refillNote.textContent = `오늘 충전 모두 사용 · ${Math.floor(min / 60)}시간 ${min % 60}분 뒤 가능`;
      return;
    }
    draw();
  }

  async function syncCreditsFromServer() {
    const gen = creditsGen;
    try {
      const uid = currentUser?.uid || "";
      const idToken = uid ? await getFreshIdToken() : null;
      const res = await fetch(
        `api/credits${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`,
        { headers: idToken ? { "x-user-token": idToken } : guestHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        if (gen !== creditsGen) return; // 그 사이 로그인 상태가 바뀜 — 이 응답은 버림
        if (typeof data.credits === "number") { renderCredits(data.credits, data.cap); renderRefill(data.refill); }
      }
    } catch {}
  }

  const PROVIDER_LABELS = {
    builtin: "빨드 기본", cloudflare: "Cloudflare", anthropic: "Claude", openai: "ChatGPT", gemini: "Gemini",
  };
  async function refreshUsageDetail() {
    if (!usageDetailList) return;
    usageDetailList.innerHTML = `<p class="hint">불러오는 중...</p>`;
    const gen = creditsGen;
    try {
      const uid = currentUser?.uid || "";
      const idToken = uid ? await getFreshIdToken() : null;
      const res = await fetch(
        `api/usage${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`,
        { headers: idToken ? { "x-user-token": idToken } : guestHeaders() }
      );
      if (!res.ok) throw new Error("응답 실패");
      const data = await res.json();
      if (gen !== creditsGen) return; // 그 사이 로그인 상태가 바뀜 — 이 응답은 버림
      renderCredits(data.credits, data.cap);
      renderRefill(data.refill);
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

  // ---------------- PAL 통합 요금제 / 크레딧 / 쿠폰 (로그인 필요) ----------------
  async function billingFetch(path, bodyIn) {
    const idToken = await getFreshIdToken();
    const res = await fetch(`api/billing/${path}`, {
      method: bodyIn ? "POST" : "GET",
      headers: { "content-type": "application/json", "x-user-token": idToken || "" },
      body: bodyIn ? JSON.stringify(bodyIn) : undefined,
    });
    const data = await res.json().catch(() => ({ error: "응답을 이해 못했다능" }));
    return { ok: res.ok, data };
  }
  function showBilling(data) {
    renderCredits(data.credits, data.cap);
    renderRefill(data.refill);
    const plan = data.plan || { id: "free", name: "무료" };
    const until = data.planUntil ? ` (${new Date(data.planUntil).toLocaleDateString("ko-KR")}까지)` : "";
    planStatus.textContent = `요금제: ${plan.id === "free" ? "무료" : `⭐ ${plan.name}${until}`}`;
    unifiedCreditsLine.textContent = data.unifiedAvailable
      ? `크레딧 ${data.credits} = 빨드 기본 ${data.local} + PAL 통합 ${data.unifiedCredits}`
      : "PAL 통합 크레딧을 못 불러왔다능 (빨드 기본 크레딧만 보인다능)";
  }
  async function refreshBillingSection() {
    if (!billingSection) return;
    const show = !!currentUser; // 게스트는 안 보임 (로그인 필요)
    billingSection.hidden = !show;
    if (billingDivider) billingDivider.hidden = !show;
    if (!show) return;
    const gen = creditsGen;
    const { ok, data } = await billingFetch("status");
    if (gen !== creditsGen) return; // 그 사이 로그인 상태가 바뀜 — 이 응답은 버림
    if (!ok) { planStatus.textContent = "요금제 정보를 못 불러왔다능..."; return; }
    showBilling(data);
  }
  couponBtn?.addEventListener("click", async () => {
    const code = couponInput.value.trim();
    if (!code) return;
    couponBtn.disabled = true;
    const { ok, data } = await billingFetch("coupon", { code });
    if (ok) {
      couponInput.value = "";
      showBilling(data);
      addMessage("assistant", "쿠폰 등록됐다능! 🎁", { extraClass: "snack" });
    } else {
      addMessage("assistant", data.error || "쿠폰을 쓸 수 없다능...", { extraClass: "error" });
    }
    couponBtn.disabled = false;
  });

  renderCredits(100, 100);
  document.getElementById("key-anthropic").value = state.keys.anthropic || "";
  document.getElementById("key-openai").value = state.keys.openai || "";
  document.getElementById("key-gemini").value = state.keys.gemini || "";

  // ---------------- 계정 / 프로필 ----------------
  // 프로필 사진은 PAL 통합 회원 계정의 사진(currentUser.photoURL)을 그대로
  // 쓴다 — 구글 사진이든, PAL 계정 설정에서 바꾼 사진이든 전부 Firebase Auth의
  // photoURL 하나로 합쳐지므로 빨드 AI가 따로 저장/override할 필요가 없다.
  function renderAccount() {
    const picUrl = currentUser?.photoURL;

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
    modelSelect.value = stillValid ? prevValue : "basic"; // 처음/잘못된 값이면 기본 단계로
    updateModelDesc();
  }
  function updateModelLocks() {
    rebuildModelOptions();
  }

  // 가입 보너스는 서버(KV)가 계정당 1회만 지급을 허용한다 (claimSignupBonus).
  async function grantSignupBonusIfNeeded(user) {
    if (!user) return;
    const gen = creditsGen;
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch("api/bonus", {
        method: "POST",
        headers: { "content-type": "application/json", ...guestHeaders() },
        body: JSON.stringify({ type: "signup", uid: user.uid, idToken }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (gen !== creditsGen) return; // 그 사이 로그인 상태가 바뀜 — 이 응답은 버림
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
    creditsGen++;
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
      const picUrl = currentUser?.photoURL;
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

    if (opts.images && opts.images.length) {
      const gallery = document.createElement("div");
      gallery.className = "bubble-gallery";
      opts.images.forEach((src, i) => {
        const img = document.createElement("img");
        img.src = src;
        img.alt = `첨부 이미지 ${i + 1}`;
        img.addEventListener("click", () => openLightbox(src));
        gallery.appendChild(img);
      });
      bubble.appendChild(gallery);
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

  // ---------------- 첨부 이미지 (파일/URL 여러 장, 미리보기, 클릭해서 확대) — 게스트는 로그인해야 쓸 수 있다 ----------------
  // 나중에 이미지 말고 다른 멀티미디어(영상/오디오 등)도 넣을 수 있게 확장할
  // 걸 생각해서 pendingAttachments를 배열로 둔다 — 지금은 이미지만 지원.
  function renderAttachPreview() {
    attachPreview.innerHTML = "";
    attachPreview.hidden = pendingAttachments.length === 0;
    pendingAttachments.forEach((att, idx) => {
      const item = document.createElement("div");
      item.className = "attach-preview-item";
      const img = document.createElement("img");
      img.src = att.dataUrl;
      img.alt = `첨부 이미지 ${idx + 1}`;
      img.addEventListener("click", () => openLightbox(att.dataUrl));
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "attach-remove";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        pendingAttachments.splice(idx, 1);
        renderAttachPreview();
      });
      item.append(img, removeBtn);
      attachPreview.appendChild(item);
    });
  }
  function addAttachment(dataUrl, mimeType) {
    pendingAttachments.push({ dataUrl, mimeType });
    renderAttachPreview();
  }
  function clearAttachments() {
    pendingAttachments = [];
    renderAttachPreview();
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

  // ---------------- 이미지 확대(라이트박스) ----------------
  function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.hidden = false;
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
  }
  lightboxClose?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

  attachBtn.addEventListener("click", () => {
    if (!requireLoginForImages()) return;
    fileInput.click();
  });
  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      addAttachment(dataUrl, file.type);
    }
    fileInput.value = "";
  });
  attachUrlBtn.addEventListener("click", async () => {
    if (!requireLoginForImages()) return;
    const raw = prompt("이미지 URL을 붙여넣어줘바! (여러 개는 줄바꿈으로 구분)");
    if (!raw) return;
    const urls = raw.split(/\n+/).map((u) => u.trim()).filter(Boolean);
    for (const url of urls) {
      try {
        const dataUrl = await urlToDataUrl(url);
        addAttachment(dataUrl, "image/*");
      } catch {
        addMessage("assistant", `이미지를 못 가져왔다능... (${url})`, { extraClass: "error" });
      }
    }
  });

  input.addEventListener("paste", async (e) => {
    const items = Array.from(e.clipboardData?.items || []).filter((it) => it.type.startsWith("image/"));
    if (!items.length) return;
    if (!currentUser) { e.preventDefault(); requireLoginForImages(); return; }
    e.preventDefault();
    for (const item of items) {
      const file = item.getAsFile();
      if (file) {
        const dataUrl = await fileToDataUrl(file);
        addAttachment(dataUrl, file.type);
      }
    }
  });

  // ---------------- 대화 전송 (여러 메시지를 연달아 보내도 순서대로 처리되는
  // 대기열 — 빨드가 "먹는 시간"으로 오래 걸려도 그동안 계속 말을 걸 수 있다) ----------------
  let isSending = false;
  const sendQueue = [];

  async function sendOne(job) {
    const { text, attachments, provider, model, apiKey } = job;
    const useGoogleGemini = provider === "gemini" && !apiKey && !!googleGeminiAccessToken;

    const isEatingTime = Math.random() < 0.6;
    addLoadingBubble(isEatingTime);
    const eatingTimeMs = isEatingTime ? 10000 + Math.random() * 50000 : 0;
    const eatingTimer = eatingTimeMs ? new Promise((resolve) => setTimeout(resolve, eatingTimeMs)) : Promise.resolve();

    const idToken = currentUser ? await getFreshIdToken() : null;
    let res;
    try {
      const [fetchRes] = await Promise.all([
        fetch("api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", ...guestHeaders() },
          body: JSON.stringify({
            message: text,
            history: currentMessages.slice(-10),
            provider,
            model,
            apiKey,
            uid: currentUser?.uid || null,
            images: attachments.map((a) => ({ dataUrl: a.dataUrl, mimeType: a.mimeType })),
            googleAccessToken: useGoogleGemini ? googleGeminiAccessToken : null,
            idToken,
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
      return;
    }

    try {
      const data = await res.json();
      removeLoadingBubble();

      if (!res.ok) {
        if (typeof data.credits === "number") renderCredits(data.credits, data.cap);
        renderRefill(data.refill);
        addMessage("assistant", data.error || data.reply || "빨드가 넘어졌다능...", {
          extraClass: data.dailyLimitReached ? "snack" : "error",
        });
      } else {
        addMessage("assistant", data.reply);
        currentMessages.push({ role: "assistant", content: data.reply });
        renderCredits(data.credits, data.cap);
        renderRefill(data.refill);
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
    }
  }

  async function processQueue() {
    if (isSending) return;
    const job = sendQueue.shift();
    if (!job) return;
    isSending = true;
    try {
      await sendOne(job);
    } finally {
      isSending = false;
      processQueue();
    }
  }

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !pendingAttachments.length) return;

    const provider = providerSelect.value;
    const model = modelSelect.value;
    const apiKey = state.keys[provider] || "";
    const attachments = pendingAttachments;

    addMessage("user", text, { images: attachments.map((a) => a.dataUrl) });
    currentMessages.push({ role: "user", content: text || "(이미지 첨부)" });
    input.value = "";
    clearAttachments();
    autoResize();

    sendQueue.push({ text, attachments, provider, model, apiKey });
    processQueue();
  });

  // 엔터는 줄바꿈(기본 textarea 동작 그대로 둠), Ctrl+Enter(맥은 Cmd+Enter)로 전송.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
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
    refreshBillingSection();
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
        const idToken = currentUser ? await getFreshIdToken() : null;
        const res = await fetch("api/bonus", {
          method: "POST",
          headers: { "content-type": "application/json", ...guestHeaders() },
          body: JSON.stringify({ type: "sticker", uid: currentUser?.uid || null, idToken }),
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
