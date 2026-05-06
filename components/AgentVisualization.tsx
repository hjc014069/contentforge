"use client";

/**
 * AgentVisualization — 4명의 에이전트 캐릭터를 표시
 *
 * 구조:
 *   [Planner]
 *      ↓
 *   [Social] [Visual] [SEO]   (병렬로 일하는 3명)
 *
 * 각 캐릭터는 4가지 상태:
 *  - idle: 잠자고 있음 (반투명)
 *  - working: 일하는 중 (위아래로 통통, 보더 빛남)
 *  - done: 완료 (체크 표시)
 *  - skipped: 작업 안 함 (Visual이 사진 1장 이하일 때)
 *
 * Lottie로 교체할 때는 emoji를 <Lottie animationData={...} />로 swap.
 */

import { motion, AnimatePresence } from "framer-motion";
import type { AgentRole, AgentState, AgentMeta, Provider } from "@/types";

// 프로바이더 표시 라벨
const PROVIDER_LABELS: Record<Provider, string> = {
  "github-models": "GitHub Models",
  groq: "Groq",
  gemini: "Gemini",
};

const PROVIDER_COLORS: Record<Provider, { bg: string; text: string }> = {
  "github-models": { bg: "bg-blue-950/60", text: "text-blue-300" },
  groq: { bg: "bg-orange-950/60", text: "text-orange-300" },
  gemini: { bg: "bg-cyan-950/60", text: "text-cyan-300" },
};

const AGENT_INFO: Record<
  AgentRole,
  {
    emoji: string;
    name: string;
    desc: string;
    workingMsg: string;
    accent: string;
    glow: string;
    bg: string;
    text: string;
    badge: string;
    badgeText: string;
  }
> = {
  planner: {
    emoji: "🤔",
    name: "Planner",
    desc: "컨텍스트 생성",
    workingMsg: "사진 분석 중...",
    accent: "border-purple-500",
    glow: "shadow-[0_0_24px_rgba(168,85,247,0.35)]",
    bg: "bg-purple-950/40",
    text: "text-purple-300",
    badge: "bg-purple-900/60",
    badgeText: "text-purple-200",
  },
  social: {
    emoji: "✍️",
    name: "Social",
    desc: "캡션 3안",
    workingMsg: "캡션 작성 중...",
    accent: "border-emerald-500",
    glow: "shadow-[0_0_24px_rgba(16,185,129,0.35)]",
    bg: "bg-emerald-950/40",
    text: "text-emerald-300",
    badge: "bg-emerald-900/60",
    badgeText: "text-emerald-200",
  },
  visual: {
    emoji: "🖼️",
    name: "Visual",
    desc: "사진 순서 추천",
    workingMsg: "스토리 흐름 정렬 중...",
    accent: "border-amber-500",
    glow: "shadow-[0_0_24px_rgba(245,158,11,0.35)]",
    bg: "bg-amber-950/40",
    text: "text-amber-300",
    badge: "bg-amber-900/60",
    badgeText: "text-amber-200",
  },
  seo: {
    emoji: "🏷️",
    name: "SEO",
    desc: "해시태그 20개",
    workingMsg: "해시태그 추출 중...",
    accent: "border-pink-500",
    glow: "shadow-[0_0_24px_rgba(236,72,153,0.35)]",
    bg: "bg-pink-950/40",
    text: "text-pink-300",
    badge: "bg-pink-900/60",
    badgeText: "text-pink-200",
  },
};

