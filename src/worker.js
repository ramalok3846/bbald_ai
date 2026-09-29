import {
  getSmartInfo,
  tryDumbMathOverride,
  buildSystemPrompt,
  applyPersonaFlourish,
  maybeSnackLine,
  builtinReply,
} from "./bbald.js";
import { callAnthropic, callOpenAI, callGemini, callCloudflareAI } from "./providers.js";
import { checkAndConsumeDailyLimit } from "./rate-limit.js";
import { resolveIdentity, getBalance, spendCredits, claimSignupBonus, claimStickerBonus } from "./credits.js";

const CREDIT_COST = {
  builtin: 1,
  cloudflare: 1,
  gemini: 3,
  openai: 3,
  anthropic: 3,
};

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

  const { isSmart, level, sunsetLabel } = getSmartInfo();
  const cost = CREDIT_COST[provider] ?? 3;
  const identity = resolveIdentity(request, uid);

  // 크레딧은 서버(KV)가 유일한 출처다 — 클라이언트가 뭐라고 보내든 무시하고
  // 서버에 저장된 실제 잔액만 본다. (예전엔 클라이언트가 보낸 숫자를 그대로
  // 믿고 차감만 해서, 설정 화면에서 숫자를 직접 입력하면 무한 충전이 가능했음)
  const currentBalance = await getBalance(env, identity);

  if (currentBalance < cost) {
    return json({
      reply: "크레딧이 다 떨어졌다능... 로그인하거나 내일 다시 놀아달라능! 🦕",
      credits: currentBalance,
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
    limitCheck = await checkAndConsumeDailyLimit(env, request, provider);
  } catch (err) {
    limitCheck = { allowed: true, remaining: null, limit: null, enabled: false };
  }
  if (!limitCheck.allowed) {
    return json(
      {
        reply: "오늘 빨드가 너무 말을 많이 했다능! 하루 사용량을 다 썼어... 내일 다시 놀아달라능! 🌙🦕",
        credits: currentBalance,
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
  const spend = await spendCredits(env, identity, cost);
  const snack = maybeSnackLine(cost);

  return json({
    reply,
    credits: spend.balance,
    isSmart,
    smartLevel: level,
    sunset: sunsetLabel,
    snack: snack || false,
    provider,
    dailyRemaining: limitCheck.remaining,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname === "/api/time") {
      return json(getSmartInfo());
    }

    if (url.pathname === "/api/credits" && request.method === "GET") {
      const uid = url.searchParams.get("uid");
      const identity = resolveIdentity(request, uid);
      try {
        const credits = await getBalance(env, identity);
        return json({ credits });
      } catch (err) {
        return json({ error: `크레딧을 못 불러왔다능... (${err.message})` }, { status: 500 });
      }
    }

    if (url.pathname === "/api/bonus" && request.method === "POST") {
      try {
        const body = await request.json();
        const identity = resolveIdentity(request, body.uid);
        if (body.type === "signup") {
          const result = await claimSignupBonus(env, identity);
          return json(result);
        }
        if (body.type === "sticker") {
          const result = await claimStickerBonus(env, identity);
          return json(result);
        }
        return json({ error: "알 수 없는 보너스 종류다능" }, { status: 400 });
      } catch (err) {
        return json({ error: `보너스 지급 중 문제가 생겼다능... (${err.message})` }, { status: 500 });
      }
    }

    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      // JS/CSS는 프록시(예: ramalok.kr/bbald_ai)를 거칠 때 중간 캐시에 옛날 버전이
      // 계속 남아있는 문제를 막기 위해 캐시를 짧게 강제한다 (index.html의 ?v= 쿼리와
      // 함께 이중으로 방어).
      if (/\.(js|css)(\?|$)/.test(url.pathname + url.search) || /\.(js|css)$/.test(url.pathname)) {
        const headers = new Headers(assetRes.headers);
        headers.set("Cache-Control", "no-cache, must-revalidate");
        return new Response(assetRes.body, { status: assetRes.status, headers });
      }
      return assetRes;
    }

    return new Response("Not found", { status: 404 });
  },
};
