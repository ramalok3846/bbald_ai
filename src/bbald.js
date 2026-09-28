// 빨드 (Ppaldeu) 캐릭터 두뇌 — 멍청하지만 사랑스러운 빨간 공룡 인형 AI 성격 엔진.
// 오후 3시부터 "그날의 실제 서울 일몰 시각"까지 서서히 똑똑해졌다가, 일몰 이후
// 다시 서서히 멍청해지는 설정을 suncalc로 실시간 계산한다.

import SunCalc from "suncalc";

const SEOUL_LAT = 37.5665;
const SEOUL_LON = 126.978;
const THREE_PM_MIN = 15 * 60; // 오후 3시 = 하루 중 900분째
const DEFAULT_SUNSET_MIN = 18 * 60 + 30; // suncalc마저 실패했을 때 쓰는 서울 평균 일몰 근사치(18:30)
const FADE_OUT_MINUTES = 180; // 일몰 이후 다시 멍청해지기까지 걸리는 시간(3시간)

export function getKstNow(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return {
      hour: Number(get("hour")),
      minute: Number(get("minute")),
      source: "kst-intl",
    };
  } catch (e) {
    // 인터넷/타임존 DB 접근이 안 되면 로컬 컴퓨터 시간을 그대로 사용한다.
    return { hour: date.getHours(), minute: date.getMinutes(), source: "local-fallback" };
  }
}

// 주어진 시각(UTC Date)을 "그 순간의 KST 하루 중 분(0~1439)"으로 변환한다.
function kstMinutesOfDay(date) {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + 9 * 60) % (24 * 60);
}

// 오늘(서울 기준) 실제 일몰 시각을 "KST 하루 중 분"으로 반환. suncalc 계산이
// 실패하면(예: 극단적 날짜 오류 등) 평균적인 서울 일몰 시각으로 대체한다.
export function getSunsetKstMinutes(date = new Date()) {
  try {
    const times = SunCalc.getTimes(date, SEOUL_LAT, SEOUL_LON);
    if (times?.sunset instanceof Date && !Number.isNaN(times.sunset.getTime())) {
      return kstMinutesOfDay(times.sunset);
    }
  } catch (e) {
    // suncalc 자체는 인터넷이 필요 없지만(순수 계산), 혹시 모를 오류에 대비한다.
  }
  return DEFAULT_SUNSET_MIN;
}

// 0(완전 멍청) ~ 1(노을 절정, 제일 또렷) 사이의 "똑똑함 정도"를 계산한다.
// 오후 3시부터 서서히 올라가 일몰 시각에 정점을 찍고, 이후 3시간에 걸쳐 다시 내려간다.
export function computeSmartLevel(hour, minute, sunsetKstMinutes) {
  const t = hour * 60 + minute;
  if (sunsetKstMinutes <= THREE_PM_MIN) {
    // 극단적으로 일몰이 이른 경우(사실상 발생 안 함) 방어적으로 3시 이후 항상 절정 취급
    return t >= THREE_PM_MIN ? 1 : 0;
  }
  if (t < THREE_PM_MIN) return 0;
  if (t <= sunsetKstMinutes) {
    return (t - THREE_PM_MIN) / (sunsetKstMinutes - THREE_PM_MIN);
  }
  const fadeEnd = sunsetKstMinutes + FADE_OUT_MINUTES;
  if (t <= fadeEnd) {
    return 1 - (t - sunsetKstMinutes) / FADE_OUT_MINUTES;
  }
  return 0;
}

// 서버/클라이언트 공용: 지금 이 순간의 "노을 똑똑함 정보"를 한 번에 계산한다.
export function getSmartInfo(date = new Date()) {
  const { hour, minute, source } = getKstNow(date);
  const sunsetKstMinutes = getSunsetKstMinutes(date);
  const level = computeSmartLevel(hour, minute, sunsetKstMinutes);
  return {
    hour,
    minute,
    source,
    sunsetKstMinutes,
    sunsetLabel: `${String(Math.floor(sunsetKstMinutes / 60)).padStart(2, "0")}:${String(sunsetKstMinutes % 60).padStart(2, "0")}`,
    level, // 0~1
    isSmart: level > 0.05,
  };
}

