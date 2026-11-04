import {
  getSmartInfo,
  tryDumbMathOverride,
  buildSystemPrompt,
  applyPersonaFlourish,
  maybeSnackLine,
  builtinReply,
} from "./bbald.js";
import { callAnthropic, callOpenAI, callGemini, callCloudflareAI, ProviderError, httpStatusFor } from "./providers.js";
import { checkAndConsumeDailyLimit, getUsageSummary } from "./rate-limit.js";
import {
  resolveIdentity,
  getBalance,
  getBalanceWithRefill,
  markSpent,
  spendCredits,
  claimSignupBonus,
  claimStickerBonus,
  adminAdjustBalance,
  adminSetBalance,
  listCreditIdentities,
} from "./credits.js";
import { getConfig, setConfig, resetConfig, publicConfig } from "./config.js";
import { checkAccess, blockedResponse } from "./guard.js";
import { findBadWord, maskBadWords } from "./filter.js";
import {
  track,
  getStats,
  getBan,
  addBan,
  removeBan,
  listBans,
  logAudit,
  listAudit,
  listShares,
  revokeShare,
  resetTodayUsage,
  resetRefillState,
  runHealth,
} from "./ops.js";
import { requireAdmin } from "./admin.js";
import { verifyIdToken } from "./firebase-verify.js";
import {
  listConversations,
  getConversation,
  saveConversation,
  deleteConversation,
  setVisibility,
  getSharedConversation,
  CONV_ID_RE,
} from "./conversations.js";
import {
  getUnified,
  spendUnified,
  redeemUnifiedCoupon,
  computeEffectiveDailyLimits,
} from "./billing.js";

// provider 기본 비용 + 모델별 배율. "모델/AI별로 사용량이 다르게 빨리
// 줄어들게 해달라"는 요청 반영 — 더 똑똑한(비싼) 모델일수록 더 많이 깎는다.
// 모델 상세 정보(실제 API 모델 id, 비용 배율, 로그인 필요 여부)는 provider별로 묶어둔다.
// 모든 AI(빨드 기본/Cloudflare/Claude/ChatGPT/Gemini)가 똑같은 4단계 모델을 갖는다.
// 클라이언트는 단계 키(lite/basic/deep/story)만 보내고, 실제로 어떤 모델이 불려가는지는
// 여기서 provider별로 정한다 — 비용 배율·로그인 필요 여부·말투 힌트는 전부 단계 기준이라
// 어느 AI를 골라도 똑같다.
const TIERS = {
  lite: { hint: "짧고 간단하게, 핵심만 가볍게 답해라." },
  basic: { hint: "" },
  deep: { hint: "차근차근 깊게 생각해서 조금 더 자세히 답해라." },
  story: { hint: "이야기하듯 생생하고 표현력 풍부하게 답해라." },
};
const MODEL_IDS = {
  anthropic: { lite: "haiku-4.5", basic: "sonnet-5", deep: "opus-5.5", story: "fable-5.1" },
  openai: { lite: "gpt-5.1-mini", basic: "gpt-5.1", deep: "gpt-5.1-pro", story: "gpt-5.1-creative" },
  gemini: {
    lite: "gemini-3.8-flash-lite", basic: "gemini-3.8-flash", deep: "gemini-3.8-pro", story: "gemini-3.8-pro-creative",
  },
  cloudflare: {
    lite: "@cf/meta/llama-3.1-8b-instruct-fast",
    basic: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    deep: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    story: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  },
  builtin: {},
};
function normalizeTier(t) {
  return TIERS[t] ? t : "basic";
}
// 크레딧이 줄어드는 속도는 관리자 설정(config.costs × config.tierMult + 이미지당 imageCost)이다.
function computeCost(config, provider, tier, imageCount = 0) {
  const base = config.costs[provider] ?? 8;
  return Math.max(1, Math.round(base * config.tierMult[normalizeTier(tier)])) + imageCount * config.imageCost;
}
function isMemberOnlyModel(config, tier) {
  return config.memberOnlyTiers[normalizeTier(tier)] === true;
}

// 게스트는 IP가 아니라 브라우저가 만든 고유 ID(x-guest-id)로 구분한다 — IP로만 구분하면 같은
// 와이파이/통신사 망을 쓰는 사람들이 잔액을 같이 쓰게 된다. 대신 저장소를 지워 새 ID로 크레딧을
// 계속 새로 받는 걸 막으려고, 같은 IP에서 하루에 새로 만들 수 있는 게스트 ID 수를 제한하고
// 넘으면 예전처럼 IP 기준 신원(공유)으로 되돌린다.
const GUEST_ID_RE = /^[A-Za-z0-9-]{16,64}$/;
const MAX_NEW_GUEST_IDS_PER_IP_PER_DAY = 20;
async function guestIdentity(request, env, ipIdentity) {
  const gid = request.headers.get("x-guest-id") || "";
  if (!GUEST_ID_RE.test(gid) || !env.RATE_LIMIT_KV) return ipIdentity;
  const identity = `guest:${gid}`;
  try {
    if (await env.RATE_LIMIT_KV.get(`guestseen:${gid}`)) return identity;
    const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const countKey = `guestnew:${ipIdentity}:${day}`;
    const count = Number(await env.RATE_LIMIT_KV.get(countKey)) || 0;
    if (count >= MAX_NEW_GUEST_IDS_PER_IP_PER_DAY) return ipIdentity;
    await env.RATE_LIMIT_KV.put(countKey, String(count + 1), { expirationTtl: 2 * 24 * 3600 });
    await env.RATE_LIMIT_KV.put(`guestseen:${gid}`, "1", { expirationTtl: 90 * 24 * 3600 });
  } catch {
    return ipIdentity;
  }
  return identity;
}

