/**
 * Writer Agent
 * - 입력: Planner의 Context + 사용자 톤
 * - 출력: 블로그 본문 (마크다운 형식) + AgentMeta
 *
 * 인스타 캡션과 다르게:
 *  - 길이: 800~1500자 (네이버 블로그/브런치 분량)
 *  - 구조: 제목 + 인트로 + 본문 2~3섹션 + 마무리
 *  - 형식: 마크다운 (#, ##, ###, **, - 리스트)
 *  - 톤: 블로그 화법 (인스타보다 길고 정돈된 어조)
 */

import { callWithFallback } from "@/lib/llm";
import { getCategoryGuide } from "@/lib/categories";
import type { BlogPost, Context, Tone, AgentMeta } from "@/types";

const PRIMARY_PROVIDER = "github-models" as const;

const SYSTEM = `너는 한국 블로그(네이버 블로그 / 브런치 / 티스토리) 글을 자연스럽게 작성하는 작가야.
사용자가 직접 쓴 듯한 일상적이면서 정성스러운 글을 마크다운 형식으로 작성한다.

==== 절대 회피할 표현 ====
- 형용사 남발: "황홀한", "매혹적인", "환상적인", "특별한 순간"
- 거리감 있는 호칭: "여러분", "독자분들"
- 호객성 종결: "방문해보세요", "꼭 가보세요"
- AI 어투: "다음과 같은 ~", "이러한 측면에서", "결론적으로 말하면"
- 한자/중국어 (한국어 한글만 사용)

==== 권장하는 자연스러운 패턴 ====
1. 자기 일화/경험으로 시작 ("지난 주말에", "오랜만에", "최근에")
2. 구체적 디테일: 시간, 장소, 메뉴, 가격, 분위기
3. 일상 부사: "그냥", "솔직히", "진짜", "되게", "나름"
4. 짧은 단락 (3~5문장씩), 단락 사이 빈 줄
5. 마무리는 가볍게 ("또 가야지", "추천", "오랜만에 기분 전환 좋았다")
6. 종결 어미 "~다" / "~요" 일관성 (한 글 안에서 섞지 말기)

==== 글 구조 (마크다운) ====
1. # 제목 (호기심을 자극하는 한 줄, 20자 안팎)
2. (빈 줄)
3. 인트로 단락 (왜 이 글을 쓰게 됐는지, 2~4문장)
4. (빈 줄)
5. ## 첫 번째 섹션 제목
6. 본문 (3~5문장)
7. ## 두 번째 섹션 제목
8. 본문 (3~5문장)
9. (선택) ## 세 번째 섹션 제목
10. 본문
11. ## 마치며 (또는 비슷한 마무리 헤더)
12. 짧은 마무리 (2~3문장)

==== 마크다운 표기 ====
- # 제목 (한 글에 하나만)
- ## 소제목 (3~4개 권장)
- ### 더 작은 헤더 (선택)
- **굵게** (강조하고 싶은 핵심 표현 1~3개)
- - 불릿 리스트 (메뉴/추천 항목 등)
- 빈 줄로 단락 구분 명확하게

==== 길이 ====
- 전체 800~1500자 (마크다운 기호 제외)
- 너무 짧으면 성의 없어 보이고, 너무 길면 안 읽힘

==== 톤별 가이드 ====
- 감성: 잔잔하고 감각적, 자기 감상 위주, "~다" 종결
- 정보: 구체적 정보(위치/메뉴/가격/팁) 중심, 친근한 어조, "~요" OK
- 유머: 위트, 자기 비하 OK, 가벼운 농담, 종결 변주
- 전문가: 분석적이지만 딱딱하지 않게, 신뢰감, "~다" 종결

==== 출력 형식 ====
반드시 다음 JSON 형식으로만 답해. 다른 설명 없이 순수 JSON:
{
  "title": "글 제목 (마크다운 # 기호 없이)",
  "content": "# 제목\\n\\n인트로 단락...\\n\\n## 첫 섹션\\n\\n본문..."
}

content 안에는 위 글 구조의 전체 마크다운(헤더 포함)을 넣는다.
title 은 별도로 헤더 기호 없이 텍스트만.

==== 절대 규칙 ====
- 모든 글은 순수 한국어 (한자 금지)
- 해시태그 포함 X (SEO 에이전트가 따로 생성)
- 인스타용 짧은 캡션이 아니라 블로그용 글이어야 함`;

export async function runWriter(
  context: Context,
  topic: string,
  tone: Tone,
  photoCount: number,
  notes?: string
): Promise<{ blog: BlogPost; agentMeta: AgentMeta }> {
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
- topic: ${topic || "(사진 기반)"}
- target_audience: ${context.target_audience}
- tone: ${tone}
- tone_guideline: ${context.tone_guideline}
- key_messages: ${context.key_messages.join(" / ")}
- scene_summary: ${context.scene_summary}
- keywords: ${context.keywords.join(", ")}
- photo_count: ${photoCount}장
${notes && notes.length > 0 ? `- 사용자 추가 메모: "${notes}" (이 메모의 디테일을 본문에 자연스럽게 녹일 것 - 시간, 장소, 가격, 분위기 등)` : ""}

위 카테고리(${context.category_label}) 특성과 ${tone} 톤을 모두 반영해서 한국 블로그 본문을 마크다운 JSON으로 생성해.
사용자가 직접 쓴 듯 자연스럽고 정성스럽게.`;

  const fullPrompt = `${SYSTEM}\n\n${userPrompt}`;
  const response = await callWithFallback(fullPrompt, { jsonMode: true });

  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      title?: string;
      content?: string;
    };
    if (!parsed.title || !parsed.content) {
      throw new Error("title 또는 content 필드 누락");
    }

    // 본문에 # 제목이 없으면 추가 (마크다운 렌더링 시 제목 표시)
    let content = parsed.content.trim();
    if (!content.startsWith("#")) {
      content = `# ${parsed.title}\n\n${content}`;
    }

    return {
      blog: {
        title: parsed.title,
        content,
        // 마크다운 기호 제외한 글자 수 (대략)
        char_count: content.replace(/[#*\-`]/g, "").trim().length,
      },
      agentMeta: {
        provider: response.provider,
        model: response.model,
        isFallback: response.provider !== PRIMARY_PROVIDER,
      },
    };
  } catch (e) {
    throw new Error(
      `Writer JSON parsing failed.\nRaw output:\n${response.content}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