function StateBadge({ state, info }: { state: AgentState; info: typeof AGENT_INFO[AgentRole] }) {
  const labels: Record<AgentState, string> = {
    idle: "대기 중",
    working: "작업 중",
    done: "완료 ✓",
    skipped: "건너뜀",
  };
  const stateClass: Record<AgentState, string> = {
    idle: "bg-gray-800 text-gray-400",
    working: `${info.badge} ${info.badgeText}`,
    done: "bg-emerald-900/60 text-emerald-200",
    skipped: "bg-gray-800 text-gray-500",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded font-mono ${stateClass[state]}`}
    >
      {labels[state]}
    </span>
  );
}

function ProviderBadge({ meta }: { meta: AgentMeta }) {
  const colors = PROVIDER_COLORS[meta.provider];
  const label = PROVIDER_LABELS[meta.provider];

  if (meta.isFallback) {
    return (
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded font-mono bg-amber-950/60 text-amber-300 border border-amber-700/50`}
      >
        via: {label} (fallback)
      </span>
    );
  }
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${colors.bg} ${colors.text}`}
    >
      via: {label}
    </span>
  );
}

function AgentCharacter({
  role,
  state,
  meta,
}: {
  role: AgentRole;
  state: AgentState;
  meta?: AgentMeta;
}) {
  const info = AGENT_INFO[role];

  return (
    <motion.div
      animate={{
        opacity: state === "idle" || state === "skipped" ? 0.4 : 1,
      }}
      transition={{ duration: 0.4 }}
      className={`relative bg-gray-900 border-2 rounded-2xl p-4 transition-colors ${
        state === "working"
          ? `${info.accent} ${info.glow}`
          : state === "done"
          ? "border-emerald-700"
          : "border-gray-800"
      }`}
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={
            state === "working"
              ? { y: [0, -6, 0] }
              : state === "done"
              ? { scale: [1, 1.2, 1] }
              : {}
          }
          transition={{
            repeat: state === "working" ? Infinity : 0,
            duration: state === "working" ? 0.7 : 0.4,
          }}
          className="text-3xl flex-shrink-0"
        >
          {info.emoji}
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-sm font-bold">{info.name}</span>
            <StateBadge state={state} info={info} />
          </div>
          <div className="text-xs text-gray-500">{info.desc}</div>
          {meta && (state === "done" || state === "working") && (
            <div className="mt-1">
              <ProviderBadge meta={meta} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 h-4 text-xs text-gray-400">
        <AnimatePresence mode="wait">
          {state === "working" && (
            <motion.span
              key="working"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={info.text}
            >
              {info.workingMsg}
            </motion.span>
          )}
          {state === "done" && (
            <motion.span
              key="done"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-emerald-400"
            >
              완료되었습니다
            </motion.span>
          )}
          {state === "skipped" && (
            <motion.span
              key="skipped"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-gray-500"
            >
              사진 2장 이상 필요
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 진행 바 */}
      <div className="mt-1 h-1 bg-gray-800 rounded overflow-hidden">
        <motion.div
          className={
            state === "working"
              ? `h-full ${info.bg.replace("/40", "")}`
              : state === "done"
              ? "h-full bg-emerald-600"
              : ""
          }
          animate={{
            width:
              state === "idle"
                ? "0%"
                : state === "working"
                ? ["10%", "80%", "60%"]
                : state === "done"
                ? "100%"
                : "0%",
          }}
          transition={{
            repeat: state === "working" ? Infinity : 0,
            duration: state === "working" ? 1.5 : 0.4,
          }}
        />
      </div>
    </motion.div>
  );
}

export type AgentStates = Record<AgentRole, AgentState>;
export type AgentMetaMap = Partial<Record<AgentRole, AgentMeta>>;

export function AgentVisualization({
  states,
  metas,
}: {
  states: AgentStates;
  metas?: AgentMetaMap;
}) {
  // 어느 에이전트라도 fallback이 발생했는지 (배너 표시용)
  const hasAnyFallback = metas
    ? Object.values(metas).some((m) => m?.isFallback)
    : false;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 font-semibold flex items-center justify-between">
        <span>🤖 에이전트 작업 현황</span>
        {hasAnyFallback && (
          <span className="text-amber-400 font-mono text-[10px]">
            ⚠️ 백업 프로바이더 사용 중
          </span>
        )}
      </div>

      <div className="mb-2">
        <AgentCharacter
          role="planner"
          state={states.planner}
          meta={metas?.planner}
        />
      </div>

      <div className="text-center text-gray-600 text-xl my-1">↓</div>
      <div className="text-center text-xs text-gray-500 mb-2 italic">
        같은 Context를 3개 에이전트가 병렬로 받음
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <AgentCharacter
          role="social"
          state={states.social}
          meta={metas?.social}
        />
        <AgentCharacter
          role="visual"
          state={states.visual}
          meta={metas?.visual}
        />
        <AgentCharacter role="seo" state={states.seo} meta={metas?.seo} />
      </div>
    </div>
  );
}
