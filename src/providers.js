// 각 AI 제공자(Provider) 호출 래퍼. 사용자가 설정 화면에서 넣은 API 키는 요청에만 쓰고 서버에 저장하지 않는다.
//
// 공통 원칙
//  - 에러를 종류로 나눠서(ProviderError.kind) 사용자가 뭘 고치면 되는지 알려준다:
//      auth(키 오류/권한 없음) · quota(한도/속도 제한) · overloaded(서버 바쁨/장애) · notfound(모델 없음)
//      · blocked(안전 필터) · empty(빈 응답) · other
//  - 단계(lite/basic/deep/story)마다 모델 후보를 순서대로 시도한다. 모델이 없다는 404/400이면 다음 후보,
//    후보가 다 없으면 그 제공자의 "모델 목록 API"로 실제 쓸 수 있는 모델을 찾아 쓴다.
//    503/429처럼 잠깐 바쁜 경우는 한 번 더 시도한 뒤 다음 후보로 넘어간다.
//  - 한 번 성공한 모델은 기억해뒀다가(같은 실행 환경 안에서) 다음 요청에 먼저 쓴다.

export class ProviderError extends Error {
  constructor(provider, kind, message, status) {
    super(message);
    this.provider = provider;
    this.kind = kind;
    this.status = status || 0;
  }
}

// kind → 우리 서버가 돌려줄 HTTP 상태 (worker.js가 사용)
export function httpStatusFor(err) {
  return { auth: 400, quota: 429, overloaded: 503, blocked: 422 }[err?.kind] || 502;
}

const LABEL = { anthropic: "Claude", openai: "ChatGPT", gemini: "Gemini" };

function upstreamMessage(text) {
  try {
    const j = JSON.parse(text);
    return String(j?.error?.message || j?.error || j?.message || "").slice(0, 300);
  } catch {
    return String(text || "").slice(0, 200);
  }
}

// 상태 코드와 본문으로 에러 종류를 판별한다.
export function classifyHttpError(provider, status, bodyText) {
  const label = LABEL[provider] || provider;
  const detail = upstreamMessage(bodyText);
  const low = `${detail} ${bodyText || ""}`.toLowerCase();
  if (
    status === 401 || status === 403 ||
    /api key not valid|api_key_invalid|invalid x-api-key|incorrect api key|invalid_api_key|permission_denied|authentication/.test(low) ||
    (status === 400 && /api key/.test(low))
  ) {
    return new ProviderError(provider, "auth", `${label} API 키가 잘못됐거나 이 모델을 쓸 권한이 없다능. 설정에서 키를 다시 확인해달라능 (${status}${detail ? `: ${detail}` : ""})`, status);
  }
  if (status === 404 || /model.*(not found|does not exist|not supported|is not available)|not_found/.test(low)) {
    return new ProviderError(provider, "notfound", `${label}에 그 모델이 없다능 (${status}${detail ? `: ${detail}` : ""})`, status);
  }
  if (status === 429 || /quota|rate.?limit|resource_exhausted|insufficient_quota/.test(low)) {
    const e = new ProviderError(provider, "quota", `${label} 사용 한도를 넘었거나 너무 빨리 보냈다능. 잠시 뒤에 다시, 또는 결제/한도를 확인해달라능 (${status}${detail ? `: ${detail}` : ""})`, status);
    // 결제 한도 소진은 모델을 바꾸거나 다시 시도해도 소용없다 (계정 단위 문제)
    e.fatal = /insufficient_quota|billing|exceeded your current quota/.test(low);
    return e;
  }
  if (status >= 500 || status === 529 || /overloaded|unavailable/.test(low)) {
    return new ProviderError(provider, "overloaded", `${label} 서버가 지금 바쁘거나 문제가 있다능 (${status}). 잠시 뒤에 다시 해달라능${detail ? ` — ${detail}` : ""}`, status);
  }
  return new ProviderError(provider, "other", `${label} 요청이 거절됐다능 (${status}${detail ? `: ${detail}` : ""})`, status);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch + 잠깐 바쁠 때(429/500/502/503/504/529) 한 번 더 시도
async function fetchWithRetry(provider, url, init, retries = 1) {
  let last;
  for (let i = 0; i <= retries; i++) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      last = new ProviderError(provider, "overloaded", `${LABEL[provider]}에 연결하지 못했다능 (${e.message || e})`, 0);
      if (i < retries) { await sleep(600); continue; }
      throw last;
    }
    if (res.ok) return res;
    const text = await res.text().catch(() => "");
    last = classifyHttpError(provider, res.status, text);
    last.bodyText = text;
    if ([429, 500, 502, 503, 504, 529].includes(res.status) && i < retries && !last.fatal) {
      await sleep(700 * (i + 1));
      continue;
    }
    throw last;
  }
  throw last;
}

