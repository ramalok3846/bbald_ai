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

export const SEED_NOTICES = [
  { id: "ev-sticker", kind: "event", emoji: "🎁", title: "랜덤 빨드 스티커 이벤트", pinned: true, visible: true,
    body: "채팅 중 화면 아무 곳에나 빨드 스티커가 잠깐 나타난다능! 놓치기 전에 눌러바~ 빨드 파워를 {stickerMin}~{stickerMax}% 랜덤으로 채워준다능. (파워가 가득 차 있을 땐 줄 게 없다능!)" },
  { id: "ev-signup", kind: "event", emoji: "🎉", title: "첫 로그인 보너스", pinned: false, visible: true,
    body: "PAL 통합 계정으로 처음 로그인하면 계정당 1회, 빨드 파워를 {signup}% 채워준다능! 게스트로도 쓸 수 있지만 로그인하면 대화도 저장되고 더 든든하다능." },
  { id: "nt-sunset", kind: "notice", emoji: "🌇", title: "노을 모드 안내", pinned: false, visible: true,
    body: "한국시간 오후 3시가 지나면 빨드가 아주 가끔 조금 또렷해진다능 (완전 똑똑해지는 건 아니고 살짝!). 그 전엔 평소처럼 멍청하고 웃긴 빨드를 만날 수 있다능." },
  { id: "gd-start", kind: "guide", emoji: "💬", title: "대화하기", pinned: true, visible: true,
    body: "아래 입력창에 말을 걸고 Ctrl+Enter(맥은 ⌘+Enter) 또는 ↑ 버튼으로 보내면 된다능. Enter는 줄바꿈이다능!" },
  { id: "gd-brain", kind: "guide", emoji: "🧠", title: "AI 두뇌 고르기", pinned: false, visible: true,
    body: "위쪽에서 AI(빨드 기본·Cloudflare·Claude·ChatGPT·Gemini)와 두뇌 단계(라이트/기본/딥씽킹/스토리)를 고를 수 있다능. 단계가 높을수록 똑똑하지만 빨드 파워가 더 든다능. Claude·ChatGPT·Gemini는 설정에서 내 API 키를 넣어야 한다능." },
  { id: "gd-image", kind: "guide", emoji: "🖼️", title: "사진 보내기", pinned: false, visible: true,
    body: "📎로 사진을 여러 장 붙이거나 🔗로 이미지 주소를 붙여넣을 수 있다능. 붙여넣기(Ctrl+V)도 된다능. 사진은 로그인해야 쓸 수 있을 수도 있다능. 클릭하면 크게 보고 저장도 할 수 있다능!" },
  { id: "gd-power", kind: "guide", emoji: "⚡", title: "빨드 파워(크레딧)", pinned: false, visible: true,
    body: "대화할 때마다 빨드 파워가 줄어든다능. 시간이 지나면 저절로 다시 차오르고, 스티커·로그인 보너스로도 채울 수 있다능. PAL 요금제·쿠폰이 있으면 더 많이 쓸 수 있다능." },
  { id: "gd-save", kind: "guide", emoji: "🔗", title: "저장 · 공유 · 시크릿", pinned: false, visible: true,
    body: "로그인하면 대화가 자동 저장돼서 왼쪽 목록에서 다시 볼 수 있다능. 🕶️ 시크릿은 저장 안 되고, 상단 공유 버튼으로 링크 공유(글만)도 할 수 있다능." },
];

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

  // AI(provider)별 사용 여부. 꺼진 AI는 선택창에서 빠지고 서버도 거절한다.
  providersEnabled: { builtin: true, cloudflare: true, anthropic: true, openai: true, gemini: true },

  // 요청 제한: 메시지 길이, 한 번에 첨부할 이미지 수, AI에 보내는 이전 대화 개수, 답변 최대 길이(토큰)
  limits: { maxMessageChars: 2000, maxImages: 4, historyTurns: 10, maxTokens: 400 },

  // 프롬프트: extra는 빨드 말투 지침 뒤에 덧붙이는 관리자 지침, sunsetMode가 false면 노을(똑똑해지는 시간) 효과 없이 항상 멍청 모드
  prompt: { extra: "", sunsetMode: true },

  // 빨드 내장 두뇌 학습: keywords 중 하나라도 들어 있으면 replies 중 하나로 답한다 (기본 지식 사전보다 먼저)
  customReplies: [],

  // 보너스: 가입 보너스(기본 크레딧의 몇 %), 랜덤 빨드 스티커
  bonus: {
    signupPct: 100,
    sticker: { enabled: true, minPct: 10, maxPct: 30, cooldownSec: 20, minIntervalSec: 90, maxIntervalSec: 240 },
  },

  // 공지사항(설정 창 옆 "공지사항"에 보임), 맨 위 배너, 문구
  // kind: notice(공지) | event(이벤트) | guide(사용법). 본문에 {signup} {stickerMin} {stickerMax} 를 쓰면 현재 보너스 설정 값으로 바뀐다.
  notices: [],
  noticesSeeded: false, // 관리자가 한 번이라도 공지를 저장했는지 (그 전에는 기본 공지/이벤트/사용법을 보여준다)
  banner: { enabled: false, text: "", level: "info", link: "" },
  texts: { greeting: "", placeholder: "", keepEmoji: false },

  // 그랜드 오픈: at 이전에는 서비스 접속을 제한하고 카운트다운 화면만 보여준다 (관리자는 로그인하면 들어올 수 있음).
  // useNotice가 켜져 있으면 PAL 공지(noticeId)의 첫 일정(milestones[0].at, 한국 시간)을 따라간다.
  launch: {
    enabled: true,
    at: "2026-11-28T10:00:00+09:00",
    useNotice: true,
    noticeId: "bbald-open",
    paused: false, // true면 오픈 시각과 상관없이 접속을 막는다 ("오픈 일시중지"). 재개하면 시각 기준으로 돌아간다.
    pausedMessage: "잠시 오픈을 멈췄다능! 준비가 끝나면 다시 알려주겠다능.",
    celebrateDays: 7, // 오픈 후 며칠 동안 접속 때마다 축하 화면을 보여줄지 (0이면 안 보임)
    version: "v1.0.0",
    title: "빨드 AI 그랜드 오픈",
    message: "빨드가 정식 오픈을 준비하고 있다능! 오픈 시각이 되면 자동으로 열린다능.",
    noticeUrl: "https://www.ramalok.kr/notice?id=bbald-open",
  },

  statsEnabled: true, // 일별 통계 수집 (KV 쓰기가 늘어나므로 끌 수 있다)

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

