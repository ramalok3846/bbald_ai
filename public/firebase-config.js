// Firebase 프로젝트를 만들면 아래 값을 실제 설정으로 바꿔주세요.
// (Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱 > SDK 설정 및 구성 에서 그대로 복사)
// 값을 채우기 전까지는 "게스트 모드"로 동작해서 로그인 없이도 앱은 정상 작동한다능.
window.BBALD_FIREBASE_CONFIG = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

window.BBALD_FIREBASE_ENABLED = window.BBALD_FIREBASE_CONFIG.apiKey !== "REPLACE_ME";