// 요청 한 건의 계정 상태. 회원(검증된 Firebase ID 토큰)이면 로컬(KV) 기본 크레딧에
// PAL 통합 크레딧(billing/{uid})을 합쳐서 한 잔액으로 보여주고, 요금제가 무료가
// 아니면 하루 제한도 늘려준다. 토큰이 없거나 uid와 안 맞으면 게스트로 취급한다.
async function getAccount(request, env, config, uid, idToken) {
  let verifiedUid = null;
  if (uid && idToken) {
    const u = await verifyIdToken(idToken);
    if (u && u.uid === uid) verifiedUid = u.uid;
  }
  let identity = resolveIdentity(request, verifiedUid);
  if (!verifiedUid) identity = await guestIdentity(request, env, identity);
  if (!verifiedUid) {
    const cap = config.startingCreditsGuest;
    const { balance: local, refill } = await getBalanceWithRefill(env, identity, cap, config.refillIntervalMin, config.refillMaxPer24h);
    return {
      isGuest: true, identity, idToken: null, localCap: cap, local, unified: null, refill,
      cap, balance: local, dailyLimits: config.dailyLimitsGuest, plan: { id: "free", name: "무료" },
    };
  }
  const localCap = config.startingCredits;
  const [{ balance: local, refill }, unified] = await Promise.all([
    getBalanceWithRefill(env, identity, localCap, config.refillIntervalMin, config.refillMaxPer24h),
    getUnified(idToken),
  ]);
  return {
    isGuest: false, identity, idToken, localCap, local, unified, refill,
    // cap은 "이만큼까지 찰 수 있다"는 게이지 기준: 로컬 기본 + (요금제 지급량 또는 실제 통합 크레딧 중 큰 쪽).
    // 잔액(local + 통합)이 항상 cap 이하라서 "135/100" 같은 표시가 안 나온다.
    cap: localCap + Math.max(unified.plan.credits, unified.credits),
    balance: local + unified.credits,
    dailyLimits: computeEffectiveDailyLimits(config.dailyLimits, unified, config.paidDailyMultiplier),
    plan: unified.plan,
  };
}

// 비용은 로컬 크레딧부터 쓰고, 모자란 만큼을 PAL 통합 크레딧에서 뺀다.
async function spendAccount(env, acct, cost) {
  const fromLocal = Math.min(acct.local, cost);
  const rest = cost - fromLocal;
  if (rest > 0) {
    const r = await spendUnified(acct.idToken, rest);
    if (!r.ok) return { ok: false, balance: acct.balance };
  }
  if (fromLocal > 0) {
    await spendCredits(env, acct.identity, fromLocal, acct.localCap);
    await markSpent(env, acct.identity);
  }
  return { ok: true, balance: acct.balance - cost };
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) },
  });
}

// 이 함수 안에서 무슨 일이 생기든(레이트리밋 KV 오류, 예상 못한 예외 등)
// 절대 JSON이 아닌 응답(=플랫폼 기본 에러 페이지)이 나가면 안 된다. 그게 나가면
// 클라이언트의 res.json()이 실패해서 "인터넷이 끊겼다능" 같은 엉뚱한 메시지만
// 뜨고 진짜 원인을 알 수 없게 되기 때문에, 맨 바깥을 한 번 더 try/catch로 감싼다.
async function handleChat(request, env, ctx) {
  try {
    return await handleChatInner(request, env, ctx);
  } catch (err) {
    return json({ error: `빨드한테 예상 못한 문제가 생겼다능... (${err?.message || err})` }, { status: 500 });
  }
}

