"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AnimatePresence, motion } from "framer-motion";
import {
  TONE_OPTIONS,
  type Tone,
  type Context,
  type Caption,
  type HashtagTiers,
  type PhotoOrder,
  type BlogPost,
  type ShortsScript,
  type GeneratedImageSet,
  type ContentMode,
  type BlogLength,
  BLOG_LENGTH_RANGES,
  type ProgressEvent,
  type ActiveAgentRole,
  type AgentState,
  type AgentMeta,
  type PromptCapture,
} from "@/types";
import { resizeImage } from "@/lib/utils/resize";
import {
  AgentVisualization,
  type AgentStates,
  type AgentMetaMap,
} from "@/components/AgentVisualization";
import { OfficeRoom } from "@/components/OfficeRoom";
import { getActiveAgents } from "@/lib/utils/activeAgents";
import { ProgressBanner } from "@/components/ProgressBanner";
import { ResultCard } from "@/components/ResultCard";
import { PromptFlowView } from "@/components/PromptFlowView";

type ResizedPhoto = {
  blob: Blob;
  previewUrl: string;
  filename: string;
};

type PipelineMeta = {
  durationMs: number;
  photoCount: number;
};

const MAX_PHOTOS = 10;

const INITIAL_AGENT_STATES: AgentStates = {
  planner: "idle",
  social: "idle",
  visual: "idle",
  seo: "idle",
  writer: "idle",
  scripter: "idle",
  imagegen: "idle",
};

