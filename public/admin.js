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
      selectTab(location.hash.slice(1) || "dash");
      setStatus("ok", "연결됨");
      await Promise.all([loadConfig(), loadList(), loadStats(), loadBans(), loadShares(), loadAudit()]);
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
    if (!tabs.includes(name)) name = "dash";
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
    fillExtra(c);
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

  // ---------------- 새 기능: 대시보드 / AI·학습 / 공지·보너스 / 운영 ----------------
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const split = (s) => String(s || "").split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
  const fmtTime = (t) => (t ? new Date(t).toLocaleString("ko-KR", { hour12: false }) : "—");
  let replies = [], notices = [];

  function fillExtra(c) {
    $("#statsEnabled").checked = c.statsEnabled !== false;
    $("#providersChecks").innerHTML = Object.keys(PROVIDER_LABELS)
      .map((p) => `<label class="chk"><input type="checkbox" id="pe_${p}" ${c.providersEnabled?.[p] !== false ? "checked" : ""}><span>${PROVIDER_LABELS[p]}</span></label>`).join("");
    $("#limMsg").value = c.limits.maxMessageChars;
    $("#limImg").value = c.limits.maxImages;
    $("#limHist").value = c.limits.historyTurns;
    $("#limTok").value = c.limits.maxTokens;
    $("#promptExtra").value = c.prompt.extra;
    $("#sunsetMode").checked = c.prompt.sunsetMode;
    replies = (c.customReplies || []).map((r) => ({ keywords: [...r.keywords], replies: [...r.replies] }));
    renderReplies();
    $("#bannerOn").checked = c.banner.enabled;
    $("#bannerLevel").value = c.banner.level;
    $("#bannerLink").value = c.banner.link;
    $("#bannerText").value = c.banner.text;
    $("#textGreeting").value = c.texts.greeting;
    $("#textPlaceholder").value = c.texts.placeholder;
    $("#bonusSignup").value = c.bonus.signupPct;
    const s = c.bonus.sticker;
    $("#stEnabled").checked = s.enabled;
    $("#stMin").value = s.minPct; $("#stMax").value = s.maxPct; $("#stCool").value = s.cooldownSec;
    $("#stIntMin").value = s.minIntervalSec; $("#stIntMax").value = s.maxIntervalSec;
    notices = (c.notices || []).map((n) => ({ ...n }));
    renderNotices();
  }

  function renderReplies() {
    $("#repliesList").innerHTML = replies.map((r, i) => `
      <div class="sub" data-i="${i}">
        <label class="fld"><span>키워드</span><textarea class="rk" rows="2">${esc(r.keywords.join(", "))}</textarea></label>
        <label class="fld"><span>답변 (여러 개면 줄바꿈)</span><textarea class="rr" rows="3">${esc(r.replies.join("\n"))}</textarea></label>
        <button type="button" class="btn btn-ghost btn-sm rdel">삭제</button>
      </div>`).join("") || '<p class="note">아직 없어요.</p>';
  }
  function syncReplies() {
    replies = $$("#repliesList .sub").map((el) => ({ keywords: split(el.querySelector(".rk").value), replies: split2(el.querySelector(".rr").value) })).filter((r) => r.keywords.length && r.replies.length);
  }
  const split2 = (s) => String(s || "").split("\n").map((w) => w.trim()).filter(Boolean); // 답변은 쉼표를 포함할 수 있으니 줄바꿈만
  $("#addReplyBtn").addEventListener("click", () => { syncReplies(); replies.push({ keywords: [""], replies: [""] }); renderReplies(); });
  $("#repliesList").addEventListener("click", (e) => {
    const b = e.target.closest(".rdel"); if (!b) return;
    const i = Number(b.closest(".sub").dataset.i);
    $$("#repliesList .sub").forEach((el, k) => { if (k === i) el.remove(); });
    syncReplies(); renderReplies();
  });

  function renderNotices() {
    $("#noticesList").innerHTML = notices.map((n, i) => `
      <div class="sub" data-i="${i}">
        <div class="grid">
          <label class="fld"><span>이모지</span><input class="ne" maxlength="4" value="${esc(n.emoji)}"></label>
          <label class="fld"><span>제목</span><input class="nt" maxlength="80" value="${esc(n.title)}"></label>
        </div>
        <label class="fld"><span>내용</span><textarea class="nb" rows="3" maxlength="800">${esc(n.body)}</textarea></label>
        <label class="chk"><input type="checkbox" class="nv" ${n.visible ? "checked" : ""}><span>보이기</span></label>
        <label class="chk"><input type="checkbox" class="np" ${n.pinned ? "checked" : ""}><span>맨 위 고정</span></label>
        <button type="button" class="btn btn-ghost btn-sm ndel">삭제</button>
      </div>`).join("") || '<p class="note">공지가 없어요.</p>';
  }
  function syncNotices() {
    notices = $$("#noticesList .sub").map((el, i) => ({
      id: notices[i]?.id || `n${Date.now().toString(36)}${i}`,
      emoji: el.querySelector(".ne").value, title: el.querySelector(".nt").value, body: el.querySelector(".nb").value,
      visible: el.querySelector(".nv").checked, pinned: el.querySelector(".np").checked,
    }));
  }
  $("#addNoticeBtn").addEventListener("click", () => { syncNotices(); notices.unshift({ id: `n${Date.now().toString(36)}`, emoji: "📢", title: "", body: "", visible: true, pinned: false }); renderNotices(); });
  $("#noticesList").addEventListener("click", (e) => {
    const b = e.target.closest(".ndel"); if (!b) return;
    const i = Number(b.closest(".sub").dataset.i);
    syncNotices(); notices.splice(i, 1); renderNotices();
  });

  $("#saveStatsBtn").addEventListener("click", (e) => save(e.currentTarget, () => ({ statsEnabled: $("#statsEnabled").checked }), "저장했어요"));
  $("#saveAiBtn").addEventListener("click", (e) => save(e.currentTarget, () => {
    syncReplies();
    return {
      providersEnabled: Object.fromEntries(Object.keys(PROVIDER_LABELS).map((p) => [p, $(`#pe_${p}`).checked])),
      limits: { maxMessageChars: numIn("#limMsg"), maxImages: numIn("#limImg"), historyTurns: numIn("#limHist"), maxTokens: numIn("#limTok") },
      prompt: { extra: $("#promptExtra").value, sunsetMode: $("#sunsetMode").checked },
      customReplies: replies,
    };
  }, "AI·학습 설정을 저장했어요"));
  $("#saveContentBtn").addEventListener("click", (e) => save(e.currentTarget, () => {
    syncNotices();
    return {
      banner: { enabled: $("#bannerOn").checked, level: $("#bannerLevel").value, link: $("#bannerLink").value.trim(), text: $("#bannerText").value },
      texts: { greeting: $("#textGreeting").value, placeholder: $("#textPlaceholder").value },
      bonus: { signupPct: numIn("#bonusSignup"), sticker: { enabled: $("#stEnabled").checked, minPct: numIn("#stMin"), maxPct: numIn("#stMax"), cooldownSec: numIn("#stCool"), minIntervalSec: numIn("#stIntMin"), maxIntervalSec: numIn("#stIntMax") } },
      notices,
    };
  }, "공지·보너스를 저장했어요"));

  // 통계
  const STAT_ROWS = [["chats", "채팅"], ["uniq", "방문자"], ["uniqMember", "└ 회원"], ["uniqGuest", "└ 게스트"], ["spent", "쓴 크레딧"], ["images", "이미지"], ["errors", "오류"], ["outOfCredits", "크레딧 부족"], ["dailyLimitHit", "하루 제한"], ["filtered", "비속어 차단"], ["signups", "가입 보너스"], ["stickers", "스티커"]];
  async function loadStats() {
    try {
      const { days } = await api("stats?days=7");
      const keys = new Set(); days.forEach((d) => Object.keys(d).forEach((k) => keys.add(k)));
      const prov = [...keys].filter((k) => k.startsWith("p:")).map((k) => [k, "AI·" + (PROVIDER_LABELS[k.slice(2)] || k.slice(2))]);
      const tiers = [...keys].filter((k) => k.startsWith("t:")).map((k) => [k, "단계·" + (TIER_LABELS[k.slice(2)] || k.slice(2))]);
      const errs = [...keys].filter((k) => k.startsWith("errk:")).map((k) => [k, "오류·" + k.slice(5)]);
      const rows = [...STAT_ROWS, ...prov, ...tiers, ...errs];
      $("#statsTable").innerHTML = `<thead><tr><th>항목</th>${days.map((d) => `<th>${d.date.slice(4, 6)}/${d.date.slice(6)}</th>`).join("")}<th>합계</th></tr></thead><tbody>${rows.map(([k, l]) => `<tr><td>${esc(l)}</td>${days.map((d) => `<td>${d[k] || 0}</td>`).join("")}<td><b>${days.reduce((a, d) => a + (d[k] || 0), 0)}</b></td></tr>`).join("")}</tbody>`;
    } catch (err) { toast(err.message); }
  }
  $("#refreshStatsBtn").addEventListener("click", loadStats);

  // 점검
  $("#healthBtn").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; $("#healthOut").textContent = "점검 중...";
    try {
      const r = await api("health");
      $("#healthOut").innerHTML = r.checks.map((c) => `<div class="hrow ${c.ok ? "ok" : "bad"}">${c.ok ? "✅" : "⚠️"} <b>${esc(c.name)}</b> — ${esc(c.detail)}</div>`).join("");
    } catch (err) { $("#healthOut").textContent = err.message; }
    btn.disabled = false;
  });
  $("#peekBtn").addEventListener("click", async () => {
    try {
      const r = await api("debug/access");
      $("#peekOut").textContent = `host=${r.host} · x-forwarded-host=${r.xForwardedHost || "없음"} · 프록시 비밀헤더=${r.proxyHeaderPresent ? "있음" : "없음"} · 가드=${r.guardEnabled ? "켜짐(" + r.guardVia + ")" : "꺼짐"} · 환경=${r.platform}`;
    } catch (err) { toast(err.message); }
  });

  // 사용자 관리
  let opsId = null;
  $("#opsLookupBtn").addEventListener("click", async () => {
    const id = $("#opsIdentity").value.trim(); if (!id) return;
    try {
      const d = await api(`lookup?identity=${encodeURIComponent(id)}`);
      opsId = d.identity;
      const used = Object.entries(d.today || {}).map(([k, v]) => `${PROVIDER_LABELS[k] || k} ${typeof v === "object" ? (v.used + "/" + v.limit) : v}`).join(" · ");
      $("#opsInfo").innerHTML = `<b>${esc(d.identity)}</b> (${d.isGuest ? "게스트" : "회원"}) — 크레딧 ${d.credits}/${d.cap}${d.refill?.nextAt ? ` · 다음 충전 ${fmtTime(d.refill.nextAt)}` : ""}<br>오늘 사용: ${esc(used) || "없음"}<br>${d.ban ? `🚫 차단 중 (${esc(d.ban.reason || "사유 없음")}, ${d.ban.until ? fmtTime(d.ban.until) + "까지" : "영구"})` : "차단 안 됨"}`;
      $("#opsActions").hidden = false; $("#banRow").hidden = false;
    } catch (err) { toast(err.message); }
  });
  async function reset(what) { if (!opsId) return; try { const r = await post("identity/reset", { identity: opsId, what }); toast(r.detail); $("#opsLookupBtn").click(); loadAudit(); } catch (err) { toast(err.message); } }
  $("#rstUsageBtn").addEventListener("click", () => reset("usage"));
  $("#rstRefillBtn").addEventListener("click", () => reset("refill"));
  $("#banBtn").addEventListener("click", async () => {
    if (!opsId || !confirm(`${opsId} 을(를) 차단할까요?`)) return;
    try { await post("bans/add", { identity: opsId, reason: $("#banReason").value, days: Number($("#banDays").value) || 0 }); toast("차단했어요"); $("#opsLookupBtn").click(); loadBans(); loadAudit(); } catch (err) { toast(err.message); }
  });

  async function loadBans() {
    try {
      const { items } = await api("bans");
      $("#bansBody").innerHTML = items.map((b) => `<tr><td>${esc(b.identity)}</td><td>${esc(b.reason)}</td><td>${b.until ? fmtTime(b.until) : "영구"}</td><td><button class="btn btn-ghost btn-sm unban" data-id="${esc(b.identity)}">해제</button></td></tr>`).join("") || '<tr><td colspan="4">차단된 사용자가 없어요.</td></tr>';
    } catch (err) { toast(err.message); }
  }
  $("#bansBody").addEventListener("click", async (e) => {
    const b = e.target.closest(".unban"); if (!b) return;
    try { await post("bans/remove", { identity: b.dataset.id }); toast("해제했어요"); loadBans(); loadAudit(); } catch (err) { toast(err.message); }
  });
  $("#refreshBansBtn").addEventListener("click", loadBans);

  async function loadShares() {
    try {
      const { items } = await api("shares");
      $("#sharesBody").innerHTML = items.map((s) => `<tr><td>${esc(s.title)}</td><td>${s.visibility === "public" ? "전체 공개" : "링크"}</td><td>${esc(s.preview)}</td><td><button class="btn btn-ghost btn-sm unshare" data-id="${esc(s.shareId)}">공유 해제</button></td></tr>`).join("") || '<tr><td colspan="4">공유된 대화가 없어요.</td></tr>';
    } catch (err) { toast(err.message); }
  }
  $("#sharesBody").addEventListener("click", async (e) => {
    const b = e.target.closest(".unshare"); if (!b || !confirm("이 대화 공유를 해제할까요?")) return;
    try { await post("shares/revoke", { shareId: b.dataset.id }); toast("공유를 해제했어요"); loadShares(); loadAudit(); } catch (err) { toast(err.message); }
  });
  $("#refreshSharesBtn").addEventListener("click", loadShares);

  $("#ftBtn").addEventListener("click", async () => {
    try {
      const r = await post("filter-test", { text: $("#ftText").value });
      $("#ftOut").innerHTML = `${r.enabled ? "" : "(필터가 꺼져 있어요) "}${r.blocked ? `🚫 걸림: <b>${esc(r.blocked)}</b>` : "✅ 통과"}<br>가림 결과: ${esc(r.masked)}`;
    } catch (err) { toast(err.message); }
  });

  $("#backupBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `bbald-config-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  });
  $("#restoreFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try {
      const patch = JSON.parse(await f.text());
      if (!confirm("현재 설정을 이 파일 내용으로 덮어쓸까요?")) return;
      fillForms(await post("config", patch)); toast("복원했어요"); loadAudit();
    } catch (err) { toast("복원하지 못했어요: " + err.message); }
  });
  $("#resetCfgBtn").addEventListener("click", async () => {
    if (!confirm("모든 설정을 기본값으로 되돌릴까요? 되돌릴 수 없어요.")) return;
    try { fillForms(await post("config/reset", {})); toast("기본값으로 초기화했어요"); loadAudit(); } catch (err) { toast(err.message); }
  });

  async function loadAudit() {
    try {
      const { items } = await api("audit");
      $("#auditBody").innerHTML = items.slice(0, 100).map((a) => `<tr><td>${fmtTime(a.at)}</td><td>${esc(a.by)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td></tr>`).join("") || '<tr><td colspan="4">기록이 없어요.</td></tr>';
    } catch (err) { toast(err.message); }
  }
  $("#refreshAuditBtn").addEventListener("click", loadAudit);
})();
