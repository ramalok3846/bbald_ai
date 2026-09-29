# 빨드 AI 🦕

빨간 공룡 인형 "빨드"를 모델로 만든, 멍청하지만 사랑스러운 캐릭터 챗봇 서비스입니다.
Cloudflare Workers 기반으로 동작하며, 빨드는 기본적으로 자체 내장된 간단한 규칙으로 대답하다가
설정에서 Gemini / ChatGPT(OpenAI) / Claude / Cloudflare Workers AI API를 연결하면 더 똑똑한(?) 두뇌를 빌려옵니다.

## 캐릭터 설정

- 평소엔 1+1도 헷갈려하는 개그 캐릭터. 계산 질문은 서버가 직접 가로채서 엉뚱한 답을 귀엽게 돌려줍니다.
- 콩글리시 발음체 말투 (`쵸~~꼴--륏!!`, `~다능`, `뿌잉뿌잉` 등).
- 한국 시간(KST) 오후 3시부터 **그날 서울의 실제 일몰 시각**(suncalc로 계산)까지 서서히 똑똑해지다가,
  일몰 이후 3시간에 걸쳐 다시 서서히 멍청해집니다 — 고정된 시간대가 아니라 계절별 일몰 시각을 실시간
  반영합니다 (`src/bbald.js`의 `computeSmartLevel`/`getSunsetKstMinutes`).
- 시간/일몰 계산은 3단계로 안전하게 대체됩니다: ① 서버(`/api/time`, suncalc)가 1순위 ②
  서버 연결이 안 되면 브라우저에 로드된 SunCalc로 로컬 계산(순수 계산이라 인터넷 불필요) ③
  SunCalc 스크립트조차 못 불러왔으면 평균 일몰(18:30)로 근사합니다.
- 실제 AI(외부 API) 호출로 크레딧을 조금 많이 쓰면, 10번 중 4번 정도 확률로
  "빨드 영양 보충중입니다! 빨드 쵸콜릿 먹는 중!🍫" 같은 대사가 추가로 출력됩니다.

## 구조

```
public/            정적 프론트엔드 (Claude 데스크탑 앱과 비슷한 사이드바 + 채팅 UI)
  index.html
  style.css
  app.js
  icon-*.png       빨드 얼굴로 만든 원형 아이콘
src/
  worker.js        Cloudflare Worker 진입점 (/api/chat, /api/time)
  bbald.js         빨드 성격/개그 로직, KST 시간 판정
  providers.js      Gemini/OpenAI/Claude/Cloudflare Workers AI 호출 래퍼
wrangler.toml
```

## 크레딧 & 모델

- **크레딧은 서버(Cloudflare KV)가 유일한 출처입니다.** 클라이언트는 표시만 하고,
  실제 잔액 조회/차감/지급은 전부 `src/credits.js`가 서버에서 처리합니다 (`/api/credits`,
  `/api/bonus`, `/api/chat`). 예전엔 클라이언트가 보낸 숫자를 그대로 믿어서 설정 화면에서
  크레딧을 무한정 입력할 수 있었는데, 그 구멍을 막았습니다.
- 신규 사용자는 100 크레딧으로 시작 (게스트는 IP, 로그인 사용자는 Firebase uid로 식별)
- 빨드 기본 / Cloudflare Workers AI: 응답당 1 크레딧
- Gemini / ChatGPT / Claude: 응답당 3 크레딧
- Claude 모델 선택지(자체 브랜딩): 빨드 라이트(Haiku 4.5) / 빨드 기본(Sonnet 5) /
  빨드 딥씽킹(Opus 5.5) / 빨드 스토리(Fable 5.1)

API 키는 설정 모달에 입력하면 브라우저에만 저장되고, 매 요청마다 Worker로 전달되어
해당 제공자 API를 호출하는 데만 사용됩니다 (서버에 별도 저장하지 않습니다).

## 추가 기능 (2차 업데이트)