export default function Home() {
  const [photos, setPhotos] = useState<ResizedPhoto[]>([]);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("감성");
  const [modes, setModes] = useState<ContentMode[]>([]);
  const [blogLength, setBlogLength] = useState<BlogLength>("normal");
  const [notes, setNotes] = useState("");
  const [generateImage, setGenerateImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"office" | "list" | "prompts">("office");

  const [agentStates, setAgentStates] = useState<AgentStates>(
    INITIAL_AGENT_STATES
  );
  const [agentMetas, setAgentMetas] = useState<AgentMetaMap>({});
  const [context, setContext] = useState<Context | null>(null);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [hashtags, setHashtags] = useState<HashtagTiers | null>(null);
  const [photoOrder, setPhotoOrder] = useState<PhotoOrder | null>(null);
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [shorts, setShorts] = useState<ShortsScript | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageSet | null>(null);
  const [prompts, setPrompts] = useState<Partial<Record<ActiveAgentRole, PromptCapture>>>({});
  // done 된 시점 기록 (모드 전환 시에도 유지되어야 OfficeRoom 의 15초 카운트가 정확함)
  const [doneSinceMs, setDoneSinceMs] = useState<Partial<Record<ActiveAgentRole, number>>>({});
  // 실행 시점에 캡처된 활성 에이전트 (시각화 표시용 — 실행 후 입력 변경되어도 유지)
  const [runAgents, setRunAgents] = useState<ActiveAgentRole[]>([]);
  const [meta, setMeta] = useState<PipelineMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const filesArray = Array.from(files).slice(0, remaining);

    const resized: ResizedPhoto[] = [];
    for (const file of filesArray) {
      try {
        const blob = await resizeImage(file, 1024, 0.85);
        resized.push({
          blob,
          previewUrl: URL.createObjectURL(blob),
          filename: file.name,
        });
      } catch (e) {
        console.error("Failed to resize", file.name, e);
      }
    }
    setPhotos((prev) => [...prev, ...resized]);
  }

  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    if (photos.length >= MAX_PHOTOS) return;
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (photos.length >= MAX_PHOTOS) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  }

  function resetResults() {
    setContext(null);
    setCaptions(null);
    setHashtags(null);
    setPhotoOrder(null);
    setBlog(null);
    setShorts(null);
    setGeneratedImages(null);
    setPrompts({});
    setDoneSinceMs({});
    setRunAgents([]);
    setMeta(null);
    setError(null);
    setAgentStates(INITIAL_AGENT_STATES);
    setAgentMetas({});
  }

  function setOneAgent(
    role: ActiveAgentRole,
    state: AgentState,
    meta?: AgentMeta
  ) {
    setAgentStates((s) => ({ ...s, [role]: state }));
    if (meta) {
      setAgentMetas((m) => ({ ...m, [role]: meta }));
    }
    // done 진입 시점 기록 (15초 후 wander 카운트용)
    if (state === "done") {
      setDoneSinceMs((d) => (role in d ? d : { ...d, [role]: Date.now() }));
    } else {
      setDoneSinceMs((d) => {
        if (!(role in d)) return d;
        const next = { ...d };
        delete next[role];
        return next;
      });
    }
  }

  function handleEvent(event: ProgressEvent) {
    switch (event.type) {
      case "planner.start":
        setOneAgent("planner", "working");
        break;
      case "planner.done":
        setOneAgent("planner", "done", event.agentMeta);
        setContext(event.context);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, planner: event.promptUsed }));
        break;
      case "social.start":
        setOneAgent("social", "working");
        break;
      case "social.done":
        setOneAgent("social", "done", event.agentMeta);
        setCaptions(event.captions);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, social: event.promptUsed }));
        break;
      case "seo.start":
        setOneAgent("seo", "working");
        break;
      case "seo.done":
        setOneAgent("seo", "done", event.agentMeta);
        setHashtags(event.hashtags);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, seo: event.promptUsed }));
        break;
      case "visual.start":
        setOneAgent("visual", "working");
        break;
      case "visual.done":
        setOneAgent("visual", "done", event.agentMeta);
        setPhotoOrder(event.photoOrder);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, visual: event.promptUsed }));
        break;
      case "visual.skipped":
        setOneAgent("visual", "skipped");
        break;
      case "writer.start":
        setOneAgent("writer", "working");
        break;
      case "writer.done":
        setOneAgent("writer", "done", event.agentMeta);
        setBlog(event.blog);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, writer: event.promptUsed }));
        break;
      case "scripter.start":
        setOneAgent("scripter", "working");
        break;
      case "scripter.done":
        setOneAgent("scripter", "done", event.agentMeta);
        setShorts(event.shorts);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, scripter: event.promptUsed }));
        break;
      case "imagegen.start":
        setOneAgent("imagegen", "working");
        break;
      case "imagegen.done":
        setOneAgent("imagegen", "done", event.agentMeta);
        setGeneratedImages(event.generatedImages);
        if (event.promptUsed)
          setPrompts((p) => ({ ...p, imagegen: event.promptUsed }));
        break;
      case "complete":
        setMeta(event.meta);
        break;
      case "error":
        setError(event.message);
        break;
    }
  }

  async function handleSubmit() {
    if (modes.length === 0) {
      alert("콘텐츠 모드를 하나 이상 선택해주세요. (📸 인스타 / 📝 블로그 / 🎬 쇼츠)");
      return;
    }
    setLoading(true);
    resetResults();
    // 실행 시점에 활성 에이전트 캡처 (이후 입력 변경되어도 시각화는 이 시점 기준)
    setRunAgents(getActiveAgents({ modes, photoCount: photos.length, generateImage }));
    try {
      const formData = new FormData();
      formData.append("topic", topic);
      formData.append("tone", tone);
      formData.append("modes", JSON.stringify(modes));
      formData.append("notes", notes);
      formData.append("generateImage", String(generateImage));
      formData.append("blogLength", blogLength);
      photos.forEach((p, i) => {
        formData.append("photos", p.blob, `photo-${i}.jpg`);
      });

      const res = await fetch("/api/pipeline", {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        throw new Error(`서버 응답 오류 (status ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as ProgressEvent;
            handleEvent(event);
          } catch (e) {
            console.error("Failed to parse stream line:", line, e);
          }
        }
      }

      const lastTrimmed = buffer.trim();
      if (lastTrimmed) {
        try {
          const event = JSON.parse(lastTrimmed) as ProgressEvent;
          handleEvent(event);
        } catch {
          // 무시
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function buildHashtagString(): string {
    if (!hashtags) return "";
    return [...hashtags.broad, ...hashtags.niche, ...hashtags.specific]
      .map((h) => `#${h}`)
      .join(" ");
  }

  const canSubmit = !loading && (photos.length > 0 || topic.trim().length > 0);
  const hasResults = context || captions || hashtags || photoOrder || blog || shorts || generatedImages;
  // 현재 입력 기준 활성 에이전트 (다음 실행 예상치 — 입력 영역 표시용)
  const previewAgents = getActiveAgents({ modes, photoCount: photos.length, generateImage });
  // 시각화에 사용할 활성 에이전트: 실행했으면 캡처된 runAgents, 아니면 미리보기
  const activeAgents = runAgents.length > 0 ? runAgents : previewAgents;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <div className="text-xs text-emerald-400 tracking-widest font-semibold uppercase">
            ContentForge MVP
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mt-1">
            멀티에이전트 콘텐츠 팩토리
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            멀티에이전트 + 멀티프로바이더 + 카테고리 자동 판별
          </p>
        </header>

        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          {/* === 입력 영역 === */}
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex-shrink-0">입력</h2>
            <div className="flex-1 overflow-y-auto scrollbar-hide -mr-2 pr-2">

            {/* 모드 다중 선택 */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">콘텐츠 모드 (다중 선택)</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setModes(["instagram", "blog", "shorts"])}
                    className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                  >
                    전부
                  </button>
                  <button
                    type="button"
                    onClick={() => setModes([])}
                    className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300"
                  >
                    초기화
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "instagram", emoji: "📸", label: "인스타", color: "emerald" },
                    { key: "blog", emoji: "📝", label: "블로그", color: "sky" },
                    { key: "shorts", emoji: "🎬", label: "쇼츠", color: "rose" },
                  ] as const
                ).map((m) => {
                  const selected = modes.includes(m.key);
                  const colorBg: Record<string, string> = {
                    emerald: "bg-emerald-600",
                    sky: "bg-sky-600",
                    rose: "bg-rose-600",
                  };
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setModes((prev) =>
                          prev.includes(m.key)
                            ? prev.filter((x) => x !== m.key)
                            : [...prev, m.key]
                        );
                      }}
                      className={`px-3 py-2 rounded text-sm transition flex items-center justify-center gap-1 ${
                        selected
                          ? `${colorBg[m.color]} text-white shadow-md scale-[1.02]`
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {selected && <span className="text-xs">✓</span>}
                      {m.emoji} {m.label}
                    </button>
                  );
                })}
              </div>
              <p className={`text-[11px] mt-1.5 ${modes.length === 0 ? "text-amber-400" : "text-gray-500"}`}>
                {modes.length === 0 && "⚠️ 모드를 하나 이상 선택하세요"}
                {modes.length === 1 && modes[0] === "instagram" && "캡션 3안 + 해시태그 + 사진 순서"}
                {modes.length === 1 && modes[0] === "blog" && "블로그 본문(마크다운) + 해시태그 + 사진 순서"}
                {modes.length === 1 && modes[0] === "shorts" && "60초 쇼츠 스크립트 + 해시태그 + 사진 순서"}
                {modes.length > 1 && `${modes.length}개 콘텐츠 동시 생성 — 한 입력으로 ${modes.length}가지 결과`}
              </p>
            </div>

            {/* 블로그 모드 전용: 글 길이 토글 */}
            {modes.includes("blog") && (
              <div className="mb-5">
                <label className="text-sm text-gray-400 mb-2 block">
                  글 길이
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["short", "normal", "long"] as BlogLength[]).map((len) => {
                    const r = BLOG_LENGTH_RANGES[len];
                    const selected = blogLength === len;
                    return (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setBlogLength(len)}
                        className={`px-2 py-2 rounded text-sm transition-all flex flex-col items-center gap-0.5 ${
                          selected
                            ? "bg-sky-600 text-white shadow-lg shadow-sky-600/30 scale-[1.02]"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-[1.01]"
                        }`}
                      >
                        <span className="font-semibold">{r.label}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            selected ? "text-sky-200" : "text-gray-500"
                          }`}
                        >
                          {r.min}~{r.max}자
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="text-sm text-gray-400 mb-2 flex items-center justify-between">
                <span>사진 (최대 {MAX_PHOTOS}장)</span>
                <span className="text-xs text-gray-500">
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </label>
              <label
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`block w-full px-4 py-5 border-2 border-dashed rounded-lg text-center text-sm transition-all cursor-pointer ${
                  photos.length >= MAX_PHOTOS
                    ? "border-gray-800 bg-gray-900/50 text-gray-600 cursor-not-allowed"
                    : isDragging
                    ? "border-purple-400 bg-purple-950/40 text-purple-200 scale-[1.01]"
                    : "border-gray-700 bg-gray-800/30 text-gray-400 hover:border-purple-500 hover:bg-purple-950/20 hover:text-purple-300"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                  disabled={photos.length >= MAX_PHOTOS}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <span className="text-2xl">{isDragging ? "📥" : "📷"}</span>
                  <span className="font-semibold">
                    {photos.length >= MAX_PHOTOS
                      ? "최대 개수 도달"
                      : isDragging
                      ? "여기에 놓으세요"
                      : "사진을 선택하세요"}
                  </span>
                  <span className={`text-[11px] ${isDragging ? "text-purple-300" : "text-gray-500"}`}>
                    클릭 또는 파일 끌어다 놓기
                  </span>
                </div>
              </label>
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.previewUrl}
                        alt={p.filename}
                        className="w-full aspect-square object-cover rounded border border-gray-800 transition-transform group-hover:scale-105"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600 text-white text-xs leading-none hover:bg-red-700"
                        aria-label="제거"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-5">
              <label className="text-sm text-gray-400 mb-2 block">
                주제{" "}
                <span className="text-gray-600">
                  (선택 — 사진만 올려도 OK)
                </span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 신촌 카페 탐방"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm transition-colors focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div className="mb-5">
              <label className="text-sm text-gray-400 mb-2 block">
                추가 정보{" "}
                <span className="text-gray-600">(선택 — AI가 글에 녹임)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 비 오는 평일, 라떼 6500원, 혼자 두 시간 머묾"
                rows={2}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm transition-colors focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                {notes.length}/200자 · 시간/장소/가격/분위기 같은 구체적 디테일을 적어주세요
              </p>
            </div>

            {/* AI 이미지 생성 옵션 */}
            <div className="mb-5">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={generateImage}
                  onChange={(e) => setGenerateImage(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded accent-fuchsia-600 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 group-hover:text-gray-100 transition">
                    🎨 AI 이미지도 함께 생성
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Context 기반 대표 이미지 1장 (GitHub Models · 실패 시 Pollinations)
                  </div>
                </div>
              </label>
            </div>

            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">톤</label>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((t) => {
                  const toneInfo: Record<string, { emoji: string; desc: string }> = {
                    "감성": { emoji: "🌿", desc: "잔잔·시적" },
                    "정보": { emoji: "📊", desc: "구체·실용" },
                    "유머": { emoji: "😂", desc: "위트·반전" },
                    "전문가": { emoji: "🧑‍🎓", desc: "분석·신뢰" },
                  };
                  const info = toneInfo[t];
                  const selected = tone === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTone(t)}
                      className={`px-3 py-2.5 rounded text-sm transition-all flex flex-col items-center gap-0.5 ${
                        selected
                          ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-[1.01]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{info.emoji}</span>
                        <span className="font-semibold">{t}</span>
                      </span>
                      <span className={`text-[10px] ${selected ? "text-purple-200" : "text-gray-500"}`}>
                        {info.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="mt-4 flex-shrink-0 w-full py-3 rounded-lg font-semibold transition-all
                         bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600
                         hover:from-purple-500 hover:via-fuchsia-500 hover:to-pink-500
                         hover:shadow-lg hover:shadow-purple-600/40 hover:scale-[1.01]
                         disabled:from-gray-700 disabled:via-gray-700 disabled:to-gray-700
                         disabled:hover:scale-100 disabled:hover:shadow-none
                         disabled:cursor-not-allowed
                         active:scale-[0.99]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                  에이전트 작동 중...
                </span>
              ) : (
                "▶ 콘텐츠 생성"
              )}
            </button>

            {!canSubmit && !loading && (
              <p className="text-xs text-gray-500 mt-2 flex-shrink-0">
                사진이나 주제 중 최소 하나는 입력해야 합니다.
              </p>
            )}

            {meta && (
              <div className="mt-5 pt-4 border-t border-gray-800 text-xs text-gray-500 font-mono flex-shrink-0">
                <div>전체 시간: {meta.durationMs}ms</div>
                <div>사진: {meta.photoCount}장</div>
              </div>
            )}
          </section>

          {/* === 결과 영역 === */}
          <section className="space-y-5">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-3">
              <div className="flex items-center justify-between mb-3 px-2 pt-1">
                <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  🏢 ContentForge 오피스
                </div>
                <div className="inline-flex rounded-lg bg-gray-950 border border-gray-800 p-0.5 text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => setViewMode("office")}
                    className={`px-3 py-1 rounded-md transition ${
                      viewMode === "office"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🏢 오피스
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1 rounded-md transition ${
                      viewMode === "list"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🃏 카드
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("prompts")}
                    className={`px-3 py-1 rounded-md transition ${
                      viewMode === "prompts"
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    🧠 프롬프트
                  </button>
                </div>
              </div>

              {viewMode === "office" && (
                <OfficeRoom showLabels agentStates={agentStates} activeAgents={activeAgents} doneSinceMs={doneSinceMs} />
              )}
              {viewMode === "list" && (
                <AgentVisualization
                  states={agentStates}
                  metas={agentMetas}
                  activeAgents={activeAgents}
                  prompts={prompts}
                />
              )}
              {viewMode === "prompts" && (
                <PromptFlowView
                  prompts={prompts}
                  metas={agentMetas}
                  activeAgents={activeAgents}
                  modes={modes}
                  userInput={{
                    topic,
                    tone,
                    notes,
                    photoCount: photos.length,
                  }}
                />
              )}
            </div>

            {/* 파이프라인 진행 상태 — 오피스 박스와 결과 카드 사이 */}
            <AnimatePresence>
              {(loading || hasResults) && (
                <motion.div
                  key="progress-banner"
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <ProgressBanner
                    states={agentStates}
                    activeAgents={activeAgents}
                    loading={loading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="bg-red-950 border border-red-800 rounded-2xl p-5 text-sm text-red-300">
                <strong>에러:</strong>
                <pre className="whitespace-pre-wrap mt-2 text-xs">{error}</pre>
              </div>
            )}

            {!loading && !hasResults && !error && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center text-gray-500 text-sm">
                좌측에 사진/주제/톤을 입력하고 [콘텐츠 생성]을 누르세요.
              </div>
            )}

            {/* Planner 결과 */}
            {context && (
              <ResultCard
                emoji="🤔"
                title="Planner — Context"
                accent="purple"
                meta={agentMetas.planner}
                defaultProviderLabel="Gemini Vision"
              >
                <div className="space-y-4">
                  <div>
                    <FieldLabel>📂 Category</FieldLabel>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {context.category_label}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        ({context.category})
                      </span>
                      <span className="text-[10px] text-emerald-400 ml-auto">
                        ⚡ AI 자동 판별
                      </span>
                    </div>
                  </div>
                  <Field label="🎯 Target Audience" value={context.target_audience} />
                  <Field label="🎨 Tone Guideline" value={context.tone_guideline} />
                  <div>
                    <FieldLabel>💬 Key Messages</FieldLabel>
                    <ul className="space-y-1">
                      {context.key_messages.map((m, i) => (
                        <li key={i} className="text-sm flex">
                          <span className="text-purple-400 mr-2 flex-shrink-0">▸</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Field label="🖼️ Scene Summary" value={context.scene_summary} />
                  <div>
                    <FieldLabel>🏷️ Keywords</FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {context.keywords.map((k, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-purple-950 text-purple-300 rounded-full text-xs"
                        >
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </ResultCard>
            )}

            {/* Social 결과 (instagram 모드) */}
            {captions && (
              <ResultCard
                emoji="✍️"
                title="Social — 캡션"
                subtitle={`${captions.length}안`}
                accent="emerald"
                meta={agentMetas.social}
                defaultProviderLabel="GitHub Models"
              >
                <div className="space-y-3">
                  {captions.map((c, i) => (
                    <div
                      key={i}
                      className="bg-gray-950 border border-gray-800 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
                          {c.tone_label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 font-mono">
                            {c.length_chars}자
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(c.caption_text)}
                            className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded"
                          >
                            복사
                          </button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {c.caption_text}
                      </p>
                    </div>
                  ))}
                </div>
              </ResultCard>
            )}

            {/* Writer 결과 (blog 모드) */}
            {blog && (
              <BlogResultCard
                blog={blog}
                meta={agentMetas.writer}
                copyToClipboard={copyToClipboard}
              />
            )}

            {/* Scripter 결과 (shorts 모드) */}
            {shorts && (
              <ShortsResultCard
                shorts={shorts}
                meta={agentMetas.scripter}
                copyToClipboard={copyToClipboard}
              />
            )}

            {/* SEO 결과 */}
            {hashtags && (
              <ResultCard
                emoji="🏷️"
                title="SEO — 해시태그"
                subtitle="20개"
                accent="pink"
                meta={agentMetas.seo}
                defaultProviderLabel="GitHub Models"
              >
                <div className="space-y-4">
                  <HashtagTier
                    label="대형 (인기 · 경쟁 큰)"
                    count={hashtags.broad.length}
                    tags={hashtags.broad}
                    color="rose"
                  />
                  <HashtagTier
                    label="중형 (특정 주제/지역)"
                    count={hashtags.niche.length}
                    tags={hashtags.niche}
                    color="pink"
                  />
                  <HashtagTier
                    label="소형 (구체적/독특)"
                    count={hashtags.specific.length}
                    tags={hashtags.specific}
                    color="purple"
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    전체 {hashtags.broad.length + hashtags.niche.length + hashtags.specific.length}개
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildHashtagString())}
                    className="text-xs px-3 py-1.5 bg-pink-900 hover:bg-pink-800 text-pink-200 rounded"
                  >
                    전체 복사
                  </button>
                </div>
              </ResultCard>
            )}

            {/* Visual 결과 */}
            {photoOrder && (
              <ResultCard
                emoji="🖼️"
                title="Visual — 사진 순서 추천"
                accent="amber"
                meta={agentMetas.visual}
                defaultProviderLabel="Gemini Vision"
              >

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
                  {photoOrder.items.map((item) => {
                    const photo = photos[item.original_index];
                    return (
                      <div key={item.position} className="w-full">
                        <div className="relative">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.previewUrl}
                              alt={item.caption_hint}
                              className="w-full aspect-square object-cover rounded border border-gray-700"
                            />
                          ) : (
                            <div className="w-full aspect-square bg-gray-800 rounded flex items-center justify-center text-gray-500 text-xs">
                              (사진 없음)
                            </div>
                          )}
                          <div className="absolute -top-2 -left-2 w-8 h-8 bg-amber-500 text-gray-950 font-bold rounded-full flex items-center justify-center text-sm shadow-lg">
                            {item.position}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-amber-300 font-semibold">
                          {item.caption_hint}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 leading-relaxed">
                          {item.reason}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">
                    📖 스토리 흐름
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {photoOrder.reasoning}
                  </p>
                </div>
              </ResultCard>
            )}

            {/* AI 이미지 결과 */}
            {generatedImages && (
              <ResultCard
                emoji="🎨"
                title="ImageGen — AI 이미지"
                subtitle={`${generatedImages.images.length}장`}
                accent="purple"
                meta={agentMetas.imagegen}
                defaultProviderLabel="GitHub Models"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  {generatedImages.images.map((img, i) => (
                    <div key={i} className="space-y-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={`generated-${i + 1}`}
                        className="w-full aspect-square object-cover rounded border border-gray-700"
                        loading="lazy"
                      />
                      <a
                        href={img.url}
                        download={`contentforge-image-${i + 1}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs px-3 py-1.5 bg-fuchsia-900 hover:bg-fuchsia-800 text-fuchsia-200 rounded"
                      >
                        ⬇ 다운로드
                      </a>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">
                    🎯 이미지 프롬프트 (영문)
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed font-mono break-all">
                    {generatedImages.base_prompt}
                  </p>
                </div>
              </ResultCard>
            )}
          </section>
        </div>

        <footer className="mt-12 text-xs text-gray-600 text-center">
          ContentForge — AI융합실전프로젝트 · 2026-1
        </footer>
      </div>
    </main>
  );
}

/**
 * BlogResultCard - 블로그 본문 결과 카드
 * - 가짜 타이핑 효과 (글자 단위로 점진 표시)
 * - 마크다운 렌더링
 * - 접기/펼치기
 * - 복사 버튼 (마크다운 / 플레인 텍스트)
 */
function BlogResultCard({
  blog,
  meta,
  copyToClipboard,
}: {
  blog: BlogPost;
  meta?: AgentMeta;
  copyToClipboard: (text: string) => void;
}) {
  const [displayed, setDisplayed] = useState("");
  const [expanded, setExpanded] = useState(false);
  const blogRef = useRef(blog);

  // 글이 바뀌면 타이핑 재시작
  useEffect(() => {
    blogRef.current = blog;
    setDisplayed("");
    setExpanded(false);

    let i = 0;
    const total = blog.content.length;
    // 글자 수에 따라 속도 조절 (총 4~6초 정도)
    const stepMs = Math.max(8, Math.min(40, 5000 / total));
    const stepChars = total > 1500 ? 2 : 1;

    const id = setInterval(() => {
      i += stepChars;
      if (i >= total) {
        setDisplayed(blog.content);
        clearInterval(id);
      } else {
        setDisplayed(blog.content.slice(0, i));
      }
    }, stepMs);
    return () => clearInterval(id);
  }, [blog]);

  const isTyping = displayed.length < blog.content.length;
  // 접힌 상태: 첫 600자만
  const shouldCollapse = !expanded && blog.content.length > 600;
  const visibleContent = shouldCollapse ? displayed.slice(0, 600) : displayed;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📝</span>
        <h2 className="text-lg font-semibold">Writer — 블로그 본문</h2>
        <span className="text-xs text-gray-500 font-mono ml-2">
          {blog.char_count}자
        </span>
        <span
          className={`ml-auto text-xs px-2 py-1 rounded font-mono ${
            meta?.isFallback
              ? "bg-amber-950 text-amber-300 border border-amber-700/50"
              : "bg-sky-950 text-sky-300"
          }`}
        >
          {formatProviderLabel(meta, "GitHub Models")}
        </span>
      </div>

      <div className="bg-gray-950 border border-gray-800 rounded-lg p-5 relative">
        <div
          className="prose prose-invert prose-sm max-w-none
                     prose-headings:text-gray-100 prose-headings:font-bold
                     prose-h1:text-2xl prose-h1:mb-3 prose-h1:mt-0
                     prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2 prose-h2:text-sky-300
                     prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1
                     prose-p:text-gray-300 prose-p:leading-relaxed prose-p:my-2
                     prose-strong:text-white
                     prose-ul:my-2 prose-li:text-gray-300 prose-li:my-0.5"
        >
          <ReactMarkdown>{visibleContent}</ReactMarkdown>
          {isTyping && (
            <span className="inline-block w-1.5 h-4 bg-sky-400 ml-0.5 align-middle animate-pulse" />
          )}
        </div>
        {shouldCollapse && !isTyping && (
          <div className="mt-3 pt-3 border-t border-gray-800 text-center">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs px-3 py-1.5 bg-sky-900 hover:bg-sky-800 text-sky-200 rounded"
            >
              전체 보기 ({blog.content.length}자) ↓
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">
          {isTyping
            ? `작성 중... ${Math.round(
                (displayed.length / blog.content.length) * 100
              )}%`
            : "작성 완료"}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => copyToClipboard(blog.content)}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded"
          >
            마크다운 복사
          </button>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                blog.content
                  .replace(/^#{1,6}\s+/gm, "")
                  .replace(/\*\*(.+?)\*\*/g, "$1")
                  .replace(/^[-*]\s+/gm, "• ")
              )
            }
            className="text-xs px-3 py-1.5 bg-sky-900 hover:bg-sky-800 text-sky-200 rounded"
          >
            텍스트 복사
          </button>
        </div>
      </div>
    </div>
  );
}


/**
 * ShortsResultCard - 쇼츠 스크립트 결과 카드
 * - 영상 제목 + 총 길이
 * - Hook 박스 (강조)
 * - 장면 테이블 (시간/영상/내레이션/자막)
 * - CTA 박스
 * - 텍스트 전체 복사
 */
function ShortsResultCard({
  shorts,
  meta,
  copyToClipboard,
}: {
  shorts: ShortsScript;
  meta?: AgentMeta;
  copyToClipboard: (text: string) => void;
}) {
  function buildPlainText(): string {
    const lines: string[] = [];
    lines.push(`[제목] ${shorts.title}`);
    lines.push(`[총 길이] ${shorts.total_duration_sec}초`);
    lines.push("");
    lines.push(`[HOOK] ${shorts.hook}`);
    lines.push("");
    lines.push("[BODY]");
    shorts.scenes.forEach((s) => {
      lines.push(`[Scene ${s.index} · ${s.duration_sec}초]`);
      lines.push(`  영상: ${s.visual}`);
      lines.push(`  내레이션: ${s.voiceover}`);
      lines.push(`  자막: ${s.text_overlay}`);
    });
    lines.push("");
    lines.push(`[CTA] ${shorts.cta}`);
    return lines.join("\n");
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-2xl">🎬</span>
        <h2 className="text-lg font-semibold">Scripter — 쇼츠 스크립트</h2>
        <span className="text-xs text-gray-500 font-mono ml-2">
          ~{shorts.total_duration_sec}초
        </span>
        <span
          className={`ml-auto text-xs px-2 py-1 rounded font-mono ${
            meta?.isFallback
              ? "bg-amber-950 text-amber-300 border border-amber-700/50"
              : "bg-rose-950 text-rose-300"
          }`}
        >
          {formatProviderLabel(meta, "GitHub Models")}
        </span>
      </div>

      {/* 제목 */}
      <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mb-3">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">
          📺 영상 제목
        </div>
        <div className="text-base font-bold text-rose-200">{shorts.title}</div>
      </div>

      {/* Hook */}
      <div className="bg-rose-950/30 border border-rose-800/50 rounded-lg p-4 mb-3">
        <div className="text-xs text-rose-400 uppercase tracking-wider mb-1 font-semibold">
          🪝 HOOK · 첫 5초
        </div>
        <p className="text-sm text-rose-100 leading-relaxed">{shorts.hook}</p>
      </div>

      {/* 장면 테이블 */}
      <div className="space-y-2 mb-3">
        {shorts.scenes.map((s) => (
          <div
            key={s.index}
            className="bg-gray-950 border border-gray-800 rounded-lg p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-rose-900/60 text-rose-200 text-xs font-bold px-2 py-0.5 rounded">
                Scene {s.index}
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {s.duration_sec}초
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-gray-500 mb-0.5">📷 영상</div>
                <div className="text-gray-200">{s.visual}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">🎤 내레이션</div>
                <div className="text-gray-200">{s.voiceover}</div>
              </div>
              <div>
                <div className="text-gray-500 mb-0.5">💬 자막</div>
                <div className="text-rose-200 font-semibold">
                  {s.text_overlay}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-lg p-4">
        <div className="text-xs text-emerald-400 uppercase tracking-wider mb-1 font-semibold">
          🎯 CTA · 마지막 한 마디
        </div>
        <p className="text-sm text-emerald-100">{shorts.cta}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {shorts.scenes.length}개 장면 · 총 {shorts.total_duration_sec}초
        </span>
        <button
          type="button"
          onClick={() => copyToClipboard(buildPlainText())}
          className="text-xs px-3 py-1.5 bg-rose-900 hover:bg-rose-800 text-rose-200 rounded"
        >
          스크립트 전체 복사
        </button>
      </div>
    </div>
  );
}

function formatProviderLabel(
  meta: AgentMeta | undefined,
  defaultLabel: string
): string {
  if (!meta) return defaultLabel;
  const providerNames: Record<string, string> = {
    "github-models": "GitHub Models",
    groq: "Groq",
    gemini: "Gemini",
    pollinations: "Pollinations",
  };
  const provider = providerNames[meta.provider] ?? meta.provider;

  let modelShort = meta.model;
  if (modelShort.startsWith("openai/")) modelShort = modelShort.slice(7);
  if (modelShort.startsWith("meta/")) modelShort = modelShort.slice(5);
  modelShort = modelShort.replace("-versatile", "").replace("-instant", "");

  const tag = meta.isFallback ? " (fallback)" : "";
  return `${provider} · ${modelShort}${tag}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-semibold">
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function HashtagTier({
  label,
  count,
  tags,
  color,
}: {
  label: string;
  count: number;
  tags: string[];
  color: "rose" | "pink" | "purple";
}) {
  const colorMap = {
    rose: "bg-rose-950 text-rose-300",
    pink: "bg-pink-950 text-pink-300",
    purple: "bg-purple-950 text-purple-300",
  };
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-semibold flex items-center gap-2">
        <span>{label}</span>
        <span className="text-gray-600">· {count}개</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span
            key={i}
            className={`px-2.5 py-1 ${colorMap[color]} rounded-full text-xs`}
          >
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}
