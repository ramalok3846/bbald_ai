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

  const LS_KEY = "bbald_ai_state_v1";
  const SIGNUP_BONUS = 100; // 첫 가입 시 추가로 얹어주는 크레딧
  const STICKER_BONUS = 20;

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

  creditValueEl.textContent = state.credits;
  creditInput.value = state.credits;
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

  function grantSignupBonusIfNeeded(user) {
    if (!user) return;
    const flagKey = `bbald_signup_bonus_${user.uid}`;
    try {
      if (!localStorage.getItem(flagKey)) {
        localStorage.setItem(flagKey, "1");
        state.credits += SIGNUP_BONUS;
        creditValueEl.textContent = state.credits;
        creditInput.value = state.credits;
        saveState();
        addMessage("assistant", `가입한다능?! 축하한다능! 첫 가입 보너스로 크레딧 ${SIGNUP_BONUS}개 선물이다능! 🎉🦕`);
      }
    } catch {}
  }

  window.addEventListener("bbald-auth-changed", (e) => {
    currentUser = e.detail.user;
    if (currentUser) {
      // 구글 로그인 등으로 새로 들어온 사용자에게 첫 가입 보너스 지급 (계정별 1회)
      grantSignupBonusIfNeeded(currentUser);
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
      const res = await fetch("api/time");
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

    try {
      const res = await fetch("api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: state.history.slice(-10),
          provider,
          model,
          apiKey,
          credits: state.credits,
          image: attachment ? { dataUrl: attachment.dataUrl, mimeType: attachment.mimeType } : null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        addMessage("assistant", data.error || "빨드가 넘어졌다능...", { extraClass: "error" });
      } else {
        addMessage("assistant", data.reply);
        state.history.push({ role: "assistant", content: data.reply });
        state.credits = data.credits;
        creditValueEl.textContent = state.credits;
        creditInput.value = state.credits;
        if (data.snack) {
          addMessage("assistant", data.snack, { extraClass: "snack" });
        }
        if (typeof data.isSmart === "boolean") {
          moodBadge.textContent = data.isSmart ? "🌅 노을 모드! 조금 똑똑해짐" : "🌙 아직 멍청한 시간";
          smartState.textContent = data.isSmart ? "노을 모드 (조금 똑똑함)" : "멍청 모드";
        }
      }
    } catch (err) {
      addMessage("assistant", "빨드 인터넷이 끊겼다능... 다시 시도해줘!", { extraClass: "error" });
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

  // ---------------- 무작위 빨드 스티커 이벤트 (+20 크레딧) ----------------
  let stickerTimer = null;
  function scheduleSticker() {
    const delay = 25000 + Math.random() * 35000; // 25~60초 랜덤 간격
    stickerTimer = setTimeout(showSticker, delay);
  }
  function showSticker() {
    const bounds = chatWrap.getBoundingClientRect();
    const maxX = Math.max(0, bounds.width - 64);
    const maxY = Math.max(0, bounds.height - 64);
    stickerBtn.style.left = `${Math.random() * maxX}px`;
    stickerBtn.style.top = `${Math.random() * maxY}px`;
    stickerBtn.hidden = false;

    const hideTimer = setTimeout(() => {
      stickerBtn.hidden = true;
      scheduleSticker();
    }, 8000);

    stickerBtn.onclick = () => {
      clearTimeout(hideTimer);
      stickerBtn.hidden = true;
      state.credits += STICKER_BONUS;
      creditValueEl.textContent = state.credits;
      creditInput.value = state.credits;
      saveState();
      addMessage("assistant", `짠! 빠드 스티커 찾았다능! 보너스 크레딧 +${STICKER_BONUS} 선물이다능! 🎁🦕`, { extraClass: "snack" });
      scheduleSticker();
    };
  }
  scheduleSticker();
})();
