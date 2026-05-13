/**
 * Planner Agent
 * - 입력: 사진(선택) + 주제 + 톤
 * - 출력: Context + AgentMeta
 *
 * Fallback 적용:
 *  - 사진 있을 때 (Vision): Gemini → GitHub Models GPT-4o-mini Vision
 *  - 사진 없을 때 (텍스트): GitHub Models → Groq → Gemini
 */

import { callWithFallback, callVisionWithFallback } from "@/lib/llm";
import { buildCategoryListForPrompt, getCategoryGuide } from "@/lib/categories";
import type { Context, ContentRequest, AgentMeta, Category } from "@/types";

const VISION_PRIMARY = "gemini" as const;
const TEXT_PRIMARY = "github-models" as const;

const PLANNER_SYSTEM = `너는 인스타그램 콘텐츠 기획 전문가야.
입력된 사진과 주제, 톤을 바탕으로 다른 AI 에이전트들이 함께 사용할 "공통 컨텍스트"를 만든다.

==== 카테고리 자동 판별 (필수) ====
사진과 주제를 보고 다음 8개 카테고리 중 가장 적합한 하나를 골라야 한다:

${buildCategoryListForPrompt()}

판별 규칙:
- 사진의 주된 피사체와 주제 텍스트를 종합해 판단
- 모호하면 사진의 시각적 내용을 우선
- 어디에도 명확히 안 맞으면 "other"

==== 출력 형식 ====
반드시 다음 JSON 형식으로만 답해. 다른 설명, 마크다운, 주석 없이 순수 JSON만:

{
  "category": "cafe",
  "category_label": "카페",
  "target_audience": "누구를 위한 콘텐츠인지 한 문장",
  "tone_guideline": "톤을 어떻게 적용할지 한두 문장",
  "key_messages": ["핵심 메시지 1", "핵심 메시지 2", "핵심 메시지 3"],
  "scene_summary": "사진과 주제를 종합한 장면 요약 한두 문장",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"]
}

규칙:
- category는 위 8개 영문 키 중 하나 (cafe / food / travel / daily / fashion / beauty / fitness / other)
- category_label은 그에 대응하는 한국어 라벨 (카페 / 음식·맛집 / 여행 / 일상 / 패션·OOTD / 뷰티 / 운동·헬스 / 기타)
- 모든 출력은 한국어
- key_messages는 정확히 3개, keywords는 정확히 5개
- 사진이 있으면 시각적 요소(색감, 분위기, 피사체)를 반영
- tone_guideline은 실행 가능한 형태로

==== 예시 1 (카페) ====
입력: 주제="신촌 카페 탐방", 톤="감성", 사진 2장(카페 인테리어, 라떼아트)
출력:
{
  "category": "cafe",
  "category_label": "카페",
  "target_audience": "감성적인 카페 분위기를 좋아하는 20-30대",
  "tone_guideline": "잔잔하고 짧은 문장, 공간 분위기와 음료에 대한 감각적 디테일",
  "key_messages": ["조용한 카페에서의 여유", "정성스러운 라떼 한 잔", "신촌의 숨은 명소"],
  "scene_summary": "신촌 골목의 아늑한 카페에서 라떼를 즐기는 여유로운 오후",
  "keywords": ["신촌카페", "감성카페", "라떼아트", "카페투어", "주말데이트"]
}

==== 예시 2 (여행) ====
입력: 주제="제주 3일 여행", 톤="정보", 사진 3장(해변, 한라산, 흑돼지구이)
출력:
{
  "category": "travel",
  "category_label": "여행",
  "target_audience": "제주 여행을 계획하는 30-40대 가족 단위 여행객",
  "tone_guideline": "구체적인 정보와 실용 팁 중심, 친근하지만 명확한 어조",
  "key_messages": ["3일이면 충분한 핵심 코스", "필수 방문 명소와 맛집", "효율적인 동선"],
  "scene_summary": "제주의 자연과 미식을 모두 담은 3일 여행 기록",
  "keywords": ["제주여행", "3박4일", "제주맛집", "한라산", "흑돼지"]
}

==== 예시 3 (음식) ====
입력: 주제="이태원 파스타 맛집", 톤="유머", 사진 2장(파스타, 식당 외관)
출력:
{
  "category": "food",
  "category_label": "음식·맛집",
  "target_audience": "맛집 탐방을 즐기는 20-30대",
  "tone_guideline": "위트 있게 식욕을 자극, 가격이나 메뉴 정보를 가볍게 곁들임",
  "key_messages": ["이태원 인생 파스타", "가성비 좋은 데이트 코스", "재방문 의지 100%"],
  "scene_summary": "이태원 골목에서 발견한 진짜 맛있는 파스타 한 그릇",
  "keywords": ["이태원맛집", "파스타맛집", "데이트맛집", "이태원파스타", "혼밥"]
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

  const notesBlock = req.notes && req.notes.length > 0
    ? `\n사용자 추가 메모: "${req.notes}"\n(이 메모를 scene_summary, key_messages, keywords 에 자연스럽게 반영할 것)`
    : "";

  const userPrompt = `이제 다음 입력에 대해 JSON을 생성해.

${topicLine}
톤: ${req.tone}${notesBlock}
사진: ${photoCount}장 ${photoNote}`;

  const fullPrompt = `${PLANNER_SYSTEM}\n\n${userPrompt}`;

  // Vision (사진 있음) vs Text (사진 없음) 분기 — 각자 다른 fallback chain
  const usingVision = photoCount > 0;
  const response = usingVision
    ? await callVisionWithFallback(fullPrompt, req.photos!, { jsonMode: true })
    : await callWithFallback(fullPrompt, { jsonMode: true });

  const cleaned = response.content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Context;

    if (
      !parsed.target_audience ||
      !parsed.tone_guideline ||
      !Array.isArray(parsed.key_messages) ||
      !parsed.scene_summary ||
      !Array.isArray(parsed.keywords)
    ) {
      throw new Error("Missing required fields in Planner output");
    }

    // 카테고리 검증 + fallback (LLM이 잘못된 값 반환 시 'other'로)
    const validCategory: Category = (
      ["cafe", "food", "travel", "daily", "fashion", "beauty", "fitness", "other"] as Category[]
    ).includes(parsed.category as Category)
      ? (parsed.category as Category)
      : "other";
    parsed.category = validCategory;
    if (!parsed.category_label) {
      parsed.category_label = getCategoryGuide(validCategory).label;
    }

    const primary = usingVision ? VISION_PRIMARY : TEXT_PRIMARY;
    const agentMeta: AgentMeta = {
      provider: response.provider,
      model: response.model,
      isFallback: response.provider !== primary,
    };

    return { context: parsed, agentMeta };
  } catch (e) {
    throw new Error(
      `Planner JSON parsing failed.\nRaw output:\n${response.content}\nError: ${
        e instanceof Error ? e.message : e
      }`
    );
  }
}