function cleanCustomReplies(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((r) => ({
      keywords: words(r?.keywords, []).slice(0, 20),
      replies: Array.isArray(r?.replies) ? r.replies.map((x) => String(x).trim().slice(0, 400)).filter(Boolean).slice(0, 10) : [],
    }))
    .filter((r) => r.keywords.length && r.replies.length)
    .slice(0, 200);
}
function cleanNotices(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((n, i) => ({
      id: String(n?.id || `n${i}`).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 20) || `n${i}`,
      kind: ["notice", "event", "guide"].includes(n?.kind) ? n.kind : "notice",
      title: String(n?.title || "").trim().slice(0, 60),
      body: String(n?.body || "").trim().slice(0, 1000),
      emoji: String(n?.emoji || "").trim().slice(0, 4),
      visible: n?.visible !== false,
      pinned: n?.pinned === true,
    }))
    .filter((n) => n.title || n.body)
    .slice(0, 60);
}

function validIso(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
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
    statsEnabled: bool(p.statsEnabled, d.statsEnabled),
    providersEnabled: Object.fromEntries(PROVIDERS.map((k) => [k, bool(p.providersEnabled?.[k], d.providersEnabled[k])])),
    limits: {
      maxMessageChars: Math.round(num(p.limits?.maxMessageChars, 10, 20000, d.limits.maxMessageChars)),
      maxImages: Math.round(num(p.limits?.maxImages, 0, 10, d.limits.maxImages)),
      historyTurns: Math.round(num(p.limits?.historyTurns, 0, 40, d.limits.historyTurns)),
      maxTokens: Math.round(num(p.limits?.maxTokens, 50, 4000, d.limits.maxTokens)),
    },
    prompt: {
      extra: typeof p.prompt?.extra === "string" ? p.prompt.extra.slice(0, 1500) : d.prompt.extra,
      sunsetMode: bool(p.prompt?.sunsetMode, d.prompt.sunsetMode),
    },
    customReplies: cleanCustomReplies(p.customReplies),
    bonus: {
      signupPct: num(p.bonus?.signupPct, 0, 1000, d.bonus.signupPct),
      sticker: {
        enabled: bool(p.bonus?.sticker?.enabled, d.bonus.sticker.enabled),
        minPct: num(p.bonus?.sticker?.minPct, 0, 1000, d.bonus.sticker.minPct),
        maxPct: Math.max(
          num(p.bonus?.sticker?.minPct, 0, 1000, d.bonus.sticker.minPct),
          num(p.bonus?.sticker?.maxPct, 0, 1000, d.bonus.sticker.maxPct)
        ),
        cooldownSec: num(p.bonus?.sticker?.cooldownSec, 0, 86400, d.bonus.sticker.cooldownSec),
        minIntervalSec: num(p.bonus?.sticker?.minIntervalSec, 5, 86400, d.bonus.sticker.minIntervalSec),
        maxIntervalSec: Math.max(
          num(p.bonus?.sticker?.minIntervalSec, 5, 86400, d.bonus.sticker.minIntervalSec),
          num(p.bonus?.sticker?.maxIntervalSec, 5, 86400, d.bonus.sticker.maxIntervalSec)
        ),
      },
    },
    launch: {
      enabled: bool(p.launch?.enabled, d.launch.enabled),
      at: validIso(p.launch?.at) ? p.launch.at : d.launch.at,
      useNotice: bool(p.launch?.useNotice, d.launch.useNotice),
      noticeId: /^[a-z0-9][a-z0-9-]{1,30}$/.test(p.launch?.noticeId || "") ? p.launch.noticeId : d.launch.noticeId,
      paused: bool(p.launch?.paused, d.launch.paused),
      pausedMessage: typeof p.launch?.pausedMessage === "string" && p.launch.pausedMessage.trim() ? p.launch.pausedMessage.trim().slice(0, 300) : d.launch.pausedMessage,
      celebrateDays: num(p.launch?.celebrateDays, 0, 60, d.launch.celebrateDays),
      version: typeof p.launch?.version === "string" && p.launch.version.trim() ? p.launch.version.trim().slice(0, 20) : d.launch.version,
      title: typeof p.launch?.title === "string" && p.launch.title.trim() ? p.launch.title.trim().slice(0, 60) : d.launch.title,
      message: typeof p.launch?.message === "string" ? p.launch.message.slice(0, 300) : d.launch.message,
      noticeUrl: typeof p.launch?.noticeUrl === "string" && /^https?:\/\//.test(p.launch.noticeUrl) ? p.launch.noticeUrl.slice(0, 300) : d.launch.noticeUrl,
    },
    noticesSeeded: p.noticesSeeded === true,
    // 관리자가 아직 공지를 저장한 적이 없으면 기본 공지/이벤트/사용법을 보여준다.
    notices: p.noticesSeeded === true || cleanNotices(p.notices).length ? cleanNotices(p.notices) : cleanNotices(SEED_NOTICES),
    banner: {
      enabled: bool(p.banner?.enabled, d.banner.enabled),
      text: typeof p.banner?.text === "string" ? p.banner.text.slice(0, 200) : d.banner.text,
      level: ["info", "warn"].includes(p.banner?.level) ? p.banner.level : "info",
      link: typeof p.banner?.link === "string" && /^https?:\/\//.test(p.banner.link) ? p.banner.link.slice(0, 300) : "",
    },
    texts: {
      greeting: typeof p.texts?.greeting === "string" ? p.texts.greeting.slice(0, 300) : d.texts.greeting,
      placeholder: typeof p.texts?.placeholder === "string" ? p.texts.placeholder.slice(0, 100) : d.texts.placeholder,
      keepEmoji: bool(p.texts?.keepEmoji, d.texts.keepEmoji),
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
  if (patch && "notices" in patch) next.noticesSeeded = true;
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
    providersEnabled: config.providersEnabled,
    limits: { maxMessageChars: config.limits.maxMessageChars, maxImages: config.limits.maxImages },
    stickerBonus: config.bonus.sticker,
    notices: config.notices.filter((n) => n.visible).sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    signupPct: config.bonus.signupPct,
    banner: config.banner,
    texts: config.texts,
    refillIntervalMin: config.refillIntervalMin,
    refillMaxPer24h: config.refillMaxPer24h,
    maintenance: config.maintenance,
    version: config.launch.version,
  };
}

// 설정을 기본값으로 되돌린다.
export async function resetConfig(env) {
  if (!env.RATE_LIMIT_KV) throw new Error("RATE_LIMIT_KV가 설정되어 있지 않아서 설정을 초기화할 수 없다능");
  await env.RATE_LIMIT_KV.delete(CONFIG_KEY);
  return merge({});
}

export const CONFIG_DEFAULTS = DEFAULTS;
