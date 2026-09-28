// 각 AI 제공자(Provider) 호출 래퍼. 사용자가 설정 화면에서 넣은 API 키를 그대로 요청에만 사용하고 서버에 저장하지 않는다.

export const CLAUDE_MODELS = {
  "fable-5.1": "claude-fable-5-1",
  "opus-5.5": "claude-opus-5-5",
  "sonnet-5": "claude-sonnet-5",
  "haiku-4.5": "claude-haiku-4-5-20251001",
};

export async function callAnthropic({ apiKey, model, systemPrompt, history, message }) {
  const modelId = CLAUDE_MODELS[model] || CLAUDE_MODELS["sonnet-5"];
  const messages = [
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
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

export async function callOpenAI({ apiKey, systemPrompt, history, message }) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
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

export async function callGemini({ apiKey, systemPrompt, history, message }) {
  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: message }] },
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

export async function callCloudflareAI({ env, systemPrompt, history, message }) {
  if (!env.AI) throw new Error("Cloudflare Workers AI 바인딩(AI)이 설정되어 있지 않다능!");
  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
    { role: "user", content: message },
  ];
  const result = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { messages });
  return result.response ?? "";
}