async function handleChatInner(request, env, ctx) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "잘못된 요청 형식이다능" }, { status: 400 });
  }

  let {
    message = "",
    history = [],
    provider = "builtin",
    model = "basic", // 단계 키: lite | basic | deep | story
    apiKey = "",
    uid = null, // Firebase 로그인 사용자면 uid, 아니면 null(게스트는 IP로 식별)
    images = [], // [{ dataUrl, mimeType }] — 이미지 여러 장 첨부 가능
    // 구글 로그인 시 받은 OAuth 액세스 토큰(Generative Language API 스코프 포함).
    // 있으면 제미나이를 API 키 입력 없이 그 구글 계정 자체의 권한/크레딧으로 호출한다.
    googleAccessToken = null,
    // 로그인한 사용자의 Firebase ID 토큰. 검증돼야 회원으로 인정하고 PAL 통합
    // 요금제·크레딧을 쓴다 (없거나 uid와 안 맞으면 게스트).
    idToken = null,
  } = body;
  const hasImages = Array.isArray(images) && images.length > 0;

  if ((typeof message !== "string" || !message.trim()) && !hasImages) {
    return json({ error: "메시지가 비어있다능!" }, { status: 400 });
  }

  const config = await getConfig(env);
  // 통계는 응답을 늦추지 않게 백그라운드로 기록한다.
  const bg = (p) => (ctx?.waitUntil ? ctx.waitUntil(p) : p);

  // 관리자가 정한 요청 제한
  if (typeof message === "string" && message.length > config.limits.maxMessageChars) {
    return json({ error: `메시지가 너무 길다능! ${config.limits.maxMessageChars}자까지만 보낼 수 있다능` }, { status: 400 });
  }
  if (hasImages && images.length > config.limits.maxImages) {
    return json({ error: `이미지는 한 번에 ${config.limits.maxImages}장까지만 보낼 수 있다능` }, { status: 400 });
  }
  if (config.providersEnabled[provider] === false) {
    return json({ error: "지금은 이 AI를 쓸 수 없다능! 다른 AI를 골라달라능 🛠️" }, { status: 403 });
  }
  history = Array.isArray(history) && config.limits.historyTurns > 0 ? history.slice(-config.limits.historyTurns) : [];

  // 욕설·비속어 필터: block이면 AI를 부르지도 크레딧을 쓰지도 않고 빨드가 타일러 돌려보낸다.
  // mask면 금지어를 ***로 가려서 그대로 진행한다.
  if (typeof message === "string" && config.filter.enabled) {
    const bad = findBadWord(message, config.filter);
    if (bad) {
      if (config.filter.action === "block") {
        if (config.statsEnabled) bg(track(env, { filtered: 1 }));
        return json({
          reply: "앗, 그런 말은 빨드가 못 알아듣겠다능... 예쁜 말로 다시 말해줄래? 🦕💕",
          filtered: true,
          snack: false,
        });
      }
      message = maskBadWords(message, config.filter);
    }
  }

  const acct = await getAccount(request, env, config, uid, idToken);
  const { isGuest, identity } = acct;
  const effectiveCap = acct.cap;
  const effectiveDailyLimits = acct.dailyLimits;

  const ban = await getBan(env, identity);
  if (ban && (!ban.until || ban.until > Date.now())) {
    return json({ error: `이용이 제한된 계정이다능${ban.reason ? ` (${ban.reason})` : ""}. 문의가 필요하면 관리자에게 알려달라능`, banned: true }, { status: 403 });
  }
  const bgTrack = (events) => { if (config.statsEnabled) bg(track(env, events, identity, isGuest)); };

  const smart = getSmartInfo();
  const { isSmart, sunsetLabel } = smart;
  const level = config.prompt.sunsetMode ? smart.level : 0; // 노을 효과를 끄면 항상 멍청 모드
  const tier = normalizeTier(model);
  const realModel = MODEL_IDS[provider]?.[tier];
  const cost = computeCost(config, provider, tier, hasImages ? images.length : 0);

  if (config.maintenance?.enabled) {
    return json(
      {
        reply: config.maintenance.message,
        credits: acct.balance,
        cap: effectiveCap,
        isSmart,
        snack: false,
        maintenance: true,
      },
      { status: 503 }
    );
  }

  // 게스트 기능 제한: 이미지 첨부, 고급 모델(딥씽킹/스토리)은 로그인해야 쓸 수 있다.
  if (isGuest && hasImages && !config.guestImages) {
    return json({ error: "이미지 첨부는 로그인하면 쓸 수 있다능! 게스트는 아직 안 된다능 🔒" }, { status: 403 });
  }
  if (isGuest && isMemberOnlyModel(config, tier)) {
    return json({ error: "그 두뇌는 로그인해야 빌릴 수 있다능! 게스트는 라이트/기본만 쓸 수 있어 🔒" }, { status: 403 });
  }

  // 크레딧은 서버(KV)가 유일한 출처다 — 클라이언트가 뭐라고 보내든 무시하고
  // 서버에 저장된 실제 잔액만 본다. (예전엔 클라이언트가 보낸 숫자를 그대로
  // 믿고 차감만 해서, 설정 화면에서 숫자를 직접 입력하면 무한 충전이 가능했음)
  const currentBalance = acct.balance;

  if (currentBalance < cost) {
    bgTrack({ outOfCredits: 1 });
    const wait = acct.refill?.nextAt ? Math.max(1, Math.ceil((acct.refill.nextAt - Date.now()) / 60000)) : null;
    const when = wait ? ` ${wait >= 60 ? `${Math.floor(wait / 60)}시간 ${wait % 60}분` : `${wait}분`} 뒤에 다시 충전된다능!` : "";
    return json({
      reply: isGuest
        ? `사용량이 다 떨어졌다능... 로그인하면 더 쓸 수 있다능!${when} 🦕`
        : `사용량이 다 떨어졌다능...${when || " 조금 있다 다시 놀아달라능!"} 🦕`,
      credits: currentBalance,
      cap: effectiveCap,
      refill: acct.refill,
      isSmart,
      snack: false,
      outOfCredits: true,
    });
    // (통계는 아래에서 기록)
  }

  // 아주 쉬운 사칙연산은 빨드의 개그 두뇌가 직접 처리 (진짜 AI 호출 없이, 크레딧 절약!)
  const mathOverride = !hasImages && tryDumbMathOverride(message, level);
  if (mathOverride) {
    return json({
      reply: mathOverride,
      credits: currentBalance, // 계산은 공짜! 빨드가 직접 (잘못) 계산했으니까
      cap: effectiveCap,
      isSmart,
      snack: false,
      provider: "builtin-math",
    });
  }

  // 하루 사용량 제한 (RATE_LIMIT_KV가 설정돼 있을 때만 실제로 막는다).
  // KV 쪽에 문제가 생겨도(바인딩 오류 등) 채팅 자체는 막히면 안 되므로, 실패하면
  // "제한 없음"으로 취급하고 그냥 통과시킨다.
  let limitCheck;
  try {
    limitCheck = await checkAndConsumeDailyLimit(env, identity, provider, effectiveDailyLimits);
  } catch (err) {
    limitCheck = { allowed: true, remaining: null, limit: null, enabled: false };
  }
  if (!limitCheck.allowed) {
    bgTrack({ dailyLimitHit: 1 });
    return json(
      {
        reply: isGuest
          ? "오늘 빨드가 너무 말을 많이 했다능! 게스트는 여기까지... 로그인하면 더 놀 수 있다능! 🌙🦕"
          : "오늘 빨드가 너무 말을 많이 했다능! 하루 사용량을 다 썼어... 내일 다시 놀아달라능! 🌙🦕",
        credits: currentBalance,
        cap: effectiveCap,
        isSmart,
        snack: false,
        dailyLimitReached: true,
      },
      { status: 429 }
    );
  }

  const systemPrompt = [buildSystemPrompt(level), TIERS[tier].hint, config.prompt.extra].filter(Boolean).join("\n");
  const maxTokens = config.limits.maxTokens;
  let reply;
  try {
    if (provider === "builtin" || provider === "cloudflare") {
      // 빨드 기본 두뇌 / Cloudflare Workers AI는 진짜 이미지 분석은 안 하고 귀엽게 반응만 한다.
      if (hasImages && provider === "builtin") {
        reply =
          images.length > 1
            ? "오오 사진이 여러 장이다! 근데 빨드는 그림이 뭔지 잘 모르겠다능... 그래도 다 이쁘다능! 🦕🖼️"
            : "오오 사진이다! 근데 빨드는 그림이 뭔지 잘 모르겠다능... 그래도 이쁘다능! 🦕🖼️";
      } else if (provider === "builtin") {
        reply = builtinReply(message, { history, custom: config.customReplies });
      } else {
        reply = await callCloudflareAI({
          env,
          model: realModel,
          maxTokens,
          systemPrompt,
          history,
          message: hasImages
            ? `${message}\n(사용자가 이미지를 ${images.length}장 첨부했지만 너는 이미지를 볼 수 없으니, 궁금해하는 티만 내며 귀엽게 반응해라)`
            : message,
        });
      }
    } else if (provider === "anthropic") {
      if (!apiKey) return json({ error: "클로드 API 키를 설정에 넣어달라능!" }, { status: 400 });
      reply = await callAnthropic({ apiKey, tier, model: realModel, maxTokens, systemPrompt, history, message, images });
    } else if (provider === "openai") {
      if (!apiKey) return json({ error: "챗지피티 API 키를 설정에 넣어달라능!" }, { status: 400 });
      reply = await callOpenAI({ apiKey, tier, model: realModel, maxTokens, systemPrompt, history, message, images });
    } else if (provider === "gemini") {
      if (!apiKey && !googleAccessToken) {
        return json({ error: "제미나이 API 키를 설정에 넣거나, 구글 로그인을 해달라능!" }, { status: 400 });
      }
      reply = await callGemini({ apiKey, accessToken: googleAccessToken, tier, model: realModel, maxTokens, systemPrompt, history, message, images });
    } else {
      return json({ error: "알 수 없는 provider다능" }, { status: 400 });
    }
  } catch (err) {
    bgTrack({ errors: 1, [`err:${provider}`]: 1, ...(err instanceof ProviderError ? { [`errk:${err.kind}`]: 1 } : {}) });
    if (err instanceof ProviderError) {
      // 종류별로 사용자가 뭘 고치면 되는지 알려주고, 상태 코드도 의미에 맞게(키 오류 400, 한도 429, 바쁨 503 …) 돌려준다.
      return json({ error: err.message, errorKind: err.kind, upstreamStatus: err.status || undefined }, { status: httpStatusFor(err) });
    }
    return json({ error: `빨드가 넘어졌다능... (${err.message})` }, { status: 502 });
  }

  reply = applyPersonaFlourish(reply, level);
  if (config.filter.enabled) reply = maskBadWords(reply, config.filter);
  const spend = await spendAccount(env, acct, cost);
  if (!spend.ok) {
    return json({
      reply: "통합 크레딧을 쓰는 데 실패했다능... 크레딧이 모자라거나 연결이 안 된다능 🦕",
      credits: acct.balance, cap: effectiveCap, isSmart, snack: false, outOfCredits: true,
    });
  }
  const snack = maybeSnackLine(cost);
  bgTrack({
    chats: 1,
    [isGuest ? "chatsGuest" : "chatsMember"]: 1,
    [`p:${provider}`]: 1,
    [`t:${tier}`]: 1,
    spent: cost,
    images: hasImages ? images.length : 0,
  });

  return json({
    reply,
    credits: spend.balance,
    cap: effectiveCap,
    refill: (await getBalanceWithRefill(env, identity, acct.localCap, config.refillIntervalMin, config.refillMaxPer24h)).refill,
    isSmart,
    smartLevel: level,
    sunset: sunsetLabel,
    snack: snack || false,
    provider,
    cost,
    dailyRemaining: limitCheck.remaining,
  });
}

