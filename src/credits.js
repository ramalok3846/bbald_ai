// 크레딧 서버 권한화. 예전엔 클라이언트가 보낸 credits 숫자를 서버가 그냥
// 믿고 차감만 해서 돌려줬는데(=클라가 999999를 보내면 그대로 통과), 그러면
// 설정 화면 크레딧 입력칸이나 devtools로 누구나 크레딧을 무한정 만들 수 있었다.
// 이제 서버(KV)가 잔액의 유일한 출처다. 클라이언트가 보내는 credits 값은
// 무시한다.

const STARTING_CREDITS = 100;
// 보너스는 cap(게스트/회원마다 다른 시작 크레딧)에 비례한 비율로 준다 — 예전엔
// 고정 숫자(가입보너스 100, 스티커 10~30)를 그냥 더해서, 게스트처럼 cap이 더
// 작을 때 cap을 훌쩍 넘어버리거나(예: 잔액 135 / 최대 100 같은 이상한 표시)
// 반대로 cap이 커지면 보너스 비중이 너무 작아지는 "숫자가 꼬이는" 문제가 있었다.
const SIGNUP_BONUS_RATIO = 1; // 가입 보너스 = cap의 100% (꽉 채워줌)
const STICKER_MIN_BONUS_RATIO = 0.1; // 스티커 보너스 = cap의 10~30%
const STICKER_MAX_BONUS_RATIO = 0.3;
const STICKER_COOLDOWN_MS = 20 * 1000; // 클릭 스팸으로 연타 못 하게 최소 간격

function creditsKey(identity) {
  return `credits:${identity}`;
}
function signupBonusKey(identity) {
  return `bonus-signup:${identity}`;
}
function stickerCooldownKey(identity) {
  return `bonus-sticker-cooldown:${identity}`;
}

// 로그인했으면 Firebase uid로, 아니면 IP로 신원을 구분한다.
// (uid는 서버에서 검증하지 않으므로 완벽한 보안은 아니지만, 클라이언트가 임의의
// 숫자를 보내던 예전 방식보다는 훨씬 낫다 — 최소한 매 요청마다 숫자를 조작해서
// 무한 충전하는 건 막는다.)
export function resolveIdentity(request, uid) {
  if (uid && typeof uid === "string" && uid.length <= 128) return `uid:${uid}`;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  return `ip:${ip}`;
}

export async function getBalance(env, identity, startingCredits = STARTING_CREDITS) {
  if (!env.RATE_LIMIT_KV) return startingCredits; // KV 미설정 시 예전처럼 그냥 동작(제한 없음)
  const raw = await env.RATE_LIMIT_KV.get(creditsKey(identity));
  if (raw === null) {
    await env.RATE_LIMIT_KV.put(creditsKey(identity), String(startingCredits));
    return startingCredits;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : startingCredits;
}

async function setBalance(env, identity, value) {
  if (!env.RATE_LIMIT_KV) return value;
  const clamped = Math.max(0, Math.floor(value));
  await env.RATE_LIMIT_KV.put(creditsKey(identity), String(clamped));
  return clamped;
}

export async function spendCredits(env, identity, cost, startingCredits = STARTING_CREDITS) {
  const current = await getBalance(env, identity, startingCredits);
  if (current < cost) return { ok: false, balance: current };
  const next = await setBalance(env, identity, current - cost);
  return { ok: true, balance: next };
}

// cap(게스트/회원마다 다른 시작 크레딧)을 항상 같이 넘겨야 한다 — 그래야
// "처음 보는 신원이라 KV에 아직 값이 없을 때" 올바른 cap으로 초기화되고,
// 보너스도 cap을 넘지 않게(min으로 clamp) 더해져서 "135 / 100"처럼 잔액이
// 최대치보다 커지는 이상한 표시가 안 생긴다.
export async function claimSignupBonus(env, identity, cap = STARTING_CREDITS) {
  if (!env.RATE_LIMIT_KV) return { granted: false, balance: cap };
  const already = await env.RATE_LIMIT_KV.get(signupBonusKey(identity));
  if (already) return { granted: false, balance: await getBalance(env, identity, cap) };
  await env.RATE_LIMIT_KV.put(signupBonusKey(identity), "1");
  const current = await getBalance(env, identity, cap);
  const amount = Math.max(1, Math.round(cap * SIGNUP_BONUS_RATIO));
  const next = await setBalance(env, identity, Math.min(cap, current + amount));
  return { granted: true, amount, balance: next };
}

export async function claimStickerBonus(env, identity, cap = STARTING_CREDITS, rand = Math.random) {
  const amount = Math.max(1, Math.round(cap * (STICKER_MIN_BONUS_RATIO + rand() * (STICKER_MAX_BONUS_RATIO - STICKER_MIN_BONUS_RATIO))));
  if (!env.RATE_LIMIT_KV) {
    return { granted: true, amount, balance: cap };
  }
  const cooldownKey = stickerCooldownKey(identity);
  const onCooldown = await env.RATE_LIMIT_KV.get(cooldownKey);
  if (onCooldown) return { granted: false, balance: await getBalance(env, identity, cap) };

  await env.RATE_LIMIT_KV.put(cooldownKey, "1", { expirationTtl: Math.ceil(STICKER_COOLDOWN_MS / 1000) });
  const current = await getBalance(env, identity, cap);
  const next = await setBalance(env, identity, Math.min(cap, current + amount));
  return { granted: true, amount, balance: next };
}

// ---------------- 관리자 전용 ----------------

// 관리자가 특정 신원(identity)의 잔액을 직접 가감한다. delta는 음수도 가능.
export async function adminAdjustBalance(env, identity, delta) {
  const current = await getBalance(env, identity);
  const next = await setBalance(env, identity, current + delta);
  return { balance: next };
}

export async function adminSetBalance(env, identity, value) {
  const next = await setBalance(env, identity, value);
  return { balance: next };
}

// credits:* 키를 KV list()로 훑어서 신원 목록 + 잔액을 돌려준다 (페이지네이션 지원).
export async function listCreditIdentities(env, cursor) {
  if (!env.RATE_LIMIT_KV) return { items: [], cursor: null, done: true };
  const page = await env.RATE_LIMIT_KV.list({ prefix: "credits:", cursor: cursor || undefined, limit: 50 });
  const items = await Promise.all(
    page.keys.map(async (k) => {
      const identity = k.name.slice("credits:".length);
      const raw = await env.RATE_LIMIT_KV.get(k.name);
      return { identity, balance: Number(raw) || 0 };
    })
  );
  return { items, cursor: page.cursor || null, done: page.list_complete };
}
