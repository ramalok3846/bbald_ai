// 관리자가 코드 재배포 없이 바꿀 수 있는 설정값들 (Cloudflare KV에 저장).
// 값이 없으면 전부 기본값(=코드에 박힌 값)으로 동작한다.

const CONFIG_KEY = "config:runtime";

const DEFAULTS = {
  dailyLimits: {
    builtin: 300,
    cloudflare: 150,
    anthropic: 500,
    openai: 500,
    gemini: 500,
  },
  maintenance: {
    enabled: false,
    message: "빨드가 잠깐 점검 중이다능... 조금 이따가 다시 놀아달라능! 🛠️",
  },
  startingCredits: 100,
};

export async function getConfig(env) {
  if (!env.RATE_LIMIT_KV) return DEFAULTS;
  try {
    const raw = await env.RATE_LIMIT_KV.get(CONFIG_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      dailyLimits: { ...DEFAULTS.dailyLimits, ...(parsed.dailyLimits || {}) },
      maintenance: { ...DEFAULTS.maintenance, ...(parsed.maintenance || {}) },
      startingCredits: typeof parsed.startingCredits === "number" ? parsed.startingCredits : DEFAULTS.startingCredits,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function setConfig(env, patch) {
  if (!env.RATE_LIMIT_KV) throw new Error("RATE_LIMIT_KV가 설정되어 있지 않아서 설정을 저장할 수 없다능");
  const current = await getConfig(env);
  const next = {
    dailyLimits: { ...current.dailyLimits, ...(patch.dailyLimits || {}) },
    maintenance: { ...current.maintenance, ...(patch.maintenance || {}) },
    startingCredits: typeof patch.startingCredits === "number" ? patch.startingCredits : current.startingCredits,
  };
  await env.RATE_LIMIT_KV.put(CONFIG_KEY, JSON.stringify(next));
  return next;
}

export const CONFIG_DEFAULTS = DEFAULTS;
