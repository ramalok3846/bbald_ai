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
export const CONV_ID_RE = /^[a-z0-9]{8,40}$/;
function shareKey(shareId) {
  return `share:${shareId}`;
}
function newShareId() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join("");
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
  if (id && !CONV_ID_RE.test(id)) throw new Error("대화 번호 형식이 올바르지 않다능");
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
    visibility: existing?.visibility || "private", // private | link | public
    shareId: existing?.shareId || null,
  };
  await env.RATE_LIMIT_KV.put(convKey(uid, convId), JSON.stringify(record));

  const list = await listConversations(env, uid);
  const idx = list.findIndex((c) => c.id === convId);
  const summary = { id: convId, title: record.title, updatedAt: now, visibility: record.visibility, shareId: record.shareId };
  if (idx >= 0) list[idx] = summary;
  else list.push(summary);
  await saveList(env, uid, list);

  return record;
}

export async function deleteConversation(env, uid, id) {
  if (!env.RATE_LIMIT_KV) return;
  const existing = await getConversation(env, uid, id);
  if (existing?.shareId) await env.RATE_LIMIT_KV.delete(shareKey(existing.shareId));
  await env.RATE_LIMIT_KV.delete(convKey(uid, id));
  const list = await listConversations(env, uid);
  await saveList(env, uid, list.filter((c) => c.id !== id));
}

// 공유 범위 설정. private(나만) / link(링크를 아는 사람) / public(전체 공개, 공개 목록에도 나옴)
export async function setVisibility(env, uid, id, visibility) {
  if (!env.RATE_LIMIT_KV) throw new Error("저장소(RATE_LIMIT_KV)가 설정되어 있지 않다능");
  if (!["private", "link", "public"].includes(visibility)) throw new Error("공개 범위가 올바르지 않다능");
  const conv = await getConversation(env, uid, id);
  if (!conv) return null;
  if (visibility === "private") {
    if (conv.shareId) await env.RATE_LIMIT_KV.delete(shareKey(conv.shareId));
    conv.shareId = null;
  } else {
    if (!conv.shareId) conv.shareId = newShareId();
    await env.RATE_LIMIT_KV.put(shareKey(conv.shareId), JSON.stringify({ uid, id, visibility }));
  }
  conv.visibility = visibility;
  await env.RATE_LIMIT_KV.put(convKey(uid, id), JSON.stringify(conv));
  const list = await listConversations(env, uid);
  const idx = list.findIndex((c) => c.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], visibility, shareId: conv.shareId };
    await saveList(env, uid, list);
  }
  return { visibility, shareId: conv.shareId };
}

// 공유 링크로 보는 대화 (읽기 전용, 로그인 필요 없음). 주인 정보는 내보내지 않는다.
export async function getSharedConversation(env, shareId) {
  if (!env.RATE_LIMIT_KV || !/^[a-z0-9]{8,40}$/.test(shareId || "")) return null;
  const raw = await env.RATE_LIMIT_KV.get(shareKey(shareId));
  if (!raw) return null;
  try {
    const ref = JSON.parse(raw);
    const conv = await getConversation(env, ref.uid, ref.id);
    if (!conv || conv.visibility === "private" || conv.shareId !== shareId) return null;
    return { title: conv.title, messages: conv.messages, visibility: conv.visibility, updatedAt: conv.updatedAt };
  } catch {
    return null;
  }
}
