// 관리자 인증 + 관리 기능. ramalok.kr 메인 관리자 시스템과 동일한 방식을 쓴다:
// Firebase Realtime Database의 admins/{uid} === true 인 계정만 관리자다
// (pal-inte-db 프로젝트, PaLhomepage의 js/admin-home.js / database.rules.all.json과 동일 규칙).
// 그래서 메인 사이트에서 이미 관리자로 등록된 계정이면 빨드 AI 관리자 페이지도
// 별도 등록 없이 바로 쓸 수 있다.

const FIREBASE_WEB_API_KEY = "AIzaSyCEmf0KIiaF11nmS2CfBNA5yxZA9nrtmUU";
const RTDB_BASE = "https://pal-inte-db-default-rtdb.asia-southeast1.firebasedatabase.app";

// idToken -> { localId(uid), email, ... } | null
async function verifyIdToken(idToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.users?.[0] || null;
}

// idToken이 진짜 관리자(admins/{uid} === true) 소유인지 확인한다.
// uid는 토큰 자체에서 얻은 값만 쓴다 (클라이언트가 다른 uid를 주장해도 무시됨 — 그래서
// "내가 아닌 다른 사람의 uid를 보내서 관리자 행세" 같은 공격이 안 통한다).
export async function requireAdmin(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const user = await verifyIdToken(idToken);
  if (!user?.localId) return null;

  const res = await fetch(`${RTDB_BASE}/admins/${user.localId}.json?auth=${encodeURIComponent(idToken)}`);
  if (!res.ok) return null;
  const isAdmin = (await res.json()) === true;
  return isAdmin ? { uid: user.localId, email: user.email || null } : null;
}