- 빨드 아이콘은 오른쪽을 바라보도록 좌우 반전되어 있고, 빨드의 말풍선은 항상 왼쪽 정렬입니다.
- 회원가입/로그인은 Firebase Auth(구글 + 이메일/비밀번호)를 붙일 수 있도록 `public/auth.js` +
  `public/firebase-config.js`로 스캐폴딩했습니다. `firebase-config.js`에 실제 프로젝트 키를 채우기 전까지는
  "게스트 모드"로 정상 동작하며, 로그인하면 계정당 1회 가입 보너스 크레딧(100)을 서버가 지급합니다.
- 채팅창에 무작위로 빨드 스티커가 나타나고, 클릭하면 크레딧을 받습니다(금액은 서버가 결정, 스팸 클릭
  방지를 위해 신원당 20초 쿨다운이 있습니다).
- 프로필 사진: 설정에서 URL을 직접 넣거나, 구글 로그인 시 구글 프로필 사진이 기본 적용됩니다.
  사용자 아이콘이 없으면 채팅창에는 "USER" 텍스트 아이콘이 표시됩니다.
- 이미지 첨부는 로컬 파일 업로드(📎), 이미지 URL(🔗), 클립보드 붙여넣기(Ctrl+V) 세 가지 방식을 모두 지원하며,
  Claude/ChatGPT/Gemini로 보내면 실제 이미지 인식이 가능합니다 (빨드 기본/Cloudflare Workers AI는 귀엽게 반응만 함).
- 설정 모달에 이메일 변경/비밀번호 변경 UI가 있으며, Firebase 연동 후 실제로 동작합니다.
- 하루 사용량 제한(과사용/악용 방지)을 `src/rate-limit.js`로 추가했습니다. Cloudflare 대시보드에서
  KV 네임스페이스를 만들어 `wrangler.toml`의 `RATE_LIMIT_KV` 바인딩을 켜기 전까지는 제한 없이 동작하고,
  켜면 IP당 provider별 하루 요청 횟수를 KST 자정 기준으로 제한합니다 (초과 시 429 응답 + 귀여운 대사).
- 화면 비율을 자동 인식해서 모바일/PC 모두 최적화되어 있습니다. 좁은 화면에서는 사이드바가
  햄버거 버튼(☰)으로 여닫히는 슬라이드 패널로 바뀌고, 상단 provider/모델 선택도 줄바꿈되며,
  말풍선/이미지 크기도 화면 폭에 비례해서 줄어듭니다.
- 공지사항(📢) 모달에 스티커 이벤트/가입 보너스/노을모드 안내를 이미지와 함께 소개합니다.
- 랜덤 빨드 스티커는 1.5~4분 간격으로 4초만 나타나고, 클릭하면 크레딧 10~30개를 랜덤 지급합니다.
- Cloudflare Workers AI 모델은 카탈로그가 자주 바뀌고 예고 없이 폐기(deprecate)되기 때문에,
  `src/providers.js`가 여러 후보 모델을 순서대로 시도합니다. 대시보드에서 `WORKERS_AI_MODEL`
  환경변수로 원하는 모델을 지정할 수도 있습니다.
- `app.js`/`style.css`/`auth.js`/`firebase-config.js`는 `index.html`에서 `?v=` 쿼리스트링으로
  캐시를 무효화합니다. 프록시(예: `ramalok.kr/bbald_ai`) 경유 시 옛날 버전이 캐싱되어 남아있는
  문제를 겪었다면, 수정 후 이 버전 번호를 올려주세요.

## 로컬 개발

```bash
npm install
npm run dev
```

## Cloudflare 배포

이 리포는 Cloudflare Workers 정적 자산(assets) + Workers AI 바인딩을 사용합니다.

```bash
npm install
npx wrangler login
npm run deploy
```

`ramalok.kr` 도메인이 이미 Cloudflare 네임서버로 연결되어 있다면, 배포 후
Cloudflare 대시보드 → Workers & Pages → `bbald-ai` → Settings → Domains & Routes 에서
원하는 서브도메인(예: `bbald.ramalok.kr`)을 연결하거나, `wrangler.toml`의 주석 처리된
`[[routes]]` 블록을 활성화하면 됩니다.
