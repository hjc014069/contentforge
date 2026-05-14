"use client";

/**
 * ProgressBanner — 파이프라인 진행 상태 시각화 (Y자 병렬 레이아웃)
 *
 * 구조:
 *           🤔 Planner (단독, 위쪽)
 *                  │
 *          ┌───────┼───────┐
 *          ↓       ↓       ↓
 *       [Content] [Visual] [SEO]   (병렬, 동시에 working)
 *
 * 의도: "Planner 끝 → 나머지 3명 동시에 일한다"는 멀티에이전트 병렬의 본질 강조
 */

import { motion } from "framer-motion";
import type {
  ActiveAgentRole,
  AgentState,
} from "@/types";

type Props = {
  states: Record<ActiveAgentRole, AgentState>;
  /** 이번 작업에 참여하는 활성 에이전트 (planner 포함) */
  activeAgents: ActiveAgentRole[];
  loading: boolean;
};

const STAGE_INFO: Record<
  ActiveAgentRole,
  { emoji: string; name: string; color: string; light: string; ring: string; glow: string }
> = {
  planner: {
    emoji: "🤔",
    name: "Planner",
    color: "bg-purple-500",
    light: "text-purple-300",
    ring: "ring-purple-400/60",
    glow: "shadow-[0_0_18px_rgba(168,85,247,0.5)]",
  },
  social: {
    emoji: "✍️",
    name: "Social",
    color: "bg-emerald-500",
    light: "text-emerald-300",
    ring: "ring-emerald-400/60",
    glow: "shadow-[0_0_18px_rgba(16,185,129,0.5)]",
  },
  writer: {
    emoji: "📝",
    name: "Writer",
    color: "bg-sky-500",
    light: "text-sky-300",
    ring: "ring-sky-400/60",
    glow: "shadow-[0_0_18px_rgba(14,165,233,0.5)]",
  },
  scripter: {
    emoji: "🎬",
    name: "Scripter",
    color: "bg-rose-500",
    light: "text-rose-300",
    ring: "ring-rose-400/60",
    glow: "shadow-[0_0_18px_rgba(244,63,94,0.5)]",
  },
  visual: {
    emoji: "🖼️",
    name: "Visual",
    color: "bg-amber-500",
    light: "text-amber-300",
    ring: "ring-amber-400/60",
    glow: "shadow-[0_0_18px_rgba(245,158,11,0.5)]",
  },
  seo: {
    emoji: "🏷️",
    name: "SEO",
    color: "bg-pink-500",
    light: "text-pink-300",
    ring: "ring-pink-400/60",
    glow: "shadow-[0_0_18px_rgba(236,72,153,0.5)]",
  },
};

// 캐릭터 노드 (원형 아이콘 + 라벨)
function StageNode({
  role,
  state,
}: {
  role: ActiveAgentRole;
  state: AgentState;
}) {
  const info = STAGE_INFO[role];
  const bg =
    state === "done"
      ? "bg-emerald-600"
      : state === "working"
      ? info.color
      : state === "skipped"
      ? "bg-gray-700"
      : "bg-gray-800";
  const ring = state === "working" ? `ring-2 ${info.ring} ${info.glow}` : "";

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <motion.div
        className={`relative w-12 h-12 rounded-full flex items-center justify-center text-xl ${bg} ${ring}`}
        animate={
          state === "working"
            ? { scale: [1, 1.12, 1] }
            : state === "done"
            ? { scale: [1, 1.25, 1] }
            : {}
        }
        transition={{
          repeat: state === "working" ? Infinity : 0,
          duration: state === "working" ? 1.2 : 0.4,
        }}
      >
        <span>{info.emoji}</span>
        {state === "done" && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 text-gray-950 rounded-full text-[10px] flex items-center justify-center font-bold">
            ✓
          </span>
        )}
        {state === "skipped" && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-gray-500 text-gray-950 rounded-full text-[10px] flex items-center justify-center font-bold">
            −
          </span>
        )}
      </motion.div>
      <span
        className={`text-[10px] font-mono ${
          state === "idle" ? "text-gray-500" : info.light
        }`}
      >
        {info.name}
      </span>
      <span
        className={`text-[9px] ${
          state === "working"
            ? info.light + " font-semibold"
            : state === "done"
            ? "text-emerald-400"
            : state === "skipped"
            ? "text-gray-500"
            : "text-gray-600"
        }`}
      >
        {state === "idle"
          ? "대기"
          : state === "working"
          ? "작업중"
          : state === "done"
          ? "완료"
          : "건너뜀"}
      </span>
    </div>
  );
}

