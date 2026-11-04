(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const PROVIDER_LABELS = { builtin: "빨드 기본", cloudflare: "Cloudflare", anthropic: "Claude", openai: "ChatGPT", gemini: "Gemini" };
  const TIER_LABELS = { lite: "⚡ 라이트", basic: "🦕 기본", deep: "🧠 딥씽킹", story: "📖 스토리" };

  // ---------------- 테마 ----------------
  const THEME_KEY = "bbald_theme";
  function applyTheme(mode) {
    const de = document.documentElement;
    if (mode === "light" || mode === "dark") de.setAttribute("data-theme", mode);
    else de.removeAttribute("data-theme");
    $$(".theme-sw button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  }
  let storedMode = "system";
  try { storedMode = localStorage.getItem(THEME_KEY) || "system"; } catch {}
  applyTheme(storedMode);
  $$(".theme-sw").forEach((g) =>
    g.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      try { localStorage.setItem(THEME_KEY, b.dataset.mode); } catch {}
      applyTheme(b.dataset.mode);
    })
  );

  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }

  // ---------------- 화면 전환 (항상 셋 중 하나만 보이고, 절대 빈 화면이 되지 않는다) ----------------
  const views = { loading: $("#viewLoading"), gate: $("#viewGate"), denied: $("#viewDenied"), app: $("#viewApp") };
  function show(name) {
    for (const [k, el] of Object.entries(views)) el.hidden = k !== name;
  }
  function showGate(message) {
    show("gate");
    const m = $("#gateMsg");
    m.hidden = !message;
    m.textContent = message || "";
  }
  $("#hostChip").textContent = location.host;

  let currentUser = null;
  let runId = 0;

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    let token = null;
    try { token = currentUser ? await currentUser.getIdToken() : null; } catch {}
    if (token) headers["x-admin-token"] = token;
    const res = await fetch(`api/admin/${path}`, { ...opts, headers });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error((data && data.error) || `요청 실패 (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }
  const post = (path, body) => api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  function setStatus(s, text) {
    const chip = $("#statusChip");
    chip.dataset.s = s;
    chip.textContent = text;
  }

  // ---------------- 로그인 상태 처리 ----------------
  async function onAuth(user) {
    const my = ++runId;
    authSeen = true;
    currentUser = user;
    if (!user) return showGate();
    show("loading");
    try {
      const me = await api("me");
      if (my !== runId) return;
      const name = user.displayName || (me.email || user.email || "").split("@")[0] || "관리자";
      $("#userName").textContent = name;
      $("#userMail").textContent = me.email || user.email || me.uid;
      $("#userIni").textContent = (name[0] || "A").toUpperCase();
      const img = $("#userImg");
      if (user.photoURL) { img.src = user.photoURL; img.hidden = false; $("#userIni").hidden = true; }
      else { img.hidden = true; $("#userIni").hidden = false; }
      show("app");
      selectTab(location.hash.slice(1) || "usage");
      setStatus("ok", "연결됨");
      await Promise.all([loadConfig(), loadList()]);
    } catch (err) {
      if (my !== runId) return;
      if (err.status === 403) {
        $("#deniedWho").textContent = user.email || user.displayName || "이";
        show("denied");
      } else {
        showGate(`관리자 정보를 불러오지 못했어요. (${err.message})`);
      }
    }
  }

  let authSeen = false;
  window.addEventListener("bbald-auth-changed", (e) => onAuth(e.detail.user));
  // auth.js가 먼저 실행돼 첫 이벤트를 이미 보냈다면 기억해둔 상태로 바로 시작한다.
  if (window.__bbaldAuthState?.ready) onAuth(window.__bbaldAuthState.user);
  // 로그인 스크립트가 아예 응답이 없어도 빈 화면 대신 로그인 화면을 보여준다.
  setTimeout(() => { if (!authSeen) showGate("로그인 확인이 늦어지고 있어요. 아래 버튼으로 로그인해 주세요."); }, 4500);

  $("#loginBtn").addEventListener("click", async () => {
    const btn = $("#loginBtn");
    if (!window.bbaldAuth) return showGate("로그인 모듈을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.");
    btn.disabled = true;
    try { await window.bbaldAuth.signInGoogle(); }
    catch (e) { showGate(`로그인하지 못했어요. (${e.message || e})`); }
    btn.disabled = false;
  });
  const logout = async () => { try { await window.bbaldAuth?.signOutUser(); } catch {} showGate(); };
  $("#logoutBtn").addEventListener("click", logout);
  $("#logoutTopBtn").addEventListener("click", logout);
  $("#deniedLogoutBtn").addEventListener("click", logout);
  $("#retryBtn").addEventListener("click", () => onAuth(currentUser));

  const userBtn = $("#userBtn"), userPop = $("#userPop");
  userBtn.addEventListener("click", (e) => { e.stopPropagation(); userPop.hidden = !userPop.hidden; userBtn.setAttribute("aria-expanded", String(!userPop.hidden)); });
  document.addEventListener("click", () => { userPop.hidden = true; });

  // ---------------- 탭 ----------------
  function selectTab(name) {
    const tabs = $$("#navTabs button").map((b) => b.dataset.tab);
    if (!tabs.includes(name)) name = "usage";
    $$("#navTabs button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === name)));
    $$(".pane").forEach((p) => { p.hidden = p.dataset.pane !== name; });
    try { history.replaceState(null, "", `#${name}`); } catch {}
  }
  $("#navTabs").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) selectTab(b.dataset.tab); });

  // ---------------- 설정 폼 ----------------
  let cfg = null;
  const numIn = (id) => Number($(id).value);
  function field(label, id, value, attrs = "") {
    return `<label class="fld"><span>${label}</span><input type="number" id="${id}" value="${value}" ${attrs}></label>`;
  }

  function fillForms(c) {
    cfg = c;
    $("#costsGrid").innerHTML = Object.keys(PROVIDER_LABELS).map((p) => field(PROVIDER_LABELS[p], `cost_${p}`, c.costs[p], 'min="0" step="1"')).join("");
    $("#tierGrid").innerHTML = Object.keys(TIER_LABELS).map((t) => field(TIER_LABELS[t] + " (배)", `tier_${t}`, c.tierMult[t], 'min="0.1" step="0.1"')).join("");
    $("#imageCost").value = c.imageCost;
    $("#startingCredits").value = c.startingCredits;
    $("#startingCreditsGuest").value = c.startingCreditsGuest;
    $("#paidDailyMultiplier").value = c.paidDailyMultiplier;
    $("#memberOnlyChecks").innerHTML = Object.keys(TIER_LABELS)
      .map((t) => `<label class="chk"><input type="checkbox" id="mo_${t}" ${c.memberOnlyTiers[t] ? "checked" : ""}><span>${TIER_LABELS[t]}</span></label>`).join("");
    $("#guestImages").checked = c.guestImages;
    $("#limitsMember").innerHTML = Object.keys(PROVIDER_LABELS).map((p) => field(PROVIDER_LABELS[p], `lm_${p}`, c.dailyLimits[p], 'min="0"')).join("");
    $("#limitsGuest").innerHTML = Object.keys(PROVIDER_LABELS).map((p) => field(PROVIDER_LABELS[p], `lg_${p}`, c.dailyLimitsGuest[p], 'min="0"')).join("");
    $("#thinkMin").value = c.think.minSec;
    $("#thinkMax").value = c.think.maxSec;
    $("#eatChance").value = c.think.eatChancePct;
    $("#refillInterval").value = c.refillIntervalMin;
    $("#refillMax").value = c.refillMaxPer24h;
    $("#filterEnabled").checked = c.filter.enabled;
    $("#filterAction").value = c.filter.action;
    $("#filterExtra").value = c.filter.extraWords.join("\n");
    $("#filterAllow").value = c.filter.allowWords.join("\n");
    $("#shareEnabled").checked = c.sharing.enabled;
    $("#sharePublic").checked = c.sharing.publicAllowed;
    $("#maintOn").checked = c.maintenance.enabled;
    $("#maintMsg").value = c.maintenance.message;
    renderCostPreview();
  }

  function renderCostPreview() {
    const costs = {}, mult = {};
    for (const p of Object.keys(PROVIDER_LABELS)) costs[p] = numIn(`#cost_${p}`) || 0;
    for (const t of Object.keys(TIER_LABELS)) mult[t] = numIn(`#tier_${t}`) || 0;
    const head = `<thead><tr><th>AI</th>${Object.values(TIER_LABELS).map((l) => `<th>${l}</th>`).join("")}</tr></thead>`;
    const body = Object.keys(PROVIDER_LABELS)
      .map((p) => `<tr><td>${PROVIDER_LABELS[p]}</td>${Object.keys(TIER_LABELS).map((t) => `<td>${Math.max(1, Math.round(costs[p] * mult[t]))}</td>`).join("")}</tr>`).join("");
    $("#costPreview").innerHTML = `${head}<tbody>${body}</tbody>`;
  }
  $("#costsGrid").addEventListener("input", renderCostPreview);
  $("#tierGrid").addEventListener("input", renderCostPreview);

  async function loadConfig() {
    try {
      fillForms(await api("config"));
    } catch (err) {
      setStatus("err", "설정 불러오기 실패");
      toast(err.message);
    }
  }

  async function save(btn, buildPatch, okMsg) {
    btn.disabled = true;
    setStatus("busy", "저장 중");
    try {
      fillForms(await post("config", buildPatch()));
      setStatus("ok", "저장됨");
      toast(okMsg || "저장했어요");
    } catch (err) {
      setStatus("err", "저장 실패");
      toast(err.message);
    }
    btn.disabled = false;
  }
  const lines = (id) => $(id).value.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);

  $("#saveCostsBtn").addEventListener("click", (e) => save(e.currentTarget, () => ({
    costs: Object.fromEntries(Object.keys(PROVIDER_LABELS).map((p) => [p, numIn(`#cost_${p}`)])),
    tierMult: Object.fromEntries(Object.keys(TIER_LABELS).map((t) => [t, numIn(`#tier_${t}`)])),
    imageCost: numIn("#imageCost"),
  }), "크레딧 비용을 저장했어요"));

  $("#saveMemberBtn").addEventListener("click", (e) => save(e.currentTarget, () => ({
    startingCredits: numIn("#startingCredits"),
    startingCreditsGuest: numIn("#startingCreditsGuest"),
    paidDailyMultiplier: numIn("#paidDailyMultiplier"),
    memberOnlyTiers: Object.fromEntries(Object.keys(TIER_LABELS).map((t) => [t, $(`#mo_${t}`).checked])),
    guestImages: $("#guestImages").checked,
    dailyLimits: Object.fromEntries(Object.keys(PROVIDER_LABELS).map((p) => [p, numIn(`#lm_${p}`)])),
    dailyLimitsGuest: Object.fromEntries(Object.keys(PROVIDER_LABELS).map((p) => [p, numIn(`#lg_${p}`)])),
  }), "멤버십 설정을 저장했어요"));

  $("#saveChatBtn").addEventListener("click", (e) => save(e.currentTarget, () => ({
    think: { minSec: numIn("#thinkMin"), maxSec: numIn("#thinkMax"), eatChancePct: numIn("#eatChance") },
    refillIntervalMin: numIn("#refillInterval"),
    refillMaxPer24h: numIn("#refillMax"),
  }), "대기 시간과 재충전 설정을 저장했어요"));

  $("#saveFilterBtn").addEventListener("click", (e) => save(e.currentTarget, () => ({
    filter: { enabled: $("#filterEnabled").checked, action: $("#filterAction").value, extraWords: lines("#filterExtra"), allowWords: lines("#filterAllow") },
  }), "비속어 필터를 저장했어요"));

  $("#saveShareBtn").addEventListener("click", (e) => save(e.currentTarget, () => ({
    sharing: { enabled: $("#shareEnabled").checked, publicAllowed: $("#sharePublic").checked },
    maintenance: { enabled: $("#maintOn").checked, message: $("#maintMsg").value },
  }), "공유·점검 설정을 저장했어요"));

  // ---------------- 사용량 조회 / 조정 / 목록 ----------------
  let currentIdentity = null;
  $("#lookupBtn").addEventListener("click", async () => {
    const identity = $("#lookupIdentity").value.trim();
    if (!identity) return;
    try {
      const data = await api(`lookup?identity=${encodeURIComponent(identity)}`);
      currentIdentity = data.identity;
      $("#lookupResult").textContent = `${data.identity} : ${data.credits}`;
      $("#adjustRow").hidden = false;
    } catch (err) { toast(err.message); }
  });
  async function adjust(body) {
    if (!currentIdentity) return;
    try {
      const data = await post("adjust", { identity: currentIdentity, ...body });
      $("#lookupResult").textContent = `${currentIdentity} : ${data.balance}`;
      toast("적용했어요");
      loadList();
    } catch (err) { toast(err.message); }
  }
  $("#adjustBtn").addEventListener("click", () => { const d = Number($("#deltaInput").value); if (Number.isFinite(d) && $("#deltaInput").value !== "") adjust({ delta: d }); });
  $("#setToBtn").addEventListener("click", () => { const v = Number($("#setToInput").value); if (Number.isFinite(v) && $("#setToInput").value !== "") adjust({ setTo: v }); });

  async function loadList() {
    try {
      const data = await api("list");
      const body = $("#listBody");
      body.innerHTML = "";
      for (const item of data.items) {
        const tr = document.createElement("tr");
        const td1 = document.createElement("td"); td1.textContent = item.identity;
        const td2 = document.createElement("td"); td2.textContent = item.balance;
        const td3 = document.createElement("td");
        const b = document.createElement("button");
        b.className = "btn btn-ghost btn-sm"; b.textContent = "조회칸에 넣기";
        b.addEventListener("click", () => { $("#lookupIdentity").value = item.identity; $("#lookupBtn").click(); });
        td3.appendChild(b);
        tr.append(td1, td2, td3);
        body.appendChild(tr);
      }
    } catch (err) { toast(err.message); }
  }
  $("#refreshListBtn").addEventListener("click", loadList);
})();
