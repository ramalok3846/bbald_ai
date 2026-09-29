// 크레딧 서버 권한화. 예전엔 클라이언트가 보낸 credits 숫자를 서버가 그냥
// 믿고 차감만 해서 돌려줬는데(=클라가 999999를 보내면 그대로 통과), 그러면
// 설정 화면 크레딧 입력칸이나 devtools로 누구나 크레딧을 무한정 만들 수 있었다.
// 이제 서버(KV)가 잔액의 유일한 출처다. 클라이언트가 보내는 credits 값은
// 무시한다.

const STARTING_CREDITS = 100;
const SIGNUP_BONUS = 100;
const STICKER_MIN_BONUS = 10;
const STICKER_MAX_BONUS = 30;
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

export async function getBalance(env, identity) {
  if (!env.RATE_LIMIT_KV) return STARTING_CREDITS; // KV 미설정 시 예전처럼 그냥 동작(제한 없음)
  const raw = await env.RATE_LIMIT_KV.get(creditsKey(identity));
  if (raw === null) {
    await env.RATE_LIMIT_KV.put(creditsKey(identity), String(STARTING_CREDITS));
    return STARTING_CREDITS;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : STARTING_CREDITS;
}

async function setBalance(env, identity, value) {
  if (!env.RATE_LIMIT_KV) return value;
  const clamped = Math.max(0, Math.floor(value));
  await env.RATE_LIMIT_KV.put(creditsKey(identity), String(clamped));
  return clamped;
}

export async function spendCredits(env, identity, cost) {
  const current = await getBalance(env, identity);
  if (current < cost) return { ok: false, balance: current };
  const next = await setBalance(env, identity, current - cost);
  return { ok: true, balance: next };
}

export async function claimSignupBonus(env, identity) {
  if (!env.RATE_LIMIT_KV) return { granted: false, balance: STARTING_CREDITS };
  const already = await env.RATE_LIMIT_KV.get(signupBonusKey(identity));
  if (already) return { granted: false, balance: await getBalance(env, identity) };
  await env.RATE_LIMIT_KV.put(signupBonusKey(identity), "1");
  const current = await getBalance(env, identity);
  const next = await setBalance(env, identity, current + SIGNUP_BONUS);
  return { granted: true, amount: SIGNUP_BONUS, balance: next };
}

export async function claimStickerBonus(env, identity, rand = Math.random) {
  if (!env.RATE_LIMIT_KV) {
    const amount = STICKER_MIN_BONUS + Math.floor(rand() * (STICKER_MAX_BONUS - STICKER_MIN_BONUS + 1));
    return { granted: true, amount, balance: STARTING_CREDITS };
  }
  const cooldownKey = stickerCooldownKey(identity);
  const onCooldown = await env.RATE_LIMIT_KV.get(cooldownKey);
  if (onCooldown) return { granted: false, balance: await getBalance(env, identity) };

  await env.RATE_LIMIT_KV.put(cooldownKey, "1", { expirationTtl: Math.ceil(STICKER_COOLDOWN_MS / 1000) });
  const amount = STICKER_MIN_BONUS + Math.floor(rand() * (STICKER_MAX_BONUS - STICKER_MIN_BONUS + 1));
  const current = await getBalance(env, identity);
  const next = await setBalance(env, identity, current + amount);
  return { granted: true, amount, balance: next };
}