export function ProgressBanner({ states, activeAgents, loading }: Props) {
  // planner 는 별도 위쪽 표시, 나머지는 병렬
  const parallelRoles: ActiveAgentRole[] = activeAgents.filter(
    (r) => r !== "planner"
  );
  const allActive: ActiveAgentRole[] = activeAgents;

  // 진행률
  const doneCount = allActive.filter(
    (r) => states[r] === "done" || states[r] === "skipped"
  ).length;
  const totalCount = allActive.length;
  const percentage = Math.round((doneCount / totalCount) * 100);

  const currentWorking = allActive.filter((r) => states[r] === "working");
  const anyActivity = allActive.some(
    (r) => states[r] === "working" || states[r] === "done"
  );
  const allDone = doneCount === totalCount;
  const plannerDone = states.planner === "done";
  const parallelWorking = parallelRoles.filter(
    (r) => states[r] === "working"
  );

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex-1">
          🚦 파이프라인 진행 상태
        </div>
        {anyActivity && (
          <span className="text-xs font-mono text-gray-400">
            {doneCount}/{totalCount} · {percentage}%
          </span>
        )}
        {parallelWorking.length >= 2 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-gradient-to-r from-emerald-600 to-pink-600 text-white"
          >
            ⚡ {parallelWorking.length}개 병렬 진행 중
          </motion.span>
        )}
        {loading &&
          currentWorking.length === 1 &&
          (() => {
            const w = currentWorking[0];
            return (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-xs font-bold ${STAGE_INFO[w].light}`}
              >
                {STAGE_INFO[w].emoji} {STAGE_INFO[w].name} 작업 중...
              </motion.span>
            );
          })()}
        {!loading && allDone && anyActivity && (
          <span className="text-xs font-bold text-emerald-300">
            ✓ 모두 완료
          </span>
        )}
      </div>

      {/* 진행률 바 */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-4">
        <motion.div
          className="h-full bg-gradient-to-r from-purple-500 via-emerald-500 to-pink-500"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* === Y자 분기 다이어그램 === */}
      <div className="relative flex flex-col items-center">
        {/* 1단계: Planner (단독, 가운데) */}
        <StageNode role="planner" state={states.planner} />

        {/* 분기선 (Y자) — N개 자식에 맞춤 */}
        {parallelRoles.length > 0 && (
          <div className="relative w-full h-8 mt-2">
            {/* 세로선 (Planner 바로 아래) */}
            <div
              className={`absolute left-1/2 top-0 w-0.5 h-3 -translate-x-1/2 ${
                plannerDone ? "bg-emerald-600" : "bg-gray-700"
              }`}
            />
            {parallelRoles.length >= 2 && (
              <div
                className={`absolute top-3 h-0.5 ${
                  plannerDone ? "bg-emerald-600" : "bg-gray-700"
                }`}
                style={{
                  left: `${50 / parallelRoles.length}%`,
                  right: `${50 / parallelRoles.length}%`,
                }}
              />
            )}
            {parallelRoles.map((_, i) => {
              const leftPercent = ((i + 0.5) / parallelRoles.length) * 100;
              return (
                <div
                  key={i}
                  className={`absolute top-3 w-0.5 h-5 ${
                    plannerDone ? "bg-emerald-600" : "bg-gray-700"
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    transform: "translateX(-50%)",
                  }}
                />
              );
            })}
          </div>
        )}

        {/* 2단계: 병렬 N개 */}
        <div
          className="grid gap-2 w-full"
          style={{
            gridTemplateColumns: `repeat(${parallelRoles.length}, minmax(0, 1fr))`,
          }}
        >
          {parallelRoles.map((role) => (
            <div key={role} className="flex justify-center">
              <StageNode role={role} state={states[role]} />
            </div>
          ))}
        </div>

        {/* 병렬 강조 라벨 (Planner 완료 후, 병렬 시작 시) */}
        {plannerDone && parallelRoles.some((r) => states[r] !== "idle") && (
          <div className="mt-3 text-center">
            <span className="text-[10px] text-gray-500 italic">
              ↑ 같은 Context로 {parallelRoles.length}명이 동시에 작업
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
