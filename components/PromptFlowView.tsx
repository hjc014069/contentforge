"use client";

/**
 * PromptFlowView — 프롬프트 흐름 시각화 (A안)
 *
 * 구조:
 *   [사용자 입력 박스]
 *         ↓
 *   [Planner 프롬프트 + 응답]
 *         ↓
 *   ┌─────┼─────┐
 *   ↓     ↓     ↓
 *  [Social/Writer/Scripter] [Visual] [SEO]
 *
 * 각 단계의 system / user / response 펼치기/접기.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import type {
  ActiveAgentRole,
  AgentMeta,
  ContentMode,
  PromptCapture,
  Tone,
} from "@/types";
import { formatProviderLabel } from "./ResultCard";

type Props = {
  prompts: Partial<Record<ActiveAgentRole, PromptCapture>>;
  metas?: Partial<Record<ActiveAgentRole, AgentMeta>>;
  activeAgents: ActiveAgentRole[];
  modes: ContentMode[];  // 입력 표시용 (📸 인스타 / 📝 블로그 / 🎬 쇼츠 — 다중 가능)
  // 사용자 입력 (참고용)
  userInput: {
    topic: string;
    tone: Tone;
    notes: string;
    photoCount: number;
  };
};

const AGENT_INFO: Record<
  ActiveAgentRole,
  { emoji: string; name: string; color: string; bg: string; border: string }
> = {
  planner: { emoji: "🤔", name: "Planner", color: "text-purple-300", bg: "bg-purple-950/40", border: "border-purple-700/50" },
  social: { emoji: "✍️", name: "Social", color: "text-emerald-300", bg: "bg-emerald-950/40", border: "border-emerald-700/50" },
  writer: { emoji: "📝", name: "Writer", color: "text-sky-300", bg: "bg-sky-950/40", border: "border-sky-700/50" },
  scripter: { emoji: "🎬", name: "Scripter", color: "text-rose-300", bg: "bg-rose-950/40", border: "border-rose-700/50" },
  visual: { emoji: "🖼️", name: "Visual", color: "text-amber-300", bg: "bg-amber-950/40", border: "border-amber-700/50" },
  seo: { emoji: "🏷️", name: "SEO", color: "text-pink-300", bg: "bg-pink-950/40", border: "border-pink-700/50" },
};

// 펼치기/접기 가능한 코드 블록
function CollapsibleBlock({
  label,
  content,
  emoji,
  defaultOpen = false,
}: {
  label: string;
  content: string;
  emoji: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;
  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs hover:bg-gray-800/50 transition-colors"
      >
        <span className="flex items-center gap-2 font-mono text-gray-300">
          <span>{emoji}</span>
          <span>{label}</span>
          <span className="text-gray-600">· {content.length.toLocaleString()}자</span>
        </span>
        <span className="text-gray-500 text-[10px]">
          {open ? "▼ 접기" : "▶ 펼치기"}
        </span>
      </button>
      {open && (
        <div className="bg-gray-950 border-t border-gray-800 max-h-80 overflow-y-auto">
          <pre className="text-[11px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap p-3">
            {content}
          </pre>
          <div className="px-3 py-1.5 border-t border-gray-800 bg-gray-900/50 flex justify-end">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(content).catch(() => {})}
              className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400"
            >
              복사
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentPromptBlock({
  role,
  prompt,
  meta,
}: {
  role: ActiveAgentRole;
  prompt?: PromptCapture;
  meta?: AgentMeta;
}) {
  const info = AGENT_INFO[role];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`border ${info.border} ${info.bg} rounded-2xl p-4`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-2xl">{info.emoji}</span>
        <span className={`text-base font-bold ${info.color}`}>{info.name}</span>
        {!prompt && (
          <span className="ml-2 text-[11px] text-gray-500">
            (아직 실행 안 됨)
          </span>
        )}
        {prompt?.photoCount !== undefined && prompt.photoCount > 0 && (
          <span className="ml-2 text-[11px] text-gray-500 font-mono">
            🖼️ 사진 {prompt.photoCount}장
          </span>
        )}
        {meta && (
          <span
            className={`ml-auto text-[10px] px-2 py-0.5 rounded font-mono ${
              meta.isFallback
                ? "bg-amber-950/60 text-amber-300 border border-amber-700/50"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            🔌 {formatProviderLabel(meta, "")}
          </span>
        )}
      </div>

      {prompt ? (
        <div className="space-y-2">
          <CollapsibleBlock
            label="시스템 프롬프트"
            emoji="📋"
            content={prompt.system}
          />
          <CollapsibleBlock
            label="사용자 프롬프트 (Context 주입)"
            emoji="💬"
            content={prompt.user}
            defaultOpen
          />
          <CollapsibleBlock
            label="LLM 응답 (raw)"
            emoji="📤"
            content={prompt.response}
          />
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic py-3 text-center">
          콘텐츠 생성 후 여기에 프롬프트가 표시됩니다
        </div>
      )}
    </motion.div>
  );
}

export function PromptFlowView({ prompts, metas, activeAgents, modes, userInput }: Props) {
  // planner 제외한 병렬 에이전트들
  const parallelRoles: ActiveAgentRole[] = activeAgents.filter(
    (r) => r !== "planner"
  );

  const hasAnyPrompt = Object.keys(prompts).length > 0;

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
            🧠 프롬프트 흐름
          </div>
          <p className="text-[11px] text-gray-600 mt-0.5">
            각 에이전트에게 전송된 프롬프트와 LLM 응답을 펼쳐서 확인
          </p>
        </div>
        {!hasAnyPrompt && (
          <span className="text-xs text-gray-500 italic">
            콘텐츠 생성 후 표시됩니다
          </span>
        )}
      </div>

      {/* 1) 사용자 입력 */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="border border-gray-700 bg-gray-800/30 rounded-2xl p-4 mb-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">📥</span>
          <span className="text-base font-bold text-gray-200">사용자 입력</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">📷 사진:</span>{" "}
            <span className="text-gray-200">{userInput.photoCount}장</span>
          </div>
          <div>
            <span className="text-gray-500">💭 주제:</span>{" "}
            <span className="text-gray-200">
              {userInput.topic || "(미입력)"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">🎨 톤:</span>{" "}
            <span className="text-gray-200">{userInput.tone}</span>
          </div>
          <div>
            <span className="text-gray-500">📋 모드:</span>{" "}
            <span className="text-gray-200">
              {modes
                .map((m) =>
                  m === "instagram"
                    ? "📸 인스타"
                    : m === "blog"
                    ? "📝 블로그"
                    : "🎬 쇼츠"
                )
                .join(" + ")}
            </span>
          </div>
          {userInput.notes && (
            <div className="sm:col-span-2">
              <span className="text-gray-500">📝 추가 메모:</span>{" "}
              <span className="text-gray-200">"{userInput.notes}"</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* 화살표 */}
      <div className="flex justify-center mb-3">
        <div className="w-0.5 h-6 bg-gray-700" />
      </div>

      {/* 2) Planner */}
      <AgentPromptBlock role="planner" prompt={prompts.planner} meta={metas?.planner} />

      {/* 분기 화살표 */}
      <div className="relative w-full h-10 my-3">
        <div className="absolute left-1/2 top-0 w-0.5 h-3 -translate-x-1/2 bg-gray-700" />
        <div className="absolute left-[16.66%] right-[16.66%] top-3 h-0.5 bg-gray-700" />
        <div className="absolute left-[16.66%] top-3 w-0.5 h-7 bg-gray-700" />
        <div className="absolute left-1/2 top-3 w-0.5 h-7 -translate-x-1/2 bg-gray-700" />
        <div className="absolute right-[16.66%] top-3 w-0.5 h-7 bg-gray-700" />
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 text-[10px] text-gray-500 italic bg-gray-900/50 px-2">
          같은 Context를 {parallelRoles.length}명에게 동시 주입
        </div>
      </div>

      {/* 3) 병렬 N개 에이전트 */}
      <div
        className="grid grid-cols-1 gap-3"
        style={{
          gridTemplateColumns:
            parallelRoles.length > 0
              ? `repeat(${parallelRoles.length}, minmax(0, 1fr))`
              : undefined,
        }}
      >
        {parallelRoles.map((role) => (
          <AgentPromptBlock
            key={role}
            role={role}
            prompt={prompts[role]}
            meta={metas?.[role]}
          />
        ))}
      </div>
    </div>
  );
}
