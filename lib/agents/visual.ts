/**
 * Visual Agent
 * - 입력: 사진들(2장 이상) + Context
 * - 출력: PhotoOrder (스토리 흐름에 맞는 추천 순서)
 *
 * Gemini 1.5 Flash Vision 사용 — 사진 비교/요약 능력 필수
 *
 * 1장 이하면 호출하지 말 것 (orchestrator에서 처리).
 */

import { callVisionWithFallback } from "@/lib/llm";
import type { Context, PhotoOrder, PhotoInput, AgentMeta, PromptCapture } from "@/types";

const VISION_PRIMARY = "gemini" as const;

const SYSTEM = `너는 인스타그램 캐러셀(여러 장 슬라이드 게시물) 큐레이터야.
입력된 사진들과 컨텍스트를 분석해 가장 적합한 순서를 추천한다.

큐레이션 원칙:
- 첫 사진(position 1): 시선을 가장 강하게 끄는 hook 역할
- 마지막 사진: 마무리 또는 임팩트 있는 한 컷
- 중간: 스토리 흐름이 자연스럽게 이어지게
- 색감, 구도, 주제의 다양성을 살릴 것

각 사진별 결정:
- original_index: 입력된 원본 순서 (0부터, 첫 번째 사진이 0)
- position: 추천 순서 (1부터, 1번 슬라이드부터)
- caption_hint: 이 사진의 한 줄 요약 (15자 이내, 한국어)
- reason: 이 위치에 둔 이유 (한 문장)

전체 스토리 흐름에 대한 reasoning도 2~3문장으로 작성.

작성 규칙:
- 모든 출력 한국어 (한자 X)
- 사진 N장이면 정확히 N개 items
- position은 1부터 N까지 중복 없이 (한 자리에 한 사진)
- original_index도 0부터 N-1까지 중복 없이

반드시 다음 JSON 형식으로만 답해. 다른 설명 없이 순수 JSON:
{
  "items": [
    { "original_index": 0, "position": 1, "caption_hint": "...", "reason": "..." },
    { "original_index": 1, "position": 2, "caption_hint": "...", "reason": "..." }
  ],
  "reasoning": "..."
}

==== 예시 ====
입력: 사진 3장 (0번 라떼아트, 1번 카페 전경, 2번 디저트)
출력:
{
  "items": [
    { "original_index": 1, "position": 1, "caption_hint": "아늑한 카페 전경", "reason": "공간의 첫인상을 보여주는 hook" },
    { "original_index": 0, "position": 2, "caption_hint": "정성스런 라떼아트", "reason": "공간에서 만난 작은 아름다움으로 자연스럽게 시선 이동" },
    { "original_index": 2, "position": 3, "caption_hint": "달콤한 디저트", "reason": "라떼와 함께 즐기는 마무리, 식욕을 자극하며 게시물 종결" }
  ],
  "reasoning": "공간 → 음료 → 디저트 순으로 카페 경험의 흐름을 자연스럽게 따라가도록 구성. 시선이 점점 가까이 줌인되며 몰입감을 높이는 효과."
}`;

export async function runVisual(
  photos: PhotoInput[],
  context: Context
): Promise<{ photoOrder: PhotoOrder; agentMeta: AgentMeta; promptUsed: PromptCapture }> {
  if (photos.length < 2) {
    throw new Error("Visual Agent는 사진 2장 이상에서만 동작합니다.");
  }

  const userPrompt = `[컨텍스트]
- target_audience: ${context.target_audience}
- scene_summary: ${context.scene_summary}
- key_messages: ${context.key_messages.join(" / ")}

[사진 정보]
- 총 ${photos.length}장 (입력 순서대로 0번부터 ${photos.length - 1}번)

위 ${photos.length}장의 사진을 보고 인스타 캐러셀의 최적 순서를 JSON으로 추천해.`;

  const fullPrompt = `${SYSTEM}\n\n${userPrompt}`;
  const response = await callVisionWithFallback(fullPrompt, photos, {
    jsonMode: true,
  });

  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as PhotoOrder;
    if (!Array.isArray(parsed.items) || parsed.items.length !== photos.length) {
      throw new Error(
        `items 개수가 사진 수와 다름 (받은: ${parsed.items?.length}, 기대: ${photos.length})`
      );
    }
    if (!parsed.reasoning || parsed.reasoning.trim().length === 0) {
      parsed.reasoning = "(스토리 흐름 설명 없음)";
    }

    // position 기준 정렬 (UI에서 그대로 쓸 수 있게)
    parsed.items.sort((a, b) => a.position - b.position);

    const agentMeta: AgentMeta = {
      provider: response.provider,
      model: response.model,
      isFallback: response.provider !== VISION_PRIMARY,
    };

    return {
      photoOrder: parsed,
      agentMeta,
      promptUsed: {
        system: SYSTEM,
        user: userPrompt,
        response: response.content,
        photoCount: photos.length,
      },
    };
  } catch (e) {
    throw new Error(
      `Visual JSON parsing failed.\nRaw output:\n${response.content}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
