# 빨드 AI 🦕

빨간 공룡 인형 "빨드"를 모델로 만든, 멍청하지만 사랑스러운 캐릭터 챗봇 서비스입니다.
Cloudflare Workers 기반으로 동작하며, 빨드는 기본적으로 자체 내장된 간단한 규칙으로 대답하다가
설정에서 Gemini / ChatGPT(OpenAI) / Claude / Cloudflare Workers AI API를 연결하면 더 똑똑한(?) 두뇌를 빌려옵니다.

## 캐릭터 설정

- 평소엔 1+1도 헷갈려하는 개그 캐릭터. 계산 질문은 서버가 직접 가로채서 엉뚱한 답을 귀엽게 돌려줍니다.
- 콩글리시 발음체 말투 (`쵸~~꼴--륏!!`, `~다능`, `뿌잉뿌잉` 등).
- 한국 시간(KST) 기준 오후 3시가 지나면 "노을 모드"로 들어가 조금 더 똑똑해집니다. (`src/bbald.js`)
- 인터넷 연결이 안 되는 등 서버 시간 조회에 실패하면, 브라우저는 로컬 컴퓨터 시간을 기준으로 표시를 대체합니다.
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

- 기본 크레딧 100 (브라우저 localStorage에 저장, 설정에서 재충전 가능)
- 빨드 기본 / Cloudflare Workers AI: 응답당 1 크레딧
- Gemini / ChatGPT / Claude: 응답당 3 크레딧
- Claude 모델 선택지: Fable 5.1 / Opus 5.5 / Sonnet 5 / Haiku 4.5

API 키는 설정 모달에 입력하면 브라우저에만 저장되고, 매 요청마다 Worker로 전달되어
해당 제공자 API를 호출하는 데만 사용됩니다 (서버에 별도 저장하지 않습니다).

## 추가 기능 (2차 업데이트)

- 빨드 아이콘은 오른쪽을 바라보도록 좌우 반전되어 있고, 빨드의 말풍선은 항상 왼쪽 정렬입니다.
- 회원가입/로그인은 Firebase Auth(구글 + 이메일/비밀번호)를 붙일 수 있도록 `public/auth.js` +
  `public/firebase-config.js`로 스캐폴딩했습니다. `firebase-config.js`에 실제 프로젝트 키를 채우기 전까지는
  "게스트 모드"로 정상 동작하며, 로그인하면 계정당 1회 가입 보너스 크레딧(100)을 자동 지급합니다.
- 채팅창에 무작위로 빨드 스티커가 나타나고, 클릭하면 크레딧 +20을 받습니다.
- 프로필 사진: 설정에서 URL을 직접 넣거나, 구글 로그인 시 구글 프로필 사진이 기본 적용됩니다.
  사용자 아이콘이 없으면 채팅창에는 "USER" 텍스트 아이콘이 표시됩니다.
- 이미지 첨부는 로컬 파일 업로드(📎), 이미지 URL(🔗), 클립보드 붙여넣기(Ctrl+V) 세 가지 방식을 모두 지원하며,
  Claude/ChatGPT/Gemini로 보내면 실제 이미지 인식이 가능합니다 (빨드 기본/Cloudflare Workers AI는 귀엽게 반응만 함).
- 설정 모달에 이메일 변경/비밀번호 변경 UI가 있으며, Firebase 연동 후 실제로 동작합니다.

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
