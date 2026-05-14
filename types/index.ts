/**
 * ContentForge 공통 타입 정의
 */

// 톤 옵션
export type Tone = "감성" | "정보" | "유머" | "전문가";

export const TONE_OPTIONS: Tone[] = ["감성", "정보", "유머", "전문가"];

// 콘텐츠 모드 (인스타 / 블로그)
export type ContentMode = "instagram" | "blog" | "shorts";

export const CONTENT_MODE_OPTIONS: ContentMode[] = ["instagram", "blog", "shorts"];

// 블로그 본문 길이 옵션 (blog 모드 전용)
export type BlogLength = "short" | "normal" | "long";

export const BLOG_LENGTH_RANGES: Record<
  BlogLength,
  { label: string; min: number; max: number }
> = {
  short: { label: "짧게", min: 500, max: 800 },
  normal: { label: "보통", min: 800, max: 1500 },
  long: { label: "길게", min: 1500, max: 2500 },
};

// 사진 입력 (서버 사이드에서 사용)
export type PhotoInput = {
  data: Buffer;
  mimeType: string;
};

// 사용자 요청
export type ContentRequest = {
  topic: string;
  tone: Tone;
  modes?: ContentMode[];    // 다중 선택 가능. 기본 ["instagram"]
  blogLength?: BlogLength;  // blog 모드일 때 글 길이 (기본 "normal")
  notes?: string;           // 자유 메모 — AI가 글 생성에 추가 디테일로 활용
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

// 프롬프트 캡처 — 각 에이전트의 입력 프롬프트 + 응답 raw 텍스트
export type PromptCapture = {
  system: string;       // 시스템 프롬프트
  user: string;         // 사용자 프롬프트 (Context, 톤, 메모 주입 후)
  response: string;     // LLM raw 응답 (보통 JSON 문자열)
  photoCount?: number;  // Vision 사용 시 사진 개수
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

// Scripter Agent 출력 (쇼츠 스크립트, ~60초)
export type ShortsScene = {
  index: number;             // 1-based
  duration_sec: number;      // 이 장면 길이 (초)
  visual: string;            // 어떤 영상/사진 화면
  voiceover: string;         // 내레이션
  text_overlay: string;      // 화면 자막
};

export type ShortsScript = {
  title: string;             // 영상 제목
  total_duration_sec: number; // 총 길이 (~60)
  hook: string;              // 첫 3~5초 시선 잡는 한 줄
  scenes: ShortsScene[];     // 장면 5~7개
  cta: string;               // 마지막 행동 유도
};

// 전체 파이프라인 실행 결과
export type PipelineResult = {
  context: Context;
  captions: Caption[] | null;     // instagram 모드일 때
  blog: BlogPost | null;          // blog 모드일 때
  shorts: ShortsScript | null;    // shorts 모드일 때
  hashtags: HashtagTiers;
  photoOrder: PhotoOrder | null;
  meta: {
    durationMs: number;
    photoCount: number;
    topic: string;
    tone: Tone;
    modes: ContentMode[];
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
  | "writer"
  | "scripter";

export const ACTIVE_AGENT_ROLES: ActiveAgentRole[] = [
  "planner",
  "social",
  "visual",
  "seo",
  "writer",
  "scripter",
];

// 에이전트 작업 상태 (UI용)
export type AgentState = "idle" | "working" | "done" | "skipped";

// 스트림 이벤트 (실시간 진행 상황)
export type ProgressEvent =
  | { type: "planner.start" }
  | { type: "planner.done"; context: Context; agentMeta: AgentMeta; promptUsed?: PromptCapture }
  | { type: "social.start" }
  | { type: "social.done"; captions: Caption[]; agentMeta: AgentMeta; promptUsed?: PromptCapture }
  | { type: "seo.start" }
  | { type: "seo.done"; hashtags: HashtagTiers; agentMeta: AgentMeta; promptUsed?: PromptCapture }
  | { type: "visual.start" }
  | { type: "visual.done"; photoOrder: PhotoOrder; agentMeta: AgentMeta; promptUsed?: PromptCapture }
  | { type: "visual.skipped" }
  | { type: "writer.start" }
  | { type: "writer.done"; blog: BlogPost; agentMeta: AgentMeta; promptUsed?: PromptCapture }
  | { type: "scripter.start" }
  | { type: "scripter.done"; shorts: ShortsScript; agentMeta: AgentMeta; promptUsed?: PromptCapture }
  | { type: "complete"; meta: PipelineResult["meta"] }
  | { type: "error"; message: string };

export type ProgressCallback = (event: ProgressEvent) => void;
