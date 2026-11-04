// 운영용 기능: 일별 통계, 사용자 차단, 관리 기록(감사 로그), 시스템 점검, 공유 대화 관리, 사용량 초기화.
// 전부 RATE_LIMIT_KV 하나에 저장한다 (바인딩이 없으면 조용히 건너뛴다).
//
// 주의: Cloudflare KV는 무료 플랜에서 하루 쓰기 1,000회 제한이 있다. 통계는 채팅 한 번에
// 쓰기 1~2번(일별 합계 1번 + 그날 처음 보는 사용자면 1번)을 더 쓰므로, 사용자가 많으면 유료 플랜을 쓰거나
// 관리자 설정에서 통계를 꺼야 한다.

const DAY_MS = 24 * 60 * 60 * 1000;

export function kstDate(now = Date.now()) {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, "");
}

// ---------------- 일별 통계 ----------------
const statKey = (date) => `stats:${date}`;

// events 예: { chats: 1, "p:anthropic": 1, spent: 14 }. 같은 날 같은 키는 더해진다.
// 동시에 여러 요청이 오면 몇 개는 덮어써질 수 있는 "대략적인" 통계다.
export async function track(env, events, identity, isGuest) {
  if (!env.RATE_LIMIT_KV) return;
  try {
    const date = kstDate();
    const raw = await env.RATE_LIMIT_KV.get(statKey(date));
    const s = raw ? JSON.parse(raw) : {};
    for (const [k, v] of Object.entries(events)) s[k] = (Number(s[k]) || 0) + v;
    if (identity) {
      const seenKey = `seen:${date}:${identity}`;
      if (!(await env.RATE_LIMIT_KV.get(seenKey))) {
        await env.RATE_LIMIT_KV.put(seenKey, "1", { expirationTtl: 2 * 24 * 3600 });
        s.uniq = (Number(s.uniq) || 0) + 1;
        s[isGuest ? "uniqGuest" : "uniqMember"] = (Number(s[isGuest ? "uniqGuest" : "uniqMember"]) || 0) + 1;
      }
    }
    await env.RATE_LIMIT_KV.put(statKey(date), JSON.stringify(s), { expirationTtl: 40 * 24 * 3600 });
  } catch {}
}

export async function getStats(env, days = 7) {
  const out = [];
  if (!env.RATE_LIMIT_KV) return out;
  for (let i = 0; i < days; i++) {
    const date = kstDate(Date.now() - i * DAY_MS);
    let s = {};
    try {
      s = JSON.parse((await env.RATE_LIMIT_KV.get(statKey(date))) || "{}");
    } catch {}
    out.push({ date, ...s });
  }
  return out.reverse();
}

// ---------------- 사용자 차단 ----------------
const banKey = (identity) => `ban:${identity}`;

