/**
 * ContentForge 공통 타입 정의
 */

// 톤 옵션
export type Tone = "감성" | "정보" | "유머" | "전문가";

export const TONE_OPTIONS: Tone[] = ["감성", "정보", "유머", "전문가"];

// 사진 입력 (서버 사이드에서 사용)
export type PhotoInput = {
  data: Buffer;
  mimeType: string;
};

// 사용자 요청
export type ContentRequest = {
  topic: string;
  tone: Tone;
  photos?: PhotoInput[];
};

// Planner Agent 출력 — 모든 다른 에이전트가 공유하는 컨텍스트
export type Context = {
  target_audience: string;   // 누구에게 말하는지
  tone_guideline: string;    // 톤 적용 가이드
  key_messages: string[];    // 핵심 메시지 (3개)
  scene_summary: string;     // 사진+주제 종합 요약
  keywords: string[];        // 키워드 (5개)
};

// 어떤 LLM 프로바이더가 응답했는지 (Fallback Pattern용)
export type Provider = "github-models" | "groq" | "gemini";

// LLM 통합 응답
export type LLMResponse = {
  content: string;
  provider: Provider;
  model: string;
};

// 에이전트가 어느 프로바이더로 응답했는지 추적
export type AgentMeta = {
  provider: Provider;
  model: string;
  isFallback: boolean;   // 1순위 실패해서 백업으로 동작했는지
};

// Social Agent 출력 — 캡션 1안
export type Caption = {
  tone_label: string;     // 변형 라벨 ("메인", "짧은 버전", "풍부한 버전")
  caption_text: string;   // 캡션 본문 (한국어)
  length_chars: number;   // 글자 수
};

// SEO Agent 출력 — 해시태그 20개를 3계층으로
export type HashtagTiers = {
  broad: string[];      // 대형 (5개) — 인기 많고 경쟁 큰
  niche: string[];      // 중형 (10개) — 특정 주제/지역
  specific: string[];   // 소형 (5개) — 매우 구체적/독특
};

// Visual Agent 출력 — 사진 순서 추천
export type PhotoOrderItem = {
  original_index: number;   // 원본 입력 순서 (0-based)
  position: number;          // 추천 순서 (1-based)
  caption_hint: string;      // 사진 짧은 설명 (15자 이내)
  reason: string;            // 이 위치에 둔 이유
};

export type PhotoOrder = {
  items: PhotoOrderItem[];
  reasoning: string;         // 전체 스토리 흐름 설명
};

// 전체 파이프라인 실행 결과
export type PipelineResult = {
  context: Context;
  captions: Caption[];
  hashtags: HashtagTiers;
  photoOrder: PhotoOrder | null;   // 사진 2장 이상일 때만 동작
  meta: {
    durationMs: number;
    photoCount: number;
    topic: string;
    tone: Tone;
  };
};

// 에이전트 역할
export type AgentRole = "planner" | "social" | "visual" | "seo";

// 에이전트 작업 상태 (UI용)
export type AgentState = "idle" | "working" | "done" | "skipped";

// 스트림 이벤트 (실시간 진행 상황)
export type ProgressEvent =
  | { type: "planner.start" }
  | { type: "planner.done"; context: Context; agentMeta: AgentMeta }
  | { type: "social.start" }
  | { type: "social.done"; captions: Caption[]; agentMeta: AgentMeta }
  | { type: "seo.start" }
  | { type: "seo.done"; hashtags: HashtagTiers; agentMeta: AgentMeta }
  | { type: "visual.start" }
  | { type: "visual.done"; photoOrder: PhotoOrder; agentMeta: AgentMeta }
  | { type: "visual.skipped" }
  | { type: "complete"; meta: PipelineResult["meta"] }
  | { type: "error"; message: string };

export type ProgressCallback = (event: ProgressEvent) => void;
