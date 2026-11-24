// 회귀 점검: node test/regression.mjs  (외부 접속 없이 모의 KV/모의 fetch로 서버 전체를 훑는다)
import worker from "../src/worker.js";

let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { if (c) pass++; else { fail++; console.log("❌", name, extra); } };

const kv = new Map();
const KV = {
  get: async (k) => (kv.has(k) ? kv.get(k) : null),
  put: async (k, v) => { kv.set(k, String(v)); },
  delete: async (k) => { kv.delete(k); },
  list: async ({ prefix = "", limit = 1000 } = {}) => ({ keys: [...kv.keys()].filter((k) => k.startsWith(prefix)).slice(0, limit).map((name) => ({ name })), list_complete: true }),
};
const env = { RATE_LIMIT_KV: KV, ASSETS: { fetch: async (r) => new Response("PAGE", { status: 200 }) } };
const ctx = { waitUntil: (p) => p };

const calls = [];
let providerMode = "ok";
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const body = init.body ? (() => { try { return JSON.parse(init.body); } catch { return init.body; } })() : null;
  calls.push({ url, body, headers: init.headers });
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (url.includes("identitytoolkit")) return J({ users: [{ localId: body.idToken === "admin" ? "adm" : "usr", email: body.idToken + "@x.y" }] });
  if (url.includes("/admins/adm.json")) return J(true);
  if (url.includes("/admins/")) return J(null);
  if (url.includes("firebasedatabase.app/plans")) return J({});
  if (url.includes("ramalok.kr/api/billing")) return J({ error: "missing_token" }, 401);
  if (url.includes("api.anthropic.com")) {
    if (providerMode === "auth") return J({ error: { type: "authentication_error", message: "bad key" } }, 401);
    return J({ content: [{ type: "text", text: "클로드 답" }], stop_reason: "end_turn" });
  }
  if (url.includes("api.openai.com")) {
    if (providerMode === "quota") return J({ error: { code: "insufficient_quota", message: "quota" } }, 429);
    return J({ choices: [{ message: { content: "오픈AI 답" } }] });
  }
  if (url.includes("generativelanguage.googleapis.com")) {
    if (providerMode === "overloaded") return J({ error: { message: "overloaded" } }, 503);
    return J({ candidates: [{ content: { parts: [{ text: "제미나이 답" }] }, finishReason: "STOP" }] });
  }
  return J({});
};

const req = (path, { method = "GET", body, headers = {} } = {}) =>
  worker.fetch(new Request("https://www.ramalok.kr" + path, { method, headers: { "content-type": "application/json", "x-guest-id": "guestguestguest01", "cf-connecting-ip": "1.1.1.1", ...headers }, body: body ? JSON.stringify(body) : undefined }), env, ctx);
const admin = (path, o = {}) => req("/api/admin/" + path, { ...o, headers: { "x-admin-token": "admin", ...(o.headers || {}) } });
const jsonOf = async (r) => { try { return await r.json(); } catch { return null; } };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
let d2;
const chat = (b, h) => req("/api/chat", { method: "POST", body: { message: "안녕", provider: "builtin", model: "basic", ...b }, headers: h });

// ---- 기본 ----
let r = await req("/api/config/public"); ok(r.status === 200, "공개 설정");
r = await req("/api/time"); ok(r.status === 200, "time");
r = await chat({}); let d = await jsonOf(r); ok(r.status === 200 && d.reply, "기본 채팅", JSON.stringify(d));
r = await chat({ message: "" }); ok(r.status === 400, "빈 메시지 400");
r = await chat({ message: "가".repeat(3000) }); ok(r.status === 400, "긴 메시지 400");
r = await req("/api/credits"); ok(r.status === 200, "credits 조회");

await admin("config", { method: "POST", body: { startingCredits: 100000, startingCreditsGuest: 100000, costs: { builtin: 1, cloudflare: 1, anthropic: 1, openai: 1, gemini: 1 }, imageCost: 0, refillMaxPer24h: 5 } });
// ---- 이미지 (게스트는 기본 금지 → 회원 토큰으로) ----
r = await chat({ images: [{ dataUrl: PNG }] }); ok(r.status === 403, "게스트 이미지 거부", r.status);
const M = { uid: "usr", idToken: "usr" };
r = await chat({ ...M, images: [{ dataUrl: PNG }] }); d = await jsonOf(r); ok(r.status === 200 && /사진/.test(d.reply), "빨드 기본 이미지", JSON.stringify(d));
r = await chat({ ...M, images: [{ dataUrl: "data:image/heic;base64,AAAA" }] }); ok(r.status === 400, "HEIC 거부");
r = await chat({ ...M, images: [{ dataUrl: "https://evil/x.png" }] }); ok(r.status === 400, "URL 이미지 거부");
r = await chat({ ...M, images: [{ dataUrl: "data:text/html;base64,AAAA" }] }); ok(r.status === 400, "html 거부");
r = await chat({ ...M, images: [{ dataUrl: "data:image/png;base64," + "A".repeat(7_100_000) }] }); ok(r.status === 413, "큰 이미지 413", r.status);
r = await chat({ ...M, images: Array(6).fill({ dataUrl: PNG }) }); ok(r.status === 400, "장수 초과");
r = await chat({ ...M, message: "", images: [{ dataUrl: PNG }] }); ok(r.status === 200, "글 없이 이미지만");

