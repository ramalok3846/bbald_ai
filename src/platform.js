// Cloudflare가 아닌 곳(Vercel 등)에서 같은 Worker 코드를 돌리기 위한 어댑터.
// Cloudflare에서는 KV/AI/ASSETS 바인딩이 자동으로 들어오지만, Vercel에는 없으므로 환경변수로 대신 만든다:
//   저장소(KV 대신)  UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN   (Vercel Marketplace의 Upstash Redis/KV를 붙이면
//                    KV_REST_API_URL + KV_REST_API_TOKEN 으로 들어오는데 그것도 인식한다)
//   Cloudflare 두뇌  CF_ACCOUNT_ID + CF_API_TOKEN (Workers AI REST API) — 없으면 Cloudflare 두뇌만 꺼진다

export function upstashKV({ url, token }) {
  const call = async (cmd) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(cmd),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) throw new Error(j.error || `Upstash HTTP ${res.status}`);
    return j.result;
  };
  return {
    async get(key) {
      const v = await call(["GET", key]);
      return v === undefined ? null : v;
    },
    async put(key, value, opts) {
      const cmd = ["SET", key, String(value)];
      if (opts?.expirationTtl) cmd.push("EX", Math.max(1, Math.ceil(opts.expirationTtl)));
      await call(cmd);
    },
    async delete(key) {
      await call(["DEL", key]);
    },
    // Cloudflare KV의 list({prefix, limit, cursor}) 와 같은 모양으로 돌려준다.
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      let cur = cursor || "0";
      const names = [];
      do {
        const [next, batch] = await call(["SCAN", cur, "MATCH", `${prefix}*`, "COUNT", 200]);
        names.push(...batch);
        cur = String(next);
      } while (cur !== "0" && names.length < limit);
      return { keys: names.slice(0, limit).map((name) => ({ name })), cursor: cur === "0" ? undefined : cur, list_complete: cur === "0" };
    },
  };
}

export function cloudflareRestAI({ accountId, apiToken }) {
  return {
    async run(model, input) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.success === false) throw new Error(j.errors?.[0]?.message || `Workers AI HTTP ${res.status}`);
      return j.result;
    },
  };
}

// process.env(Vercel) → Worker가 기대하는 env 객체
export function buildEnvFromProcess(penv = {}) {
  const url = penv.UPSTASH_REDIS_REST_URL || penv.KV_REST_API_URL;
  const token = penv.UPSTASH_REDIS_REST_TOKEN || penv.KV_REST_API_TOKEN;
  return {
    PLATFORM: "vercel",
    RATE_LIMIT_KV: url && token ? upstashKV({ url, token }) : undefined,
    AI: penv.CF_ACCOUNT_ID && penv.CF_API_TOKEN ? cloudflareRestAI({ accountId: penv.CF_ACCOUNT_ID, apiToken: penv.CF_API_TOKEN }) : undefined,
    WORKERS_AI_MODEL: penv.WORKERS_AI_MODEL,
    BBALD_PROXY_SECRET: penv.BBALD_PROXY_SECRET,
    BBALD_ALLOWED_HOSTS: penv.BBALD_ALLOWED_HOSTS,
    BBALD_CANONICAL_URL: penv.BBALD_CANONICAL_URL,
  };
}
