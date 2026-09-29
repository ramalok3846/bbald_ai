(() => {
  const chatEl = document.getElementById("chat");
  const composer = document.getElementById("composer");
  const input = document.getElementById("input");
  const sendBtn = document.getElementById("sendBtn");
  const providerSelect = document.getElementById("providerSelect");
  const modelSelect = document.getElementById("modelSelect");
  const creditValueEl = document.getElementById("creditValue");
  const creditDisplay = document.getElementById("creditDisplay");
  const moodBadge = document.getElementById("moodBadge");
  const kstClock = document.getElementById("kstClock");
  const smartState = document.getElementById("smartState");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsBackdrop = document.getElementById("settingsBackdrop");
  const closeSettings = document.getElementById("closeSettings");
  const newChatBtn = document.getElementById("newChatBtn");

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

  const LS_KEY = "bbald_ai_state_v1";

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { credits: 100, keys: {}, history: [], profilePic: "" };
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
  }

  const state = loadState();
  if (typeof state.credits !== "number") state.credits = 100;
  state.keys = state.keys || {};
  state.history = state.history || [];
  state.profilePic = state.profilePic || "";

  let pendingAttachment = null; // { dataUrl, mimeType }
  let currentUser = null;

  // 크레딧은 서버(KV)가 유일한 출처다. localStorage 값은 새로고침 사이 깜빡임을
  // 줄이기 위한 "마지막으로 본 값" 캐시일 뿐이고, 아래에서 곧바로 서버 값으로
  // 덮어쓴다 — 설정에서 숫자를 직접 입력해서 바꾸는 기능은 없앴다.
  function renderCredits(value) {
    state.credits = value;
    creditValueEl.textContent = value;
    if (creditDisplay) creditDisplay.textContent = value;
    saveState();
  }

  async function syncCreditsFromServer() {
    try {
      const uid = currentUser?.uid || "";
      const res = await fetch(`api/credits${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data.credits === "number") renderCredits(data.credits);
      }
    } catch {}
  }

  renderCredits(state.credits);
  profilePicUrlInput.value = state.profilePic;
  document.getElementById("key-anthropic").value = state.keys.anthropic || "";
  document.getElementById("key-openai").value = state.keys.openai || "";
  document.getElementById("key-gemini").value = state.keys.gemini || "";

  // ---------------- 계정 / 프로필 ----------------
  function initialsAvatarHtml(label) {
    return (label || "USER").slice(0, 4).toUpperCase();
  }

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
  }

  // 가입 보너스는 서버(KV)가 계정당 1회만 지급을 허용한다 (claimSignupBonus).
  // 클라이언트는 그냥 요청만 보내고, 결과(granted/amount)를 서버가 알려준다.
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
        renderCredits(data.balance);
        addMessage("assistant", `가입한다능?! 축하한다능! 첫 가입 보너스로 크레딧 ${data.amount}개 선물이다능! 🎉🦕`);
      } else if (typeof data.balance === "number") {
        renderCredits(data.balance);
      }
    } catch {}
  }

  window.addEventListener("bbald-auth-changed", (e) => {
    currentUser = e.detail.user;
    if (currentUser) {
      // 구글 로그인 등으로 새로 들어온 사용자에게 첫 가입 보너스 지급 (계정별 1회, 서버가 판단)
      grantSignupBonusIfNeeded(currentUser);
    } else {
      syncCreditsFromServer();
    }
    renderAccount();
  });

  authBtn.addEventListener("click", async () => {
    if (!window.bbaldAuth) return;
    if (currentUser) {
      await window.bbaldAuth.signOutUser();
    } else {
      await window.bbaldAuth.signInGoogle();
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
  // 1순위: 서버(/api/time, suncalc로 실제 서울 일몰 계산). 2순위: 서버 연결이
  // 안 되면 브라우저에 로드된 SunCalc(인터넷 없이도 동작하는 순수 계산)로 로컬
  // 계산. 3순위: SunCalc 스크립트마저 못 불러왔으면 평균 일몰 시각(18:30)으로 근사.
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
          // sunset은 로컬 브라우저 타임존 기준 Date 객체이므로, KST 값으로 다시 변환한다.
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit",
          }).formatToParts(times.sunset);
          const get = (t) => parts.find((p) => p.type === t)?.value;
          return Number(get("hour")) * 60 + Number(get("minute"));
        }
      }
    } catch {}
    return DEFAULT_SUNSET_MIN; // SunCalc를 못 쓰면 평균 일몰로 근사
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
    // 서버 연결 실패(오프라인 등): 로컬 시간 + 로컬 SunCalc(또는 근사 일몰)로 대체
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

  function autoResize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }
  input.addEventListener("input", autoResize);

  // ---------------- 첨부 이미지 (업로드 / URL / 붙여넣기) ----------------
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

  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setAttachment(dataUrl, file.type);
    fileInput.value = "";
  });
  attachUrlBtn.addEventListener("click", async () => {
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
    state.history.push({ role: "user", content: text || "(이미지 첨부)" });
    input.value = "";
    clearAttachment();
    autoResize();
    sendBtn.disabled = true;

    let res;
    try {
      res = await fetch("api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: state.history.slice(-10),
          provider,
          model,
          apiKey,
          uid: currentUser?.uid || null,
          image: attachment ? { dataUrl: attachment.dataUrl, mimeType: attachment.mimeType } : null,
        }),
      });
    } catch (err) {
      // fetch() 자체가 실패 = 진짜로 네트워크에 못 닿은 경우 (오프라인, DNS 실패 등)
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      addMessage(
        "assistant",
        offline
          ? "빨드 인터넷이 끊겼다능... 다시 시도해줘!"
          : `빨드한테 요청이 안 갔다능... (${err.message || "네트워크 오류"})`,
        { extraClass: "error" }
      );
      sendBtn.disabled = false;
      saveState();
      return;
    }

    try {
      const data = await res.json();

      if (!res.ok) {
        if (typeof data.credits === "number") renderCredits(data.credits);
        addMessage("assistant", data.error || data.reply || "빨드가 넘어졌다능...", {
          extraClass: data.dailyLimitReached ? "snack" : "error",
        });
      } else {
        addMessage("assistant", data.reply);
        state.history.push({ role: "assistant", content: data.reply });
        renderCredits(data.credits);
        if (data.snack) {
          addMessage("assistant", data.snack, { extraClass: "snack" });
        }
        if (typeof data.smartLevel === "number") {
          const local = getLocalKstGuess();
          updateMoodUI(local.hour, local.minute, data.smartLevel, data.sunset);
        }
      }
    } catch (err) {
      // fetch는 성공했는데 응답이 JSON이 아닌 경우 (프록시/서버가 에러 페이지를 돌려준 경우 등)
      addMessage(
        "assistant",
        `빨드 응답을 이해 못했다능... (서버가 이상한 응답을 줬다능, status ${res.status})`,
        { extraClass: "error" }
      );
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

  // ---------------- 설정 모달 ----------------
  settingsBtn.addEventListener("click", () => settingsBackdrop.classList.add("open"));
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

  // ---------------- 모바일 사이드바 토글 (화면 비율에 따라 자동으로 숨겨지는
  // 사이드바를 햄버거 버튼으로 열고 닫는다. PC 폭에서는 CSS가 menuToggle
  // 자체를 숨기므로 이 코드는 모바일 폭에서만 실제로 쓰인다.) ----------------
  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("open");
  }
  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("open");
    sidebarBackdrop.classList.add("open");
  });
  sidebarBackdrop.addEventListener("click", closeSidebar);
  sidebar.querySelectorAll("button, .conv-item").forEach((el) => {
    el.addEventListener("click", closeSidebar);
  });

  // ---------------- 모델 설명 ----------------
  const MODEL_DESCRIPTIONS = {
    "haiku-4.5": "⚡ 빨드 라이트 — 제일 빠르고 가벼운 두뇌. 짧고 간단한 대화에 딱이다능!",
    "sonnet-5": "🦕 빨드 기본 — 속도와 똑똑함의 균형. 평소엔 이걸로 쓰면 딱 좋다능!",
    "opus-5.5": "🧠 빨드 딥씽킹 — 더 깊게 생각하는 두뇌. 복잡한 질문에 강하지만 크레딧을 더 쓴다능.",
    "fable-5.1": "📖 빨드 스토리 — 이야기하듯 표현력이 풍부한 두뇌. 창작/이야기에 어울린다능!",
  };
  function updateModelDesc() {
    modelDescEl.textContent = MODEL_DESCRIPTIONS[modelSelect.value] || "";
  }
  modelSelect.addEventListener("change", updateModelDesc);
  updateModelDesc();

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

  // ---------------- 무작위 빨드 스티커 이벤트 (크레딧 10~30 랜덤 지급, 서버가 결정) ----------------
  const stickerBadge = stickerBtn.querySelector(".sticker-badge");
  let stickerTimer = null;
  function scheduleSticker() {
    const delay = 90000 + Math.random() * 150000; // 1.5~4분 랜덤 간격
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
    }, 4000); // 4초만 보이고 사라짐

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
          renderCredits(data.balance);
          addMessage("assistant", `짠! 빨드 스티커 찾았다능! 보너스 크레딧 +${data.amount} 선물이다능! 🎁🦕`, { extraClass: "snack" });
        }
      } catch {}
      scheduleSticker();
    };
  }
  scheduleSticker();
})();