// ---- 모든 제공자 이미지 ----
for (const [prov, key, hostPart, want] of [["anthropic", "k", "api.anthropic.com", "클로드 답"], ["openai", "k", "api.openai.com", "오픈AI 답"], ["gemini", "k", "generativelanguage", "제미나이 답"]]) {
  calls.length = 0;
  r = await chat({ ...M, provider: prov, apiKey: key, message: "이거 뭐야", images: [{ dataUrl: PNG }, { dataUrl: PNG }] }); d = await jsonOf(r);
  ok(r.status === 200 && d.reply?.includes(want), `${prov} 이미지 성공`, JSON.stringify(d));
  const c = calls.find((x) => x.url.includes(hostPart) && x.body && typeof x.body === "object" && !x.url.includes("/models?") );
  const s = JSON.stringify(c?.body || {});
  const n = prov === "anthropic" ? (s.match(/"type":"image"/g) || []).length : prov === "openai" ? (s.match(/image_url/g) || []).length / 2 : (s.match(/inlineData/g) || []).length;
  ok(n === 2, `${prov} 요청에 이미지 2장`, s.slice(0, 200));
  r = await chat({ ...M, provider: prov, apiKey: key, message: "", images: [{ dataUrl: PNG }] }); ok(r.status === 200, `${prov} 글 없이 이미지`);
  r = await chat({ ...M, provider: prov, message: "hi" }); ok(r.status === 400, `${prov} 키 없으면 400`, r.status);
}
providerMode = "auth"; r = await chat({ ...M, provider: "anthropic", apiKey: "bad" }); d = await jsonOf(r); ok(r.status === 400 && d.errorKind === "auth", "claude 인증 오류 400/auth", JSON.stringify(d));
providerMode = "quota"; r = await chat({ ...M, provider: "openai", apiKey: "k" }); d = await jsonOf(r); ok(r.status === 429, "openai 한도 429", JSON.stringify(d));
providerMode = "overloaded"; r = await chat({ ...M, provider: "gemini", apiKey: "k" }); d = await jsonOf(r); ok(r.status === 503, "gemini 과부하 503", JSON.stringify(d));
providerMode = "ok";

// ---- 대화 저장(이미지 포함) ----
{
  const JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
  const save = (b) => req("/api/conversations", { method: "POST", body: b, headers: { "x-user-token": "usr" } });
  r = await save({ messages: [{ role: "user", content: "사진", images: [JPG, "https://evil/x.png", "data:text/html;base64,AA", JPG] }, { role: "assistant", content: "ok", images: [JPG] }] });
  d = await jsonOf(r); ok(r.status === 200 && d.messages[0].images?.length === 2, "저장 시 이미지 정리", JSON.stringify(d).slice(0, 160));
  r = await req("/api/conversations/" + d.id, { headers: { "x-user-token": "usr" } }); const got = await jsonOf(r);
  ok(got.messages[0].images?.length === 2 && got.messages[0].images[0] === JPG, "다시 열면 이미지 유지");
  r = await save({ id: d.id, messages: [{ role: "user", content: "큰 것", images: ["data:image/jpeg;base64," + "A".repeat(700000)] }] }); d2 = await jsonOf(r);
  ok(d2.messages[0].images === undefined, "너무 큰 이미지는 저장 안 함");
  r = await req(`/api/conversations/${d.id}/share`, { method: "POST", body: { visibility: "link" }, headers: { "x-user-token": "usr" } }); const sh = await jsonOf(r);
  if (sh?.shareId) { r = await req("/api/share/" + sh.shareId); const sd = await jsonOf(r); ok(r.status === 200 && !JSON.stringify(sd).includes("base64"), "공유 화면엔 이미지 제외", JSON.stringify(sd).slice(0,100)); }
  else ok(false, "공유 생성", JSON.stringify(sh));
}

