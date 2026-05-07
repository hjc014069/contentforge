/**
 * 카테고리별 가이드 데이터
 *
 * Planner가 카테고리를 자동 판별 → Social/SEO가 이 가이드를 동적 주입
 *
 * 발표 포인트:
 *  "단순 LLM 호출이 아니라, 카테고리에 맞춰 다른 톤·다른 해시태그 패턴으로 생성"
 */

import type { Category } from "@/types";

export type CategoryGuide = {
  label: string;                    // 한국어 라벨
  description: string;               // Planner가 카테고리 판별할 때 참고할 설명
  caption_focus: string;             // 캡션 작성 시 무엇에 집중할지
  caption_examples: string[];        // 카테고리별 자연스러운 캡션 표현 예시
  typical_emojis: string[];          // 카테고리에서 자주 쓰는 이모지
  avoid_for_category: string[];      // 이 카테고리에서 특히 피해야 할 표현
  hashtag_seed_broad: string[];     // 대형 태그 시드 (참고용)
  hashtag_seed_niche: string[];     // 중형 태그 시드 (참고용)
};

export const CATEGORY_GUIDES: Record<Category, CategoryGuide> = {
  cafe: {
    label: "카페",
    description: "카페 공간, 음료(커피/디저트), 카페 분위기 사진",
    caption_focus: "공간의 분위기, 음료/메뉴, 시간의 여유, 발견의 즐거움",
    caption_examples: [
      "골목 안쪽 작은 카페 발견했다",
      "라떼 한 잔에 두 시간",
      "여기 진짜 분위기 좋다",
      "주말 오후 카페에서 멍",
    ],
    typical_emojis: ["☕", "✨", "🌿", "📖"],
    avoid_for_category: ["과도한 호객성"],
    hashtag_seed_broad: ["카페", "감성", "힐링", "데일리", "일상"],
    hashtag_seed_niche: ["카페투어", "감성카페", "카페스타그램", "주말카페", "혼자카페"],
  },
  food: {
    label: "음식·맛집",
    description: "음식, 식당, 맛집, 메뉴 사진",
    caption_focus: "메뉴 이름, 가격, 맛 묘사 (구체적), 재방문 의사",
    caption_examples: [
      "여기 진짜 맛있다",
      "이 가격에 이 정도면 가성비 갑",
      "또 가야지",
      "다음엔 이거 시켜야지",
      "예약 필수임",
    ],
    typical_emojis: ["🍽️", "😋", "🤤", "🔥"],
    avoid_for_category: ["과장된 형용사 ('황홀한 맛')"],
    hashtag_seed_broad: ["먹스타그램", "맛집", "맛스타그램", "데일리", "일상"],
    hashtag_seed_niche: ["맛집추천", "맛집투어", "혼밥", "데이트맛집", "현지맛집"],
  },
  travel: {
    label: "여행",
    description: "여행지 풍경, 관광지, 여행 일정 사진",
    caption_focus: "장소, 인상적인 순간, 일정 정보, 추천",
    caption_examples: [
      "여기 진짜 뷰 미쳤다",
      "사진엔 1도 안 담겨",
      "다음에 또 와야지",
      "이번 여행 인생샷 건짐",
      "정보 댓글로 받음",
    ],
    typical_emojis: ["✈️", "🌊", "🌅", "📷"],
    avoid_for_category: ["관광 안내문 같은 어조"],
    hashtag_seed_broad: ["여행", "여행스타그램", "감성", "힐링", "일상"],
    hashtag_seed_niche: ["국내여행", "여행기록", "주말여행", "여행지추천", "인생샷"],
  },
  daily: {
    label: "일상",
    description: "특정 카테고리에 안 맞는 일상 사진, 셀카, 무드샷",
    caption_focus: "감정, 소소한 일, 짧은 메모",
    caption_examples: [
      "그냥 오늘",
      "별거 없는 하루",
      "이런 날도 좋다",
      "요즘 기분",
      "끄적끄적",
    ],
    typical_emojis: ["💭", "🌿", "🤍"],
    avoid_for_category: ["과한 형식적 어투"],
    hashtag_seed_broad: ["일상", "데일리", "감성", "일상스타그램", "daily"],
    hashtag_seed_niche: ["일상기록", "데일리룩", "오늘하루", "소소한일상", "일상스타"],
  },
  fashion: {
    label: "패션·OOTD",
    description: "옷, 코디, 스타일링 사진",
    caption_focus: "옷 정보(브랜드/사이즈/가격), 매칭, 분위기",
    caption_examples: [
      "오늘의 ootd",
      "이 자켓 진짜 추천",
      "사이즈 정보 댓글",
      "가성비 갑",
      "겉옷만 받쳐주면 되는 코디",
    ],
    typical_emojis: ["🤍", "👔", "✨"],
    avoid_for_category: [],
    hashtag_seed_broad: ["OOTD", "오오티디", "패션", "데일리룩", "일상"],
    hashtag_seed_niche: ["패션스타그램", "데일리코디", "옷스타그램", "오늘의룩", "코디추천"],
  },
  beauty: {
    label: "뷰티",
    description: "화장품, 메이크업, 스킨케어 제품 사진",
    caption_focus: "제품 이름, 효과, 리뷰 (솔직한 후기)",
    caption_examples: [
      "이거 진짜 좋다",
      "재구매 각",
      "리뷰 진짜 솔직히",
      "사용 한 달 후기",
      "이 가격에 이 효과면 갓성비",
    ],
    typical_emojis: ["💄", "✨", "🤍"],
    avoid_for_category: ["광고처럼 들리는 표현"],
    hashtag_seed_broad: ["뷰티", "뷰티스타그램", "스킨케어", "메이크업", "데일리"],
    hashtag_seed_niche: ["뷰티추천", "스킨케어루틴", "메이크업추천", "립스타그램", "솔직후기"],
  },
  fitness: {
    label: "운동·헬스",
    description: "운동, 헬스장, 운동복, 운동 루틴 사진",
    caption_focus: "루틴, 성취, 동기부여, 운동 정보",
    caption_examples: [
      "오늘도 출석",
      "이번 주 3일째",
      "운동 후 셀카",
      "꾸준함이 답",
      "땀 흘린 만큼",
    ],
    typical_emojis: ["💪", "🔥", "🏋️"],
    avoid_for_category: [],
    hashtag_seed_broad: ["운동", "헬스타그램", "운동스타그램", "fitness", "데일리"],
    hashtag_seed_niche: ["홈트", "헬스", "운동기록", "다이어트일기", "운동루틴"],
  },
  other: {
    label: "기타",
    description: "위 어느 카테고리에도 명확히 안 맞는 경우",
    caption_focus: "상황에 맞춰 자유롭게",
    caption_examples: [],
    typical_emojis: [],
    avoid_for_category: [],
    hashtag_seed_broad: ["일상", "데일리", "감성"],
    hashtag_seed_niche: ["일상기록", "소통", "맞팔"],
  },
};

/**
 * 안전하게 카테고리 가이드 가져오기 (LLM이 잘못된 카테고리 반환 시 other로)
 */
export function getCategoryGuide(category: string): CategoryGuide {
  return (
    CATEGORY_GUIDES[category as Category] ?? CATEGORY_GUIDES.other
  );
}

/**
 * Planner 프롬프트에 들어갈 카테고리 정의 텍스트 (LLM이 보고 판별)
 */
export function buildCategoryListForPrompt(): string {
  return ALL_CATEGORY_LIST.map(
    (cat) =>
      `- ${cat}: ${CATEGORY_GUIDES[cat].label} (${CATEGORY_GUIDES[cat].description})`
  ).join("\n");
}

const ALL_CATEGORY_LIST: Category[] = [
  "cafe", "food", "travel", "daily", "fashion", "beauty", "fitness", "other",
];