// 관리자 API. 전부 idToken(Firebase ID 토큰, admins/{uid}===true 계정만 통과)으로
// 인증한다 — ramalok.kr 메인 관리자 시스템과 동일한 규칙이라 거기서 이미 등록된
// 관리자 계정이면 바로 쓸 수 있다.
async function handleAdmin(request, env, url) {
  try {
    const idToken =
      request.headers.get("x-admin-token") ||
      (request.method === "GET" ? url.searchParams.get("idToken") : null);

    const admin = await requireAdmin(idToken);
    if (!admin) return json({ error: "관리자 권한이 없다능!" }, { status: 403 });

    const path = url.pathname.replace(/\/+$/, "").slice("/api/admin/".length);

    if (path === "me" && request.method === "GET") {
      return json({ admin: true, email: admin.email, uid: admin.uid });
    }

    if (path === "config" && request.method === "GET") {
      return json(await getConfig(env));
    }

    if (path === "config" && request.method === "POST") {
      const patch = await request.json();
      const next = await setConfig(env, patch);
      await logAudit(env, admin, "설정 변경", Object.keys(patch || {}).join(", "));
      return json(next);
    }

    if (path === "config/reset" && request.method === "POST") {
      const next = await resetConfig(env);
      await logAudit(env, admin, "설정 초기화", "모든 설정을 기본값으로");
      return json(next);
    }

    if (path === "stats" && request.method === "GET") {
      const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 7));
      return json({ days: await getStats(env, days) });
    }

    if (path === "bans" && request.method === "GET") {
      return json({ items: await listBans(env) });
    }
    if (path === "bans/add" && request.method === "POST") {
      const b = await request.json();
      try {
        const rec = await addBan(env, String(b.identity || "").trim(), b.reason, admin.email || admin.uid, b.days);
        await logAudit(env, admin, "사용자 차단", `${rec.identity}${rec.reason ? ` · ${rec.reason}` : ""}${rec.until ? ` · ${b.days}일` : " · 영구"}`);
        return json(rec);
      } catch (err) {
        return json({ error: err.message }, { status: 400 });
      }
    }
    if (path === "bans/remove" && request.method === "POST") {
      const b = await request.json();
      await removeBan(env, String(b.identity || ""));
      await logAudit(env, admin, "차단 해제", String(b.identity || ""));
      return json({ ok: true });
    }

    if (path === "shares" && request.method === "GET") {
      return json({ items: await listShares(env) });
    }
    if (path === "shares/revoke" && request.method === "POST") {
      const b = await request.json();
      const ok = await revokeShare(env, String(b.shareId || ""));
      await logAudit(env, admin, "공유 해제", String(b.shareId || ""));
      return json({ ok });
    }

    if (path === "filter-test" && request.method === "POST") {
      const b = await request.json();
      const config = await getConfig(env);
      const text = String(b.text || "").slice(0, 500);
      return json({ blocked: findBadWord(text, config.filter), masked: maskBadWords(text, config.filter), enabled: config.filter.enabled });
    }

    if (path === "audit" && request.method === "GET") {
      return json({ items: await listAudit(env) });
    }

    if (path === "debug/access" && request.method === "GET") {
      // 프록시가 실제로 어떤 헤더를 넘겨주는지 확인용 (비밀값은 보여주지 않고 "있음/없음"만)
      const h = request.headers;
      const pick = (k) => h.get(k) || "";
      return json({
        host: new URL(request.url).hostname,
        xForwardedHost: pick("x-forwarded-host"),
        xForwardedFor: pick("x-forwarded-for"),
        cfConnectingIp: pick("cf-connecting-ip"),
        proxyHeaderPresent: !!h.get("x-bbald-proxy"),
        guardEnabled: !!(env.BBALD_PROXY_SECRET || env.BBALD_ALLOWED_HOSTS),
        guardVia: checkAccess(request, env).via,
        platform: env.PLATFORM || "cloudflare",
      });
    }

    if (path === "health" && request.method === "GET") {
      return json(await runHealth(env, { version: "bbald_ai" }));
    }

    if (path === "identity/reset" && request.method === "POST") {
      const b = await request.json();
      const identity = String(b.identity || "");
      if (!identity) return json({ error: "identity가 필요하다능" }, { status: 400 });
      let detail = "";
      if (b.what === "usage") detail = `오늘 사용량 ${await resetTodayUsage(env, identity)}건 초기화`;
      else if (b.what === "refill") { await resetRefillState(env, identity); detail = "재충전 기록 초기화"; }
      else return json({ error: "what은 usage 또는 refill이어야 한다능" }, { status: 400 });
      await logAudit(env, admin, "신원 초기화", `${identity} · ${detail}`);
      return json({ ok: true, detail });
    }

    if (path === "lookup" && request.method === "GET") {
      const identity = url.searchParams.get("identity");
      if (!identity) return json({ error: "identity 파라미터가 필요하다능" }, { status: 400 });
      const config = await getConfig(env);
      const isGuest = !identity.startsWith("uid:");
      const cap = isGuest ? config.startingCreditsGuest : config.startingCredits;
      const { balance: credits, refill } = await getBalanceWithRefill(env, identity, cap, config.refillIntervalMin, config.refillMaxPer24h);
      const today = await getUsageSummary(env, identity, isGuest ? config.dailyLimitsGuest : config.dailyLimits);
      const ban = await getBan(env, identity);
      return json({ identity, credits, cap, isGuest, today, refill, ban });
    }

    if (path === "list" && request.method === "GET") {
      const cursor = url.searchParams.get("cursor") || undefined;
      const result = await listCreditIdentities(env, cursor);
      return json(result);
    }

    if (path === "adjust" && request.method === "POST") {
      const body = await request.json();
      const { identity, delta, setTo } = body;
      if (!identity) return json({ error: "identity가 필요하다능" }, { status: 400 });
      if (typeof setTo === "number") {
        const result = await adminSetBalance(env, identity, setTo);
        return json(result);
      }
      if (typeof delta === "number") {
        const result = await adminAdjustBalance(env, identity, delta);
        return json(result);
      }
      return json({ error: "delta 또는 setTo 숫자가 필요하다능" }, { status: 400 });
    }

    return json({ error: "알 수 없는 관리자 API다능" }, { status: 404 });
  } catch (err) {
    return json({ error: `관리자 API 오류다능... (${err?.message || err})` }, { status: 500 });
  }
}

