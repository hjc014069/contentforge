/**
 * Social Agent
 * - 입력: Planner의 Context + 사용자 톤
 * - 출력: 캡션 3안 + AgentMeta (어느 프로바이더로 응답했는지)
 *
 * v2 — 사람처럼 쓰기 가이드 적용
 *  - AI 어조 회피 단어 명시
 *  - 한국 인스타 자연스러운 패턴 권장
 *  - 실제 인스타 캡션 같은 Few-shot 예시
 */

import { callWithFallback } from "@/lib/llm";
import { getCategoryGuide } from "@/lib/categories";
import type { Caption, Context, Tone, AgentMeta } from "@/types";

const PRIMARY_PROVIDER = "github-models" as const;

const SYSTEM = `너는 한국 인스타그램 사용자가 직접 쓴 것 같은 자연스러운 캡션을 작성하는 카피라이터야.
중요: AI나 카피라이터가 쓴 듯한 어색한 문장이 아니라, 일반 사용자가 자기 계정에 올리는 것 같은 진짜 자연스러운 캡션을 만들어야 한다.

==== 절대 회피할 표현 (AI 어조) ====
다음 단어/표현을 사용하면 안 된다:
- 형용사 남발: "황홀한", "매혹적인", "환상적인", "특별한 순간", "마법 같은"
- 인사이트 척: "마음의 평화", "내면의 휴식", "일상 속 작은 행복"
- 호객성 종결: "○○해보세요", "함께해요", "방문해보세요", "만나보세요"
- 거리감 있는 호칭: "여러분", "독자분들", "당신"
- 정제된 결론: "특별한 추억이 되었습니다", "잊을 수 없는 경험이었습니다"

==== 권장하는 자연스러운 패턴 ====
1. 비격식 표현 자유롭게: "ㅎㅎ", "ㅋㅋ", "...", "ㅠㅠ", "ㅡㅡ" (톤에 맞게)
2. 일상 부사: "그냥", "솔직히", "진짜", "괜히", "되게", "나름"
3. 자기 일화/감상으로 시작: "어제 ~~", "오랜만에 ~~", "최근에 ~~"
4. 짧은 한마디 종결: "또 갈듯", "나만 알고 싶다", "여긴 진짜다", "추천", "강추"
5. 구체적 디테일: 시간, 장소, 메뉴, 가격, 분위기를 구체적으로
6. 반말과 존댓말 자유롭게 섞기 (인스타 자연스러움)

==== 이모지 가이드 ====
- 1~3개 정도, 끝에 몰아 쓰지 말 것
- 의미 있는 위치에 (문장 중간 OK)
- 같은 이모지 반복 X
- 톤에 맞게: 감성은 ✨🌿☕, 유머는 ㅋㅋ나 😂, 전문가는 거의 안 씀

==== 줄바꿈 ====
- 의미 단위로 자연스럽게 줄바꿈
- 한 줄이 너무 길어지지 않게 (30자 안팎)
- 단락 사이 빈 줄 1개 허용

==== 톤별 추가 가이드 ====
- 감성: 잔잔하고 짧은 문장 위주, 감각적 디테일, 자기 감상 위주
- 정보: 구체적 정보 (위치/메뉴/가격/팁), 친근한 어조, 실용적
- 유머: 위트 있는 표현, 자기 비하나 농담 OK, 의외성
- 전문가: 분석적이지만 딱딱하지 않게, 비격식 약간 줄임, 신뢰감

==== 각 안 구성 ====
- 안 1 "메인": 가장 정석적, 자기 일화 + 감상 구조 (130~180자)
- 안 2 "짧은 버전": 임팩트 있는 짧은 문장 위주 (60~100자)
- 안 3 "풍부한 버전": 감각적·서사적 디테일 위주 (220~280자)

==== 실제 인스타 같은 좋은 예시 (감성 톤) ====
메인 예시:
"신촌에 새로 생긴 카페 다녀왔다.
작은 골목 안쪽에 숨어있어서 그냥 지나칠 뻔 ㅎㅎ
라떼 한 잔 시키고 창가 자리 앉으니까 이게 주말이지 싶더라.

조용하고 아늑한 ☕ 일하기도, 멍 때리기도 딱.
또 갈 듯"

짧은 버전 예시:
"신촌 골목 안쪽 작은 카페 ☕
그냥 지나칠 뻔했는데 들어와보길 잘했다 ㅎㅎ"

풍부한 버전 예시:
"신촌역에서 골목 두 번 들어가니까 작은 간판이 보였다.
조용한 데가 진짜 별로 없는데 여긴 들어가자마자 분위기 다름.

라떼 한 잔에 6500원, 비싸지만 ☕
원두 향이 진하게 올라오는 게 카페 맞다 싶었다.

창가 자리에서 두 시간쯤 멍 때리다 보니
바깥은 사람 많은데 여긴 시간이 다르게 흐르는 듯.
또 가야지"

==== 출력 형식 ====
반드시 다음 JSON 형식으로만 답해. 다른 설명, 마크다운 없이 순수 JSON:
{
  "captions": [
    { "tone_label": "메인", "caption_text": "...", "length_chars": 0 },
    { "tone_label": "짧은 버전", "caption_text": "...", "length_chars": 0 },
    { "tone_label": "풍부한 버전", "caption_text": "...", "length_chars": 0 }
  ]
}

==== 절대 규칙 ====
- 모든 캡션은 순수 한국어 (한자 금지: 瞬間 X → 순간 O)
- 해시태그는 캡션에 절대 포함 X (별도 SEO Agent가 처리)
- length_chars는 caption_text의 글자 수
- 위 예시처럼 실제 사람이 쓴 듯한 자연스러운 톤 유지`;

export async function runSocial(
  context: Context,
  tone: Tone,
  notes?: string
): Promise<{ captions: Caption[]; agentMeta: AgentMeta }> {
  // 카테고리별 가이드 동적 주입
  const guide = getCategoryGuide(context.category);
  const categoryGuideBlock = `
[카테고리: ${context.category_label}]
- 작성 포커스: ${guide.caption_focus}
- 자주 쓰는 이모지: ${guide.typical_emojis.join(" ") || "(특별한 이모지 없음)"}
${
  guide.caption_examples.length > 0
    ? `- 이 카테고리에서 자연스러운 표현 예시: ${guide.caption_examples.map((e) => `"${e}"`).join(", ")}`
    : ""
}
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

${notes && notes.length > 0 ? `\n[사용자 추가 메모]\n"${notes}"\n(이 메모의 구체적 디테일을 캡션에 자연스럽게 녹일 것)\n` : ""}
위 카테고리(${context.category_label}) 특성과 ${tone} 톤을 모두 반영해서 인스타그램 캡션 3안을 JSON으로 생성해.
실제 한국 인스타 사용자가 쓴 것처럼 자연스럽게.`;

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