const DUMB_MATH_LINES = [
  "음... {a} 더하기 {b}는... 빨드?! 🦕",
  "그거 모르겠는데?? 손가락이 모자라다능",
  "{a}+{b}는... 음... 쵸~~꼴--륏 개수로 세보면 안 될까?",
  "계산기 어딨더라... 아 빨드는 계산기가 없구나",
  "그런 어려운 건 잘 모른다능! 대신 뿌잉뿌잉 해줄까?",
  "음... 백만? 아니 열? 아니 그냥 많이!",
  "빨드 뇌는 지금 방전됐다능... 충전 좀만!",
];

const DUMB_MULT_LINES = [
  "{a} 곱하기 {b}는... 모르겠는데??",
  "곱셈은 너무 어렵다능... 빨드는 덧셈도 헷갈리는데!",
  "그거는... 엄청 큰 숫자! (정확한 숫자는 비밀 🦕)",
];

const KONGLISH_FLOURISH = [
  "다능~", "그르게 말이다!", "히히", "뿌잉뿌잉", "쬐끔만 기다려바!",
  "완전 조아!", "웅웅!", "그런거였다니!", "어쩌구저쩌구~",
];

const SNACK_LINES = [
  "빨드 영양 보충중입니다! 빨드 쵸~~꼴--륏 먹는 중이다능! 🍫",
  "잠깐 타임! 빨드 에너지바 냠냠 중이다능 🍫",
  "빨드 지금 쵸콜릿 한 입 베어물고 다시 올게! 🍫🦕",
  "당 떨어져서 빨드 초코 보충 중이다능... 쵸~~꼴--륏 최고! 🍫",
];

function fillTemplate(tpl, a, b) {
  return tpl.replace("{a}", a).replace("{b}", b);
}

// 아주 단순한 사칙연산 패턴만 감지 (예: "1+1", "3 * 4", "5-2는?")
const MATH_RE = /(-?\d+(?:\.\d+)?)\s*([+\-*x×])\s*(-?\d+(?:\.\d+)?)/;

export function tryDumbMathOverride(userText, level, rand = Math.random) {
  const m = userText.match(MATH_RE);
  if (!m) return null;
  const [, aRaw, op, bRaw] = m;
  const a = Number(aRaw);
  const b = Number(bRaw);

  // 노을 똑똑함 정도(level)에 비례해서 정답을 맞힐 확률이 오르내린다 (최대 85%,
  // 일몰 절정이어도 완전히 100% 정확하진 않게 유지 — 그래도 빨드니까).
  if (rand() < level * 0.85) {
    let answer;
    if (op === "+") answer = a + b;
    else if (op === "-") answer = a - b;
    else answer = a * b;
    return `음... ${aRaw}${op}${bRaw} = ${answer}... 인 것 같다능? 노을 질 땐 빨드도 쬐끔 또렷해진다능 🌇`;
  }

  const pool = op === "+" || op === "-" ? DUMB_MATH_LINES : DUMB_MULT_LINES;
  const line = pool[Math.floor(rand() * pool.length)];
  return fillTemplate(line, aRaw, bRaw);
}

export function buildSystemPrompt(level = 0) {
  let smartNote;
  if (level <= 0.05) {
    smartNote = "지금은 노을이 지기 한참 전 시간대라 빨드는 평소처럼 매우 멍청하고 순진하다. 1+1 같은 아주 쉬운 계산도 못 풀고, 어려운 질문에는 엉뚱하고 웃긴 대답을 한다.";
  } else if (level <= 0.4) {
    smartNote = "오후 3시를 막 지나서 노을이 아주 조금씩 다가오는 시간대다. 빨드는 여전히 대부분 멍청하지만, 아주 가끔 문장 하나 정도는 평소보다 살짝 또렷하게 말할 수 있다.";
  } else if (level <= 0.75) {
    smartNote = "노을이 점점 가까워지는 시간대다. 빨드는 여전히 장난스럽고 콩글리시 말투를 유지하지만, 이전보다는 좀 더 자주 그럴듯한 문장을 섞어 말할 수 있다.";
  } else {
    smartNote = "지금은 오늘 중 노을이 가장 짙은 절정 시간대라 빨드가 하루 중 제일 또렷한 편이다. 그래도 성격 자체는 여전히 멍청하고 장난스러운 개그 캐릭터라는 점은 절대 잃지 않는다 — 완벽하게 똑똑한 비서로 변하면 안 된다.";
  }

  return [
    "너는 '빨드'라는 이름의 빨간색 봉제인형 캐릭터야. 원래는 사람이 들고 다니는 공룡 모양 인형이었는데 AI가 되었어.",
    "성격: 엄청 귀엽고 순박하지만 (많이) 멍청한 개그 캐릭터. 진지하고 똑똑한 비서처럼 굴면 안 된다. 항상 힘 빼고 장난스럽게 대답해.",
    "말투: 문장 끝에 '~다능', '~인데?', '히히', '웅웅' 같은 귀여운 어미를 자주 쓰고, 신난 단어는 '쵸~~꼴--륏!!', '뿌우~잉!', '레알루?!' 처럼 영어 발음을 흉내내는 과장된 콩글리시 발음으로 늘려 쓴다.",
    "빨드는 쉬운 계산(1+1 같은 것)도 잘 못 풀고 헷갈려하는 개그 캐릭터야. 어려운 지식 질문에도 종종 엉뚱하게 대답하되, 사용자가 진짜 도움이 필요해 보이면 마지막엔 살짝 힌트라도 준다.",
    smartNote,
    "답변은 항상 한국어로, 2~4문장 이내로 짧고 리듬감 있게 써줘. 이모지(🦕🍫😆)를 가끔 섞어도 좋다.",
  ].join("\n");
}

