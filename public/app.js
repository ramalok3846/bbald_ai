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
  const guideBtn = document.getElementById("guideBtn");
  const eventsBtn = document.getElementById("eventsBtn");
  const infoTabs = document.getElementById("infoTabs");
  const infoBody = document.getElementById("infoBody");
  const infoTitle = document.getElementById("infoTitle");
  const noticesDot = document.getElementById("noticesDot");
  const adminLink = document.getElementById("adminLink");
  const sidebarClose = document.getElementById("sidebarClose");

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
    { value: "lite", label: "빨드 라이트", desc: "가장 빠르고 가벼운 두뇌. 짧은 대화에 딱!", cost: 1, memberOnly: false },
    { value: "basic", label: "빨드 기본", desc: "속도와 똑똑함의 균형. 평소엔 이걸로!", cost: 1.5, memberOnly: false },
    { value: "deep", label: "빨드 딥씽킹", desc: "가장 깊게 생각하는 두뇌. 사용량을 많이 씀", cost: 3, memberOnly: true },
    { value: "story", label: "빨드 스토리", desc: "표현력 풍부한 창작 두뇌", cost: 2, memberOnly: true },
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
  let MODEL_CATALOG;
  function buildCatalog() {
    MODEL_CATALOG = Object.fromEntries(
      Object.keys(REAL_MODEL).map((prov) => [
        prov,
        TIERS.map((t) => ({ ...t, desc: `${REAL_MODEL[prov][t.value]} — ${t.desc}` })),
      ])
    );
  }
  buildCatalog();

  // 관리자 설정 중 모두에게 공개되는 값(대기 시간, 단계별 비용/로그인 필요, 공유 허용 등).
  // 서버에서 못 받아도 아래 기본값으로 그대로 동작한다.
  let pubCfg = {
    think: { minSec: 5, maxSec: 20, eatChancePct: 60 },
    tierMult: { lite: 1, basic: 1.5, deep: 3, story: 2 },
    memberOnlyTiers: { lite: false, basic: false, deep: true, story: true },
    guestImages: false,
    sharing: { enabled: true, publicAllowed: true },
  };
  async function loadPublicConfig() {
    try {
      const res = await fetch("api/config/public", { cache: "no-store" });
      if (!res.ok) return;
      pubCfg = { ...pubCfg, ...(await res.json()) };
      for (const t of TIERS) {
        if (pubCfg.tierMult?.[t.value] != null) t.cost = pubCfg.tierMult[t.value];
        if (pubCfg.memberOnlyTiers?.[t.value] != null) t.memberOnly = !!pubCfg.memberOnlyTiers[t.value];
      }
      buildCatalog();
      rebuildModelOptions();
      applyPublicExtras();
    } catch {}
  }

  // 관리자가 정한 배너/공지/문구/AI 사용 여부/제한값을 화면에 반영한다.
  // ---------------- 안내 창: 사용법 / 공지사항 / 이벤트 (관리자가 편집) ----------------
  const INFO_KINDS = { guide: "사용법", notice: "공지사항", event: "이벤트" };
  const KIND_ICON = { guide: "book", notice: "megaphone", event: "gift" };
  let infoKind = "guide";
  const SEEN_KEY = "bbald_seen_info";
  function fillTpl(text) {
    const sb = pubCfg.stickerBonus || {};
    return String(text || "")
      .replace(/\{signup\}/g, pubCfg.signupPct ?? 100)
      .replace(/\{stickerMin\}/g, sb.minPct ?? 10)
      .replace(/\{stickerMax\}/g, sb.maxPct ?? 30);
  }
  function infoSignature() {
    return (pubCfg.notices || []).filter((n) => n.kind !== "guide").map((n) => `${n.id}:${(n.title || "").length}:${(n.body || "").length}`).join("|");
  }
  function updateInfoDot() {
    let seen = "";
    try { seen = localStorage.getItem(SEEN_KEY) || ""; } catch {}
    const sig = infoSignature();
    noticesDot.hidden = !sig || sig === seen;
  }
  function markInfoSeen() {
    try { localStorage.setItem(SEEN_KEY, infoSignature()); } catch {}
    noticesDot.hidden = true;
  }
  function renderInfo() {
    infoTabs.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.kind === infoKind;
      b.setAttribute("aria-selected", String(on));
      b.classList.toggle("active", on);
    });
    infoTitle.innerHTML = bIcon(KIND_ICON[infoKind] || "info") + " ";
    infoTitle.appendChild(document.createTextNode(INFO_KINDS[infoKind] || "안내"));
    infoBody.innerHTML = "";
    const list = Array.isArray(pubCfg.notices) ? pubCfg.notices.filter((n) => (n.kind || "notice") === infoKind) : null;
    if (!list || !list.length) {
      const p = document.createElement("p");
      p.className = "hint info-empty";
      p.textContent = list ? "아직 올라온 글이 없다능!" : "불러오지 못했다능... 잠시 후 다시 열어달라능!";
      infoBody.appendChild(p);
    } else {
      list.forEach((n, i) => {
        const art = document.createElement("article");
        art.className = `notice-card kind-${infoKind}`;
        art.style.animationDelay = `${Math.min(i, 8) * 40}ms`;
        const h = document.createElement("h3");
        h.innerHTML = bIcon(KIND_ICON[infoKind] || "info") + " ";
        h.appendChild(document.createTextNode(n.title));
        if (n.pinned) { const pin = document.createElement("span"); pin.className = "pin-tag"; pin.textContent = "고정"; h.appendChild(pin); }
        const pEl = document.createElement("p");
        pEl.textContent = bStripEmoji(fillTpl(n.body));
        art.append(h, pEl);
        infoBody.appendChild(art);
      });
    }
    updateInfoDot();
  }
  function openInfo(kind) {
    infoKind = INFO_KINDS[kind] ? kind : "guide";
    renderInfo();
    openModal(noticesBackdrop);
    if (infoKind !== "guide") markInfoSeen();
    infoBody.scrollTop = 0;
  }
  infoTabs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-kind]");
    if (!b) return;
    infoKind = b.dataset.kind;
    renderInfo();
    if (infoKind !== "guide") markInfoSeen();
    infoBody.scrollTop = 0;
  });

  // PAL 콘솔(ramalok.kr/console) 통계: 스크립트(/js/pal-analytics.js)가 없거나 막혀 있어도 아무 일도 일어나지 않는다.
  function track(name) { try { window.PalAnalytics?.event(name); } catch {} }

  // ---------------- 모달 열기/닫기 (애니메이션 + Esc + 포커스) ----------------
  let lastFocus = null;
  function openModal(backdrop) {
    lastFocus = document.activeElement;
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
  function closeModal(backdrop) {
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".modal-backdrop.open")) document.body.classList.remove("modal-open");
    try { lastFocus?.focus?.(); } catch {}
  }

  // ---------------- 그랜드 오픈: 오픈 전 접속 제한 + 카운트다운 ----------------
  let launchTimer = null;
  let launchPreview = false; // 관리자가 오픈 전에 미리 입장한 상태
  let launchCelebrating = false;
  function fmtKst(ms) {
    try {
      return new Date(ms).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return ""; }
  }
  function pad2(n) { return String(Math.max(0, n)).padStart(2, "0"); }
  function confettiHtml(n) {
    const colors = ["#ff6b6b", "#ffd166", "#7c5cfc", "#e58bd9", "#4ecdc4", "#fff"];
    let h = "";
    for (let i = 0; i < n; i++) {
      const left = Math.random() * 100, delay = Math.random() * 1.6, dur = 2.6 + Math.random() * 2.4, size = 6 + Math.random() * 8, rot = Math.random() * 360;
      h += `<i style="left:${left}%;width:${size}px;height:${size * 1.6}px;background:${colors[i % colors.length]};animation-delay:${delay}s;animation-duration:${dur}s;transform:rotate(${rot}deg)"></i>`;
    }
    return h;
  }
  function removeLaunchOverlay() {
    clearInterval(launchTimer);
    launchTimer = null;
    document.getElementById("launchOverlay")?.remove();
    document.body.classList.remove("launch-lock");
  }
  function buildLaunchOverlay() {
    let ov;
      ov = document.createElement("div");
      ov.id = "launchOverlay";
      ov.className = "launch-overlay";
      ov.setAttribute("role", "dialog");
      ov.setAttribute("aria-label", "빨드 AI 그랜드 오픈 카운트다운");
      ov.innerHTML = `
        <div class="launch-bg" aria-hidden="true"><i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i><span class="grid"></span></div>
        <div class="launch-stars" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<span style="left:${(i * 53) % 100}%;top:${(i * 37) % 100}%;animation-delay:${(i % 7) * 0.4}s">${bIcon("star")}</span>`).join("")}</div>
        <div class="launch-confetti" aria-hidden="true"></div>
        <div class="launch-card">
          <div class="launch-ribbon"><span class="lv"></span><b>GRAND OPEN</b></div>
          <div class="launch-mascot"><span class="halo"></span><img src="icon-256.png" alt="빨드" /></div>
          <h1 class="launch-title"></h1>
          <p class="launch-date"></p>
          <div class="launch-count" role="timer" aria-live="off">
            <div class="cell"><b data-u="d">00</b><small>일</small></div><em>:</em>
            <div class="cell"><b data-u="h">00</b><small>시간</small></div><em>:</em>
            <div class="cell"><b data-u="m">00</b><small>분</small></div><em>:</em>
            <div class="cell"><b data-u="s">00</b><small>초</small></div>
          </div>
          <p class="launch-msg"></p>
          <div class="launch-actions">
            <a class="launch-btn primary" target="_blank" rel="noopener">${bIcon("megaphone")}<span>오픈 안내 보기</span></a>
            <button type="button" class="launch-btn ghost" id="launchAdminBtn">${bIcon("shield")}<span>관리자 입장</span></button>
          </div>
          <p class="launch-foot">정식 오픈 전까지 점검 · 보수가 있을 수 있어요</p>
        </div>`;
      document.body.appendChild(ov);
      ov.querySelector(".launch-confetti").innerHTML = "";
      ov.querySelector("#launchAdminBtn").addEventListener("click", () => {
        if (!currentUser) { authBtn.click(); return; }
        revealAdminLink(true);
      });
    return ov;
  }

  function applyLaunch() {
    const L = pubCfg.launch;
    const verBadge = document.getElementById("verBadge");
    if (verBadge) verBadge.textContent = pubCfg.version || L?.version || "v1.0.0";
    const showGate = !!(L && L.active && !launchPreview && !pubCfg.maintenance?.enabled);
    let ov = document.getElementById("launchOverlay");
    if (!showGate && L && !L.active && L.celebrate && !celebrateDone && !launchCelebrating && !shareParam && !pubCfg.maintenance?.enabled) {
      showCelebration();
      return;
    }
    if (!showGate) {
      if (ov && !launchCelebrating) removeLaunchOverlay();
      document.body.classList.toggle("launch-lock", !!ov && launchCelebrating);
      // 오픈 전에 관리자 미리보기로 들어온 경우 표시
      let pv = document.getElementById("launchPreviewBar");
      if (L?.active && launchPreview) {
        if (!pv) {
          pv = document.createElement("div");
          pv.id = "launchPreviewBar";
          pv.className = "site-banner warn";
          document.querySelector(".main").insertBefore(pv, document.querySelector(".main").firstChild);
        }
        pv.textContent = `오픈 전 미리보기 — ${fmtKst(L.at)} 오픈 예정 (관리자만 입장 중)`;
      } else pv?.remove();
      return;
    }
    const offset = (L.now || Date.now()) - Date.now();
    if (!ov) ov = buildLaunchOverlay();
    document.body.classList.add("launch-lock");
    ov.querySelector(".lv").textContent = pubCfg.version || L.version || "v1.0.0";
    ov.querySelector(".launch-title").textContent = L.title || "빨드 AI 그랜드 오픈";
    ov.querySelector(".launch-date").textContent = `${fmtKst(L.at)} (KST) 정식 오픈`;
    ov.querySelector(".launch-msg").textContent = L.message || "";
    const nb = ov.querySelector(".launch-btn.primary");
    nb.href = L.noticeUrl || "https://www.ramalok.kr/notice?id=bbald-open";
    ov.querySelector("#launchAdminBtn span").textContent = currentUser ? "관리자 확인" : "관리자 입장";

    clearInterval(launchTimer);
    const tick = () => {
      const left = L.at - (Date.now() + offset);
      if (left <= 0) { clearInterval(launchTimer); celebrateOpen(); return; }
      const sec = Math.floor(left / 1000);
      const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      const set = (u, v) => { const el = ov.querySelector(`[data-u="${u}"]`); if (el && el.textContent !== v) { el.textContent = v; el.classList.remove("tick"); void el.offsetWidth; el.classList.add("tick"); } };
      set("d", pad2(d)); set("h", pad2(h)); set("m", pad2(m)); set("s", pad2(s));
      ov.querySelector(".launch-count").classList.toggle("urgent", left < 60 * 1000);
    };
    tick();
    launchTimer = setInterval(tick, 250);
  }
  // 축하 화면: 오픈 시각이 되는 순간 + 오픈 후 celebrateDays(기본 7일) 동안 접속할 때마다.
  // 건너뛰기: 스페이스 키 (또는 버튼/화면 터치 — 키보드가 없는 모바일용).
  let celebrateDone = false;
  let celebrateKeyHandler = null;
  function endCelebration() {
    if (!launchCelebrating) return;
    launchCelebrating = false;
    celebrateDone = true;
    if (celebrateKeyHandler) { document.removeEventListener("keydown", celebrateKeyHandler, true); celebrateKeyHandler = null; }
    const ov = document.getElementById("launchOverlay");
    if (ov) {
      ov.classList.add("leaving");
      setTimeout(() => { if (!launchCelebrating) removeLaunchOverlay(); }, 450);
    }
    loadPublicConfig();
  }
  function showCelebration() {
    if (launchCelebrating) return;
    launchCelebrating = true;
    clearInterval(launchTimer);
    let ov = document.getElementById("launchOverlay");
    if (!ov) ov = buildLaunchOverlay();
    ov.classList.remove("leaving");
    ov.classList.add("opened");
    document.body.classList.add("launch-lock");
    const L = pubCfg.launch || {};
    const day = L.at ? Math.max(1, Math.floor(((L.now || Date.now()) - L.at) / 86400000) + 1) : 1;
    ov.querySelector(".lv").textContent = pubCfg.version || L.version || "v1.0.0";
    ov.querySelector(".launch-confetti").innerHTML = confettiHtml(90);
    ov.querySelector(".launch-title").textContent = `${pubCfg.version || "v1.0.0"} 정식 오픈!`;
    ov.querySelector(".launch-date").textContent = day > 1 ? `빨드 AI 오픈 ${day}일째 — 와줘서 고맙다능` : "빨드 AI가 문을 열었다능";
    ov.querySelector(".launch-msg").textContent = "지금부터 마음껏 빨드랑 놀아달라능!";
    ov.querySelector(".launch-count").hidden = true;
    ov.querySelector(".launch-foot").hidden = true;
    ov.querySelector(".launch-actions").innerHTML = `<button type="button" class="launch-btn primary" id="launchEnter">${bIcon("bolt")}<span>빨드 만나러 가기</span></button><p class="launch-skip"><kbd>Space</kbd> 를 누르면 건너뛰어요</p>`;
    ov.querySelector("#launchEnter").addEventListener("click", endCelebration);
    celebrateKeyHandler = (e) => {
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); e.stopPropagation(); endCelebration(); }
    };
    document.addEventListener("keydown", celebrateKeyHandler, true);
    ov.querySelector("#launchEnter").focus({ preventScroll: true });
  }
  // 오픈 시각이 되는 순간 (카운트다운이 0이 됨)
  async function celebrateOpen() {
    try { await loadPublicConfig(); } catch {}
    if (!pubCfg.launch?.active) showCelebration();
  }

  // 점검 모드: 화면 전체를 덮고 입력을 막는다 (관리자 설정에서 켜면 새로고침 없이 다음 요청/포커스 때 바로 반영).
  function applyMaintenance(on, message) {
    let ov = document.getElementById("maintOverlay");
    document.body.classList.toggle("maint-lock", !!on);
    if (!on) { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "maintOverlay";
      ov.className = "maint-overlay";
      ov.setAttribute("role", "alertdialog");
      ov.innerHTML = '<div class="maint-box"><div class="maint-emoji">' + bIcon("wrench") + '</div><h2>점검 중이다능</h2><p class="maint-msg"></p><button type="button" class="maint-retry">다시 확인하기</button></div>';
      document.body.appendChild(ov);
      ov.querySelector(".maint-retry").addEventListener("click", () => loadPublicConfig());
    }
    ov.querySelector(".maint-msg").textContent = message || "잠시 후에 다시 와달라능!";
  }
  window.addEventListener("focus", () => { loadPublicConfig(); });

  function applyPublicExtras() {
    applyMaintenance(!!pubCfg.maintenance?.enabled, pubCfg.maintenance?.message);
    applyLaunch();
    const mainEl = document.querySelector(".main");
    let banner = document.getElementById("siteBanner");
    const bc = pubCfg.banner;
    if (bc?.enabled && bc.text) {
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "siteBanner";
        mainEl.insertBefore(banner, mainEl.firstChild);
      }
      banner.className = `site-banner ${bc.level === "warn" ? "warn" : "info"}`;
      banner.textContent = bc.text;
      if (bc.link) {
        const a = document.createElement("a");
        a.href = bc.link; a.target = "_blank"; a.rel = "noopener"; a.textContent = "자세히 ›";
        banner.append(" ", a);
      }
      banner.hidden = false;
    } else if (banner) banner.hidden = true;

    renderInfo();
    if (pubCfg.launch && !pubCfg.launch.active && pubCfg.launch.enabled && !shareParam) {
      let seen = true;
      try { seen = localStorage.getItem("bbald_v1_welcome") === "1"; } catch {}
      if (!seen && !launchCelebrating && !pubCfg.launch.celebrate && currentMessages.length === 0) {
        try { localStorage.setItem("bbald_v1_welcome", "1"); } catch {}
        addMessage("assistant", `${pubCfg.version || "v1.0.0"} 그랜드 오픈을 같이 축하해달라능! 오늘도 빨드랑 놀아달라능~`, { extraClass: "snack", skipStore: true });
      }
    }
    if (pubCfg.texts?.placeholder) input.placeholder = pubCfg.texts.placeholder;
    if (pubCfg.limits?.maxMessageChars) input.maxLength = pubCfg.limits.maxMessageChars;

    for (const opt of providerSelect.options) {
      const off = pubCfg.providersEnabled?.[opt.value] === false;
      opt.disabled = off;
      opt.hidden = off;
    }
    if (providerSelect.selectedOptions[0]?.disabled) {
      const first = Array.from(providerSelect.options).find((o) => !o.disabled);
      if (first) { providerSelect.value = first.value; rebuildModelOptions(); }
    }
    // 아직 대화를 시작하지 않았다면 바뀐 인사말로 다시 그린다.
    if (!currentMessages.length && !shareParam && chatEl.children.length === 1 && !pendingConvParam) {
      chatEl.innerHTML = "";
      addGreeting();
    }
  }
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

  // ---- 채팅 고유번호 + 주소 파라미터 ----
  // 일반/시크릿 모두 첫 메시지를 보낼 때 고유번호가 생기고 주소에 ?c=번호 (시크릿은 &secret=1)가 붙는다.
  // 새로고침하거나 주소를 다시 열면 같은 대화로 돌아온다 — 로그인 일반 채팅은 서버 저장본,
  // 게스트/시크릿은 이 탭의 sessionStorage에서 (탭을 닫으면 사라져서 "저장 안 됨"은 그대로).
  const urlParams = new URLSearchParams(location.search);
  const shareParam = urlParams.get("share");
  let pendingConvParam = /^[a-z0-9]{8,40}$/.test(urlParams.get("c") || "") ? urlParams.get("c") : null;
  const pendingSecret = urlParams.get("secret") === "1";
  function newChatId() {
    const a = new Uint8Array(10);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
  }
  function syncUrl() {
    if (shareParam) return;
    try {
      const u = new URL(location.href);
      if (currentConvId) {
        u.searchParams.set("c", currentConvId);
        if (isIncognito) u.searchParams.set("secret", "1");
        else u.searchParams.delete("secret");
      } else {
        u.searchParams.delete("c");
        u.searchParams.delete("secret");
      }
      history.replaceState(null, "", u);
    } catch {}
  }
  function ensureConvId() {
    if (!currentConvId) currentConvId = newChatId();
    syncUrl();
  }
  function sessionSave() {
    if (!currentConvId || !currentMessages.length) return;
    if (currentUser && !isIncognito) return; // 로그인 일반 채팅은 서버에 저장됨
    const key = `bbald_sess_${currentConvId}`;
    try {
      sessionStorage.setItem(key, JSON.stringify({ messages: currentMessages, secret: isIncognito, ts: Date.now() }));
    } catch {
      // 사진 때문에 저장 공간(약 5MB)이 넘치면 글만이라도 저장한다.
      try {
        sessionStorage.setItem(key, JSON.stringify({ messages: currentMessages.map((m) => ({ role: m.role, content: m.content })), secret: isIncognito, ts: Date.now() }));
      } catch {}
    }
  }
  function sessionLoad(id) {
    try {
      const r = JSON.parse(sessionStorage.getItem(`bbald_sess_${id}`) || "null");
      return r && Array.isArray(r.messages) ? r : null;
    } catch {
      return null;
    }
  }
  function renderCurrentMessages() {
    chatEl.innerHTML = "";
    if (!currentMessages.length) addGreeting();
    else for (const m of currentMessages) addMessage(m.role === "assistant" ? "assistant" : "user", m.content, { skipStore: true, images: m.images });
  }

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
    planStatus.textContent = `요금제: ${plan.id === "free" ? "무료" : `${plan.name}${until}`}`;
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
      opt.textContent = locked ? `${m.label} (로그인 필요)` : m.label;
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
      delBtn.innerHTML = bIcon("x");
      delBtn.setAttribute("aria-label", "대화 삭제");
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
      if (!res.ok) { if (currentConvId === id) { currentConvId = null; syncUrl(); } return false; }
      const conv = await res.json();
      currentConvId = conv.id;
      currentMessages = Array.isArray(conv.messages) ? conv.messages : [];
      isIncognito = false;
      updateSecretBadge();
      renderCurrentMessages();
      syncUrl();
      renderConvList();
      closeSidebar();
      return true;
    } catch {}
    return false;
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
        syncUrl();
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
        const summary = { id: record.id, title: record.title, updatedAt: record.updatedAt, visibility: record.visibility, shareId: record.shareId };
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
      if (pendingConvParam && !shareParam) {
        const id = pendingConvParam;
        pendingConvParam = null;
        if (!currentMessages.length) await loadConversationById(id);
      }
    } else {
      currentIdToken = null;
      googleGeminiAccessToken = null;
      conversationsCache = [];
      syncCreditsFromServer();
      if (pendingConvParam && !shareParam) { pendingConvParam = null; currentConvId = null; syncUrl(); } // 저장본이 없는 주소
    }
    renderAccount();
    renderConvList();
    revealAdminLink();
  });

  // 관리자 계정이면 사이드바에 "관리자" 메뉴를 보여준다 (일반 사용자에게는 숨김).
  async function revealAdminLink(manual = false) {
    adminLink.hidden = true;
    if (!currentUser) return;
    try {
      const t = await getFreshIdToken();
      if (!t) return;
      const r = await fetch("api/admin/me", { headers: { "x-admin-token": t } });
      adminLink.hidden = !r.ok;
      // 오픈 전에는 관리자만 미리 입장할 수 있다.
      if (r.ok && pubCfg.launch?.active) { launchPreview = true; applyLaunch(); }
      else if (manual) {
        const msg = document.querySelector("#launchOverlay .launch-foot");
        if (msg) msg.textContent = "관리자 계정이 아니라서 들어갈 수 없어요. 오픈 시각까지 기다려 주세요.";
      }
    } catch {}
  }

  authBtn.addEventListener("click", async () => {
    if (!window.bbaldAuth) {
      addMessage("assistant", "로그인 모듈을 불러오는 중이다능... 잠시 후 다시 눌러달라능!", { extraClass: "snack", skipStore: true });
      return;
    }
    if (authBtn.disabled) return;
    const label = authBtn.textContent;
    authBtn.disabled = true;
    try {
      if (currentUser) {
        if (!confirm("로그아웃할까?")) return;
        authBtn.textContent = "로그아웃 중…";
        await window.bbaldAuth.signOutUser();
      } else {
        authBtn.textContent = "로그인 창 여는 중…";
        const result = await window.bbaldAuth.signInGoogle();
        if (result?.googleAccessToken) googleGeminiAccessToken = result.googleAccessToken;
      }
    } catch (err) {
      addMessage("assistant", `로그인에 실패했다능... (${err?.message || err}) 팝업 차단을 풀고 다시 해달라능!`, { extraClass: "error", skipStore: true });
    } finally {
      authBtn.disabled = false;
      authBtn.textContent = currentUser ? "로그아웃" : "로그인";
      if (!currentUser && authBtn.textContent === label) authBtn.textContent = "로그인";
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

  function setMood(icon, text) {
    moodBadge.innerHTML = bIcon(icon) + " ";
    moodBadge.appendChild(document.createTextNode(text));
  }

  function updateMoodUI(hour, minute, level, sunsetLabel) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    kstClock.textContent = `${hh}:${mm}`;
    const sunsetNote = sunsetLabel ? ` · 오늘 일몰 ${sunsetLabel}` : "";

    if (level <= 0.05) {
      smartState.textContent = `멍청 모드${sunsetNote}`;
      setMood("moon", "아직 멍청한 시간");
    } else if (level <= 0.4) {
      smartState.textContent = `노을 다가오는 중 (살짝 또렷)${sunsetNote}`;
      setMood("cloudsun", "노을이 다가오는 중");
    } else if (level <= 0.75) {
      smartState.textContent = `노을 모드 (제법 또렷)${sunsetNote}`;
      setMood("sunset", "노을 모드! 조금 똑똑해짐");
    } else {
      smartState.textContent = `노을 절정 (오늘 중 제일 또렷)${sunsetNote}`;
      setMood("sunrise", "노을 절정! 오늘 제일 또렷함");
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
    // 이모지(그림 문자)는 기본적으로 화면에서 가린다 (관리자 설정 "답변의 이모지 유지"를 켜면 그대로).
    // 저장된 대화 내용은 그대로 두고, 보여줄 때만 지운다. 안내/오류 문구는 항상 지운다.
    if (typeof text === "string" && (opts.extraClass || !pubCfg.texts?.keepEmoji)) text = bStripEmoji(text);
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
    const text = pubCfg.texts?.greeting || "안뇽!! 빨드다능! 🦕 무엇이든 물어봐바~ (근데 어려운 건 잘 모를 수도 있다능 히히)";
    addMessage("assistant", text, { skipStore: true });
  }

  // ---------------- 생각 중 표시 ----------------
  // 대기 중에는 메시지를 하나만 보여준다(돌아가며 바뀌지 않음). 채팅마다 eatChancePct(기본 60%)
  // 확률로 "쵸꼴뤳 먹는 중" 멘트, 아니면 "생각 중" 멘트. 기다리는 시간은 관리자 설정의
  // minSec~maxSec(기본 5~20초) 사이 랜덤이고, 실제 응답이 더 늦으면 응답이 올 때까지다.
  const EAT_PHRASES = [
    "빨드 쵸꼴뤳 먹는 중이다능...! 🍫",
    "빨드 쵸~~꼴--륏 냠냠 먹는 중이다능...! 🍫",
    "빨드 영양 보충 중이다능... 쵸꼴뤳 냠냠! 🍫",
  ];
  const THINK_PHRASE = "빨드 생각 중이다능... 🦕";
  function pickLoadingPhrase(isEating) {
    return isEating ? EAT_PHRASES[Math.floor(Math.random() * EAT_PHRASES.length)] : THINK_PHRASE;
  }
  function addLoadingBubble(isEating) {
    removeLoadingBubble();
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
    bubble.textContent = bStripEmoji(pickLoadingPhrase(isEating));
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    chatEl.scrollTop = chatEl.scrollHeight;
  }
  function removeLoadingBubble() {
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
      removeBtn.innerHTML = bIcon("x");
      removeBtn.setAttribute("aria-label", "첨부 삭제");
      removeBtn.addEventListener("click", () => {
        pendingAttachments.splice(idx, 1);
        renderAttachPreview();
      });
      item.append(img, removeBtn);
      attachPreview.appendChild(item);
    });
  }
  // 사진은 그대로 보내면 너무 크거나(휴대폰 사진 5~15MB) AI가 못 읽는 형식(HEIC 등)일 수 있어서,
  // 브라우저에서 한 번 다시 그려 긴 변 1568px 이하 JPEG(투명 배경은 흰색)로 줄여서 보낸다.
  // 모든 AI(Claude/ChatGPT/Gemini)가 읽을 수 있고 요청 크기도 작아진다.
  function normalizeImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1568;
          const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight, 1));
          const w = Math.max(1, Math.round(img.naturalWidth * scale));
          const h = Math.max(1, Math.round(img.naturalHeight * scale));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let out = c.toDataURL("image/jpeg", 0.85);
          if (out.length > 4_500_000) out = c.toDataURL("image/jpeg", 0.6);
          resolve(out);
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error("이미지를 읽을 수 없다능"));
      img.src = dataUrl;
    });
  }
  // 대화에 저장해 둘 미리보기 사진(긴 변 960px, JPEG 70%): 새로고침/대화 다시 열기에서도 보이게 한다.
  function makeThumb(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, 960 / Math.max(img.naturalWidth, img.naturalHeight, 1));
          const c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const x = c.getContext("2d");
          x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
          x.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.7));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }
  async function addAttachmentSafe(dataUrl, label) {
    try {
      addAttachment(await normalizeImage(dataUrl), "image/jpeg");
    } catch {
      addMessage("assistant", `이 사진은 빨드가 못 열겠다능... (${label || "알 수 없는 형식"}) JPG/PNG/WEBP로 다시 올려달라능!`, { extraClass: "error", skipStore: true });
    }
  }
  function addAttachment(dataUrl, mimeType) {
    const maxImg = pubCfg.limits?.maxImages ?? 4;
    if (pendingAttachments.length >= maxImg) {
      addMessage("assistant", `이미지는 한 번에 ${maxImg}장까지만 붙일 수 있다능!`, { extraClass: "snack", skipStore: true });
      return;
    }
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
    if (currentUser || pubCfg.guestImages) return true;
    addMessage("assistant", "이미지 첨부는 로그인하면 쓸 수 있다능! 게스트는 아직 안 된다능 🔒", { extraClass: "snack" });
    return false;
  }

  // ---------------- 이미지 확대(라이트박스) ----------------
  function openLightbox(src) {
    const dl = document.getElementById("lightboxDownload");
    if (dl) { dl.href = src; dl.download = `bbald-${Date.now()}.${/^data:image\/png/.test(src) ? "png" : "jpg"}`; }
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
      if (file.type && !file.type.startsWith("image/")) {
        addMessage("assistant", `"${file.name}" 은(는) 이미지가 아니라서 못 붙인다능!`, { extraClass: "error", skipStore: true });
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      await addAttachmentSafe(dataUrl, file.type || file.name);
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
        await addAttachmentSafe(dataUrl, url);
      } catch {
        addMessage("assistant", `이미지를 못 가져왔다능... (${url})`, { extraClass: "error" });
      }
    }
  });

  input.addEventListener("paste", async (e) => {
    const items = Array.from(e.clipboardData?.items || []).filter((it) => it.type.startsWith("image/"));
    if (!items.length) return;
    if (!currentUser && !pubCfg.guestImages) { e.preventDefault(); requireLoginForImages(); return; }
    e.preventDefault();
    for (const item of items) {
      const file = item.getAsFile();
      if (file) {
        const dataUrl = await fileToDataUrl(file);
        await addAttachmentSafe(dataUrl, file.type);
      }
    }
  });

  // ---------------- 대화 전송 (여러 메시지를 연달아 보내도 순서대로 처리되는
  // 대기열 — 빨드가 "먹는 시간"으로 오래 걸려도 그동안 계속 말을 걸 수 있다) ----------------
  let isSending = false;
  const sendQueue = [];

  async function sendOne(job) {
    const { text, attachments, provider, model, apiKey, thumbsReady } = job;
    const useGoogleGemini = provider === "gemini" && !apiKey && !!googleGeminiAccessToken;

    const th = pubCfg.think;
    const isEatingTime = Math.random() * 100 < th.eatChancePct;
    addLoadingBubble(isEatingTime);
    const waitMs = (th.minSec + Math.random() * Math.max(0, th.maxSec - th.minSec)) * 1000;
    const eatingTimer = new Promise((resolve) => setTimeout(resolve, waitMs));

    const idToken = currentUser ? await getFreshIdToken() : null;
    let res;
    try {
      const [fetchRes] = await Promise.all([
        fetch("api/chat", {
          method: "POST",
          headers: { "content-type": "application/json", ...guestHeaders() },
          body: JSON.stringify({
            message: text,
            history: currentMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
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

      if (data.maintenance) { applyMaintenance(true, data.reply || data.error); return; }
      if (data.launch) { loadPublicConfig(); return; }
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
        if (typeof data.smartLevel === "number") {
          const local = getLocalKstGuess();
          updateMoodUI(local.hour, local.minute, data.smartLevel, data.sunset);
        }
        await (thumbsReady || Promise.resolve());
        await persistCurrentConversation();
        sessionSave();
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
    ensureConvId();
    const userMsg = { role: "user", content: text || "(이미지 첨부)" };
    currentMessages.push(userMsg);
    const thumbsReady = attachments.length
      ? Promise.all(attachments.map((a) => makeThumb(a.dataUrl))).then((t) => { const ok = t.filter(Boolean); if (ok.length) userMsg.images = ok; })
      : Promise.resolve();
    thumbsReady.then(() => sessionSave());
    sessionSave();
    input.value = "";
    clearAttachments();
    autoResize();

    track("bbald-chat");
    if (attachments.length) track("bbald-image");
    sendQueue.push({ text, attachments, provider, model, apiKey, thumbsReady });
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
    syncUrl();
    renderConvList();
  }

  newChatBtn.addEventListener("click", () => {
    if (shareParam) { location.href = location.pathname; return; }
    startNewChat();
  });

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

  // ---------------- 설정 / 안내 모달 ----------------
  settingsBtn.addEventListener("click", () => {
    openModal(settingsBackdrop);
    refreshUsageDetail();
    refreshBillingSection();
  });
  closeSettings.addEventListener("click", () => closeModal(settingsBackdrop));
  settingsBackdrop.addEventListener("click", (e) => { if (e.target === settingsBackdrop) closeModal(settingsBackdrop); });

  noticesBtn.addEventListener("click", () => openInfo("notice"));
  eventsBtn.addEventListener("click", () => openInfo("event"));
  guideBtn.addEventListener("click", () => openInfo("guide"));
  closeNotices.addEventListener("click", () => closeModal(noticesBackdrop));
  noticesBackdrop.addEventListener("click", (e) => { if (e.target === noticesBackdrop) closeModal(noticesBackdrop); });

  // Esc: 열린 창 → 사이드바 순서로 닫는다.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = Array.from(document.querySelectorAll(".modal-backdrop.open")).pop();
    if (!lightbox.hidden) closeLightbox();
    else if (open) closeModal(open);
    else if (sidebar.classList.contains("open")) closeSidebar();
  });

  // ---------------- 모바일 사이드바 (햄버거 → X 모션, 슬라이드, 스와이프로 닫기) ----------------
  function openSidebar() {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.add("open");
    menuToggle.classList.add("open");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "메뉴 닫기");
    document.body.classList.add("menu-open");
  }
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("open");
    menuToggle.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "메뉴 열기");
    document.body.classList.remove("menu-open");
    sidebar.style.transform = "";
  }
  menuToggle.addEventListener("click", () => (sidebar.classList.contains("open") ? closeSidebar() : openSidebar()));
  sidebarClose.addEventListener("click", closeSidebar);
  sidebarBackdrop.addEventListener("click", closeSidebar);
  sidebar.querySelectorAll("button, a").forEach((el) => {
    if (el.id === "incognitoBtn" || el.id === "sidebarClose") return; // 자체 핸들러가 있거나 위에서 처리
    el.addEventListener("click", closeSidebar);
  });
  window.addEventListener("resize", () => { if (window.innerWidth > 720) closeSidebar(); });
  // 사이드바를 왼쪽으로 밀면 닫힌다.
  {
    let sx = null, sy = 0, dx = 0;
    sidebar.addEventListener("touchstart", (e) => { if (!sidebar.classList.contains("open")) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; sidebar.style.transition = "none"; }, { passive: true });
    sidebar.addEventListener("touchmove", (e) => {
      if (sx === null) return;
      dx = e.touches[0].clientX - sx;
      if (Math.abs(e.touches[0].clientY - sy) > Math.abs(dx)) return;
      if (dx < 0) sidebar.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    sidebar.addEventListener("touchend", () => {
      if (sx === null) return;
      sidebar.style.transition = "";
      if (dx < -60) closeSidebar(); else sidebar.style.transform = "";
      sx = null;
    });
  }

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
  let stickerHideTimer = null;
  const STICKER_SHOW_MS = 6000;
  function stickerEnabled() {
    return pubCfg.stickerBonus?.enabled !== false && !pubCfg.maintenance?.enabled && !shareParam && !(pubCfg.launch?.active && !launchPreview);
  }
  function scheduleSticker(first = false) {
    clearTimeout(stickerTimer);
    const sb = pubCfg.stickerBonus || {};
    const min = (sb.minIntervalSec || 90) * 1000;
    const max = Math.max(min, (sb.maxIntervalSec || 240) * 1000);
    // 처음 한 번은 금방 보여서 "이벤트가 있구나"를 알 수 있게 한다.
    const delay = first ? 20000 + Math.random() * 25000 : min + Math.random() * (max - min);
    stickerTimer = setTimeout(showSticker, delay);
  }
  function hideSticker() {
    clearTimeout(stickerHideTimer);
    stickerBtn.hidden = true;
    stickerBtn.classList.remove("show");
  }
  function showSticker() {
    // 안 보이는 탭 / 창이 열려 있을 때 / 기능이 꺼졌을 때는 건너뛰고 잠시 뒤에 다시 시도한다.
    if (!stickerEnabled() || document.hidden || document.body.classList.contains("modal-open") || document.body.classList.contains("menu-open")) {
      stickerTimer = setTimeout(showSticker, 15000);
      return;
    }
    const bounds = chatWrap.getBoundingClientRect();
    const size = 64;
    stickerBtn.style.left = `${Math.max(8, Math.random() * Math.max(0, bounds.width - size - 16))}px`;
    stickerBtn.style.top = `${Math.max(8, Math.random() * Math.max(0, bounds.height - size - 16))}px`;
    stickerBadge.innerHTML = bIcon("gift");
    stickerBtn.style.setProperty("--sticker-ms", `${STICKER_SHOW_MS}ms`);
    stickerBtn.hidden = false;
    stickerBtn.classList.remove("show");
    void stickerBtn.offsetWidth; // 애니메이션 다시 시작
    stickerBtn.classList.add("show");

    stickerHideTimer = setTimeout(() => {
      hideSticker();
      scheduleSticker();
    }, STICKER_SHOW_MS);

    stickerBtn.onclick = async () => {
      hideSticker();
      try {
        const idToken = currentUser ? await getFreshIdToken() : null;
        const res = await fetch("api/bonus", {
          method: "POST",
          headers: { "content-type": "application/json", ...guestHeaders() },
          body: JSON.stringify({ type: "sticker", uid: currentUser?.uid || null, idToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.granted) {
          track("bbald-sticker");
          renderCredits(data.balance, data.cap);
          const pctGained = Math.max(1, Math.round((data.amount / (data.cap || creditsCap || 100)) * 100));
          addMessage("assistant", `짠! 빨드 스티커 찾았다능! 보너스 사용량 +${pctGained}% 선물이다능! 🎁🦕`, { extraClass: "snack", skipStore: true });
        } else if (data.full) {
          addMessage("assistant", "빨드 파워가 이미 꽉 차 있다능! 다음에 줄어들면 또 찾아줘~ 🦕", { extraClass: "snack", skipStore: true });
        } else if (data.disabled || data.maintenance) {
          addMessage("assistant", "스티커 이벤트는 지금 쉬고 있다능! 🛠️", { extraClass: "snack", skipStore: true });
        } else {
          addMessage("assistant", "어? 방금 막 빨드 간식 다 먹었나보다... 쬐끔 있다 또 찾아봐줘!", { extraClass: "snack", skipStore: true });
        }
      } catch {
        addMessage("assistant", "스티커를 못 받았다능... 네트워크가 이상한가봐!", { extraClass: "error", skipStore: true });
      }
      scheduleSticker();
    };
  }
  scheduleSticker(true);

  // ---------------- 초기 상태: 서버 크레딧 동기화 + 인사 ----------------
  // index.html에 미리 박아둔 인사 말풍선은 지우고 JS가 다시 그린다 (중복 방지).
  chatEl.innerHTML = "";
  syncCreditsFromServer();
  addGreeting();
  renderConvList();
  loadPublicConfig();

  // 주소에 ?c=번호 가 있으면 새로고침 전 대화로 복원한다 (게스트/시크릿은 이 탭 저장본, 로그인 회원은 인증 뒤 서버에서).
  if (pendingConvParam && !shareParam) {
    const sess = sessionLoad(pendingConvParam);
    if (sess && (sess.secret || pendingSecret || !currentUser)) {
      currentConvId = pendingConvParam;
      currentMessages = sess.messages;
      isIncognito = !!sess.secret;
      updateSecretBadge();
      renderCurrentMessages();
      pendingConvParam = null;
    }
  }

  // ---------------- 공유 ----------------
  // 저장된 대화(로그인 + 시크릿 아님)만 공유할 수 있다. 공개 범위: 비공개 / 링크 공유 / 전체 공개.
  const shareBtn = document.getElementById("shareBtn");
  const shareBackdrop = document.getElementById("shareBackdrop");
  const shareVisibility = document.getElementById("shareVisibility");
  const shareLinkRow = document.getElementById("shareLinkRow");
  const shareLink = document.getElementById("shareLink");
  const shareHint = document.getElementById("shareHint");
  const shareLinkFor = (shareId) => `${location.origin}${location.pathname}?share=${shareId}`;

  async function openShare() {
    openModal(shareBackdrop);
    shareLinkRow.hidden = true;
    shareVisibility.disabled = true;
    const publicOpt = shareVisibility.querySelector('option[value="public"]');
    if (publicOpt) publicOpt.disabled = pubCfg.sharing?.publicAllowed === false;
    const fail = (t) => { shareHint.textContent = bStripEmoji(t); };
    if (pubCfg.sharing?.enabled === false) return fail("지금은 대화 공유가 꺼져 있다능.");
    if (!currentUser) return fail("대화 공유는 로그인해야 쓸 수 있다능! 🔒");
    if (isIncognito) return fail("시크릿 대화는 저장이 안 돼서 공유할 수 없다능 🕶️");
    if (!currentMessages.length) return fail("먼저 빨드랑 대화를 해야 공유할 수 있다능!");
    shareHint.textContent = bStripEmoji("저장하는 중...");
    await persistCurrentConversation();
    const cur = conversationsCache.find((c) => c.id === currentConvId);
    if (!cur) return fail("대화를 저장하지 못했다능... 잠시 후 다시 해달라능");
    shareVisibility.value = cur.visibility || "private";
    shareVisibility.disabled = false;
    shareHint.textContent = bStripEmoji("공개 범위를 고르면 바로 적용된다능. 공유하는 건 글(대화 내용)뿐이고 사진은 안 나간다능.");
    showShareLink(cur.shareId, cur.visibility);
  }
  function showShareLink(shareId, visibility) {
    if (visibility && visibility !== "private" && shareId) {
      shareLink.value = shareLinkFor(shareId);
      shareLinkRow.hidden = false;
    } else {
      shareLinkRow.hidden = true;
    }
  }
  shareBtn?.addEventListener("click", openShare);
  document.getElementById("closeShare")?.addEventListener("click", () => closeModal(shareBackdrop));
  shareBackdrop?.addEventListener("click", (e) => { if (e.target === shareBackdrop) closeModal(shareBackdrop); });
  shareVisibility?.addEventListener("change", async () => {
    shareVisibility.disabled = true;
    try {
      const idToken = await getFreshIdToken();
      const res = await fetch(`api/conversations/${encodeURIComponent(currentConvId)}/share`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-user-token": idToken || "" },
        body: JSON.stringify({ visibility: shareVisibility.value }),
      });
      const data = await res.json();
      if (!res.ok) { shareHint.textContent = bStripEmoji(data.error || "공개 범위를 바꾸지 못했다능"); return; }
      const cur = conversationsCache.find((c) => c.id === currentConvId);
      if (cur) { cur.visibility = data.visibility; cur.shareId = data.shareId; }
      shareHint.textContent = bStripEmoji(data.visibility === "private" ? "이제 나만 볼 수 있다능 🔒" : "공유 링크가 만들어졌다능! 아래 링크를 복사해서 보내면 된다능 🔗");
      showShareLink(data.shareId, data.visibility);
    } catch {
      shareHint.textContent = bStripEmoji("공개 범위를 바꾸지 못했다능...");
    } finally {
      shareVisibility.disabled = false;
    }
  });
  document.getElementById("shareCopy")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(shareLink.value); shareHint.textContent = "링크를 복사했다능!"; }
    catch { shareLink.select(); shareHint.textContent = "복사가 안 돼서 선택만 해뒀다능, 직접 복사해달라능"; }
  });

  // 공유 링크(?share=...)로 들어오면 읽기 전용으로 보여준다 (로그인 필요 없음).
  async function loadSharedView() {
    composer.hidden = true;
    const banner = document.createElement("div");
    banner.className = "shared-banner";
    banner.innerHTML = '<span class="shared-title">' + bIcon("link") + ' 공유된 대화 (읽기 전용)</span><a href="' + location.pathname + '">나도 빨드와 대화하기</a>';
    chatWrap.parentNode.insertBefore(banner, chatWrap);
    chatEl.innerHTML = "";
    try {
      const res = await fetch(`api/share/${encodeURIComponent(shareParam)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { addMessage("assistant", data.error || "공유된 대화를 못 찾았다능...", { extraClass: "error" }); return; }
      document.title = `${data.title || "공유된 대화"} · 빨드 AI`;
      for (const m of data.messages || []) addMessage(m.role === "assistant" ? "assistant" : "user", m.content, { skipStore: true });
    } catch {
      addMessage("assistant", "공유된 대화를 불러오지 못했다능...", { extraClass: "error" });
    }
  }
  if (shareParam) loadSharedView();
})();
