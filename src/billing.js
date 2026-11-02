// 유료 요금제(PRO) / 크레딧 충전 / 쿠폰. PAL Canva(pal-canva)의 "PRO 요금제
// (테스트 모드)"와 같은 원칙을 그대로 따른다 — 실제 결제는 없고, 테스트 카드
// (카드번호 0000-0000-0000-0000, 유효기간 00/00, CVC 000)로만 "결제"가 통과한다.
// 진짜 돈이 오가는 결제를 붙이려면 결제사(토스페이먼츠 등) API 키를 Cloudflare
// 환경변수/시크릿으로 받아 서버에서 웹훅으로 검증하도록 바꿔야 한다 (지금은 가짜).
//
// 구매/쿠폰으로 받은 크레딧은 "cap_bonus"로 잔액과 함께 최대치(cap)도 같이
// 늘려서, 잔액이 cap보다 커 보이는("135 / 100" 같은) 이상한 표시가 안 생기게 한다.

const PRO_CAP_MULTIPLIER = 3; // PRO면 크레딧 최대치가 3배
const PRO_DAILY_MULTIPLIER = 2; // PRO면 하루 제한도 2배
const PRO_PLAN_DAYS = 30;

// "통합회원 요금제에서 크레딧을 가져와라" — PAL Design(pal-canva)의 PRO 구독은
// PAL 전체 계정에 걸친 혜택으로 취급한다. pal_canva/billing/{uid}를 pal-canva와
// 똑같은 방식으로 읽어서(pal-canva/assets/js/billing.js의 statusOf와 동일 로직),
// 거기서 PRO면 bbald_ai에서도 로그인 없이(따로 안 사야) PRO로 인정해준다.
import { RTDB_BASE } from "./firebase-verify.js";

async function checkPalCanvaPro(uid, idToken) {
  if (!uid || !idToken) return false;
  try {
    const res = await fetch(`${RTDB_BASE}/pal_canva/billing/${uid}.json?auth=${encodeURIComponent(idToken)}`);
    if (!res.ok) return false;
    const b = await res.json();
    if (!b) return false;
    const now = Date.now();
    return !!b.autoRenew || (b.proUntil || 0) > now;
  } catch {
    return false;
  }
}

export const CREDIT_PACKS = {
  small: { amount: 50, priceLabel: "₩1,100 (테스트)" },
  medium: { amount: 150, priceLabel: "₩2,900 (테스트)" },
  large: { amount: 400, priceLabel: "₩6,900 (테스트)" },
};

export const PRO_PLAN_INFO = {
  priceLabel: "₩4,900/월 (테스트)",
  capMultiplier: PRO_CAP_MULTIPLIER,
  dailyMultiplier: PRO_DAILY_MULTIPLIER,
  days: PRO_PLAN_DAYS,
};

function planKey(identity) {
  return `plan:${identity}`;
}
function capBonusKey(identity) {
  return `cap_bonus:${identity}`;
}
function couponKey(code) {
  return `coupon:${code.toUpperCase()}`;
}
function couponUseKey(code, identity) {
  return `coupon_used:${code.toUpperCase()}:${identity}`;
}

// 테스트 결제 전용 "카드" — 실제 결제 정보가 아니라, 테스트 모드임을 분명히
// 하는 고정값과 맞는지만 확인한다 (PAL Canva 체크아웃과 동일한 값).
export function isTestCardValid(card) {
  const number = String(card?.number || "").replace(/[\s-]/g, "");
  const exp = String(card?.exp || "").replace(/\s/g, "");
  const cvc = String(card?.cvc || "").trim();
  return number === "0000000000000000" && exp === "00/00" && cvc === "000";
}

// idToken이 있으면(로그인된 사용자가 자기 토큰을 같이 보낸 경우) PAL Design의
// PRO 구독도 같이 확인해서, 둘 중 하나라도 PRO면 PRO로 인정한다.
export async function getPlan(env, identity, idToken) {
  let own = { tier: "free" };
  if (env.RATE_LIMIT_KV) {
    const raw = await env.RATE_LIMIT_KV.get(planKey(identity));
    if (raw) {
      try {
        const plan = JSON.parse(raw);
        if (!(plan.tier === "pro" && plan.expiresAt && plan.expiresAt < Date.now())) {
          own = plan;
        }
      } catch {}
    }
  }
  if (own.tier === "pro") return own;

  const uid = identity.startsWith("uid:") ? identity.slice(4) : null;
  if (uid && (await checkPalCanvaPro(uid, idToken))) {
    return { tier: "pro", source: "pal_canva" };
  }
  return own;
}

export async function setPlan(env, identity, tier, days = PRO_PLAN_DAYS) {
  if (!env.RATE_LIMIT_KV) return { tier };
  const plan = {
    tier,
    startedAt: Date.now(),
    expiresAt: tier === "pro" ? Date.now() + days * 24 * 60 * 60 * 1000 : null,
  };
  await env.RATE_LIMIT_KV.put(planKey(identity), JSON.stringify(plan));
  return plan;
}