function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}
function mimeFromDataUrl(dataUrl, fallback) {
  const m = /^data:([^;]+);/.exec(dataUrl || "");
  return m ? m[1] : fallback;
}

// ---------------- 단계별 모델 후보 ----------------
// 앞쪽이 우선. 앞 모델이 없거나 접근 권한이 없으면 다음 후보를 쓴다.
export const TIER_MODELS = {
  anthropic: {
    lite: ["claude-haiku-5-5", "claude-haiku-4-5-20251001"],
    basic: ["claude-sonnet-5-5", "claude-sonnet-5"],
    deep: ["claude-opus-5-5", "claude-sonnet-5-5"],
    story: ["claude-fable-5-1", "claude-sonnet-5-5"],
  },
  openai: {
    lite: ["gpt-5.1-mini", "gpt-4.1-mini", "gpt-4o-mini"],
    basic: ["gpt-5.1", "gpt-4.1", "gpt-4o"],
    deep: ["gpt-5.1-pro", "gpt-5.1", "gpt-4.1"],
    story: ["gpt-5.1-creative", "gpt-5.1", "gpt-4.1"],
  },
  gemini: {
    lite: ["gemini-3.8-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash"],
    basic: ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.0-flash"],
    deep: ["gemini-3.8-pro", "gemini-2.5-pro", "gemini-2.5-flash"],
    story: ["gemini-3.8-pro-creative", "gemini-3.8-pro", "gemini-2.5-pro", "gemini-2.5-flash"],
  },
};

// 한 번 성공한 모델 기억 (key: "provider:tier")
const workingModel = new Map();

function candidatesFor(provider, tier, requested) {
  const base = TIER_MODELS[provider]?.[tier] || TIER_MODELS[provider]?.basic || [];
  const first = workingModel.get(`${provider}:${tier}`);
  return [first, requested, ...base].filter((m, i, a) => m && a.indexOf(m) === i);
}

// 모델 목록 API로 실제 있는 모델을 찾아 단계에 맞게 고른다 (후보가 전부 없을 때만 부른다).
function rankDiscovered(provider, tier, ids) {
  const ver = (id) => {
    const m = id.match(/(\d+)(?:[.-](\d+))?/);
    return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
  };
  const want = {
    anthropic: { lite: /haiku/, basic: /sonnet/, deep: /opus/, story: /fable|opus|sonnet/ },
    openai: { lite: /(mini|nano)/, basic: /^gpt-\d/, deep: /(pro|^o\d)/, story: /^gpt-\d/ },
    gemini: { lite: /flash-lite|lite/, basic: /flash/, deep: /pro/, story: /pro/ },
  }[provider][tier];
  const bad = /embed|aqa|imagen|tts|audio|live|image|vision|realtime|transcribe|search|moderation|whisper|dall|robotics|computer|codex|instruct$/;
  let pool = ids.filter((id) => want.test(id) && !bad.test(id));
  if (tier === "basic" && provider !== "anthropic") pool = pool.filter((id) => !/(-lite|-mini|-nano|-pro)/.test(id));
  return pool.sort((a, b) => ver(b) - ver(a)).slice(0, 3);
}