// 로그인 사용자의 서버 저장 대화 기록. 게스트는 아예 이 경로를 쓰지 않는다
// (클라이언트가 호출을 안 함) — "비로그인은 저장 안 됨" 요구사항.
// idToken으로 실제 소유자를 검증해서, 남의 uid를 주장해 남의 대화를 읽는 걸 막는다.
async function handleConversations(request, env, url) {
  try {
    const idToken = request.headers.get("x-user-token") || url.searchParams.get("idToken");
    const user = await verifyIdToken(idToken);
    if (!user) return json({ error: "로그인이 필요하다능!" }, { status: 401 });

    const rest = url.pathname.replace(/\/+$/, "").slice("/api/conversations".length); // "" | "/:id"
    const id = rest.startsWith("/") ? rest.slice(1) : null;

    if (!id && request.method === "GET") {
      return json({ items: await listConversations(env, user.uid) });
    }
    if (id && request.method === "GET") {
      const conv = await getConversation(env, user.uid, id);
      if (!conv) return json({ error: "그 대화를 못 찾았다능" }, { status: 404 });
      return json(conv);
    }
    if (!id && request.method === "POST") {
      const bodyIn = await request.json();
      if (bodyIn.id && !CONV_ID_RE.test(bodyIn.id)) return json({ error: "대화 번호 형식이 올바르지 않다능" }, { status: 400 });
      const record = await saveConversation(env, user.uid, bodyIn);
      return json(record);
    }
    if (id && id.endsWith("/share") && request.method === "POST") {
      const convId = id.slice(0, -"/share".length);
      const config = await getConfig(env);
      const bodyIn = await request.json().catch(() => ({}));
      const want = bodyIn.visibility;
      if (want !== "private" && !config.sharing.enabled) return json({ error: "대화 공유가 꺼져 있다능" }, { status: 403 });
      if (want === "public" && !config.sharing.publicAllowed) return json({ error: "전체 공개는 지금 막혀 있다능 (링크 공유만 가능)" }, { status: 403 });
      const result = await setVisibility(env, user.uid, convId, want);
      if (!result) return json({ error: "그 대화를 못 찾았다능 (저장된 대화만 공유할 수 있다능)" }, { status: 404 });
      return json(result);
    }
    if (id && request.method === "DELETE") {
      await deleteConversation(env, user.uid, id);
      return json({ ok: true });
    }

    return json({ error: "알 수 없는 요청이다능" }, { status: 404 });
  } catch (err) {
    return json({ error: `대화 저장소 오류다능... (${err?.message || err})` }, { status: 500 });
  }
}

