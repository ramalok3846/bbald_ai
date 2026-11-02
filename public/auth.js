// PAL 통합 로그인(SSO) 연동. index.html이 먼저 /js/firebase-init.js, /js/pal-sso.js를
// 불러와두면(같은 주소 ramalok.kr 아래라서 가능), 그 공용 로그인을 그대로 쓴다 —
// 메인 사이트에 이미 로그인돼 있으면 빨드 AI를 열었을 때 자동으로 로그인 상태가 된다.
// 저 두 파일이 없으면(다른 도메인에서 미리보기 등) 빨드 AI 자체 Firebase 로그인으로
// 조용히 대체한다. app.js는 window.addEventListener('bbald-auth-changed', ...) 로
// 로그인 상태를 받는다 — 어느 경로든 결과는 항상 Firebase User 객체다.

function dispatchAuthChanged(user) {
  window.dispatchEvent(new CustomEvent("bbald-auth-changed", { detail: { user } }));
}

// ---------------- 경로 1: PAL 통합 로그인(SSO) — 같은 주소에 있을 때 ----------------
async function initShared() {
  if (!window.palAuth) {
    // firebase-init.js는 type="module"이라 비동기로 끝난다. 아직 안 끝났으면 기다린다.
    await new Promise((resolve) => window.addEventListener("pal-firebase-ready", resolve, { once: true }));
  }
  const P = window.palAuth;
  const { updatePassword, updateEmail } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

  P.onAuthStateChanged((user) => dispatchAuthChanged(user));

  window.bbaldAuth = {
    enabled: true,
    shared: true, // PAL 통합 로그인을 쓰고 있다는 표시 (디버깅/안내용)
    // "로그인" 버튼을 누르면 PAL 통합 로그인 화면(/login)을 팝업으로 띄운다.
    // 이메일/비밀번호, Google, 회원가입, 비밀번호 재설정까지 거기서 전부 처리되고,
    // 끝나면 이 창에 postMessage로 결과를 돌려준다(팝업이 막히면 자동으로 이동 방식).
    signInGoogle: () => window.PalSSO.login({ popup: true }),
    signUpEmail: () => window.PalSSO.login({ popup: true }),
    signInEmail: () => window.PalSSO.login({ popup: true }),
    signOutUser: () => window.PalSSO.logout(), // 통합 로그아웃: 다른 PAL 서비스에서도 로그아웃된다
    changePassword: (newPassword) => updatePassword(P.auth.currentUser, newPassword),
    changeEmail: (newEmail) => updateEmail(P.auth.currentUser, newEmail),
    getIdToken: (force) => window.PalSSO.getIdToken(force),
  };

  // 이미 로그인돼 있으면(메인 사이트 등에서) 곧바로 알려준다.
  const current = P.currentUser();
  if (current) dispatchAuthChanged(current);
}

// ---------------- 경로 2: 빨드 AI 자체 로그인 (통합 로그인 스크립트가 없을 때만) ----------------
async function initStandalone() {
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
    updatePassword,
    updateEmail,
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

  const app = initializeApp(window.BBALD_FIREBASE_CONFIG);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  // 구글 로그인시 받는 OAuth 액세스 토큰에 제미나이(Generative Language API) 권한
  // 스코프를 같이 요청해둔다 — 계정에 그 API가 허용돼 있으면, 빨드 AI가 사용자가
  // 직접 API 키를 입력 안 해도 그 구글 계정 자체의 권한/크레딧으로 호출할 수 있다
  // ("가능하다면"이라 최선 시도: PAL 통합 로그인 경로에선 이 스코프를 못 받아서
  // 이 자체 로그인 경로에서만 동작한다).
  provider.addScope("https://www.googleapis.com/auth/generative-language");

  onAuthStateChanged(auth, (user) => dispatchAuthChanged(user));

  window.bbaldAuth = {
    enabled: true,
    shared: false,
    signInGoogle: async () => {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      return { user: result.user, googleAccessToken: credential?.accessToken || null };
    },
    signUpEmail: (email, password) => createUserWithEmailAndPassword(auth, email, password),
    signInEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signOutUser: () => signOut(auth),
    changePassword: (newPassword) => updatePassword(auth.currentUser, newPassword),
    changeEmail: (newEmail) => updateEmail(auth.currentUser, newEmail),
  };
}

async function init() {
  // index.html이 /js/pal-sso.js(classic script)를 이 모듈 스크립트보다 앞에 둬서,
  // 이 시점이면 그 스크립트가 로드됐는지(=같은 주소 ramalok.kr 아래인지) 이미 알 수 있다.
  if (window.PalSSO) {
    await initShared();
  } else {
    await initStandalone();
  }
}

init().catch((err) => {
  console.error("빨드 인증 초기화 실패", err);
  dispatchAuthChanged(null);
});
