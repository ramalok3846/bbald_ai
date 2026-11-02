// PAL 통합 요금제 · 크레딧 · 쿠폰 연동. ramalok.kr 메인 사이트(PaLhomepage)의
// "관리자 > 요금·크레딧·쿠폰"이 유일한 출처고, 빨드 AI는 그걸 읽고 쓰기만 한다.
//
//   billing/{uid}  { plan, planUntil, credits }   본인만 읽기, 서버(/api/billing)만 쓰기
//   plans/{id}     { name, price, credits, perks }  누구나 읽기
//   POST https://www.ramalok.kr/api/billing  Authorization: Bearer <ID 토큰>
//        { action: me | redeem | spend }
//
// 크레딧을 쓰거나 쿠폰을 등록하는 건 메인 사이트 API가 처리해야 하므로 사용자의
// Firebase ID 토큰을 그대로 전달한다. 환경변수는 따로 필요 없다 (메인 사이트 쪽
// Vercel에 FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY가 들어 있어야 함).

import { RTDB_BASE } from "./firebase-verify.js";

const PAL_BILLING_API = "https://www.ramalok.kr/api/billing";
const PAID_DAILY_MULTIPLIER = 2; // 유료 요금제면 하루 제한 2배

async function palCall(idToken, action, payload) {
  try {
    const res = await fetch(PAL_BILLING_API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ action, ...(payload || {}) }),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    return { ok: res.ok && data?.ok === true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function loadPlan(planId) {
  if (!planId || planId === "free") return { id: "free", name: "무료", credits: 0, perks: [] };
  try {
    const res = await fetch(`${RTDB_BASE}/plans/${encodeURIComponent(planId)}.json`);
    const p = res.ok ? await res.json() : null;
    return { id: planId, name: p?.name || planId, credits: Number(p?.credits) || 0, perks: p?.perks || [] };
  } catch {
    return { id: planId, name: planId, credits: 0, perks: [] };
  }
}

// 통합 계정 상태. 메인 사이트 API에 못 닿으면 available:false (=통합 크레딧 0, 무료로 취급).
export async function getUnified(idToken) {
  if (!idToken) return { available: false, credits: 0, plan: await loadPlan("free"), planUntil: 0 };
  const r = await palCall(idToken, "me");
  if (!r.ok) return { available: false, credits: 0, plan: await loadPlan("free"), planUntil: 0 };
  const b = r.data.billing || {};
  return {
    available: true,
    credits: Math.max(0, Number(b.credits) || 0),
    plan: await loadPlan(b.plan || "free"),
    planUntil: Number(b.planUntil) || 0,
    expired: b.expired || null,
  };
}

export async function spendUnified(idToken, amount) {
  const r = await palCall(idToken, "spend", { amount, service: "빨드 AI" });
  return { ok: r.ok, credits: r.ok ? Number(r.data.credits) : null };
}

export async function redeemUnifiedCoupon(idToken, code) {
  const r = await palCall(idToken, "redeem", { code });
  if (r.ok) return { ok: true, applied: r.data.applied || [] };
  return { ok: false, error: r.data?.message || "쿠폰을 쓸 수 없어요." };
}

export function isPaid(unified) {
  return !!unified && unified.plan?.id !== "free";
}

export function computeEffectiveDailyLimits(dailyLimits, unified) {
  if (!isPaid(unified)) return dailyLimits;
  return Object.fromEntries(Object.entries(dailyLimits).map(([k, v]) => [k, Math.round(v * PAID_DAILY_MULTIPLIER)]));
}
