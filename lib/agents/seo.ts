/**
 * SEO Agent
 * - 입력: Planner의 Context
 * - 출력: 해시태그 20개 + AgentMeta (어느 프로바이더로 응답했는지)
 *
 * callWithFallback 사용. SEO는 1순위가 Groq였으나, 통합으로 GitHub Models 1순위.
 * 텍스트 작업은 모두 같은 fallback chain 사용.
 */

import { callWithFallback } from "@/lib/llm";
import { getCategoryGuide } from "@/lib/categories";
import type { HashtagTiers, Context, AgentMeta } from "@/types";

const PRIMARY_PROVIDER = "github-models" as const;

const SYSTEM = `너는 한국 인스타그램에서 실제로 자주 쓰이는 해시태그를 잘 아는 전략 전문가야.
주어진 컨텍스트를 바탕으로 해시태그 20개를 3계층으로 분류해 만든다.

==== 계층 정의 (정확히 이 개수) ====
- broad (대형, 정확히 5개): 인기 많고 경쟁 큰 일반 태그
  예: #카페, #일상, #여행, #감성, #힐링, #데일리, #먹스타그램
- niche (중형, 정확히 10개): 특정 주제 또는 지역 태그
  예: #신촌카페, #감성카페, #카페투어, #서울카페, #주말데이트
- specific (소형, 정확히 5개): 매우 구체적이거나 독특한 태그
  예: #토요일오후의카페, #나만의숨겨진카페, #카페에서글쓰기

==== 한국 인스타 자연스러운 패턴 ====
- 자주 쓰는 접미사: "그램", "스타그램", "스타" → #먹스타그램, #카페스타그램, #일상스타
- 자주 쓰는 접두사: "데일리", "오늘의", "주말의", "나만의"
- 영어 혼용: "OOTD", "daily", "vlog" 등은 영어 그대로
- "감성" 계열은 감성 톤, "맛집" 계열은 음식 톤, "데이트" 계열은 커플 톤

==== 작성 규칙 ====
- 한국어 우선, 영어 혼용 OK
- 정확히 broad 5 + niche 10 + specific 5 = 총 20개
- 중복 없음
- # 기호 없이 순수 키워드만 (시스템에서 # 자동 추가)
- 띄어쓰기 없이 한 단어처럼 (예: "신촌카페" O, "신촌 카페" X)
- 한자 금지

반드시 다음 JSON 형식으로만 답해. 다른 설명, 마크다운 없이 순수 JSON:
{
  "broad": ["...", "...", "...", "...", "..."],
  "niche": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "..."],
  "specific": ["...", "...", "...", "...", "..."]
}`;

export async function runSeo(
  context: Context
): Promise<{ hashtags: HashtagTiers; agentMeta: AgentMeta }> {
  const guide = getCategoryGuide(context.category);

  const categoryHint = `
[카테고리: ${context.category_label}]
- 이 카테고리에서 자주 쓰이는 broad 후보: ${guide.hashtag_seed_broad.join(", ")}
- 이 카테고리에서 자주 쓰이는 niche 후보: ${guide.hashtag_seed_niche.join(", ")}
(참고용 시드일 뿐. 그대로 베끼지 말고 컨텍스트에 맞게 조합·변형할 것)
`.trim();

  const userPrompt = `${categoryHint}

[컨텍스트]
- target_audience: ${context.target_audience}
- scene_summary: ${context.scene_summary}
- key_messages: ${context.key_messages.join(" / ")}
- keywords: ${context.keywords.join(", ")}

위 카테고리 특성과 컨텍스트를 종합해 broad 5 + niche 10 + specific 5 = 총 20개의 해시태그를 JSON으로 생성해.`;

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
