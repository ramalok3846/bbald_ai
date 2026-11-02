import {
  getSmartInfo,
  tryDumbMathOverride,
  buildSystemPrompt,
  applyPersonaFlourish,
  maybeSnackLine,
  builtinReply,
} from "./bbald.js";
import { callAnthropic, callOpenAI, callGemini, callCloudflareAI } from "./providers.js";
import { checkAndConsumeDailyLimit, getUsageSummary } from "./rate-limit.js";
import {
  resolveIdentity,
  getBalance,
  spendCredits,
  claimSignupBonus,
  claimStickerBonus,
  adminAdjustBalance,
  adminSetBalance,
  listCreditIdentities,
} from "./credits.js";
import { getConfig, setConfig } from "./config.js";
import { requireAdmin } from "./admin.js";
import { verifyIdToken } from "./firebase-verify.js";
import { listConversations, getConversation, saveConversation, deleteConversation } from "./conversations.js";

// provider 기본 비용 + Claude 모델별 배율. "모델/AI별로 사용량이 다르게 빨리
// 줄어들게 해달라"는 요청 반영 — 더 똑똑한(비싼) 모델일수록 더 많이 깎는다.
const BASE_COST = {
  builtin: 2,
  cloudflare: 2,
  anthropic: 4,
  openai: 5,
  gemini: 5,
};
const MODEL_COST_MULTIPLIER = {
  "haiku-4.5": 1, // 빨드 라이트
  "sonnet-5": 1.5, // 빨드 기본
  "opus-5.5": 3, // 빨드 딥씽킹
  "fable-5.1": 2, // 빨드 스토리
};
function computeCost(provider, model) {
  const base = BASE_COST[provider] ?? 4;
  if (provider === "anthropic") {
    const mult = MODEL_COST_MULTIPLIER[model] ?? 1.5;
    return Math.max(1, Math.round(base * mult));
  }
  return base;
}

// 로그인 없이는 못 쓰는 모델(더 똑똑한/비싼 두뇌). 게스트가 고르면 로그인을 요구한다.
const MEMBER_ONLY_MODELS = new Set(["opus-5.5", "fable-5.1"]);

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
async function handleChat(request, env) {
  try {
    return await handleChatInner(request, env);
  } catch (err) {
    return json({ error: `빨드한테 예상 못한 문제가 생겼다능... (${err?.message || err})` }, { status: 500 });
  }
}

