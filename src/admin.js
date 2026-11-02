// 관리자 인증. ramalok.kr 메인 관리자 시스템과 동일한 방식을 쓴다:
// Firebase Realtime Database의 admins/{uid} === true 인 계정만 관리자다
// (pal-inte-db 프로젝트, PaLhomepage의 js/admin-home.js / database.rules.all.json과 동일 규칙).
// 그래서 메인 사이트에서 이미 관리자로 등록된 계정이면 빨드 AI 관리자 페이지도
// 별도 등록 없이 바로 쓸 수 있다.

import { verifyIdToken, RTDB_BASE } from "./firebase-verify.js";

// idToken이 진짜 관리자(admins/{uid} === true) 소유인지 확인한다.
export async function requireAdmin(idToken) {
  const user = await verifyIdToken(idToken);
  if (!user) return null;

  const res = await fetch(`${RTDB_BASE}/admins/${user.uid}.json?auth=${encodeURIComponent(idToken)}`);
  if (!res.ok) return null;
  const isAdmin = (await res.json()) === true;
  return isAdmin ? user : null;
}
