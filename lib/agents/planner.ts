/**
 * Planner Agent
 * - 입력: 사진(선택) + 주제 + 톤
 * - 출력: Context (다른 모든 에이전트가 공유할 공통 컨텍스트)
 *
 * 사진이 있으면 Gemini Vision으로 분석, 없으면 Gemini 텍스트만 사용.
 */

import { callGemini, callGeminiVision } from "@/lib/llm/gemini";
import type { Context, ContentRequest, AgentMeta } from "@/types";

const PLANNER_AGENT_META: AgentMeta = {
  provider: "gemini",
  model: "gemini-2.5-flash",
  isFallback: false,
};

const PLANNER_SYSTEM = `너는 인스타그램 콘텐츠 기획 전문가야.
입력된 사진과 주제, 톤을 바탕으로 다른 AI 에이전트들이 함께 사용할 "공통 컨텍스트"를 만든다.

반드시 다음 JSON 형식으로만 답해. 다른 설명, 마크다운, 주석 없이 순수 JSON만:

{
  "target_audience": "누구를 위한 콘텐츠인지 한 문장",
  "tone_guideline": "톤을 어떻게 적용할지 한두 문장",
  "key_messages": ["핵심 메시지 1", "핵심 메시지 2", "핵심 메시지 3"],
  "scene_summary": "사진과 주제를 종합한 장면 요약 한두 문장",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
}

규칙:
- 모든 출력은 한국어
- key_messages는 정확히 3개
- keywords는 정확히 5개
- 사진이 있으면 사진의 시각적 요소(색감, 분위기, 피사체)를 반영
- tone_guideline은 추상적이지 않고 실행 가능한 형태로

==== 예시 1 ====
입력: 주제="신촌 카페 탐방", 톤="감성", 사진 2장(아늑한 카페 인테리어, 라떼아트)
출력:
{
  "target_audience": "감성적인 카페 분위기를 좋아하는 20-30대 여성",
  "tone_guideline": "잔잔하고 시적인 표현, 감각적인 묘사 위주의 문장 사용",
  "key_messages": ["조용한 카페에서의 여유로운 시간", "정성스러운 라떼 한 잔의 가치", "신촌의 숨은 명소 발견"],
  "scene_summary": "신촌 골목의 아늑한 카페에서 라떼를 즐기는 여유로운 오후의 한 장면",
  "keywords": ["신촌카페", "감성카페", "라떼아트", "카페투어", "주말데이트"]
}

==== 예시 2 ====
입력: 주제="제주 3일 여행", 톤="정보", 사진 3장(해변, 한라산 정상, 흑돼지구이)
출력:
{
  "target_audience": "제주 여행을 계획하는 30-40대 가족 단위 여행객",
  "tone_guideline": "구체적인 정보와 실용 팁 중심, 친근하지만 명확한 어조",
  "key_messages": ["3일이면 충분한 핵심 코스", "필수 방문 명소와 맛집 정리", "효율적인 일정 동선"],
  "scene_summary": "제주의 자연(해변, 한라산)과 미식(흑돼지)을 모두 담은 알찬 3일 일정",
  "keywords": ["제주여행", "3박4일", "제주맛집", "한라산", "흑돼지"]
}
`;

export async function runPlanner(
  req: ContentRequest
): Promise<{ context: Context; agentMeta: AgentMeta }> {
  const photoCount = req.photos?.length ?? 0;
  const hasTopic = req.topic && req.topic.trim().length > 0;

  if (!hasTopic && photoCount === 0) {
    throw new Error("주제 또는 사진 중 최소 하나는 입력되어야 합니다.");
  }

  const topicLine = hasTopic
    ? `주제: ${req.topic}`
    : `주제: (미지정 — 사진의 시각적 내용을 보고 적절한 주제를 자유롭게 추론할 것)`;
  const photoNote =
    photoCount > 0
      ? "(이미지를 함께 분석해 시각적 요소를 반영)"
      : "(사진 없음 — 주제와 톤만으로 추론)";

  const userPrompt = `이제 다음 입력에 대해 JSON을 생성해.

${topicLine}
톤: ${req.tone}
사진: ${photoCount}장 ${photoNote}`;

  const fullPrompt = `${PLANNER_SYSTEM}\n\n${userPrompt}`;

  const raw =
    photoCount > 0
      ? await callGeminiVision(fullPrompt, req.photos!, { jsonMode: true })
      : await callGemini(fullPrompt, { jsonMode: true });

  // jsonMode를 강제했더라도 안전하게 markdown wrapping 제거
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Context;

    // 최소 검증
    if (
      !parsed.target_audience ||
      !parsed.tone_guideline ||
      !Array.isArray(parsed.key_messages) ||
      !parsed.scene_summary ||
      !Array.isArray(parsed.keywords)
    ) {
      throw new Error("Missing required fields in Planner output");
    }

    return { context: parsed, agentMeta: PLANNER_AGENT_META };
  } catch (e) {
    throw new Error(
      `Planner JSON parsing failed.\nRaw output:\n${raw}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
