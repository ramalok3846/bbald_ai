// 공용 Firebase ID 토큰 검증. pal-inte-db 프로젝트(ramalok.kr 메인과 동일)의
// Identity Toolkit REST API로 토큰을 검증해서 진짜 uid/email을 얻는다.
// 클라이언트가 "내가 uid xxx다"라고 주장하는 값은 여기서 절대 신뢰하지 않고,
// 토큰 자체에서 나온 값만 쓴다.

const FIREBASE_WEB_API_KEY = "AIzaSyCEmf0KIiaF11nmS2CfBNA5yxZA9nrtmUU";
export const RTDB_BASE = "https://pal-inte-db-default-rtdb.asia-southeast1.firebasedatabase.app";

// idToken -> { localId(uid), email, ... } | null
export async function verifyIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.users?.[0];
    return user?.localId ? { uid: user.localId, email: user.email || null } : null;
  } catch {
    return null;
  }
}
