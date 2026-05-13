/**
 * ContentForge 공통 타입 정의
 */

// 톤 옵션
export type Tone = "감성" | "정보" | "유머" | "전문가";

export const TONE_OPTIONS: Tone[] = ["감성", "정보", "유머", "전문가"];

// 콘텐츠 모드 (인스타 / 블로그)
export type ContentMode = "instagram" | "blog";

export const CONTENT_MODE_OPTIONS: ContentMode[] = ["instagram", "blog"];

// 사진 입력 (서버 사이드에서 사용)
export type PhotoInput = {
  data: Buffer;
  mimeType: string;
};

// 사용자 요청
export type ContentRequest = {
  topic: string;
  tone: Tone;
  mode?: ContentMode; // 기본 "instagram"
  notes?: string;     // 자유 메모 — AI가 글 생성에 추가 디테일로 활용
  photos?: PhotoInput[];
};

// 콘텐츠 카테고리 (Planner가 자동 판별)
export type Category =
  | "cafe"
  | "food"
  | "travel"
  | "daily"
  | "fashion"
  | "beauty"
  | "fitness"
  | "other";

export const ALL_CATEGORIES: Category[] = [
  "cafe", "food", "travel", "daily", "fashion", "beauty", "fitness", "other",
];

// Planner Agent 출력
export type Context = {
  category: Category;
  category_label: string;
  target_audience: string;
  tone_guideline: string;
  key_messages: string[];
  scene_summary: string;
  keywords: string[];
};

// LLM Provider
export type Provider = "github-models" | "groq" | "gemini";

export type LLMResponse = {
  content: string;
  provider: Provider;
  model: string;
};

export type AgentMeta = {
  provider: Provider;
  model: string;
  isFallback: boolean;
};

// Social Agent 출력
export type Caption = {
  tone_label: string;
  caption_text: string;
  length_chars: number;
};

// SEO Agent 출력
export type HashtagTiers = {
  broad: string[];
  niche: string[];
  specific: string[];
};

// Visual Agent 출력
export type PhotoOrderItem = {
  original_index: number;
  position: number;
  caption_hint: string;
  reason: string;
};

export type PhotoOrder = {
  items: PhotoOrderItem[];
  reasoning: string;
};

// Writer Agent 출력 (블로그 본문)
export type BlogPost = {
  title: string;
  content: string;       // 마크다운 형식 본문 (제목 포함)
  char_count: number;
};

// 전체 파이프라인 실행 결과
export type PipelineResult = {
  context: Context;
  captions: Caption[] | null;     // instagram 모드일 때
  blog: BlogPost | null;          // blog 모드일 때
  hashtags: HashtagTiers;
  photoOrder: PhotoOrder | null;
  meta: {
    durationMs: number;
    photoCount: number;
    topic: string;
    tone: Tone;
    mode: ContentMode;
  };
};

// 에이전트 역할 (전체)
export type AgentRole =
  | "planner"
  | "social"
  | "visual"
  | "seo"
  | "writer"
  | "scripter"
  | "imagegen";

// 현재 파이프라인에 실제로 참여하는 활성 에이전트
// (모드에 따라 social 또는 writer 가 활성)
export type ActiveAgentRole =
  | "planner"
  | "social"
  | "visual"
  | "seo"
  | "writer";

export const ACTIVE_AGENT_ROLES: ActiveAgentRole[] = [
  "planner",
  "social",
  "visual",
  "seo",
  "writer",
];

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
  | { type: "writer.start" }
  | { type: "writer.done"; blog: BlogPost; agentMeta: AgentMeta }
  | { type: "complete"; meta: PipelineResult["meta"] }
  | { type: "error"; message: string };

export type ProgressCallback = (event: ProgressEvent) => void;
