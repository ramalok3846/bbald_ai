// 로그인 사용자용 서버 저장 대화 기록 (ChatGPT/Claude처럼 여러 대화를 목록으로
// 보여주고 다시 불러올 수 있게). 게스트는 여기 접근 자체가 없다 — "비로그인은
// 저장 안 됨" 요구사항은 이 모듈을 아예 안 쓰는 것으로 구현된다.
// 저장 위치는 기존에 쓰던 RATE_LIMIT_KV를 재사용한다 (새 네임스페이스 불필요).

const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONV = 200;

function convKey(uid, id) {
  return `conv:${uid}:${id}`;
}
function convListKey(uid) {
  return `convlist:${uid}`;
}
function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listConversations(env, uid) {
  if (!env.RATE_LIMIT_KV) return [];
  const raw = await env.RATE_LIMIT_KV.get(convListKey(uid));
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function saveList(env, uid, list) {
  const trimmed = list
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONVERSATIONS);
  await env.RATE_LIMIT_KV.put(convListKey(uid), JSON.stringify(trimmed));
  return trimmed;
}

export async function getConversation(env, uid, id) {
  if (!env.RATE_LIMIT_KV) return null;
  const raw = await env.RATE_LIMIT_KV.get(convKey(uid, id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// messages: [{ role, content }]. id가 없으면 새로 만든다.
export async function saveConversation(env, uid, { id, title, messages }) {
  if (!env.RATE_LIMIT_KV) throw new Error("저장소(RATE_LIMIT_KV)가 설정되어 있지 않다능");
  const convId = id || newId();
  const now = Date.now();
  const trimmedMessages = Array.isArray(messages) ? messages.slice(-MAX_MESSAGES_PER_CONV) : [];
  const existing = id ? await getConversation(env, uid, id) : null;
  const record = {
    id: convId,
    title: title || existing?.title || trimmedMessages[0]?.content?.slice(0, 24) || "새 대화",
    messages: trimmedMessages,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await env.RATE_LIMIT_KV.put(convKey(uid, convId), JSON.stringify(record));

  const list = await listConversations(env, uid);
  const idx = list.findIndex((c) => c.id === convId);
  const summary = { id: convId, title: record.title, updatedAt: now };
  if (idx >= 0) list[idx] = summary;
  else list.push(summary);
  await saveList(env, uid, list);

  return record;
}

export async function deleteConversation(env, uid, id) {
  if (!env.RATE_LIMIT_KV) return;
  await env.RATE_LIMIT_KV.delete(convKey(uid, id));
  const list = await listConversations(env, uid);
  await saveList(env, uid, list.filter((c) => c.id !== id));
}