export async function getCapBonus(env, identity) {
  if (!env.RATE_LIMIT_KV) return 0;
  return Number(await env.RATE_LIMIT_KV.get(capBonusKey(identity))) || 0;
}

async function addCapBonus(env, identity, amount) {
  const current = await getCapBonus(env, identity);
  const next = Math.max(0, current + amount);
  await env.RATE_LIMIT_KV.put(capBonusKey(identity), String(next));
  return next;
}

// baseCap(게스트/회원 기본값)에 PRO 배율과 구매로 늘린 cap_bonus를 더해 실제
// 크레딧 최대치를 계산한다. handleChat/handleUsage/api-credits가 공통으로 쓴다.
export function computeEffectiveCap(baseCap, plan, capBonus) {
  const multiplied = plan?.tier === "pro" ? Math.round(baseCap * PRO_CAP_MULTIPLIER) : baseCap;
  return multiplied + (capBonus || 0);
}
export function computeEffectiveDailyLimits(dailyLimits, plan) {
  if (plan?.tier !== "pro") return dailyLimits;
  return Object.fromEntries(Object.entries(dailyLimits).map(([k, v]) => [k, Math.round(v * PRO_DAILY_MULTIPLIER)]));
}

// 게스트는 신원이 IP라서(기기/네트워크가 바뀌면 다른 사람이 됨) 요금제·쿠폰은
// 로그인한 사람만 쓸 수 있다.
export async function purchaseCreditPack(env, identity, packId, card) {
  const pack = CREDIT_PACKS[packId];
  if (!pack) return { ok: false, error: "알 수 없는 상품이다능" };
  if (!isTestCardValid(card)) {
    return { ok: false, error: "테스트 카드 정보가 맞지 않다능 (카드번호 0000-0000-0000-0000, 유효기간 00/00, CVC 000)" };
  }
  if (!env.RATE_LIMIT_KV) return { ok: false, error: "저장소가 설정되어 있지 않다능" };
  const capBonus = await addCapBonus(env, identity, pack.amount);
  return { ok: true, amount: pack.amount, capBonus };
}

export async function subscribePro(env, identity, card) {
  if (!isTestCardValid(card)) {
    return { ok: false, error: "테스트 카드 정보가 맞지 않다능 (카드번호 0000-0000-0000-0000, 유효기간 00/00, CVC 000)" };
  }
  const plan = await setPlan(env, identity, "pro");
  return { ok: true, plan };
}

// ---------------- 쿠폰 (관리자가 발급) ----------------
export async function createCoupon(env, { code, amount, planDays, maxUses }) {
  if (!env.RATE_LIMIT_KV) throw new Error("저장소가 설정되어 있지 않다능");
  if (!code || typeof code !== "string") throw new Error("쿠폰 코드가 필요하다능");
  const record = {
    code: code.toUpperCase(),
    amount: Number(amount) > 0 ? Math.round(Number(amount)) : 0,
    planDays: Number(planDays) > 0 ? Math.round(Number(planDays)) : 0,
    maxUses: Number(maxUses) > 0 ? Math.round(Number(maxUses)) : 1,
    usedCount: 0,
    createdAt: Date.now(),
  };
  await env.RATE_LIMIT_KV.put(couponKey(record.code), JSON.stringify(record));
  return record;
}

export async function deleteCoupon(env, code) {
  if (!env.RATE_LIMIT_KV || !code) return;
  await env.RATE_LIMIT_KV.delete(couponKey(code));
}

export async function listCoupons(env) {
  if (!env.RATE_LIMIT_KV) return [];
  const page = await env.RATE_LIMIT_KV.list({ prefix: "coupon:" });
  const items = await Promise.all(
    page.keys.map(async (k) => {
      try {
        return JSON.parse((await env.RATE_LIMIT_KV.get(k.name)) || "null");
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean);
}

export async function redeemCoupon(env, identity, codeRaw) {
  if (!env.RATE_LIMIT_KV) return { ok: false, error: "저장소가 설정되어 있지 않다능" };
  const code = String(codeRaw || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "쿠폰 코드를 입력해달라능" };
  const raw = await env.RATE_LIMIT_KV.get(couponKey(code));
  if (!raw) return { ok: false, error: "그런 쿠폰은 없다능" };
  const coupon = JSON.parse(raw);
  const already = await env.RATE_LIMIT_KV.get(couponUseKey(code, identity));
  if (already) return { ok: false, error: "이미 사용한 쿠폰이다능" };
  if (coupon.usedCount >= coupon.maxUses) return { ok: false, error: "쿠폰 사용 횟수가 다 찼다능" };

  coupon.usedCount += 1;
  await env.RATE_LIMIT_KV.put(couponKey(code), JSON.stringify(coupon));
  await env.RATE_LIMIT_KV.put(couponUseKey(code, identity), "1");

  let capBonus = null;
  if (coupon.amount > 0) capBonus = await addCapBonus(env, identity, coupon.amount);
  let plan = null;
  if (coupon.planDays > 0) plan = await setPlan(env, identity, "pro", coupon.planDays);

  return { ok: true, amount: coupon.amount, planDays: coupon.planDays, capBonus, plan };
}
