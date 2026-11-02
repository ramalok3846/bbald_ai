// Firebase Auth 연동 (구글 로그인 + 이메일/비밀번호). firebase-config.js에
// 실제 프로젝트 키가 채워지기 전까지는 아무 것도 하지 않고 "게스트 모드"로 남는다.
// app.js는 window.addEventListener('bbald-auth-changed', ...) 로 로그인 상태를 받는다.

function dispatchAuthChanged(user) {
  window.dispatchEvent(new CustomEvent("bbald-auth-changed", { detail: { user } }));
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

  window.bbaldAuth = {
    enabled: true,
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

init().catch((err) => {
  console.error("빨드 인증 초기화 실패", err);
  dispatchAuthChanged(null);
});
