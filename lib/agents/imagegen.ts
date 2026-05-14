/**
 * ImageGen Agent
 * - 입력: Planner Context (+ 추가 정보)
 * - 출력: 생성된 이미지 1장 (URL) + AgentMeta
 *
 * Fallback Pattern:
 *   1) GitHub Models (dall-e-3 또는 gpt-image-1 시도)
 *   2) Pollinations.ai (무료, 무인증)
 *
 * 영문 프롬프트 생성: Planner Context의 scene_summary / keywords / category 활용
 * 별도 LLM 호출 없이 Context 데이터로 직접 prompt 조합 (속도 우선)
 */

import { callWithFallback } from "@/lib/llm";
import type {
  GeneratedImageSet,
  Context,
  AgentMeta,
  PromptCapture,
  Provider,
} from "@/types";

const PRIMARY_PROVIDER: Provider = "github-models";
const FALLBACK_PROVIDER: Provider = "pollinations";

// Planner Context → 영문 이미지 프롬프트 변환 (단순 매핑, 별도 LLM 안 씀)
const CATEGORY_STYLE_HINT: Record<string, string> = {
  cafe: "cozy cafe interior, warm lighting, instagram aesthetic",
  food: "delicious food close-up, top-down view, food photography",
  travel: "scenic landscape, travel photography, golden hour",
  daily: "lifestyle photography, soft natural light, candid moment",
  fashion: "fashion editorial, minimal background, OOTD style",
  beauty: "beauty product close-up, soft pastel tones",
  fitness: "active lifestyle, dynamic movement, gym aesthetic",
  other: "high quality photography, natural composition",
};

function buildEnglishPrompt(context: Context, notes?: string): string {
  const styleHint = CATEGORY_STYLE_HINT[context.category] ?? CATEGORY_STYLE_HINT.other;
  // scene_summary 와 keywords 는 한국어. 영문 변환 없이 그대로 넣되,
  // 스타일/키워드 영문 힌트를 앞쪽에 배치.
  const parts = [
    styleHint,
    context.scene_summary,
    context.keywords.slice(0, 5).join(", "),
    notes ?? "",
    "photorealistic, high detail, 8k",
  ].filter(Boolean);
  return parts.join(", ");
}

// ----- 1순위: GitHub Models 이미지 생성 -----
async function callGitHubModelsImage(
  prompt: string
): Promise<{ url: string; model: string }> {
  const token = process.env.GITHUB_MODELS_TOKEN;
  if (!token) throw new Error("GITHUB_MODELS_TOKEN missing");

  // GitHub Models 이미지 생성 endpoint (DALL-E 3 시도)
  // 실제 모델 ID 는 GitHub Models 카탈로그에 따라 다를 수 있음
  const model = "dall-e-3";
  const res = await fetch(
    "https://models.github.ai/inference/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "url",
      }),
      signal: AbortSignal.timeout(60000),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub Models image gen failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const url = data?.data?.[0]?.url;
  if (!url) throw new Error("GitHub Models response missing image URL");
  return { url, model };
}

// ----- 2순위: Pollinations.ai (URL 기반, 무료) -----
function callPollinationsImage(
  prompt: string
): { url: string; model: string } {
  const encoded = encodeURIComponent(prompt);
  const seed = Math.floor(Math.random() * 100000);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
  return { url, model: "flux" };
}

export async function runImageGen(
  context: Context,
  notes?: string
): Promise<{
  generatedImages: GeneratedImageSet;
  agentMeta: AgentMeta;
  promptUsed: PromptCapture;
}> {
  const prompt = buildEnglishPrompt(context, notes);

  let url: string;
  let provider: Provider;
  let model: string;
  let isFallback = false;
  let firstError = "";

  // 1순위: GitHub Models
  try {
    const result = await callGitHubModelsImage(prompt);
    url = result.url;
    model = result.model;
    provider = "github-models";
  } catch (e) {
    firstError = e instanceof Error ? e.message : String(e);
    // 2순위: Pollinations
    const result = callPollinationsImage(prompt);
    url = result.url;
    model = result.model;
    provider = FALLBACK_PROVIDER;
    isFallback = true;
  }

  const systemPrompt =
    "Generate a high-quality image based on the user's content context.\n" +
    "Style hints are mapped per category. Output: image URL.";

  return {
    generatedImages: {
      images: [
        {
          url,
          prompt,
          width: 1024,
          height: 1024,
        },
      ],
      base_prompt: prompt,
    },
    agentMeta: {
      provider,
      model,
      isFallback,
    },
    promptUsed: {
      system: systemPrompt,
      user: prompt,
      response: isFallback
        ? `[Fallback to ${provider}] 1순위 실패 이유:\n${firstError}\n\n이미지 URL:\n${url}`
        : `이미지 URL:\n${url}`,
    },
  };
}

// callWithFallback is imported but not directly used here. 
// 이미지 생성은 자체 fallback 로직을 사용 (LLM과 다른 endpoint)
void callWithFallback;