export async function getBan(env, identity) {
  if (!env.RATE_LIMIT_KV || !identity) return null;
  try {
    const raw = await env.RATE_LIMIT_KV.get(banKey(identity));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export async function addBan(env, identity, reason, by, days) {
  if (!env.RATE_LIMIT_KV) throw new Error("저장소(RATE_LIMIT_KV)가 설정되어 있지 않다능");
  if (!/^(uid|guest|ip):.{1,200}$/.test(identity || "")) throw new Error("신원 형식이 올바르지 않다능 (uid:… / guest:… / ip:…)");
  const until = Number(days) > 0 ? Date.now() + Number(days) * DAY_MS : 0;
  const rec = { reason: String(reason || "").slice(0, 100), by: by || "", at: Date.now(), until };
  const opts = until ? { expirationTtl: Math.max(60, Math.ceil((until - Date.now()) / 1000)) } : undefined;
  await env.RATE_LIMIT_KV.put(banKey(identity), JSON.stringify(rec), opts);
  return { identity, ...rec };
}
export async function removeBan(env, identity) {
  if (!env.RATE_LIMIT_KV) return;
  await env.RATE_LIMIT_KV.delete(banKey(identity));
}
export async function listBans(env) {
  if (!env.RATE_LIMIT_KV) return [];
  const page = await env.RATE_LIMIT_KV.list({ prefix: "ban:", limit: 200 });
  const items = await Promise.all(
    page.keys.map(async (k) => {
      try {
        return { identity: k.name.slice(4), ...JSON.parse((await env.RATE_LIMIT_KV.get(k.name)) || "{}") };
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean);
}

// ---------------- 관리 기록 (감사 로그) ----------------
const AUDIT_KEY = "audit:log";
export async function logAudit(env, admin, action, detail) {
  if (!env.RATE_LIMIT_KV) return;
  try {
    const list = JSON.parse((await env.RATE_LIMIT_KV.get(AUDIT_KEY)) || "[]");
    list.unshift({ at: Date.now(), by: admin?.email || admin?.uid || "?", action, detail: String(detail || "").slice(0, 200) });
    await env.RATE_LIMIT_KV.put(AUDIT_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {}
}
export async function listAudit(env) {
  if (!env.RATE_LIMIT_KV) return [];
  try {
    return JSON.parse((await env.RATE_LIMIT_KV.get(AUDIT_KEY)) || "[]");
  } catch {
    return [];
  }
}

// ---------------- 공유 대화 관리 ----------------
export async function listShares(env) {
  if (!env.RATE_LIMIT_KV) return [];
  const page = await env.RATE_LIMIT_KV.list({ prefix: "share:", limit: 100 });
  const items = await Promise.all(
    page.keys.map(async (k) => {
      try {
        const ref = JSON.parse((await env.RATE_LIMIT_KV.get(k.name)) || "null");
        if (!ref) return null;
        const conv = JSON.parse((await env.RATE_LIMIT_KV.get(`conv:${ref.uid}:${ref.id}`)) || "null");
        if (!conv) return null;
        return {
          shareId: k.name.slice(6),
          visibility: ref.visibility,
          title: conv.title,
          messages: conv.messages?.length || 0,
          preview: (conv.messages?.[0]?.content || "").slice(0, 60),
          updatedAt: conv.updatedAt,
          owner: `uid:${ref.uid}`,
        };
      } catch {
        return null;
      }
    })
  );
  return items.filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function revokeShare(env, shareId) {
  if (!env.RATE_LIMIT_KV || !/^[a-z0-9]{8,40}$/.test(shareId || "")) return false;
  const raw = await env.RATE_LIMIT_KV.get(`share:${shareId}`);
  if (!raw) return false;
  const ref = JSON.parse(raw);
  await env.RATE_LIMIT_KV.delete(`share:${shareId}`);
  try {
    const key = `conv:${ref.uid}:${ref.id}`;
    const conv = JSON.parse((await env.RATE_LIMIT_KV.get(key)) || "null");
    if (conv) {
      conv.visibility = "private";
      conv.shareId = null;
      await env.RATE_LIMIT_KV.put(key, JSON.stringify(conv));
    }
  } catch {}
  return true;
}

// ---------------- 신원 하나의 오늘 상태 초기화 ----------------
export async function resetTodayUsage(env, identity) {
  if (!env.RATE_LIMIT_KV) return 0;
  const date = kstDate();
  let n = 0;
  for (const p of ["builtin", "cloudflare", "anthropic", "openai", "gemini"]) {
    const key = `usage:${p}:${date}:${identity}`;
    if (await env.RATE_LIMIT_KV.get(key)) {
      await env.RATE_LIMIT_KV.delete(key);
      n++;
    }
  }
  return n;
}
export async function resetRefillState(env, identity) {
  if (env.RATE_LIMIT_KV) await env.RATE_LIMIT_KV.delete(`refill:${identity}`);
}

// ---------------- 시스템 점검 ----------------
export async function runHealth(env, extra = {}) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const onVercel = env.PLATFORM === "vercel";
  add("배포 환경", true, onVercel ? "Vercel (저장소=Upstash/Vercel KV, Cloudflare 두뇌=REST API)" : "Cloudflare Workers");
  const g = !!(env.BBALD_PROXY_SECRET || env.BBALD_ALLOWED_HOSTS);
  add("원본(dev) 주소 차단", g, g ? `켜짐 — 정식 주소 ${env.BBALD_CANONICAL_URL || "https://www.ramalok.kr/bbald_ai"} 로 안내/이동` : "꺼져 있어요. BBALD_PROXY_SECRET 또는 BBALD_ALLOWED_HOSTS를 설정하면 *.workers.dev / *.vercel.app 직접 접속을 막고 정식 주소로 이동시켜요 (DEPLOY.md 참고).");
  if (!env.RATE_LIMIT_KV) add("KV 저장소(RATE_LIMIT_KV)", false, onVercel ? "UPSTASH_REDIS_REST_URL/TOKEN(또는 KV_REST_API_URL/TOKEN) 환경변수가 없어요 — 크레딧·대화·설정이 저장되지 않아요." : "바인딩이 없어요. wrangler.toml의 kv_namespaces를 확인하세요 — 크레딧·대화·설정이 저장되지 않아요.");
  else {
    try {
      const k = `health:${Date.now()}`;
      await env.RATE_LIMIT_KV.put(k, "1", { expirationTtl: 60 });
      const v = await env.RATE_LIMIT_KV.get(k);
      await env.RATE_LIMIT_KV.delete(k);
      add("KV 저장소(RATE_LIMIT_KV)", v === "1", v === "1" ? "읽기/쓰기 정상" : "쓴 값을 읽지 못했어요");
    } catch (e) {
      add("KV 저장소(RATE_LIMIT_KV)", false, `오류: ${e.message}`);
    }
  }
  add("Workers AI(Cloudflare 두뇌)", !!env.AI, env.AI ? "연결됨 — Cloudflare 두뇌 사용 가능" : onVercel ? "CF_ACCOUNT_ID / CF_API_TOKEN 환경변수가 없어요. Cloudflare 두뇌만 꺼져요 (빨드 기본·Claude·ChatGPT·Gemini는 정상)." : "바인딩이 없어요. Cloudflare 두뇌는 쓸 수 없어요.");
  if (!onVercel) add("정적 파일(ASSETS 바인딩)", !!env.ASSETS, env.ASSETS ? "연결됨" : "바인딩이 없어요");
  add("선택 환경변수 WORKERS_AI_MODEL", true, env.WORKERS_AI_MODEL ? `지정됨: ${env.WORKERS_AI_MODEL}` : "없음 (기본 모델 후보를 순서대로 시도해요)");

  // 메인 사이트(PAL) 연동
  try {
    const r = await fetch("https://www.ramalok.kr/api/billing", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => null);
    if (j?.error === "missing_token") add("PAL 통합 요금제 API", true, "연결됨 (/api/billing 응답 정상)");
    else if (j?.error === "server_misconfigured") add("PAL 통합 요금제 API", false, `메인 사이트 환경변수 미설정: ${(j.missing || []).join(", ")}`);
    else add("PAL 통합 요금제 API", false, `예상 못한 응답 (HTTP ${r.status})`);
  } catch (e) {
    add("PAL 통합 요금제 API", false, `연결 실패: ${e.message}`);
  }
  try {
    const r = await fetch("https://pal-inte-db-default-rtdb.asia-southeast1.firebasedatabase.app/plans.json?shallow=true");
    add("PAL 요금제 목록(Realtime Database)", r.ok, r.ok ? "읽기 정상" : `HTTP ${r.status} — 규칙(plans 읽기)이 배포됐는지 확인하세요`);
  } catch (e) {
    add("PAL 요금제 목록(Realtime Database)", false, `연결 실패: ${e.message}`);
  }
  return { checks, ...extra, time: new Date().toISOString() };
}
