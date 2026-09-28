// 하루 사용량 제한 (악용/과금 방지). wrangler.toml에 RATE_LIMIT_KV 바인딩이
// 없으면 그냥 무제한으로 통과시킨다 (초기 설정 전에도 앱이 안 깨지도록).

// provider별 하루 최대 요청 횟수. IP 하나당 기준.
// - builtin/cloudflare: 사용자 키 없이 우리 Cloudflare 계정(Workers AI 무료 한도)을
//   쓰기 때문에 더 빡빡하게 막아준다.
// - anthropic/openai/gemini: 사용자 본인 키로 호출하지만, 키가 새거나
//   스크립트로 무한 반복 호출되는 사고를 막기 위해 넉넉한 한도를 둔다.
export const DAILY_LIMITS = {
  builtin: 300,
  cloudflare: 150,
  anthropic: 500,
  openai: 500,
  gemini: 500,
};

function kstDateKey() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get("year")}${get("month")}${get("day")}`; // YYYYMMDD (KST 기준)
  } catch {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }
}

function clientIp(request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
}

// 반환: { allowed, remaining, limit } — allowed=false면 오늘치를 다 썼다는 뜻.
export async function checkAndConsumeDailyLimit(env, request, provider) {
  const limit = DAILY_LIMITS[provider] ?? 300;
  if (!env.RATE_LIMIT_KV) {
    // KV 미설정: 제한 없이 통과 (README/wrangler.toml 안내 참고)
    return { allowed: true, remaining: null, limit, enabled: false };
  }

  const key = `usage:${provider}:${kstDateKey()}:${clientIp(request)}`;
  const current = Number((await env.RATE_LIMIT_KV.get(key)) || "0");

  if (current >= limit) {
    return { allowed: false, remaining: 0, limit, enabled: true };
  }

  // 자정(KST) 기준 하루가 지나면 자연스럽게 만료되도록 넉넉히 25시간 TTL.
  await env.RATE_LIMIT_KV.put(key, String(current + 1), { expirationTtl: 25 * 60 * 60 });
  return { allowed: true, remaining: limit - current - 1, limit, enabled: true };
}
