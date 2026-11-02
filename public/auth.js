// Firebase Auth 연동 (구글 로그인 + 이메일/비밀번호). firebase-config.js에
// 실제 프로젝트 키가 채워지기 전까지는 아무 것도 하지 않고 "게스트 모드"로 남는다.
// app.js는 window.addEventListener('bbald-auth-changed', ...) 로 로그인 상태를 받는다.

function dispatchAuthChanged(user) {
  window.dispatchEvent(new CustomEvent("bbald-auth-changed", { detail: { user } }));
}

// ---------- PAL 통합 로그인(SSO) ----------
// 홈페이지(www.ramalok.kr)의 /login 이 모든 PAL 서비스의 로그인 창구다. 빨드 AI가
// www.ramalok.kr/bbald_ai 로 열리면 홈페이지와 같은 주소라서 로그인 정보를 브라우저가
// 그대로 공유하므로, 통합 로그인 팝업에서 로그인하면 여기서도 바로 로그인 상태가 된다.
const PAL_HUB = "https://www.ramalok.kr";
const onPalSite = /(^|\.)ramalok\.kr$/.test(location.hostname);

function openPalLoginPopup() {
  return new Promise((resolve) => {
    const q = new URLSearchParams({ mode: "popup", origin: location.origin, redirect: location.href });
    if (location.origin !== PAL_HUB) q.set("handoff", "1");
    const w = window.open(`${PAL_HUB}/login?${q}`, "pal-sso", "width=480,height=720");
    if (!w) return resolve({ blocked: true });
    let done = false;
    const finish = (v) => { if (done) return; done = true; window.removeEventListener("message", onMsg); clearInterval(iv); resolve(v); };
    const onMsg = (e) => {
      if (e.origin !== PAL_HUB || !e.data || e.data.type !== "pal-sso") return;
      finish(e.data.ok ? { user: e.data.user, customToken: e.data.customToken || null } : { error: e.data.error });
    };
    window.addEventListener("message", onMsg);
    const iv = setInterval(() => { if (w.closed) finish({ closed: true }); }, 600);
  });
}

// 자동 로그아웃: 홈페이지와 같은 기준(1시간 무활동, 같은 저장 키)이라 한 곳에서 활동하면 모두 유지된다.
function startIdleGuard(auth, signOut, onAuthStateChanged) {
  const IDLE_MS = 60 * 60 * 1000;
  const KEY = "pal_last_active";
  const read = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch { return 0; } };
  let lastWrite = 0;
  const touch = (force) => {
    const now = Date.now();
    if (!force && now - lastWrite < 10000) return;
    lastWrite = now;
    try { localStorage.setItem(KEY, String(now)); } catch {}
  };
  let timer = null;
  const EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"];
  const onAct = () => touch(false);
  const check = async () => {
    const last = read();
    if (auth.currentUser && last && Date.now() - last > IDLE_MS) {
      stop();
      try { await signOut(auth); } catch {}
      try { localStorage.removeItem(KEY); } catch {}
      window.dispatchEvent(new CustomEvent("pal-idle-logout"));
      showNotice("1시간 동안 활동이 없어서 안전을 위해 로그아웃됐다능. 다시 로그인해 달라능!");
    }
  };
  const onVis = () => { if (document.visibilityState === "visible") check(); };
  function start() {
    if (timer) return;
    EVENTS.forEach((ev) => window.addEventListener(ev, onAct, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", onVis);
    timer = setInterval(check, 20000);
  }
  function stop() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    EVENTS.forEach((ev) => window.removeEventListener(ev, onAct, { capture: true }));
    document.removeEventListener("visibilitychange", onVis);
  }
  onAuthStateChanged(auth, async (u) => {
    if (!u) { stop(); return; }
    const last = read();
    if (last && Date.now() - last > IDLE_MS) { await check(); return; }
    touch(true);
    start();
  });
}

function showNotice(text) {
  const el = document.createElement("div");
  el.textContent = text;
  el.setAttribute("role", "status");
  el.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:92vw;padding:12px 18px;border-radius:12px;background:#251f3f;color:#fff;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.3)";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

async function init() {
  if (!window.BBALD_FIREBASE_ENABLED) {
    // 설정 전: 게스트 모드. 다른 스크립트가 로그인 버튼을 눌러도 안내만 뜨도록
    // window.bbaldAuth를 "미구성" 상태로 노출한다.
    window.bbaldAuth = {
      enabled: false,
      signInGoogle: async () => {
        alert("아직 Firebase 설정 전이다능! firebase-config.js에 프로젝트 키를 채워주면 구글 로그인이 켜진다능.");
      },
      signUpEmail: async () => {
        alert("아직 Firebase 설정 전이다능!");
      },
      signInEmail: async () => {
        alert("아직 Firebase 설정 전이다능!");
      },
      signOutUser: async () => {},
      changePassword: async () => {
        alert("아직 Firebase 설정 전이다능!");
      },
      changeEmail: async () => {
        alert("아직 Firebase 설정 전이다능!");
      },
    };
    dispatchAuthChanged(null);
    return;
  }

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    signInWithCustomToken,
    updatePassword,
    updateEmail,
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

  const app = initializeApp(window.BBALD_FIREBASE_CONFIG);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  // 구글 로그인시 받는 OAuth 액세스 토큰에 제미나이(Generative Language API) 권한
  // 스코프를 같이 요청해둔다 — 계정에 그 API가 허용돼 있으면, 빨드 AI가 사용자가
  // 직접 API 키를 입력 안 해도 그 구글 계정 자체의 권한/크레딧으로 호출할 수 있다
  // ("가능하다면"이라 최선 시도: 계정에 해당 API/프로젝트가 없으면 그냥 안 쓰인다).
  provider.addScope("https://www.googleapis.com/auth/generative-language");

  onAuthStateChanged(auth, (user) => dispatchAuthChanged(user));
  startIdleGuard(auth, signOut, onAuthStateChanged);

  window.bbaldAuth = {
    enabled: true,
    // 로그인 버튼: PAL 통합 로그인(/login) 팝업을 먼저 쓴다. (이메일·구글 모두 거기서 고른다)
    // 통합 로그인을 못 쓰는 주소(예: *.workers.dev 직접 접속)나 팝업이 막힌 경우에만 예전처럼 여기서 구글 팝업을 띄운다.
    // 통합 로그인으로 들어오면 구글 액세스 토큰(제미나이 권한)은 없으므로 googleAccessToken은 null이다 → 직접 키 입력 방식 사용.
    signInGoogle: async () => {
      if (onPalSite) {
        const r = await openPalLoginPopup();
        if (r.customToken && !auth.currentUser) await signInWithCustomToken(auth, r.customToken);
        if (r.user || r.closed) return { user: auth.currentUser, googleAccessToken: null };
        if (r.error) throw new Error(r.error);
        // r.blocked → 아래 예전 방식으로
      }
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      return { user: result.user, googleAccessToken: credential?.accessToken || null };
    },
    signUpEmail: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signInEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signOutUser: () => { try { localStorage.removeItem("pal_last_active"); } catch {} return signOut(auth); },
    changePassword: (newPassword) => updatePassword(auth.currentUser, newPassword),
    changeEmail: (newEmail) => updateEmail(auth.currentUser, newEmail),
  };
}

init().catch((err) => {
  console.error("빨드 인증 초기화 실패", err);
  dispatchAuthChanged(null);
});
