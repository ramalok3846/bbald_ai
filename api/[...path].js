// Vercel 배포용 진입점: /api/* 요청을 Cloudflare Worker와 똑같은 코드(src/worker.js)로 처리한다.
// 정적 파일(public/)은 Vercel이 직접 서빙하고, 이 함수는 API만 맡는다. 설정 방법은 DEPLOY.md 참고.
import worker from "../src/worker.js";
import { buildEnvFromProcess } from "../src/platform.js";

export const config = { runtime: "edge" };

export default async function handler(request, context) {
  return worker.fetch(request, buildEnvFromProcess(process.env), { waitUntil: (p) => context?.waitUntil?.(p) });
}
