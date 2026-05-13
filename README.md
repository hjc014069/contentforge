# 🏭 ContentForge

> **멀티에이전트 AI 콘텐츠 자동 생성 시스템** — 사진 한 장이면 인스타 캡션·해시태그·블로그 본문이 한 번에

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#-license)

> 🎓 **아주대학교 AI융합실전프로젝트 2026-1 캡스톤**

---

## 📸 미리보기

```
┌──────────────────────────────────────────────────────────────┐
│  CONTENTFORGE 오피스                                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  🤔                                    │   │
│  │              [Planner]                                 │   │
│  │                                                        │   │
│  │    ✍️         🖼️         🏷️         📝              │   │
│  │  [Social]  [Visual]  [SEO]      [Writer]            │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

7명의 AI 에이전트가 모인 픽셀 오피스에서, 사용자가 콘텐츠를 요청하면 캐릭터들이 자기 자리로 가서 일하는 모습이 **실시간으로 시각화**됩니다.

---

## ✨ 주요 기능

### 🤖 멀티에이전트 파이프라인

| 에이전트 | 역할 | 상태 |
|---------|------|------|
| 🤔 **Planner** | 사진·주제 분석, 8 카테고리 자동 판별, 공통 컨텍스트 생성 | ✅ |
| ✍️ **Social** | 인스타 캡션 3안 (메인 / 짧은 / 풍부한) | ✅ |
| 🏷️ **SEO** | 해시태그 20개 — 3계층(대형 5 + 중형 10 + 소형 5) | ✅ |
| 🖼️ **Visual** | 사진 순서 추천 (사진 2장 이상) | ✅ |
| 📝 **Writer** | 블로그용 마크다운 본문 (800~1500자) | ✅ |
| 🎬 **Scripter** | 쇼츠 스크립트 (~60초, hook + scenes 5~7개 + CTA) | ✅ |
| 🎨 **ImageGen** | AI 이미지 생성 (1~3장) | 🚧 |

### 🔄 멀티 프로바이더 Fallback

```
텍스트 LLM:   GitHub Models  →  Groq  →  Gemini
Vision LLM:   Gemini         →  GitHub Models
```

- 한 API가 막혀도 자동으로 백업 프로바이더로 전환
- 429 / 5xx / timeout / network 에러는 자동 재시도
- 어느 프로바이더로 응답했는지 UI에 실시간 표시 (Fallback 발생 시 ⚠️ 배지)

### 🎨 픽셀 오피스 시각화

- 사용자가 **"콘텐츠 생성"** 누르면 7명의 캐릭터가 자기 자리로 걸어가 일하는 모습 실시간 표시
- **working** → 자기 자리에 앉아 작업 / **done** → 머리 위 ✓ 이펙트 → 15초 후 자유롭게 wander
- 머리 위 말풍선에 **역할별 이모지** (🤔/✍️/🖼️/🏷️/📝)
- y좌표 기반 동적 z-index로 가구·캐릭터 가려짐 자연스러움
- Lane 기반 이동 시스템으로 책상 관통 없이 자연스러운 동선

### 🎯 입력 옵션

- 📷 **사진** (최대 10장, 클라이언트에서 자동 리사이즈)
- 💭 **주제** (선택 — 사진만 올려도 OK)
- 🎨 **톤** 4종: 감성 / 정보 / 유머 / 전문가
- 📋 **콘텐츠 모드**: 📸 인스타그램 / 📝 블로그 / 🎬 쇼츠
- 📝 **자유 메모** (선택) — AI가 본문에 자연스럽게 녹임 (예: "비 오는 평일, 라떼 6500원")

### 📂 카테고리 자동 판별

Planner가 사진과 주제를 보고 8개 카테고리 중 자동 선택:
- ☕ 카페 / 🍽️ 음식·맛집 / ✈️ 여행 / 📔 일상
- 👗 패션·OOTD / 💄 뷰티 / 💪 운동·헬스 / 📦 기타

카테고리별로 **caption_focus / typical_emojis / hashtag_seed** 가이드가 다르게 주입되어, 단순 LLM 호출이 아닌 카테고리별 맞춤 결과를 생성합니다.

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                       사용자 입력                              │
│        사진 + 주제 + 톤 + 모드 + 자유 메모                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  [1] Planner Agent                          │
│        사진 분석 → 카테고리 판별 → 공통 Context 생성            │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ [2-a] Content │  │  [2-b] SEO    │  │ [2-c] Visual  │
│ Social /      │  │  해시태그 20개  │  │  사진 순서     │
│ Writer /      │  │               │  │  (병렬)        │
│ Scripter      │  │               │  │               │
│ (모드 분기)    │  │               │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
              NDJSON 스트림으로 실시간 전송
                           │
                           ▼
              🖥️ 픽셀 오피스 시각화 + 결과 카드
```

