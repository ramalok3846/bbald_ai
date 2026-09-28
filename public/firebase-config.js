// PAL 홈페이지(pal-inte-db)와 같은 Firebase 프로젝트를 그대로 쓴다.
// (Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱 > SDK 설정 및 구성)
window.BBALD_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCEmf0KIiaF11nmS2CfBNA5yxZA9nrtmUU",
  authDomain: "pal-inte-db.firebaseapp.com",
  databaseURL: "https://pal-inte-db-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pal-inte-db",
  storageBucket: "pal-inte-db.firebasestorage.app",
  messagingSenderId: "411569829650",
  appId: "1:411569829650:web:b4d05e68c2fd1c4dd0e5cb",
  measurementId: "G-5HL52VSK1G",
};

window.BBALD_FIREBASE_ENABLED = window.BBALD_FIREBASE_CONFIG.apiKey !== "REPLACE_ME";
