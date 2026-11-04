// 관리자가 코드 재배포 없이 바꿀 수 있는 설정값들 (Cloudflare KV에 저장).
// 값이 없으면 전부 기본값(=코드에 박힌 값)으로 동작한다. 저장할 때는 항상 이 파일의
// sanitize 규칙을 거치므로 이상한 값(음수, 문자열 등)이 들어가도 안전한 값으로 보정된다.
//
// 비로그인(게스트)과 로그인 회원은 기본값부터 차등을 둔다 — 게스트는 사용량이
// 적고(startingCreditsGuest) 하루 제한도 더 빡빡하다(dailyLimitsGuest).
// 로그인하면 "게스트 잔액에 더하는" 게 아니라 완전히 새 신원(uid)으로 전환된다.

const CONFIG_KEY = "config:runtime";

export const PROVIDERS = ["builtin", "cloudflare", "anthropic", "openai", "gemini"];
export const TIER_KEYS = ["lite", "basic", "deep", "story"];

const DEFAULTS = {
  dailyLimits: { builtin: 300, cloudflare: 150, anthropic: 500, openai: 500, gemini: 500 },
  dailyLimitsGuest: { builtin: 60, cloudflare: 30, anthropic: 80, openai: 80, gemini: 80 },
  maintenance: {
    enabled: false,
    message: "빨드가 잠깐 점검 중이다능... 조금 이따가 다시 놀아달라능! 🛠️",
  },
  startingCredits: 100, // 로그인 회원(빨드 AI 멤버) 기본 크레딧
  startingCreditsGuest: 30, // 게스트 기본 크레딧 (회원보다 적게)

  // 자동 재충전: 크레딧이 줄기 시작한 때부터 refillIntervalMin분 뒤에 기본 크레딧을 꽉 채워주고,
  // 24시간 동안 최대 refillMaxPer24h번까지만 해준다 (게스트/회원 공통, 기본 크레딧에만 적용).
  refillIntervalMin: 90,
  refillMaxPer24h: 5,

  // 크레딧이 줄어드는 속도: 한 번 보낼 때 깎이는 양 = round(costs[AI] × tierMult[단계]) + 이미지 수 × imageCost
  costs: { builtin: 4, cloudflare: 6, anthropic: 14, openai: 16, gemini: 16 },
  tierMult: { lite: 1, basic: 1.5, deep: 3, story: 2 },
  imageCost: 3,

  // 빨드 AI 멤버십(로그인 회원) 혜택
  memberOnlyTiers: { lite: false, basic: false, deep: true, story: true }, // true면 로그인해야 쓸 수 있는 단계
  guestImages: false, // 게스트도 이미지를 첨부할 수 있는지
  paidDailyMultiplier: 2, // 유료 요금제(PAL 통합 요금제)면 하루 사용 제한 배수

  // 답을 기다리는 동안 보이는 "빨드 생각 중" 시간(초)과, 그 중 "쵸콜릿 먹는 중" 멘트가 나올 확률(%)
  think: { minSec: 5, maxSec: 20, eatChancePct: 60 },

  // 욕설·비속어 필터. extraWords는 관리자가 더하는 금지어, allowWords는 기본 목록에서 빼는 단어.
  filter: { enabled: true, action: "block", extraWords: [], allowWords: [] }, // action: block(막기) | mask(가리기)

  // 대화 공유. publicAllowed가 false면 "전체 공개"는 못 고르고 링크 공유까지만 된다.
  sharing: { enabled: true, publicAllowed: true },
};

