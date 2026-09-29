// 각 AI 제공자(Provider) 호출 래퍼. 사용자가 설정 화면에서 넣은 API 키를 그대로 요청에만 사용하고 서버에 저장하지 않는다.

export const CLAUDE_MODELS = {
  "fable-5.1": "claude-fable-5-1",
  "opus-5.5": "claude-opus-5-5",
  "sonnet-5": "claude-sonnet-5",
  "haiku-4.5": "claude-haiku-4-5-20251001",
};

function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}
function mimeFromDataUrl(dataUrl, fallback) {
  const m = /^data:([^;]+);/.exec(dataUrl || "");
  return m ? m[1] : fallback;
}

export async function callAnthropic({ apiKey, model, systemPrompt, history, message, image }) {
  const modelId = CLAUDE_MODELS[model] || CLAUDE_MODELS["sonnet-5"];
  let userContent = message;
  if (image?.dataUrl) {
    userContent = [
      { type: "text", text: message || "이 사진 좀 봐줘!" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mimeFromDataUrl(image.dataUrl, image.mimeType || "image/png"),
          data: dataUrlToBase64(image.dataUrl),
        },
      },
    ];
  }
  const messages = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: userContent },
  ];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

export async function callOpenAI({ apiKey, systemPrompt, history, message, image }) {
  let userContent = message;
  if (image?.dataUrl) {
    userContent = [
      { type: "text", text: message || "이 사진 좀 봐줘!" },
      { type: "image_url", image_url: { url: image.dataUrl } },
    ];
  }
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: userContent },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 400 }),
  });
  if (!res.ok) throw new Error(`OpenAI API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function callGemini({ apiKey, systemPrompt, history, message, image }) {
  const userParts = [{ text: message || "이 사진 좀 봐줘!" }];
  if (image?.dataUrl) {
    userParts.push({
      inlineData: {
        mimeType: mimeFromDataUrl(image.dataUrl, image.mimeType || "image/png"),
        data: dataUrlToBase64(image.dataUrl),
      },
    });
  }
  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: userParts },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });
  if (!res.ok) throw new Error(`Gemini API 오류: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Workers AI 모델 카탈로그는 종종 바뀌고 예고 없이 폐기(deprecate)된다.
// env.WORKERS_AI_MODEL(대시보드 환경변수)로 원하는 모델을 지정할 수 있고,
// 지정 안 하거나 그 모델이 죽었으면 아래 후보들을 순서대로 시도한다.
const WORKERS_AI_FALLBACK_MODELS = [
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fp8",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.1-8b-instruct",
  "@cf/meta/llama-3-8b-instruct",
];

export async function callCloudflareAI({ env, systemPrompt, history, message }) {
  if (!env.AI) throw new Error("Cloudflare Workers AI 바인딩(AI)이 설정되어 있지 않다능!");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];

  const candidates = env.WORKERS_AI_MODEL
    ? [env.WORKERS_AI_MODEL, ...WORKERS_AI_FALLBACK_MODELS]
    : WORKERS_AI_FALLBACK_MODELS;

  let lastErr;
  for (const modelId of candidates) {
    try {
      const result = await env.AI.run(modelId, { messages });
      return result.response ?? "";
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`모든 Workers AI 모델 후보가 실패했다능 (마지막 오류: ${lastErr?.message || lastErr})`);
}
