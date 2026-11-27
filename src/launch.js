// 그랜드 오픈 게이트. 오픈 시각(at) 전에는 일반 사용자의 서비스 이용(채팅·저장·보너스 등)을 막고
// 카운트다운 화면만 보여준다. 오픈 시각은 PAL 공지(settings/{noticeId})의 첫 일정을 따라가고,
// 못 읽으면 관리자 설정(launch.at)을 쓴다.
import { requireAdmin } from "./admin.js";

const RTDB = "https://pal-inte-db-default-rtdb.asia-southeast1.firebasedatabase.app";
let noticeCache = { id: "", t: 0, at: null };

// "2026-11-28T10:00:00" (시간대 없음) → 한국 시간으로 본다.
function parseKst(v) {
  if (typeof v !== "string" || !v) return null;
  const iso = /(Z|[+-]\d{2}:\d{2})$/.test(v) ? v : `${v}${v.length === 16 ? ":00" : ""}+09:00`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

async function noticeAt(id) {
  const now = Date.now();
  if (noticeCache.id === id && now - noticeCache.t < 60_000) return noticeCache.at;
  let at = null;
  try {
    const r = await fetch(`${RTDB}/settings/${id}.json`, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      at = parseKst(j?.milestones?.[0]?.at);
    }
  } catch {}
  noticeCache = { id, t: now, at };
  return at;
}

export async function launchInfo(env, config, now = Date.now()) {
  const L = config.launch;
  let at = parseKst(L.at);
  if (L.useNotice) {
    const n = await noticeAt(L.noticeId);
    if (n) at = n;
  }
  const active = !!(L.enabled && at && now < at);
  return { active, enabled: L.enabled, at, now, version: L.version, title: L.title, message: L.message, noticeUrl: L.noticeUrl };
}

export async function isLaunchAdmin(token) {
  if (!token) return false;
  try { return !!(await requireAdmin(token)); } catch { return false; }
}

// 오픈 전이고 관리자가 아니면 막는 응답을 돌려준다 (통과면 null).
export async function launchBlock(env, config, token) {
  const info = await launchInfo(env, config);
  if (!info.active) return null;
  if (await isLaunchAdmin(token)) return null;
  return { launch: true, at: info.at, error: `아직 오픈 전이다능! ${info.title} 시각이 되면 열린다능.` };
}