// ---- 관리자 ----
r = await req("/api/admin/me"); ok(r.status === 403, "토큰 없으면 관리자 403");
r = await admin("me", { headers: { "x-admin-token": "usr" } }); ok(r.status === 403, "일반 회원 관리자 403");
for (const p of ["me", "config", "stats?days=7", "bans", "shares", "audit", "health", "debug/access", "list", "lookup?identity=guest:guestguestguest01"]) {
  r = await admin(p); ok(r.status === 200, `admin GET ${p}`, r.status);
}
r = await admin("config", { method: "POST", body: { costs: { builtin: 1 }, think: { minSec: 3, maxSec: 9 }, limits: { maxImages: 2 }, customReplies: [{ keywords: ["붕붕"], replies: ["부릉부릉"] }], notices: [{ id: "a", title: "공지", body: "내용" }] } });
d = await jsonOf(r); ok(r.status === 200 && d.limits.maxImages === 2 && d.customReplies.length === 1, "설정 저장", JSON.stringify(d).slice(0, 120));
r = await chat({ message: "붕붕" }); d = await jsonOf(r); ok(d.reply?.includes("부릉부릉"), "맞춤 답변 적용", JSON.stringify(d));
r = await chat({ ...M, images: Array(3).fill({ dataUrl: PNG }) }); ok(r.status === 400, "maxImages=2 적용");
r = await admin("config", { method: "POST", body: { limits: { maxImages: 4 } } });
r = await admin("filter-test", { method: "POST", body: { text: "시발" } }); d = await jsonOf(r); ok(r.status === 200 && d.blocked, "필터 테스트", JSON.stringify(d));
r = await chat({ message: "시발 뭐야" }); d = await jsonOf(r); ok(d.filtered === true, "비속어 차단");
r = await admin("bans/add", { method: "POST", body: { identity: "guest:guestguestguest01", reason: "test", days: 1 } }); ok(r.status === 200, "차단 추가");
r = await chat({}); ok(r.status === 403, "차단된 사용자 거부");
r = await admin("bans"); d = await jsonOf(r); ok(d.items.length === 1, "차단 목록");
r = await admin("bans/remove", { method: "POST", body: { identity: "guest:guestguestguest01" } }); r = await chat({}); ok(r.status === 200, "차단 해제 후 채팅");
r = await admin("identity/reset", { method: "POST", body: { identity: "guest:guestguestguest01", what: "usage" } }); ok(r.status === 200, "사용량 초기화");
r = await admin("adjust", { method: "POST", body: { identity: "guest:guestguestguest01", delta: 5 } }); ok(r.status === 200, "크레딧 조정");
r = await admin("stats?days=3"); d = await jsonOf(r); ok(d.days.some((x) => x.chats > 0), "통계 기록됨", JSON.stringify(d).slice(0, 150));
r = await admin("audit"); d = await jsonOf(r); ok(d.items.length > 2, "감사 로그");

// ---- 점검 모드 ----
r = await admin("config", { method: "POST", body: { maintenance: { enabled: true, message: "점검 중!" } } }); ok(r.status === 200, "점검 켜기");
r = await req("/api/config/public"); d = await jsonOf(r); ok(d.maintenance?.enabled === true, "공개 설정에 점검 표시", JSON.stringify(d.maintenance));
r = await chat({}); d = await jsonOf(r); ok(r.status === 503 && d.maintenance === true && d.error === "점검 중!", "점검 중 채팅 503", JSON.stringify(d));
r = await chat({ ...M, provider: "gemini", apiKey: "k" }); ok(r.status === 503, "점검 중 외부 AI도 막힘");
r = await req("/api/bonus", { method: "POST", body: { type: "sticker" } }); ok(r.status === 503, "점검 중 보너스 막힘");
r = await admin("me"); ok(r.status === 200, "점검 중에도 관리자 접근 가능");
r = await admin("config", { method: "POST", body: { maintenance: { enabled: false } } });
r = await chat({}); ok(r.status === 200, "점검 끄면 채팅 재개");

// ---- 설정 초기화 ----
r = await admin("config/reset", { method: "POST", body: {} }); d = await jsonOf(r); ok(r.status === 200 && d.maintenance.enabled === false && d.customReplies.length === 0, "설정 초기화");

// ---- 접근 가드 ----
const g = { ...env, BBALD_PROXY_SECRET: "s", BBALD_ALLOWED_HOSTS: "www.ramalok.kr" };
let gr = await worker.fetch(new Request("https://bbald-ai.ramalok.workers.dev/api/time"), g, ctx); ok(gr.status === 403, "직접 접속 차단");
gr = await worker.fetch(new Request("https://bbald-ai.ramalok.workers.dev/api/time", { headers: { "x-bbald-proxy": "s" } }), g, ctx); ok(gr.status === 200, "비밀 헤더 통과");
gr = await worker.fetch(new Request("https://www.ramalok.kr/bbald_ai/api/time"), g, ctx); ok(gr.status === 200, "/bbald_ai 접두사 처리");

console.log(`\n통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
