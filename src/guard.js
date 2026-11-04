// 접근 주소 보호. "ramalok.kr/bbald_ai 로만 들어올 수 있고, *.workers.dev / *.vercel.app 같은 원본(dev) 주소로
// 직접 들어오면 안 내하고 이동시킨다"를 위한 가드. 아래 환경변수가 하나도 없으면 가드는 꺼져 있다(예전처럼 동작).
//
//   BBALD_PROXY_SECRET    ramalok.kr 쪽 프록시(PaLhomepage middleware)가 x-bbald-proxy 헤더로 보내는 비밀값.
//                         같으면 통과 — 가장 안전한 방식(권장). 헤더 x-bbald-client-ip가 있으면 진짜 방문자 IP로 쓴다.
//   BBALD_ALLOWED_HOSTS   쉼표로 구분한 허용 호스트(예: www.ramalok.kr,ramalok.kr). 요청의 Host 또는
//                         x-forwarded-host가 여기 있으면 통과 (비밀값 없이 쓰는 간단한 방식 — 헤더를 직접 만들어 보내면
//                         뚫을 수 있으니 "실수로 들어오는 것"을 막는 용도).
//   BBALD_CANONICAL_URL   이동시킬 정식 주소 (기본 https://www.ramalok.kr/bbald_ai)

const DEFAULT_CANONICAL = "https://www.ramalok.kr/bbald_ai";

export function guardConfig(env = {}) {
  const hosts = String(env.BBALD_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return {
    secret: String(env.BBALD_PROXY_SECRET || ""),
    hosts,
    canonical: String(env.BBALD_CANONICAL_URL || DEFAULT_CANONICAL).replace(/\/+$/, ""),
    enabled: !!env.BBALD_PROXY_SECRET || hosts.length > 0,
  };
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
const hostOnly = (h) => String(h || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");

// { allowed, via, clientIp } — via: off | secret | host | forwarded-host | none
export function checkAccess(request, env) {
  const cfg = guardConfig(env);
  if (!cfg.enabled) return { allowed: true, via: "off", cfg };
  const h = request.headers;
  const given = h.get("x-bbald-proxy") || "";
  if (cfg.secret && given && safeEqual(given, cfg.secret)) {
    return { allowed: true, via: "secret", clientIp: h.get("x-bbald-client-ip") || "", cfg };
  }
  let reqHost = "";
  try { reqHost = new URL(request.url).hostname.toLowerCase(); } catch {}
  if (cfg.hosts.includes(reqHost)) return { allowed: true, via: "host", cfg };
  const fwd = hostOnly(h.get("x-forwarded-host"));
  if (fwd && cfg.hosts.includes(fwd)) {
    return { allowed: true, via: "forwarded-host", clientIp: (h.get("x-forwarded-for") || "").split(",")[0].trim(), cfg };
  }
  return { allowed: false, via: "none", cfg };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// 허용되지 않은 주소로 들어왔을 때의 응답: 화면에는 안내 + 자동 이동, API/그 외 요청은 JSON 403.
export function blockedResponse(request, cfg) {
  let path = "/";
  try { const u = new URL(request.url); path = u.pathname + u.search; } catch {}
  const target = cfg.canonical + (path === "/" ? "/" : path);
  const wantsHtml = (request.method === "GET" || request.method === "HEAD") && /text\/html/.test(request.headers.get("accept") || "");
  if (!wantsHtml) {
    return new Response(JSON.stringify({ error: "이 주소로는 들어올 수 없다능. 정식 주소로 이용해달라능", url: cfg.canonical }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="4;url=${esc(target)}"><title>이 주소로는 들어올 수 없어요</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#f4f2fb;color:#221c38}
.c{max-width:420px;padding:32px;text-align:center}h1{font-size:1.3rem;margin:0 0 10px}p{color:#6b6389;line-height:1.6}a{display:inline-block;margin-top:14px;padding:11px 20px;border-radius:12px;background:linear-gradient(135deg,#ff6b6b,#7c5cfc 60%,#e58bd9);color:#fff;text-decoration:none;font-weight:700}
@media(prefers-color-scheme:dark){body{background:#0e0b1a;color:#f0edff}p{color:#b1a8d4}}</style></head>
<body><div class="c"><h1>이 주소로는 들어올 수 없어요</h1><p>빨드 AI는 정식 주소에서만 이용할 수 있어요.<br>잠시 후 자동으로 이동합니다.</p><a href="${esc(target)}">지금 이동하기</a></div></body></html>`;
  return new Response(request.method === "HEAD" ? null : html, {
    status: 403,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
