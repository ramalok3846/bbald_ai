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
  document.querySelectorAll(".theme-sw").forEach((group) => {
    group.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (btn) setTheme(btn.dataset.mode);
    });
  });
  applyTheme((() => { try { return localStorage.getItem(THEME_KEY) || "system"; } catch { return "system"; } })());

  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const gateMsg = document.getElementById("gateMsg");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const whoami = document.getElementById("whoami");

  const lookupIdentity = document.getElementById("lookupIdentity");
  const lookupBtn = document.getElementById("lookupBtn");
  const adjustRow = document.getElementById("adjustRow");
  const lookupResult = document.getElementById("lookupResult");
  const deltaInput = document.getElementById("deltaInput");
  const adjustBtn = document.getElementById("adjustBtn");
  const setToInput = document.getElementById("setToInput");
  const setToBtn = document.getElementById("setToBtn");

  const listBody = document.getElementById("listBody");
  const refreshListBtn = document.getElementById("refreshListBtn");

  const limitsRow = document.getElementById("limitsRow");
  const saveLimitsBtn = document.getElementById("saveLimitsBtn");
  const startingCreditsInput = document.getElementById("startingCreditsInput");
  const saveStartingBtn = document.getElementById("saveStartingBtn");
  const maintenanceToggle = document.getElementById("maintenanceToggle");
  const maintenanceMessage = document.getElementById("maintenanceMessage");
  const saveMaintenanceBtn = document.getElementById("saveMaintenanceBtn");

  const couponCodeInput = document.getElementById("couponCodeInput");
  const couponAmountInput = document.getElementById("couponAmountInput");
  const couponDaysInput = document.getElementById("couponDaysInput");
  const couponMaxUsesInput = document.getElementById("couponMaxUsesInput");
  const createCouponBtn = document.getElementById("createCouponBtn");
  const couponListBody = document.getElementById("couponListBody");

  const toastEl = document.getElementById("toast");
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  let idToken = null;
  let currentIdentity = null;

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (idToken) headers["x-admin-token"] = idToken;
    const res = await fetch(`api/admin/${path}`, { ...opts, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
    return data;
  }

  function showGate(message) {
    gate.hidden = false;
    app.hidden = true;
    gateMsg.textContent = message || "";
  }
  function showApp() {
    gate.hidden = true;
    app.hidden = false;
  }

  async function tryEnterAdmin(user) {
    if (!user) {
      showGate("");
      return;
    }
    try {
      idToken = await user.getIdToken();
      const me = await api("me");
      whoami.textContent = me.email || me.uid;
      showApp();
      loadConfig();
      loadList();
      loadCoupons();
    } catch (err) {
      idToken = null;
      showGate(`관리자 권한이 없는 계정이다능. (${err.message})`);
    }
  }

  window.addEventListener("bbald-auth-changed", (e) => {
    tryEnterAdmin(e.detail.user);
  });

  loginBtn.addEventListener("click", () => window.bbaldAuth?.signInGoogle());
  logoutBtn.addEventListener("click", () => window.bbaldAuth?.signOutUser());

  // ---------------- 사용량 조회/조정 ----------------
  lookupBtn.addEventListener("click", async () => {
    const identity = lookupIdentity.value.trim();
    if (!identity) return;
    try {
      const data = await api(`lookup?identity=${encodeURIComponent(identity)}`);
      currentIdentity = data.identity;
      lookupResult.textContent = `${data.identity} : ${data.credits}`;
      adjustRow.hidden = false;
    } catch (err) {
      toast(err.message);
    }
  });

  adjustBtn.addEventListener("click", async () => {
    const delta = Number(deltaInput.value);
    if (!currentIdentity || !Number.isFinite(delta)) return;
    try {
      const data = await api("adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identity: currentIdentity, delta }),
      });
      lookupResult.textContent = `${currentIdentity} : ${data.balance}`;
      toast("적용했다능!");
      loadList();
    } catch (err) {
      toast(err.message);
    }
  });

  setToBtn.addEventListener("click", async () => {
    const setTo = Number(setToInput.value);
    if (!currentIdentity || !Number.isFinite(setTo)) return;
    try {
      const data = await api("adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identity: currentIdentity, setTo }),
      });
      lookupResult.textContent = `${currentIdentity} : ${data.balance}`;
      toast("적용했다능!");
      loadList();
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------------- 목록 ----------------
  async function loadList() {
    try {
      const data = await api("list");
      listBody.innerHTML = "";
      for (const item of data.items) {
        const tr = document.createElement("tr");
        const edit = document.createElement("button");
        edit.className = "btn secondary";
        edit.textContent = "조회칸에 넣기";
        edit.style.padding = "4px 10px";
        edit.style.fontSize = "0.75rem";
        edit.addEventListener("click", () => {
          lookupIdentity.value = item.identity;
          lookupBtn.click();
        });
        tr.innerHTML = `<td>${item.identity}</td><td>${item.balance}</td>`;
        const td = document.createElement("td");
        td.appendChild(edit);
        tr.appendChild(td);
        listBody.appendChild(tr);
      }
    } catch (err) {
      toast(err.message);
    }
  }
  refreshListBtn.addEventListener("click", loadList);

  // ---------------- 설정 (하루 제한 / 기본 사용량 / 점검 모드) ----------------
  async function loadConfig() {
    try {
      const cfg = await api("config");
      limitsRow.innerHTML = "";
      for (const [provider, limit] of Object.entries(cfg.dailyLimits)) {
        const wrap = document.createElement("label");
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.gap = "4px";
        wrap.innerHTML = `<span style="font-size:0.78rem;color:var(--text-muted);">${provider}</span>`;
        const input = document.createElement("input");
        input.type = "number";
        input.value = limit;
        input.dataset.provider = provider;
        input.style.maxWidth = "110px";
        wrap.appendChild(input);
        limitsRow.appendChild(wrap);
      }
      startingCreditsInput.value = cfg.startingCredits;
      maintenanceToggle.checked = !!cfg.maintenance.enabled;
      maintenanceMessage.value = cfg.maintenance.message;
    } catch (err) {
      toast(err.message);
    }
  }

  saveLimitsBtn.addEventListener("click", async () => {
    const dailyLimits = {};
    limitsRow.querySelectorAll("input").forEach((el) => {
      dailyLimits[el.dataset.provider] = Number(el.value) || 0;
    });
    try {
      await api("config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dailyLimits }),
      });
      toast("하루 사용량 제한 저장했다능!");
    } catch (err) {
      toast(err.message);
    }
  });

  saveStartingBtn.addEventListener("click", async () => {
    try {
      await api("config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startingCredits: Number(startingCreditsInput.value) || 100 }),
      });
      toast("기본 사용량 저장했다능!");
    } catch (err) {
      toast(err.message);
    }
  });

  saveMaintenanceBtn.addEventListener("click", async () => {
    try {
      await api("config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          maintenance: { enabled: maintenanceToggle.checked, message: maintenanceMessage.value },
        }),
      });
      toast("점검 모드 설정 저장했다능!");
    } catch (err) {
      toast(err.message);
    }
  });

  // ---------------- 쿠폰 ----------------
  async function loadCoupons() {
    try {
      const data = await api("coupon/list");
      couponListBody.innerHTML = "";
      for (const c of data.items) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${c.code}</td><td>${c.amount || "-"}</td><td>${c.planDays ? c.planDays + "일" : "-"}</td><td>${c.usedCount}/${c.maxUses}</td>`;
        const del = document.createElement("button");
        del.className = "btn secondary";
        del.textContent = "삭제";
        del.style.padding = "4px 10px";
        del.style.fontSize = "0.75rem";
        del.addEventListener("click", async () => {
          try {
            await api("coupon/delete", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code: c.code }),
            });
            toast("삭제했다능!");
            loadCoupons();
          } catch (err) {
            toast(err.message);
          }
        });
        const td = document.createElement("td");
        td.appendChild(del);
        tr.appendChild(td);
        couponListBody.appendChild(tr);
      }
    } catch (err) {
      toast(err.message);
    }
  }
  createCouponBtn.addEventListener("click", async () => {
    const code = couponCodeInput.value.trim();
    if (!code) return toast("쿠폰 코드를 입력해달라능");
    try {
      await api("coupon/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          amount: Number(couponAmountInput.value) || 0,
          planDays: Number(couponDaysInput.value) || 0,
          maxUses: Number(couponMaxUsesInput.value) || 1,
        }),
      });
      toast("쿠폰 발급했다능!");
      couponCodeInput.value = "";
      couponAmountInput.value = "";
      couponDaysInput.value = "";
      couponMaxUsesInput.value = "1";
      loadCoupons();
    } catch (err) {
      toast(err.message);
    }
  });
})();