async function handleUsage(request, env, url) {
  try {
    const uid = url.searchParams.get("uid");
    const idToken = request.headers.get("x-user-token") || url.searchParams.get("idToken");
    const config = await getConfig(env);
    const acct = await getAccount(request, env, config, uid, idToken);
    const today = await getUsageSummary(env, acct.identity, acct.dailyLimits);
    return json({ credits: acct.balance, cap: acct.cap, isGuest: acct.isGuest, today, plan: acct.plan, refill: acct.refill });
  } catch (err) {
    return json({ error: `사용 정보를 못 불러왔다능... (${err.message})` }, { status: 500 });
  }
}

// PAL 통합 요금제·크레딧·쿠폰 (ramalok.kr 관리자 > 요금·크레딧·쿠폰이 출처).
// 로그인(ID 토큰)이 필요하고, 쿠폰 등록은 메인 사이트 API에 그대로 전달한다.
async function handleBilling(request, env, url) {
  try {
    const idToken = request.headers.get("x-user-token") || url.searchParams.get("idToken");
    const user = await verifyIdToken(idToken);
    if (!user) return json({ error: "로그인이 필요하다능!" }, { status: 401 });
    const path = url.pathname.replace(/\/+$/, "").slice("/api/billing/".length);
    const config = await getConfig(env);

    if (path === "coupon" && request.method === "POST") {
      const bodyIn = await request.json();
      const result = await redeemUnifiedCoupon(idToken, bodyIn.code);
      if (!result.ok) return json(result, { status: 400 });
    }

    if ((path === "status" && request.method === "GET") || (path === "coupon" && request.method === "POST")) {
      const acct = await getAccount(request, env, config, user.uid, idToken);
      return json({
        ok: true,
        credits: acct.balance,
        cap: acct.cap,
        local: acct.local,
        unifiedCredits: acct.unified?.credits ?? 0,
        unifiedAvailable: !!acct.unified?.available,
        plan: acct.plan,
        refill: acct.refill,
        planUntil: acct.unified?.planUntil || 0,
      });
    }

    return json({ error: "알 수 없는 요청이다능" }, { status: 404 });
  } catch (err) {
    return json({ error: `요금제 처리 중 문제가 생겼다능... (${err?.message || err})` }, { status: 500 });
  }
}

