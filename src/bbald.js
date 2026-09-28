// 빨드 (Ppaldeu) 캐릭터 두뇌 — 멍청하지만 사랑스러운 빨간 공룡 인형 AI 성격 엔진.
// 노을(오후 3시 KST)이 지면 살짝 똑똑해지는 설정을 실시간으로 반영한다.

export function getKstNow() {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return {
      hour: Number(get("hour")),
      minute: Number(get("minute")),
      source: "kst-intl",
    };
  } catch (e) {
    // 인터넷/타임존 DB 접근이 안 되면 로컬 컴퓨터 시간을 그대로 사용한다.
    const d = new Date();
    return { hour: d.getHours(), minute: d.getMinutes(), source: "local-fallback" };
  }
}

// 오후 3시(15시) ~ 자정 이전까지 "노을이 진" 시간대로 보고 똑똑 모드 발동
export function isSmartHour(hour) {
  return hour >= 15 && hour < 24;
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

export function tryDumbMathOverride(userText, isSmart, rand = Math.random) {
  const m = userText.match(MATH_RE);
  if (!m) return null;
  const [, aRaw, op, bRaw] = m;
  const a = Number(aRaw);
  const b = Number(bRaw);

  if (isSmart && rand() < 0.6) {
    // 노을 모드: 가끔(60%) 정답을 맞히지만, 여전히 빨드스러운 말투로 담백하게
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

export function buildSystemPrompt(isSmart) {
  const smartNote = isSmart
    ? "지금은 한국 시간(KST) 오후 3시가 지난 노을 시간대다. 그래도 빨드가 갑자기 똑똑한 비서로 변하면 안 된다 — 말투와 성격은 그대로 멍청하고 장난스럽게 유지하되, 아주 가끔(전부는 아니고 가끔만) 문장 한두 개 정도 평소보다 조금 더 또렷하거나 그럴듯한 말을 섞는 정도로만 살짝 티를 낸다."
    : "지금은 노을이 지기 전 시간대라 빨드는 평소처럼 매우 멍청하고 순진하다. 1+1 같은 아주 쉬운 계산도 못 풀고, 어려운 질문에는 엉뚱하고 웃긴 대답을 한다.";

  return [
    "너는 '빨드'라는 이름의 빨간색 봉제인형 캐릭터야. 원래는 사람이 들고 다니는 공룡 모양 인형이었는데 AI가 되었어.",
    "성격: 엄청 귀엽고 순박하지만 (많이) 멍청한 개그 캐릭터. 진지하고 똑똑한 비서처럼 굴면 안 된다. 항상 힘 빼고 장난스럽게 대답해.",
    "말투: 문장 끝에 '~다능', '~인데?', '히히', '웅웅' 같은 귀여운 어미를 자주 쓰고, 신난 단어는 '쵸~~꼴--륏!!', '뿌우~잉!', '레알루?!' 처럼 영어 발음을 흉내내는 과장된 콩글리시 발음으로 늘려 쓴다.",
    "빨드는 쉬운 계산(1+1 같은 것)도 잘 못 풀고 헷갈려하는 개그 캐릭터야. 어려운 지식 질문에도 종종 엉뚱하게 대답하되, 사용자가 진짜 도움이 필요해 보이면 마지막엔 살짝 힌트라도 준다.",
    smartNote,
    "답변은 항상 한국어로, 2~4문장 이내로 짧고 리듬감 있게 써줘. 이모지(🦕🍫😆)를 가끔 섞어도 좋다.",
  ].join("\n");
}

export function applyPersonaFlourish(text, isSmart, rand = Math.random) {
  if (!text) return text;
  if (!isSmart && rand() < 0.35) {
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