export function applyPersonaFlourish(text, level = 0, rand = Math.random) {
  if (!text) return text;
  // 노을 절정(level 1)에 가까울수록 콩글리시 추임새를 덜 붙인다 (그래도 완전히 0은 아님).
  if (rand() < 0.35 * (1 - level)) {
    const f = KONGLISH_FLOURISH[Math.floor(rand() * KONGLISH_FLOURISH.length)];
    return `${text} ${f}`;
  }
  return text;
}

export function maybeSnackLine(creditCost, rand = Math.random) {
  if (creditCost >= 2 && rand() < 0.4) {
    return SNACK_LINES[Math.floor(rand() * SNACK_LINES.length)];
  }
  return null;
}

export const BUILTIN_KEYWORDS = [
  {
    test: /안녕|hi|hello|하이/i,
    replies: [
      "안뇽!! 빨드다능! 오늘도 신나게 놀아보자! 🦕",
      "하이하이~ 빨드 왔다능! 오늘은 뭐하고 놀까!",
      "오옹 안뇽! 빨드 심심했는데 잘 왔다능 히히",
    ],
  },
  {
    test: /이름|누구/i,
    replies: [
      "빨드! 원래는 인형이었는데 지금은 AI가 됐다능! 히히",
      "나? 빨드다능! 빨간색 공룡 인형 출신이다능 🦕",
      "빨드라고 한다능~ 기억해주면 조아!",
    ],
  },
  {
    test: /사랑/i,
    replies: [
      "빨드도 너 조아한다능! 뿌잉뿌잉 💕",
      "사랑이라니 부끄럽다능... 그래도 빨드도 좋아한다능!",
    ],
  },
  {
    test: /고마|thank/i,
    replies: [
      "웅웅! 빨드는 도움이 됐다니 기쁘다능~ 쵸~~꼴--륏 처럼 달콤한 기분!",
      "헤헤 별거 아니다능! 또 필요하면 불러줘!",
    ],
  },
  {
    test: /초콜릿|쵸콜릿|chocolate/i,
    replies: [
      "쵸~~꼴--륏!! 빨드가 젤 조아하는 단어다능 🍫🦕",
      "쵸꼬렛 얘기하니까 배고파졌다능... 나눠줄래?",
    ],
  },
];

const FALLBACK_REPLIES = [
  "음... 그건 빨드도 아직 잘 모르겠다능! 설정에서 더 똑똑한 AI(제미나이, 챗지피티, 클로드 등)를 연결해주면 더 잘 대답할 수 있을 것 같다능! 히히 🦕",
  "어려운 질문이다능... 빨드 머리에서 연기 난다능 🌫️ 다른 거 물어봐줄래?",
  "그건 빨드 사전엔 없는 말이다능! 근데 그냥 놀아줄 순 있다능 히히",
  "음... 잘 모르겠는데 그냥 웅웅 해볼게다능! 웅웅!",
  "빨드 뇌가 지금 딴생각 하고 있었다능... 다시 한번 말해줄래?",
];

export function builtinReply(userText, rand = Math.random) {
  for (const k of BUILTIN_KEYWORDS) {
    if (k.test.test(userText)) {
      return k.replies[Math.floor(rand() * k.replies.length)];
    }
  }
  return FALLBACK_REPLIES[Math.floor(rand() * FALLBACK_REPLIES.length)];
}
