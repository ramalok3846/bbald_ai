import {
  getKstNow,
  isSmartHour,
  tryDumbMathOverride,
  buildSystemPrompt,
  applyPersonaFlourish,
  maybeSnackLine,
  builtinReply,
} from "./bbald.js";
import { callAnthropic, callOpenAI, callGemini, callCloudflareAI } from "./providers.js";

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

async function handleChat(request, env) {
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
    credits = 100,
    image = null, // { dataUrl, mimeType } | null
  } = body;

  if ((typeof message !== "string" || !message.trim()) && !image) {
    return json({ error: "메시지가 비어있다능!" }, { status: 400 });
  }

  const { hour } = getKstNow();
  const isSmart = isSmartHour(hour);
  const cost = CREDIT_COST[provider] ?? 3;

  if (credits < cost) {
    return json({
      reply: "크레딧이 다 떨어졌다능... 설정에서 크레딧을 충전하거나 내일 다시 놀아달라능! 🦕",
      credits,
      isSmart,
      snack: false,
      outOfCredits: true,
    });
  }

  // 아주 쉬운 사칙연산은 빨드의 개그 두뇌가 직접 처리 (진짜 AI 호출 없이, 크레딧 절약!)
  const mathOverride = !image && tryDumbMathOverride(message, isSmart);
  if (mathOverride) {
    return json({
      reply: mathOverride,
      credits, // 계산은 공짜! 빨드가 직접 (잘못) 계산했으니까
      isSmart,
      snack: false,
      provider: "builtin-math",
    });
  }

  const systemPrompt = buildSystemPrompt(isSmart);
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

  reply = applyPersonaFlourish(reply, isSmart);
  const newCredits = Math.max(0, credits - cost);
  const snack = maybeSnackLine(cost);

  return json({
    reply,
    credits: newCredits,
    isSmart,
    snack: snack || false,
    provider,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname === "/api/time") {
      const { hour, minute, source } = getKstNow();
      return json({ hour, minute, source, isSmart: isSmartHour(hour) });
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  },
};
