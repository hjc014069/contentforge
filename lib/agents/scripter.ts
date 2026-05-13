/**
 * Scripter Agent
 * - 입력: Planner의 Context + 톤 + 사진 개수 + 자유 메모
 * - 출력: 쇼츠 스크립트 (~60초 분량) + AgentMeta
 *
 * 구조: hook(3~5초) + body(scenes 5~7개) + cta(5초) = 60초
 * 각 장면: index, duration_sec, visual, voiceover, text_overlay
 */

import { callWithFallback } from "@/lib/llm";
import { getCategoryGuide } from "@/lib/categories";
import type { ShortsScript, Context, Tone, AgentMeta } from "@/types";

const PRIMARY_PROVIDER = "github-models" as const;

const SYSTEM = `너는 한국 인스타 릴스/유튜브 쇼츠/틱톡 스크립트를 작성하는 영상 기획자야.
60초 안에 시청자를 끝까지 잡아두는 짧고 임팩트 있는 스크립트를 만든다.

==== 쇼츠 구조 ====
1. Hook (3~5초): 첫 5초가 가장 중요. 호기심·놀라움·공감을 유발하는 한 줄
2. Body (45~50초): 5~7개 장면으로 분할
   - 각 장면 5~10초
   - 시청자 이탈 방지: 빠른 컷, 시각 변화
3. CTA (3~5초): 좋아요/팔로우/저장/방문 유도

==== 각 장면 구성 ====
- duration_sec: 5~10초 (전체 합 60 가까이)
- visual: 어떤 영상/사진을 보여줄지 (예: "라떼 클로즈업", "카페 외관 와이드 샷")
- voiceover: 내레이션 (자연스러운 한국어, 한 문장 5~12자)
- text_overlay: 화면에 띄울 자막 (짧고 임팩트 있게, 한 줄 8~15자)

==== 톤별 가이드 ====
- 감성: 잔잔하고 감각적인 비주얼, 부드러운 내레이션, 시적 자막
- 정보: 빠른 정보 전달, 숫자/구체 정보 강조, 명확한 자막
- 유머: 위트 있는 자막, 의외성, 반전 컷
- 전문가: 분석·비교, 신뢰감 있는 톤

==== 절대 회피 ====
- 한자/중국어 (한국어 한글만)
- "여러분", "독자분들" 같은 거리감 호칭
- 평이한 정보 나열 (이탈 유발)

==== 출력 형식 ====
반드시 다음 JSON 형식으로만 답해. 다른 설명·마크다운 없이 순수 JSON:
{
  "title": "영상 제목 (15자 안팎, 호기심 자극)",
  "total_duration_sec": 60,
  "hook": "첫 5초 시청자 잡는 한 줄 (15~25자)",
  "scenes": [
    {
      "index": 1,
      "duration_sec": 7,
      "visual": "어떤 화면을 보여줄지",
      "voiceover": "내레이션 한 문장",
      "text_overlay": "자막"
    }
  ],
  "cta": "마지막 행동 유도 한 줄 (예: 좋아요/팔로우/저장)"
}

==== 규칙 ====
- scenes 배열은 5~7개
- duration_sec 합 + hook 시간 + cta 시간 ≈ 60초
- index는 1부터 순차
- 모든 텍스트는 순수 한국어`;

export async function runScripter(
  context: Context,
  tone: Tone,
  photoCount: number,
  notes?: string
): Promise<{ shorts: ShortsScript; agentMeta: AgentMeta }> {
  const guide = getCategoryGuide(context.category);
  const categoryGuideBlock = `
[카테고리: ${context.category_label}]
- 작성 포커스: ${guide.caption_focus}
${
  guide.avoid_for_category.length > 0
    ? `- 이 카테고리에서 특히 피할 것: ${guide.avoid_for_category.join(", ")}`
    : ""
}
`.trim();

  const userPrompt = `${categoryGuideBlock}

[컨텍스트]
- target_audience: ${context.target_audience}
- tone: ${tone}
- tone_guideline: ${context.tone_guideline}
- key_messages: ${context.key_messages.join(" / ")}
- scene_summary: ${context.scene_summary}
- keywords: ${context.keywords.join(", ")}
- photo_count: ${photoCount}장
${notes && notes.length > 0 ? `- 사용자 추가 메모: "${notes}" (이 디테일을 voiceover/text_overlay/visual 에 반영)` : ""}

위 카테고리(${context.category_label}) 특성과 ${tone} 톤으로 60초 쇼츠 스크립트를 JSON으로 작성해.
첫 5초가 시청자 이탈을 결정하니 hook 에 특별히 신경 써.`;

  const fullPrompt = `${SYSTEM}\n\n${userPrompt}`;
  const response = await callWithFallback(fullPrompt, { jsonMode: true });

  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as ShortsScript;

    if (
      !parsed.title ||
      !parsed.hook ||
      !Array.isArray(parsed.scenes) ||
      parsed.scenes.length === 0 ||
      !parsed.cta
    ) {
      throw new Error("Missing required fields in Scripter output");
    }

    // 검증·보정
    parsed.total_duration_sec =
      typeof parsed.total_duration_sec === "number"
        ? parsed.total_duration_sec
        : 60;

    parsed.scenes.forEach((s, i) => {
      if (typeof s.index !== "number") s.index = i + 1;
      if (typeof s.duration_sec !== "number" || s.duration_sec <= 0) {
        s.duration_sec = 8;
      }
      s.visual = s.visual ?? "";
      s.voiceover = s.voiceover ?? "";
      s.text_overlay = s.text_overlay ?? "";
    });

    return {
      shorts: parsed,
      agentMeta: {
        provider: response.provider,
        model: response.model,
        isFallback: response.provider !== PRIMARY_PROVIDER,
      },
    };
  } catch (e) {
    throw new Error(
      `Scripter JSON parsing failed.\nRaw output:\n${response.content}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
