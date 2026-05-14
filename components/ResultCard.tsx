"use client";

/**
 * ResultCard — 결과 카드 공통 컴포넌트
 * 헤더 좌측 색 바 + 이모지 + 제목 + 메타 배지 통일
 * Framer Motion 등장 애니메이션
 */

import { motion } from "framer-motion";
import type { AgentMeta } from "@/types";

export type ResultCardAccent =
  | "purple"   // planner
  | "emerald"  // social
  | "sky"      // writer
  | "rose"     // scripter
  | "pink"     // seo
  | "amber";   // visual

const ACCENT_BAR: Record<ResultCardAccent, string> = {
  purple: "bg-purple-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  rose: "bg-rose-500",
  pink: "bg-pink-500",
  amber: "bg-amber-500",
};

const ACCENT_META: Record<ResultCardAccent, string> = {
  purple: "bg-purple-950 text-purple-300",
  emerald: "bg-emerald-950 text-emerald-300",
  sky: "bg-sky-950 text-sky-300",
  rose: "bg-rose-950 text-rose-300",
  pink: "bg-pink-950 text-pink-300",
  amber: "bg-amber-950 text-amber-300",
};

const PROVIDER_NAMES: Record<string, string> = {
  "github-models": "GitHub Models",
  groq: "Groq",
  gemini: "Gemini",
  pollinations: "Pollinations",
};

export function formatProviderLabel(
  meta: AgentMeta | undefined,
  defaultLabel: string
): string {
  if (!meta) return defaultLabel;
  const provider = PROVIDER_NAMES[meta.provider] ?? meta.provider;
  let modelShort = meta.model;
  if (modelShort.startsWith("openai/")) modelShort = modelShort.slice(7);
  if (modelShort.startsWith("meta/")) modelShort = modelShort.slice(5);
  modelShort = modelShort.replace("-versatile", "").replace("-instant", "");
  const tag = meta.isFallback ? " (fallback)" : "";
  return `${provider} · ${modelShort}${tag}`;
}

type Props = {
  emoji: string;
  title: string;
  subtitle?: string;          // 글자 수, 개수 등
  accent: ResultCardAccent;
  meta?: AgentMeta;
  defaultProviderLabel?: string;
  children: React.ReactNode;
};

export function ResultCard({
  emoji,
  title,
  subtitle,
  accent,
  meta,
  defaultProviderLabel = "",
  children,
}: Props) {
  const accentBar = ACCENT_BAR[accent];
  const metaClass = meta?.isFallback
    ? "bg-amber-950 text-amber-300 border border-amber-700/50"
    : ACCENT_META[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
    >
      {/* 헤더 */}
      <div className="flex items-stretch">
        {/* 좌측 색 바 */}
        <div className={`w-1.5 ${accentBar}`} aria-hidden="true" />
        <div className="flex items-center gap-2 flex-1 px-5 py-4 flex-wrap">
          <span className="text-2xl">{emoji}</span>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && (
            <span className="text-xs text-gray-500 font-mono ml-1">
              {subtitle}
            </span>
          )}
          <span
            className={`ml-auto text-xs px-2 py-1 rounded font-mono ${metaClass}`}
          >
            {formatProviderLabel(meta, defaultProviderLabel)}
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-6 pb-6 pt-1">{children}</div>
    </motion.div>
  );
}