const num = (v, min, max, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const bool = (v, fallback) => (typeof v === "boolean" ? v : fallback);
const words = (arr, fallback) =>
  Array.isArray(arr)
    ? [...new Set(arr.map((w) => String(w).trim().toLowerCase()).filter((w) => w.length >= 1 && w.length <= 30))].slice(0, 500)
    : fallback;

function numMap(patch, base, keys, min, max) {
  const out = {};
  for (const k of keys) out[k] = num(patch?.[k], min, max, base[k]);
  return out;
}

function merge(p = {}) {
  const d = DEFAULTS;
  const think = p.think || {};
  const minSec = num(think.minSec, 0, 300, d.think.minSec);
  const maxSec = Math.max(minSec, num(think.maxSec, 0, 300, d.think.maxSec));
  return {
    dailyLimits: numMap(p.dailyLimits, d.dailyLimits, PROVIDERS, 0, 1e6),
    dailyLimitsGuest: numMap(p.dailyLimitsGuest, d.dailyLimitsGuest, PROVIDERS, 0, 1e6),
    maintenance: {
      enabled: bool(p.maintenance?.enabled, d.maintenance.enabled),
      message: typeof p.maintenance?.message === "string" ? p.maintenance.message.slice(0, 300) : d.maintenance.message,
    },
    startingCredits: num(p.startingCredits, 0, 1e6, d.startingCredits),
    startingCreditsGuest: num(p.startingCreditsGuest, 0, 1e6, d.startingCreditsGuest),
    refillIntervalMin: num(p.refillIntervalMin, 1, 60 * 24, d.refillIntervalMin),
    refillMaxPer24h: Math.round(num(p.refillMaxPer24h, 0, 100, d.refillMaxPer24h)),
    costs: numMap(p.costs, d.costs, PROVIDERS, 0, 10000),
    tierMult: numMap(p.tierMult, d.tierMult, TIER_KEYS, 0.1, 100),
    imageCost: num(p.imageCost, 0, 10000, d.imageCost),
    memberOnlyTiers: Object.fromEntries(TIER_KEYS.map((k) => [k, bool(p.memberOnlyTiers?.[k], d.memberOnlyTiers[k])])),
    guestImages: bool(p.guestImages, d.guestImages),
    paidDailyMultiplier: num(p.paidDailyMultiplier, 1, 100, d.paidDailyMultiplier),
    think: { minSec, maxSec, eatChancePct: Math.round(num(think.eatChancePct, 0, 100, d.think.eatChancePct)) },
    filter: {
      enabled: bool(p.filter?.enabled, d.filter.enabled),
      action: p.filter?.action === "mask" ? "mask" : "block",
      extraWords: words(p.filter?.extraWords, d.filter.extraWords),
      allowWords: words(p.filter?.allowWords, d.filter.allowWords),
    },
    sharing: {
      enabled: bool(p.sharing?.enabled, d.sharing.enabled),
      publicAllowed: bool(p.sharing?.publicAllowed, d.sharing.publicAllowed),
    },
  };
}

export async function getConfig(env) {
  if (!env.RATE_LIMIT_KV) return merge({});
  try {
    const raw = await env.RATE_LIMIT_KV.get(CONFIG_KEY);
    return merge(raw ? JSON.parse(raw) : {});
  } catch {
    return merge({});
  }
}

// patch는 최상위 키별로 덮어쓴다 (중첩 객체는 키 단위로 합쳐서 일부만 보내도 나머지가 유지됨).
export async function setConfig(env, patch) {
  if (!env.RATE_LIMIT_KV) throw new Error("RATE_LIMIT_KV가 설정되어 있지 않아서 설정을 저장할 수 없다능");
  const current = await getConfig(env);
  const next = { ...current };
  for (const [k, v] of Object.entries(patch || {})) {
    if (!(k in DEFAULTS)) continue;
    next[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...current[k], ...v } : v;
  }
  const clean = merge(next);
  await env.RATE_LIMIT_KV.put(CONFIG_KEY, JSON.stringify(clean));
  return clean;
}

// 로그인 안 한 사람에게도 내려주는 공개 설정 (비밀 값 없음)
export function publicConfig(config) {
  return {
    think: config.think,
    tierMult: config.tierMult,
    memberOnlyTiers: config.memberOnlyTiers,
    guestImages: config.guestImages,
    sharing: config.sharing,
    refillIntervalMin: config.refillIntervalMin,
    refillMaxPer24h: config.refillMaxPer24h,
    maintenance: config.maintenance,
  };
}

export const CONFIG_DEFAULTS = DEFAULTS;
