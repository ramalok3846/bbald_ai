// 관리자가 코드 재배포 없이 바꿀 수 있는 설정값들 (Cloudflare KV에 저장).
// 값이 없으면 전부 기본값(=코드에 박힌 값)으로 동작한다.
//
// 비로그인(게스트)과 로그인 회원은 기본값부터 차등을 둔다 — 게스트는 사용량이
// 적고(startingCreditsGuest) 하루 제한도 더 빡빡하다(dailyLimitsGuest).
// 로그인하면 "게스트 잔액에 더하는" 게 아니라 완전히 새 신원(uid)으로 전환되고,
// 그 uid는 처음 보는 신원이라 startingCreditsMember로 새로 시작한다 — 즉 게스트
// 잔액은 합쳐지지 않고 그냥 버려진다(flush).

const CONFIG_KEY = "config:runtime";

const DEFAULTS = {
  dailyLimits: {
    builtin: 300,
    cloudflare: 150,
    anthropic: 500,
    openai: 500,
    gemini: 500,
  },
  dailyLimitsGuest: {
    builtin: 60,
    cloudflare: 30,
    anthropic: 80,
    openai: 80,
    gemini: 80,
  },
  maintenance: {
    enabled: false,
    message: "빨드가 잠깐 점검 중이다능... 조금 이따가 다시 놀아달라능! 🛠️",
  },
  startingCredits: 100, // 로그인 회원 시작값
  startingCreditsGuest: 30, // 게스트 시작값 (회원보다 적게)
};

function merge(patch) {
  return {
    dailyLimits: { ...DEFAULTS.dailyLimits, ...(patch.dailyLimits || {}) },
    dailyLimitsGuest: { ...DEFAULTS.dailyLimitsGuest, ...(patch.dailyLimitsGuest || {}) },
    maintenance: { ...DEFAULTS.maintenance, ...(patch.maintenance || {}) },
    startingCredits: typeof patch.startingCredits === "number" ? patch.startingCredits : DEFAULTS.startingCredits,
    startingCreditsGuest:
      typeof patch.startingCreditsGuest === "number" ? patch.startingCreditsGuest : DEFAULTS.startingCreditsGuest,
  };
}

export async function getConfig(env) {
  if (!env.RATE_LIMIT_KV) return DEFAULTS;
  try {
    const raw = await env.RATE_LIMIT_KV.get(CONFIG_KEY);
    if (!raw) return DEFAULTS;
    return merge(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

export async function setConfig(env, patch) {
  if (!env.RATE_LIMIT_KV) throw new Error("RATE_LIMIT_KV가 설정되어 있지 않아서 설정을 저장할 수 없다능");
  const current = await getConfig(env);
  const next = merge({ ...current, ...patch, dailyLimits: { ...current.dailyLimits, ...(patch.dailyLimits || {}) }, dailyLimitsGuest: { ...current.dailyLimitsGuest, ...(patch.dailyLimitsGuest || {}) } });
  await env.RATE_LIMIT_KV.put(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export const CONFIG_DEFAULTS = DEFAULTS;