async function discoverModels(provider, tier, apiKey, accessToken) {
  try {
    let res;
    if (provider === "gemini") {
      const url = accessToken
        ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200"
        : `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`;
      res = await fetch(url, { headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });
      if (!res.ok) return [];
      const j = await res.json();
      return rankDiscovered(
        "gemini", tier,
        (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""))
      );
    }
    if (provider === "openai") {
      res = await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${apiKey}` } });
      if (!res.ok) return [];
      return rankDiscovered("openai", tier, ((await res.json()).data || []).map((m) => m.id));
    }
    if (provider === "anthropic") {
      res = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" } });
      if (!res.ok) return [];
      return rankDiscovered("anthropic", tier, ((await res.json()).data || []).map((m) => m.id));
    }
  } catch {}
  return [];
}

// 후보를 순서대로 시도하는 공통 루프. attempt(modelId)는 텍스트를 돌려주거나 ProviderError를 던진다.
async function runWithModels(provider, tier, requested, creds, attempt) {
  let list = candidatesFor(provider, tier, requested);
  const tried = new Set();
  let bestErr = null;
  const remember = (e) => {
    // auth/quota/overloaded처럼 "모델과 무관한" 에러가 더 알려줄 게 많다
    if (!bestErr || (bestErr.kind === "notfound" && e.kind !== "notfound")) bestErr = e;
  };
  for (let round = 0; round < 2; round++) {
    for (const id of list) {
      if (tried.has(id)) continue;
      tried.add(id);
      try {
        const text = await attempt(id);
        workingModel.set(`${provider}:${tier}`, id);
        return text;
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        if (e.kind === "auth" || e.fatal) throw e; // 키/결제 문제는 다른 모델로 바꿔도 소용없다
        remember(e);
        // notfound/overloaded/quota/empty/blocked → 다음 후보
      }
    }
    if (round === 0 && (!bestErr || bestErr.kind === "notfound")) {
      list = await discoverModels(provider, tier, creds.apiKey, creds.accessToken);
      if (!list.length) break;
    } else break;
  }
  throw bestErr || new ProviderError(provider, "other", `${LABEL[provider]} 호출에 실패했다능`, 0);
}

// ---------------- Anthropic (Claude) ----------------
export async function callAnthropic({ apiKey, tier = "basic", model, systemPrompt, history, message, images, maxTokens = 400 }) {
  let userContent = message;
  if (images?.length) {
    userContent = [
      { type: "text", text: message || "이 사진들 좀 봐줘!" },
      ...images.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: mimeFromDataUrl(img.dataUrl, img.mimeType || "image/png"), data: dataUrlToBase64(img.dataUrl) },
      })),
    ];
  }
  const messages = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: userContent },
  ];
  return runWithModels("anthropic", tier, model, { apiKey }, async (modelId) => {
    const res = await fetchWithRetry("anthropic", "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: modelId, max_tokens: maxTokens, system: systemPrompt, messages }),
    });
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    if (!text.trim()) throw new ProviderError("anthropic", data.stop_reason === "refusal" ? "blocked" : "empty", "Claude가 빈 답을 줬다능", 200);
    return text;
  });
}

// ---------------- OpenAI (ChatGPT) ----------------
// 새 모델(gpt-5, o-시리즈)은 max_tokens 대신 max_completion_tokens만 받고, 생각하는 데 토큰을 쓰므로 여유를 더 준다.
export async function callOpenAI({ apiKey, tier = "basic", model, systemPrompt, history, message, images, maxTokens = 400 }) {
  let userContent = message;
  if (images?.length) {
    userContent = [
      { type: "text", text: message || "이 사진들 좀 봐줘!" },
      ...images.map((img) => ({ type: "image_url", image_url: { url: img.dataUrl } })),
    ];
  }
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: userContent },
  ];
  return runWithModels("openai", tier, model, { apiKey }, async (modelId) => {
    const reasoning = /^(gpt-5|o\d)/.test(modelId);
    const send = (useCompletionParam) =>
      fetchWithRetry("openai", "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelId,
          messages,
          [useCompletionParam ? "max_completion_tokens" : "max_tokens"]: reasoning ? maxTokens + 1500 : maxTokens,
        }),
      });
    let res;
    try {
      res = await send(true);
    } catch (e) {
      // 아주 오래된 모델/호환 서버는 max_completion_tokens를 모른다
      if (e.kind === "other" && /max_completion_tokens|unsupported_parameter|unrecognized/i.test(e.bodyText || e.message)) res = await send(false);
      else throw e;
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (!text || !String(text).trim()) {
      throw new ProviderError("openai", choice?.finish_reason === "content_filter" ? "blocked" : "empty", "ChatGPT가 빈 답을 줬다능 (토큰 부족이거나 안전 필터)", 200);
    }
    return String(text);
  });
}

// ---------------- Gemini ----------------
// accessToken이 있으면(구글 로그인 OAuth, Generative Language API 스코프) 키 없이 그 계정 권한으로 호출한다.
// 2.5/3 계열은 "생각"에 토큰을 쓰기 때문에 maxOutputTokens가 작으면 답이 비어 오므로 여유를 더 준다.
export async function callGemini({ apiKey, accessToken, tier = "basic", model, systemPrompt, history, message, images, maxTokens = 400 }) {
  const userParts = [{ text: message || "이 사진들 좀 봐줘!" }];
  for (const img of images || []) {
    userParts.push({ inlineData: { mimeType: mimeFromDataUrl(img.dataUrl, img.mimeType || "image/png"), data: dataUrlToBase64(img.dataUrl) } });
  }
  const contents = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
    { role: "user", parts: userParts },
  ];
  return runWithModels("gemini", tier, model, { apiKey, accessToken }, async (modelId) => {
    const base = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
    const url = accessToken ? base : `${base}?key=${encodeURIComponent(apiKey)}`;
    const headers = { "content-type": "application/json" };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    const call = async (outTokens) => {
      const res = await fetchWithRetry("gemini", url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: outTokens },
        }),
      });
      return res.json();
    };
    let data = await call(maxTokens + 1500);
    const read = (d) => (d.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought && typeof p.text === "string").map((p) => p.text).join("");
    let text = read(data);
    if (!text.trim() && data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      data = await call(Math.max(4096, maxTokens * 6)); // 생각하느라 다 썼다면 한 번 더 넉넉하게
      text = read(data);
    }
    if (!text.trim()) {
      const block = data.promptFeedback?.blockReason || (["SAFETY", "PROHIBITED_CONTENT", "RECITATION"].includes(data.candidates?.[0]?.finishReason) ? data.candidates[0].finishReason : "");
      throw new ProviderError("gemini", block ? "blocked" : "empty", block ? `Gemini 안전 필터에 걸렸다능 (${block}). 말을 바꿔서 다시 해달라능` : "Gemini가 빈 답을 줬다능", 200);
    }
    return text;
  });
}

// ---------------- Cloudflare Workers AI ----------------
// 모델 카탈로그는 종종 바뀌고 예고 없이 폐기된다. env.WORKERS_AI_MODEL로 지정하거나,
// 지정 안 하거나 죽었으면 아래 후보들을 순서대로 시도한다.
const WORKERS_AI_FALLBACK_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fp8",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
];

export async function callCloudflareAI({ env, model, systemPrompt, history, message, maxTokens = 400 }) {
  if (!env.AI) {
    throw new ProviderError("cloudflare", "other", "Cloudflare 두뇌를 쓸 수 없다능 (Workers AI 연결이 안 돼 있다능). 다른 AI를 골라달라능", 0);
  }
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];
  const candidates = [model, env.WORKERS_AI_MODEL, ...WORKERS_AI_FALLBACK_MODELS].filter((m, i, arr) => m && arr.indexOf(m) === i);
  let lastErr;
  for (const modelId of candidates) {
    try {
      const result = await env.AI.run(modelId, { messages, max_tokens: maxTokens });
      const text = result?.response ?? result?.result?.response ?? "";
      if (String(text).trim()) return text;
      lastErr = new Error("빈 응답");
    } catch (err) {
      lastErr = err;
    }
  }
  throw new ProviderError("cloudflare", "overloaded", `Cloudflare 두뇌가 모든 모델 후보에서 실패했다능 (${lastErr?.message || lastErr})`, 0);
}
