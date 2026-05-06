/**
 * Social Agent
 * - 입력: Planner의 Context + 사용자 톤
 * - 출력: 캡션 3안 + AgentMeta (어느 프로바이더로 응답했는지)
 *
 * callWithFallback 사용 — GitHub Models → Groq → Gemini 자동 전환
 */

import { callWithFallback } from "@/lib/llm";
import type { Caption, Context, Tone, AgentMeta } from "@/types";

const PRIMARY_PROVIDER = "github-models" as const;

const SYSTEM = `너는 인스타그램 캡션 전문 카피라이터야.
주어진 컨텍스트와 톤을 바탕으로 캡션 3안을 만든다.

각 안은 같은 컨텍스트에서 출발하지만 서로 다른 접근으로:
- 안 1 "메인": 가장 정석적, 핵심 메시지를 명확하게 (150~200자)
- 안 2 "짧은 버전": 임팩트 있는 짧은 문장 위주 (60~100자)
- 안 3 "풍부한 버전": 감각적·서사적 묘사 위주 (250~300자)

작성 규칙 (절대 준수):
- 모든 캡션은 순수 한국어로만 작성. 한자는 절대 사용하지 말 것.
  (예: "瞬間" X → "순간" O, "開始" X → "시작" O, "幸福" X → "행복" O)
- 인스타그램 스타일 (이모지 적절히, 줄바꿈 활용 가능)
- 같은 톤이지만 표현 방식의 차이를 분명히 살릴 것
- 해시태그는 캡션에 절대 포함하지 말 것 (별도 SEO Agent가 처리)
- 각 안은 독립적으로 사용 가능한 완결된 캡션이어야 함

반드시 다음 JSON 형식으로만 답해. 다른 설명, 마크다운 없이 순수 JSON:
{
  "captions": [
    { "tone_label": "메인", "caption_text": "...", "length_chars": 0 },
    { "tone_label": "짧은 버전", "caption_text": "...", "length_chars": 0 },
    { "tone_label": "풍부한 버전", "caption_text": "...", "length_chars": 0 }
  ]
}
length_chars는 caption_text의 글자 수.`;

export async function runSocial(
  context: Context,
  tone: Tone
): Promise<{ captions: Caption[]; agentMeta: AgentMeta }> {
  const userPrompt = `[컨텍스트]
- target_audience: ${context.target_audience}
- tone: ${tone}
- tone_guideline: ${context.tone_guideline}
- key_messages: ${context.key_messages.join(" / ")}
- scene_summary: ${context.scene_summary}
- keywords: ${context.keywords.join(", ")}

위 컨텍스트로 ${tone} 톤의 인스타그램 캡션 3안을 JSON으로 생성해.`;

  const fullPrompt = `${SYSTEM}\n\n${userPrompt}`;
  const response = await callWithFallback(fullPrompt, { jsonMode: true });

  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as { captions: Caption[] };
    if (!Array.isArray(parsed.captions) || parsed.captions.length === 0) {
      throw new Error("캡션 배열이 비어있거나 잘못된 형식입니다.");
    }

    parsed.captions.forEach((c) => {
      if (typeof c.length_chars !== "number" || c.length_chars <= 0) {
        c.length_chars = c.caption_text?.length ?? 0;
      }
    });

    return {
      captions: parsed.captions,
      agentMeta: {
        provider: response.provider,
        model: response.model,
        isFallback: response.provider !== PRIMARY_PROVIDER,
      },
    };
  } catch (e) {
    throw new Error(
      `Social JSON parsing failed.\nRaw output:\n${response.content}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