**핵심 패턴**: `Promise.all([social, seo, visual])` 한 줄 = 멀티에이전트 병렬의 본질

---

## 🚀 시작하기

### 사전 요구사항

- Node.js 18+
- npm 또는 pnpm
- LLM API 키 (아래 환경 변수 참고)

### 환경 변수

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# GitHub Models (1순위 텍스트 LLM)
GITHUB_MODELS_TOKEN=ghp_xxxxxxxxxxxxx

# Groq (2순위 텍스트 LLM, 빠른 추론)
GROQ_API_KEY=gsk_xxxxxxxxxxxxx

# Gemini (1순위 Vision, 3순위 텍스트)
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxx
```

> 💡 모든 키를 다 발급받지 않아도 됩니다. Fallback 패턴 덕분에 하나만 있어도 동작합니다.

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 또는 프로덕션 빌드
npm run build
npm start
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

---

## 🧰 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS |
| 애니메이션 | Framer Motion, CSS Keyframes |
| LLM 프로바이더 | GitHub Models · Groq · Gemini |
| 마크다운 | react-markdown |
| 스트리밍 | NDJSON over Fetch ReadableStream |
| 이미지 처리 | Python Pillow + scipy (캐릭터 sprite 누끼) |

---

## 📂 프로젝트 구조

```
contentforge/
├── app/
│   ├── page.tsx                    # 메인 UI (입력·결과·시각화)
│   ├── globals.css
│   └── api/pipeline/route.ts       # NDJSON 스트리밍 엔드포인트
│
├── components/
│   ├── OfficeRoom.tsx              # 픽셀 오피스 컨테이너
│   ├── AnimatedCharacter.tsx       # 캐릭터 애니메이션 (wander/working/sit)
│   ├── PixelCharacter.tsx          # sprite sheet 렌더링
│   └── AgentVisualization.tsx      # 카드형 시각화 (보조)
│
├── lib/
│   ├── orchestrator.ts             # 파이프라인 조율 ★ (모드별 분기)
│   ├── officeLayout.ts             # 좌표·Lane·Forbidden Box 정의
│   ├── categories.ts               # 8 카테고리별 가이드
│   ├── llm/
│   │   ├── index.ts                # callWithFallback / callVisionWithFallback
│   │   ├── github-models.ts
│   │   ├── groq.ts
│   │   └── gemini.ts
│   ├── agents/
│   │   ├── planner.ts              # 사진 분석 + 카테고리 자동 판별
│   │   ├── social.ts               # 캡션 3안
│   │   ├── seo.ts                  # 해시태그 20개
│   │   ├── visual.ts               # 사진 순서
│   │   └── writer.ts               # 블로그 본문
│   └── utils/resize.ts             # 클라이언트 사이드 이미지 리사이즈
│
├── types/index.ts                  # 공통 타입 (Context, ProgressEvent 등)
├── public/office/                  # 픽셀 아트 자산
│   ├── background.png              # 사무실 배경 1672×941
│   ├── planner_desk.png / chair.png
│   ├── desk.png / chair.png        # 회의실 가구
│   └── characters/<role>/<action>.png  # 7명 × 4 액션 = 28장
└── README.md
```

---

## 📡 API

### `POST /api/pipeline`

NDJSON 스트리밍 응답. 각 에이전트의 진행 상태를 실시간으로 전송.

**Request** — `multipart/form-data`

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `topic` | string | ❌ | 주제 (사진만 있어도 OK) |
| `tone` | string | ✅ | 감성 / 정보 / 유머 / 전문가 |
| `mode` | string | ❌ | instagram (기본) / blog / shorts |
| `notes` | string | ❌ | 자유 메모 |
| `photos` | File[] | ❌ | 최대 10장 |

**Response** — `application/x-ndjson`

한 줄당 한 ProgressEvent JSON. 이벤트 종류:

```
planner.start
planner.done    { context, agentMeta }
social.start    (instagram 모드)
social.done     { captions, agentMeta }
writer.start    (blog 모드)
writer.done     { blog, agentMeta }
scripter.start  (shorts 모드)
scripter.done   { shorts, agentMeta }
seo.start       seo.done     { hashtags, agentMeta }
visual.start    visual.done  { photoOrder, agentMeta }
visual.skipped  (사진 < 2장)
complete        { meta }
error           { message }
```

---

## 🗺️ 로드맵

- [x] **Phase 1** — 활성 에이전트 4명 (Planner / Social / SEO / Visual)
- [x] **Phase 1.5** — 픽셀 오피스 시각화 + 에이전트 상태 연동
  - [x] Lane 기반 자연스러운 캐릭터 이동
  - [x] working/done 모션 + 말풍선 + ✓ 이펙트
  - [x] y기반 동적 z-index
- [x] **Phase 2** — Writer 에이전트 + 인스타/블로그 모드 토글
  - [x] 마크다운 형식 본문 생성
  - [x] 가짜 타이핑 효과 + react-markdown 렌더링
  - [x] 접기/펼치기 + 복사 (마크다운/텍스트)
- [x] **자유 메모 입력** — 사용자가 추가 디테일 입력하면 모든 에이전트가 활용
- [x] **Phase 3** — Scripter 에이전트 + 쇼츠 모드
  - [x] 60초 스크립트 (hook + scenes 5~7개 + CTA 구조)
  - [x] 장면별 visual / voiceover / text_overlay 분리
  - [x] 스크립트 전체 복사 (plain text 포맷)
- [ ] **Phase 4** — ImageGen 에이전트 + AI 이미지 생성

---

## 🎓 발표 포인트

1. **멀티에이전트 병렬 처리** — `Promise.all` 한 줄로 3개 에이전트 동시 실행
2. **멀티 프로바이더 신뢰성** — 한 API가 막혀도 시스템은 멈추지 않는다 (Fallback Pattern)
3. **카테고리 자동 판별 + 맞춤 가이드** — 카테고리별로 다른 톤·해시태그 패턴 적용
4. **픽셀 오피스 시각화** — 추상적인 "AI 에이전트" 개념을 시각적으로 표현
5. **NDJSON 스트리밍** — 각 에이전트 진행 상황을 실시간으로 화면에 반영
6. **사용자 입력 활용 (자유 메모)** — 사진과 주제로 표현 안 되는 디테일도 글에 녹임

---

## 📷 데모 시나리오

### 시나리오 1 — 카페 인스타 캡션
- 📷 사진: 카페 라떼 + 인테리어
- 💭 주제: "신촌 카페 탐방"
- 🎨 톤: 감성
- 📋 모드: 인스타
- 📝 메모: "비 오는 평일, 라떼 6500원, 혼자 두 시간 머묾"

→ 결과: 감성 캡션 3안 + 카페 해시태그 20개 + 사진 순서

### 시나리오 2 — 음식 블로그 본문
- 📷 사진: 파스타 + 식당 외관
- 💭 주제: "이태원 파스타 맛집"
- 🎨 톤: 유머
- 📋 모드: 블로그
- 📝 메모: "데이트 코스, 예약 필수"

→ 결과: 마크다운 블로그 본문 (1200자) + 맛집 해시태그 + 사진 순서

### 시나리오 3 — 여행 쇼츠 스크립트
- 📷 사진: 제주 해변, 한라산, 흑돼지
- 💭 주제: "제주 2박3일 핵심 코스"
- 🎨 톤: 정보
- 📋 모드: 🎬 쇼츠
- 📝 메모: "비행기·렌터카 포함 1인 30만원"

→ 결과: 60초 쇼츠 스크립트 (Hook → Scene 6개 → CTA) + 여행 해시태그 + 사진 순서

---

## 🤝 기여 / 개발

```bash
# 타입 체크
npx tsc --noEmit

# 린트
npm run lint

# 빌드
npm run build
```

---

## 📄 License

MIT License — 자유롭게 사용·수정·배포 가능

---

<p align="center">
  made with 💜 by <b>황준철</b><br/>
  아주대학교 AI융합실전프로젝트 2026-1
</p>
