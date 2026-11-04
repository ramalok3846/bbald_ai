// 욕설·비속어 필터. 기본 금지어 목록 + 관리자가 더한 단어(extraWords) − 관리자가 허용한 단어(allowWords).
// 띄어쓰기·특수문자·반복 글자로 우회하는 걸 막으려고, 검사 전에 문장을 정규화한다
// ("시 발", "시.발", "ㅅㅂ", "씨이발" 등). 정상 단어를 잘못 막는 걸 줄이려고 너무 흔한 짧은 단어는
// 기본 목록에 넣지 않았다 — 필요하면 관리자 화면에서 단어를 더하면 된다.

const BASE_WORDS = [
  "시발", "씨발", "시팔", "씨팔", "ㅅㅂ", "ㅆㅂ",
  "병신", "ㅂㅅ", "븅신", "빙신",
  "지랄", "ㅈㄹ", "좆", "존나", "졸라", "ㅈㄴ",
  "개새끼", "개새", "새끼야", "쌔끼", "썅", "씹새", "개년", "쌍년", "미친놈", "미친년", "또라이",
  "닥쳐", "꺼져라", "엿먹", "느금", "니애미", "니엄마", "패드립", "섹스", "야동", "ㅗ",
  "fuck", "fck", "shit", "bitch", "asshole", "dick", "cunt", "bastard",
];

// 자음/모음 사이 장식, 공백, 특수문자 제거 + 소문자 + 같은 글자 3번 이상 반복은 1개로
export function normalizeForFilter(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\s​-‏⁠﻿._\-~`'"!@#$%^&*()+=\[\]{}|\\/:;,<>?·ㆍ•]+/g, "")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/\$/g, "s");
}

function activeWords(filterCfg) {
  const allow = new Set((filterCfg.allowWords || []).map((w) => normalizeForFilter(w)));
  const all = [...BASE_WORDS, ...(filterCfg.extraWords || [])].map((w) => normalizeForFilter(w)).filter(Boolean);
  return [...new Set(all)].filter((w) => !allow.has(w));
}

// 걸리는 단어를 돌려준다 (없으면 null)
export function findBadWord(text, filterCfg) {
  if (!filterCfg?.enabled) return null;
  const norm = normalizeForFilter(text);
  if (!norm) return null;
  for (const w of activeWords(filterCfg)) {
    if (norm.includes(w)) return w;
  }
  return null;
}

// 원문에서 금지어를 ***로 가린다 (띄어쓰기 우회까지 잡으려고 글자 단위로 대응시켜 가린다).
export function maskBadWords(text, filterCfg) {
  if (!filterCfg?.enabled) return text;
  const src = String(text || "");
  const keep = [];
  let norm = "";
  for (let i = 0; i < src.length; i++) {
    const n = normalizeForFilter(src[i]);
    if (n) {
      norm += n;
      for (let j = 0; j < n.length; j++) keep.push(i);
    }
  }
  const hide = new Set();
  for (const w of activeWords(filterCfg)) {
    let from = 0;
    for (;;) {
      const at = norm.indexOf(w, from);
      if (at < 0) break;
      for (let k = at; k < at + w.length; k++) hide.add(keep[k]);
      from = at + w.length;
    }
  }
  if (!hide.size) return src;
  return [...src].map((ch, i) => (hide.has(i) ? "*" : ch)).join("");
}
