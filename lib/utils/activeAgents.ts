/**
 * 활성 에이전트 결정 — 진실의 단일 출처 (Single Source of Truth)
 *
 * 사용자 입력(모드, 사진 개수 등) → 이번 작업에 참여할 에이전트 배열
 *
 * 사용처:
 *   - Orchestrator: 어떤 에이전트를 호출할지 (간접적, 이미 모드 분기 + photoCount 처리)
 *   - ProgressBanner / AgentVisualization / PromptFlowView / OfficeRoom: 시각화
 *
 * 미래 확장:
 *   - mode → modes (다중 선택)
 *   - 옵션: seoEnabled, customLength 등 추가 시 input 에 필드 추가
 */

import type { ActiveAgentRole, ContentMode } from "@/types";

export type ActiveAgentsInput = {
  modes: ContentMode[];
  photoCount: number;
};

/**
 * 반환 순서가 시각화에서의 표시 순서가 됨:
 *   planner (단독, 위쪽) → 콘텐츠 에이전트들 → visual → seo (병렬, 아래쪽)
 *
 * 다중 모드 시 콘텐츠 에이전트가 1~3개 동시 활성화.
 */
export function getActiveAgents(input: ActiveAgentsInput): ActiveAgentRole[] {
  const list: ActiveAgentRole[] = ["planner"];

  if (input.modes.includes("instagram")) list.push("social");
  if (input.modes.includes("blog")) list.push("writer");
  if (input.modes.includes("shorts")) list.push("scripter");

  // Visual 은 사진 2장 이상일 때만 의미가 있음
  if (input.photoCount >= 2) list.push("visual");

  list.push("seo");

  return list;
}

/** planner 제외한 병렬 작업 에이전트들 (시각화 분기용) */
export function getParallelAgents(input: ActiveAgentsInput): ActiveAgentRole[] {
  return getActiveAgents(input).filter((r) => r !== "planner");
}