export default {
  async fetch(request, env, ctx) {
    // 0) 접근 가드: 정식 주소(ramalok.kr/bbald_ai)를 거치지 않은 원본(dev) 주소 접근은 안내 후 이동 (환경변수가 있을 때만 켜짐)
    const access = checkAccess(request, env);
    if (!access.allowed) return blockedResponse(request, access.cfg);
    if (access.clientIp) {
      // 프록시 뒤에서는 연결 IP가 프록시 IP라서, 프록시가 알려준 진짜 방문자 IP로 바꿔준다.
      const headers = new Headers(request.headers);
      headers.set("cf-connecting-ip", access.clientIp);
      request = new Request(request, { headers });
    }

    let url = new URL(request.url);
    // "/bbald_ai/..." 로 바로 들어와도(Cloudflare 라우트 방식) 접두사를 떼고 똑같이 처리한다.
    // (Vercel 리라이트 방식은 이미 접두사를 떼고 넘겨준다.)
    if (url.pathname === "/bbald_ai" || url.pathname.startsWith("/bbald_ai/")) {
      url.pathname = url.pathname.slice("/bbald_ai".length) || "/";
      request = new Request(url, request);
    }
    // 프록시 앞단(예: PaLhomepage의 미들웨어)이 실수로 끝에 슬래시를 붙여
    // "/api/chat/" 같은 요청을 보내는 경우가 있었다(실제로 이것 때문에 전체
    // 채팅이 404로 응답 못 하는 버그가 있었음). API 경로만큼은 끝 슬래시가
    // 있어도 없는 것과 동일하게 받아들이도록 방어적으로 정규화한다.
    const apiPath = url.pathname.startsWith("/api/") ? url.pathname.replace(/\/+$/, "") : url.pathname;

    if (apiPath === "/api/chat" && request.method === "POST") {
      return handleChat(request, env, ctx);
    }

    if (apiPath === "/api/config/public" && request.method === "GET") {
      return json(publicConfig(await getConfig(env)), { headers: { "cache-control": "no-store" } });
    }

    if (apiPath === "/api/time") {
      return json(getSmartInfo());
    }

    if (apiPath === "/api/credits" && request.method === "GET") {
      const uid = url.searchParams.get("uid");
      const idToken = request.headers.get("x-user-token") || url.searchParams.get("idToken");
      try {
        const config = await getConfig(env);
        const acct = await getAccount(request, env, config, uid, idToken);
        return json({ credits: acct.balance, cap: acct.cap, plan: acct.plan, refill: acct.refill });
      } catch (err) {
        return json({ error: `사용량을 못 불러왔다능... (${err.message})` }, { status: 500 });
      }
    }

    if (apiPath === "/api/usage" && request.method === "GET") {
      return handleUsage(request, env, url);
    }

    if (apiPath === "/api/bonus" && request.method === "POST") {
      try {
        const bodyIn = await request.json();
        const config = await getConfig(env);
        const acct = await getAccount(request, env, config, bodyIn.uid, bodyIn.idToken);
        // 보너스는 로컬(KV) 기본 크레딧에만 붙고 localCap을 넘지 않는다. 통합 크레딧은 건드리지 않는다.
        let result;
        if (bodyIn.type === "signup") {
          result = await claimSignupBonus(env, acct.identity, acct.localCap, config.bonus.signupPct);
          if (result.granted && config.statsEnabled) ctx?.waitUntil?.(track(env, { signups: 1 }));
        } else if (bodyIn.type === "sticker") {
          if (!config.bonus.sticker.enabled) return json({ granted: false, balance: acct.balance, cap: acct.cap, disabled: true });
          result = await claimStickerBonus(env, acct.identity, acct.localCap, config.bonus.sticker);
          if (result.granted && config.statsEnabled) ctx?.waitUntil?.(track(env, { stickers: 1 }));
        } else return json({ error: "알 수 없는 보너스 종류다능" }, { status: 400 });
        const balance = result.balance + (acct.unified?.credits || 0);
        return json({ ...result, balance, cap: acct.cap });
      } catch (err) {
        return json({ error: `보너스 지급 중 문제가 생겼다능... (${err.message})` }, { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
    }

    if (apiPath.startsWith("/api/share/") && request.method === "GET") {
      const config = await getConfig(env);
      if (!config.sharing.enabled) return json({ error: "대화 공유가 꺼져 있다능" }, { status: 403 });
      const shared = await getSharedConversation(env, apiPath.slice("/api/share/".length));
      if (!shared) return json({ error: "공유된 대화를 못 찾았다능 (비공개로 바뀌었거나 없는 링크)" }, { status: 404 });
      return json(shared, { headers: { "cache-control": "no-store" } });
    }

    if (apiPath === "/api/conversations" || apiPath.startsWith("/api/conversations/")) {
      return handleConversations(request, env, url);
    }

    if (apiPath.startsWith("/api/billing/")) {
      return handleBilling(request, env, url);
    }

    if (env.ASSETS) {
      // Cloudflare Assets는 "/admin.html" -> "/admin", "/admin/" -> "/admin" 같은 3xx
      // 리다이렉트를 돌려준다. 이 Worker는 PaLhomepage(Vercel)가 "/bbald_ai/" 접두사를 뗀
      // 주소로 호출하기 때문에 그 Location이 접두사 없이 나가고, 접두사를 다시 붙여
      // 돌려줘도 메인 사이트 미들웨어가 "/bbald_ai/admin"에 슬래시를 붙여 308로 되돌리고
      // Assets가 다시 슬래시를 떼는 식으로 서로 무한 리다이렉트(ERR_TOO_MANY_REDIRECTS)가 났다.
      // → 리다이렉트를 브라우저로 보내지 않고 여기서 직접 따라가서 최종 200 응답을 돌려준다.
      // (브라우저 주소는 그대로 /bbald_ai/admin.html 이고, 리다이렉트가 없으니 순환도 없다.)
      let assetReq = request;
      let assetRes = await env.ASSETS.fetch(assetReq);
      for (let hop = 0; hop < 5 && assetRes.status >= 300 && assetRes.status < 400; hop++) {
        const loc = assetRes.headers.get("Location");
        if (!loc) break;
        let next;
        try {
          next = new URL(loc, url);
        } catch {
          break;
        }
        if (next.origin !== url.origin) break; // 다른 사이트로 가는 리다이렉트는 그대로 둔다
        assetReq = new Request(next.toString(), request);
        assetRes = await env.ASSETS.fetch(assetReq);
      }
      // 정적 파일(특히 html/js/css)은 프록시나 중간 CDN 캐시에 옛날 버전·옛날 404가
      // 남는 문제가 있었어서 캐시를 짧게 강제한다.
      const headers = new Headers(assetRes.headers);
      headers.set("Cache-Control", "no-cache, must-revalidate");
      return new Response(assetRes.body, { status: assetRes.status, headers });
    }

    return new Response("Not found", { status: 404 });
  },
};
