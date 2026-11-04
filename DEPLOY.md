# 배포 가이드 (Cloudflare / Vercel 둘 다 지원)

빨드 AI는 같은 코드(`src/worker.js`)로 **Cloudflare Workers**와 **Vercel** 어느 쪽에서든 돌아가요.
최종 목표: 사용자는 **`https://www.ramalok.kr/bbald_ai`** 로만 들어오고, 원본 주소(`*.workers.dev`, `*.vercel.app`)는 막거나 정식 주소로 보내요.

## 1. 환경변수 · 규칙 표

| 이름 | 어디에 | 필수 | 설명 |
|---|---|---|---|
| `RATE_LIMIT_KV` (바인딩) | Cloudflare | ✅ | wrangler.toml의 KV. 크레딧·대화·설정·통계 저장소 |
| `AI` (바인딩) | Cloudflare | 선택 | Workers AI (Cloudflare 두뇌) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (또는 `KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Vercel | ✅ | Vercel의 KV 대신 쓰는 저장소 (Vercel Marketplace → Upstash Redis 연결하면 자동 생성) |
| `CF_ACCOUNT_ID`, `CF_API_TOKEN` | Vercel | 선택 | Cloudflare 두뇌를 Vercel에서 쓸 때 (토큰 권한: Workers AI) |
| `WORKERS_AI_MODEL` | 둘 다 | 선택 | Cloudflare 모델 고정 (없으면 후보를 순서대로 시도) |
| `BBALD_PROXY_SECRET` | 둘 다 | 권장 | 메인 사이트 프록시만 아는 비밀값. 요청 헤더 `x-bbald-proxy`가 같아야 통과 |
| `BBALD_ALLOWED_HOSTS` | 둘 다 | 선택 | 허용 호스트(쉼표 구분), 예: `www.ramalok.kr,ramalok.kr` |
| `BBALD_CANONICAL_URL` | 둘 다 | 선택 | 차단 시 안내할 정식 주소 (기본 `https://www.ramalok.kr/bbald_ai`) |
| API 키 (Claude/OpenAI/Gemini) | 사용자 입력 | - | 사용자가 설정 화면에 직접 넣음 (서버에 저장 안 함) |
| 메인 사이트 `FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY` | PaLhomepage(Vercel) | ✅ | 통합 요금제 `/api/billing`용. 관리자 → 시스템 점검에서 확인 가능 |
| RTDB 규칙 | Firebase | ✅ | `plans` 읽기 허용, `admins/{uid}` 관리자 지정 |

**가드 규칙**: `BBALD_PROXY_SECRET`과 `BBALD_ALLOWED_HOSTS`가 둘 다 없으면 가드는 꺼져 있어요(현재 상태). 하나라도 있으면 켜져서, 비밀 헤더가 맞거나 허용 호스트로 온 요청만 통과해요. 나머지는 HTML이면 "이 주소로는 들어올 수 없어요" 안내 후 4초 뒤 정식 주소로 이동, API면 403 JSON.
`x-forwarded-host`만 보는 방식은 위조가 가능한 "약한" 방식이라, 진짜로 막으려면 **비밀 헤더(`BBALD_PROXY_SECRET`)** 를 쓰세요.

## 2. Cloudflare 배포
```
npm i
npx wrangler deploy
```
KV id는 wrangler.toml의 것을 쓰거나 `npx wrangler kv namespace create RATE_LIMIT_KV`로 새로 만들어요.

## 3. Vercel 배포
1. Vercel에서 이 저장소를 새 프로젝트로 import (Framework: Other, 빌드 없음 — `vercel.json`에 설정됨).
2. Storage → Upstash Redis(KV) 연결 → 위 환경변수 자동 주입.
3. (선택) `CF_ACCOUNT_ID`, `CF_API_TOKEN` 추가.
4. 구성: `api/[...path].js`(엣지 함수가 Worker 코드를 그대로 실행) + `middleware.js`(가드) + `public/`(정적 파일).

## 4. 원본 주소 지우고 `ramalok.kr/bbald_ai`만 남기기

> ⚠️ 순서가 중요해요. 지금 PaLhomepage가 `bbald-ai.ramalok.workers.dev`로 리라이트하고 있어서, workers.dev를 먼저 끄면 사이트가 멈춰요.

### 방법 A (추천): Cloudflare 커스텀 도메인으로 교체
1. ramalok.kr DNS가 Cloudflare에 있어야 해요(없으면 방법 C).
2. Workers & Pages → bbald-ai → Settings → Domains & Routes → **Add → Custom Domain** → `bbald-origin.ramalok.kr`
3. PaLhomepage `vercel.json`의 리라이트 목적지를 `https://bbald-origin.ramalok.kr/$1` 로 변경하고 배포 → `ramalok.kr/bbald_ai` 정상 확인.
4. 이제 `wrangler.toml`의 `workers_dev = false`, `preview_urls = false` 주석을 풀고 `npx wrangler deploy` → workers.dev 주소 삭제됨.
5. 원본 `bbald-origin.ramalok.kr`도 직접 못 들어오게: 환경변수 `BBALD_PROXY_SECRET`을 정하고, PaLhomepage의 `/bbald_ai` 요청에 `x-bbald-proxy: <비밀값>`(+ `x-bbald-client-ip`: 방문자 IP) 헤더를 붙이는 미들웨어/프록시를 둬요. (Vercel rewrite만으로는 임의 헤더 추가가 `headers` 설정으로 가능: `source: /bbald_ai/(.*)`에 `x-bbald-proxy`를 넣는 건 응답 헤더라 안 돼요 → 미들웨어에서 `NextResponse.rewrite(url, { request: { headers } })` 방식 필요.) 이 변경은 메인 사이트 운영 라우팅을 건드리니 먼저 상의 후 진행해요.
6. 그동안 `BBALD_ALLOWED_HOSTS=www.ramalok.kr,ramalok.kr` 만 걸어 두면 약한 방식이지만 직접 접속은 안내 페이지로 보내요 (Vercel rewrite가 `x-forwarded-host`를 원래 호스트로 넘겨주는지는 관리자 → 운영·시스템 → "프록시 헤더 확인"으로 확인).

### 방법 B: Cloudflare 라우트
`www.ramalok.kr/bbald_ai/*` 를 Worker에 직접 연결(오렌지 구름 프록시 필요). Worker가 `/bbald_ai` 접두사를 스스로 떼므로 별도 리라이트 불필요. 이때 PaLhomepage의 리라이트는 제거해요.

### 방법 C: Vercel을 원본으로
Vercel 프로젝트(3번)를 원본으로 쓰고 Deployment Protection + `BBALD_PROXY_SECRET`으로 직접 접속을 막아요. `*.vercel.app`은 끌 수 없으니 가드가 필수예요.

## 5. 참고
- Cloudflare KV 무료 플랜은 하루 쓰기 1,000회 제한 → 사용자가 많으면 유료 플랜 또는 관리자 → 대시보드에서 통계 기록 끄기.
- 점검: 관리자 → 운영 · 시스템 → "점검 실행".