async function handleChatInner(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "잘못된 요청 형식이다능" }, { status: 400 });
  }

  const {
    message = "",
    history = [],
    provider = "builtin",
    model = "sonnet-5",
    apiKey = "",
    uid = null, // Firebase 로그인 사용자면 uid, 아니면 null(게스트는 IP로 식별)
    image = null, // { dataUrl, mimeType } | null
  } = body;

  if ((typeof message !== "string" || !message.trim()) && !image) {
    return json({ error: "메시지가 비어있다능!" }, { status: 400 });
  }

  const isGuest = !uid;
  const identity = resolveIdentity(request, uid);
  const config = await getConfig(env);
  const effectiveCap = isGuest ? config.startingCreditsGuest : config.startingCredits;
  const effectiveDailyLimits = isGuest ? config.dailyLimitsGuest : config.dailyLimits;

  const { isSmart, level, sunsetLabel } = getSmartInfo();
  const cost = computeCost(provider, model);

  if (config.maintenance?.enabled) {
    return json(
      {
        reply: config.maintenance.message,
        credits: await getBalance(env, identity, effectiveCap),
        cap: effectiveCap,
        isSmart,
        snack: false,
        maintenance: true,
      },
      { status: 503 }
    );
  }

  // 게스트 기능 제한: 이미지 첨부, 고급 모델(딥씽킹/스토리)은 로그인해야 쓸 수 있다.
  if (isGuest && image) {
    return json({ error: "이미지 첨부는 로그인하면 쓸 수 있다능! 게스트는 아직 안 된다능 🔒" }, { status: 403 });
  }
  if (isGuest && MEMBER_ONLY_MODELS.has(model)) {
    return json({ error: "그 두뇌는 로그인해야 빌릴 수 있다능! 게스트는 라이트/기본만 쓸 수 있어 🔒" }, { status: 403 });
  }

  // 크레딧은 서버(KV)가 유일한 출처다 — 클라이언트가 뭐라고 보내든 무시하고
  // 서버에 저장된 실제 잔액만 본다. (예전엔 클라이언트가 보낸 숫자를 그대로
  // 믿고 차감만 해서, 설정 화면에서 숫자를 직접 입력하면 무한 충전이 가능했음)
  const currentBalance = await getBalance(env, identity, effectiveCap);

  if (currentBalance < cost) {
    return json({
      reply: isGuest
        ? "사용량이 다 떨어졌다능... 로그인하면 더 쓸 수 있다능! 🦕"
        : "사용량이 다 떨어졌다능... 내일 다시 놀아달라능! 🦕",
      credits: currentBalance,
      cap: effectiveCap,
      isSmart,
      snack: false,
      outOfCredits: true,
    });
  }

  // 아주 쉬운 사칙연산은 빨드의 개그 두뇌가 직접 처리 (진짜 AI 호출 없이, 크레딧 절약!)
  const mathOverride = !image && tryDumbMathOverride(message, level);
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

  const systemPrompt = buildSystemPrompt(level);
  let reply;
  try {
    if (provider === "builtin" || provider === "cloudflare") {
      // 빨드 기본 두뇌 / Cloudflare Workers AI는 진짜 이미지 분석은 안 하고 귀엽게 반응만 한다.
      if (image && provider === "builtin") {
        reply = "오오 사진이다! 근데 빨드는 그림이 뭔지 잘 모르겠다능... 그래도 이쁘다능! 🦕🖼️";
      } else if (provider === "builtin") {
        reply = builtinReply(message);
      } else {
        reply = await callCloudflareAI({ env, systemPrompt, history, message: image ? `${message}\n(사용자가 이미지를 첨부했지만 너는 이미지를 볼 수 없으니, 궁금해하는 티만 내며 귀엽게 반응해라)` : message });
      }
    } else if (provider === "anthropic") {
      if (!apiKey) return json({ error: "클로드 API 키를 설정에 넣어달라능!" }, { status: 400 });
      reply = await callAnthropic({ apiKey, model, systemPrompt, history, message, image });
    } else if (provider === "openai") {
      if (!apiKey) return json({ error: "챗지피티 API 키를 설정에 넣어달라능!" }, { status: 400 });
      reply = await callOpenAI({ apiKey, systemPrompt, history, message, image });
    } else if (provider === "gemini") {
      if (!apiKey) return json({ error: "제미나이 API 키를 설정에 넣어달라능!" }, { status: 400 });
      reply = await callGemini({ apiKey, systemPrompt, history, message, image });
    } else {
      return json({ error: "알 수 없는 provider다능" }, { status: 400 });
    }
  } catch (err) {
    return json({ error: `빨드가 넘어졌다능... (${err.message})` }, { status: 502 });
  }

  reply = applyPersonaFlourish(reply, level);
  const spend = await spendCredits(env, identity, cost, effectiveCap);
  const snack = maybeSnackLine(cost);

  return json({
    reply,
    credits: spend.balance,
    cap: effectiveCap,
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
      return json(next);
    }

    if (path === "lookup" && request.method === "GET") {
      const identity = url.searchParams.get("identity");
      if (!identity) return json({ error: "identity 파라미터가 필요하다능" }, { status: 400 });
      const config = await getConfig(env);
      const credits = await getBalance(env, identity, config.startingCredits);
      return json({ identity, credits });
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
      const record = await saveConversation(env, user.uid, bodyIn);
      return json(record);
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
    const identity = resolveIdentity(request, uid);
    const config = await getConfig(env);
    const isGuest = !uid;
    const cap = isGuest ? config.startingCreditsGuest : config.startingCredits;
    const dailyLimits = isGuest ? config.dailyLimitsGuest : config.dailyLimits;
    const [credits, today] = await Promise.all([
      getBalance(env, identity, cap),
      getUsageSummary(env, identity, dailyLimits),
    ]);
    return json({ credits, cap, isGuest, today });
  } catch (err) {
    return json({ error: `사용 정보를 못 불러왔다능... (${err.message})` }, { status: 500 });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 프록시 앞단(예: PaLhomepage의 미들웨어)이 실수로 끝에 슬래시를 붙여
    // "/api/chat/" 같은 요청을 보내는 경우가 있었다(실제로 이것 때문에 전체
    // 채팅이 404로 응답 못 하는 버그가 있었음). API 경로만큼은 끝 슬래시가
    // 있어도 없는 것과 동일하게 받아들이도록 방어적으로 정규화한다.
    const apiPath = url.pathname.startsWith("/api/") ? url.pathname.replace(/\/+$/, "") : url.pathname;

    if (apiPath === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (apiPath === "/api/time") {
      return json(getSmartInfo());
    }

    if (apiPath === "/api/credits" && request.method === "GET") {
      const uid = url.searchParams.get("uid");
      const identity = resolveIdentity(request, uid);
      try {
        const config = await getConfig(env);
        const cap = uid ? config.startingCredits : config.startingCreditsGuest;
        const credits = await getBalance(env, identity, cap);
        return json({ credits, cap });
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
        const identity = resolveIdentity(request, bodyIn.uid);
        const config = await getConfig(env);
        const cap = bodyIn.uid ? config.startingCredits : config.startingCreditsGuest;
        if (bodyIn.type === "signup") {
          const result = await claimSignupBonus(env, identity);
          return json({ ...result, cap });
        }
        if (bodyIn.type === "sticker") {
          const result = await claimStickerBonus(env, identity);
          return json({ ...result, cap });
        }
        return json({ error: "알 수 없는 보너스 종류다능" }, { status: 400 });
      } catch (err) {
        return json({ error: `보너스 지급 중 문제가 생겼다능... (${err.message})` }, { status: 500 });
      }
    }

    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
    }

    if (apiPath === "/api/conversations" || apiPath.startsWith("/api/conversations/")) {
      return handleConversations(request, env, url);
    }

    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      // 정적 파일(특히 html/js/css)은 프록시(예: ramalok.kr/bbald_ai)나 중간 CDN
      // 캐시에 옛날 버전·옛날 404가 계속 남아있는 문제가 있었다 (admin.html을 새로
      // 추가했는데도 예전에 그 경로가 없었을 때의 404 응답이 캐시되어 남아있던 사례
      // 포함). 그래서 정적 자산 전체에 캐시를 짧게 강제한다.
      const headers = new Headers(assetRes.headers);
      headers.set("Cache-Control", "no-cache, must-revalidate");
      return new Response(assetRes.body, { status: assetRes.status, headers });
    }

    return new Response("Not found", { status: 404 });
  },
};
