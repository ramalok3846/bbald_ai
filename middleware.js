// Vercel 배포용 접근 가드: BBALD_PROXY_SECRET / BBALD_ALLOWED_HOSTS가 설정돼 있을 때만 동작한다.
// 허용된 경로(ramalok.kr 프록시 등)가 아니면 정식 주소(BBALD_CANONICAL_URL)로 안내하고 이동시킨다.
import { checkAccess, blockedResponse } from "./src/guard.js";

export const config = { matcher: ["/((?!_vercel).*)"] };

export default function middleware(request) {
  const env = {
    BBALD_PROXY_SECRET: process.env.BBALD_PROXY_SECRET,
    BBALD_ALLOWED_HOSTS: process.env.BBALD_ALLOWED_HOSTS,
    BBALD_CANONICAL_URL: process.env.BBALD_CANONICAL_URL,
  };
  const access = checkAccess(request, env);
  if (access.allowed) return; // 통과 (그대로 정적 파일/API로)
  return blockedResponse(request, access.cfg);
}
