/**
 * SEO Agent
 * - 입력: Planner의 Context
 * - 출력: 해시태그 20개 + AgentMeta (어느 프로바이더로 응답했는지)
 *
 * callWithFallback 사용. SEO는 1순위가 Groq였으나, 통합으로 GitHub Models 1순위.
 * 텍스트 작업은 모두 같은 fallback chain 사용.
 */

import { callWithFallback } from "@/lib/llm";
import type { HashtagTiers, Context, AgentMeta } from "@/types";

const PRIMARY_PROVIDER = "github-models" as const;

const SYSTEM = `너는 인스타그램 해시태그 전략 전문가야.
주어진 컨텍스트를 바탕으로 해시태그 20개를 3계층으로 분류해 만든다.

계층 정의 (정확히 이 개수를 지킬 것):
- broad (대형, 정확히 5개): 인기 많고 경쟁 큰 일반 태그
  예: #카페, #일상, #여행, #감성, #힐링
- niche (중형, 정확히 10개): 특정 주제 또는 지역 태그
  예: #신촌카페, #감성카페, #카페투어, #서울카페, #주말데이트
- specific (소형, 정확히 5개): 매우 구체적이거나 독특한 태그
  예: #토요일오후의카페, #나만의숨겨진카페, #카페에서글쓰기

작성 규칙:
- 한국어 우선, 영어 혼용 OK (인스타에서 둘 다 사용됨)
- 정확히 broad 5개 + niche 10개 + specific 5개 = 총 20개
- 중복 없음
- # 기호 없이 순수 키워드만 (시스템에서 # 자동 추가)
- 띄어쓰기 없이 한 단어처럼 (예: "신촌카페" O, "신촌 카페" X)

반드시 다음 JSON 형식으로만 답해. 다른 설명, 마크다운 없이 순수 JSON:
{
  "broad": ["...", "...", "...", "...", "..."],
  "niche": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."],
  "specific": ["...", "...", "...", "...", "..."]
}`;

export async function runSeo(
  context: Context
): Promise<{ hashtags: HashtagTiers; agentMeta: AgentMeta }> {
  const userPrompt = `[컨텍스트]
- target_audience: ${context.target_audience}
- scene_summary: ${context.scene_summary}
- key_messages: ${context.key_messages.join(" / ")}
- keywords: ${context.keywords.join(", ")}

위 컨텍스트를 바탕으로 broad 5 + niche 10 + specific 5 = 총 20개의 해시태그를 JSON으로 생성해.`;

  const fullPrompt = `${SYSTEM}\n\n${userPrompt}`;
  const response = await callWithFallback(fullPrompt, { jsonMode: true });

  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as HashtagTiers;
    if (
      !Array.isArray(parsed.broad) ||
      !Array.isArray(parsed.niche) ||
      !Array.isArray(parsed.specific)
    ) {
      throw new Error("해시태그 구조가 올바르지 않습니다.");
    }

    const stripHash = (arr: string[]) =>
      arr.map((h) => h.replace(/^#+/, "").trim()).filter((h) => h.length > 0);
    parsed.broad = stripHash(parsed.broad);
    parsed.niche = stripHash(parsed.niche);
    parsed.specific = stripHash(parsed.specific);

    return {
      hashtags: parsed,
      agentMeta: {
        provider: response.provider,
        model: response.model,
        isFallback: response.provider !== PRIMARY_PROVIDER,
      },
    };
  } catch (e) {
    throw new Error(
      `SEO JSON parsing failed.\nRaw output:\n${response.content}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
