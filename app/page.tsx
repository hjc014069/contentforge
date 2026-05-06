"use client";

import { useState } from "react";
import {
  TONE_OPTIONS,
  type Tone,
  type Context,
  type Caption,
  type HashtagTiers,
  type PhotoOrder,
  type ProgressEvent,
  type AgentRole,
  type AgentState,
  type AgentMeta,
} from "@/types";
import { resizeImage } from "@/lib/utils/resize";
import {
  AgentVisualization,
  type AgentStates,
  type AgentMetaMap,
} from "@/components/AgentVisualization";

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
};

export default function Home() {
  const [photos, setPhotos] = useState<ResizedPhoto[]>([]);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("감성");
  const [loading, setLoading] = useState(false);

  const [agentStates, setAgentStates] = useState<AgentStates>(
    INITIAL_AGENT_STATES
  );
  const [agentMetas, setAgentMetas] = useState<AgentMetaMap>({});
  const [context, setContext] = useState<Context | null>(null);
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const [hashtags, setHashtags] = useState<HashtagTiers | null>(null);
  const [photoOrder, setPhotoOrder] = useState<PhotoOrder | null>(null);
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
    setMeta(null);
    setError(null);
    setAgentStates(INITIAL_AGENT_STATES);
    setAgentMetas({});
  }

  function setOneAgent(role: AgentRole, state: AgentState, meta?: AgentMeta) {
    setAgentStates((s) => ({ ...s, [role]: state }));
    if (meta) {
      setAgentMetas((m) => ({ ...m, [role]: meta }));
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
        break;
      case "social.start":
        setOneAgent("social", "working");
        break;
      case "social.done":
        setOneAgent("social", "done", event.agentMeta);
        setCaptions(event.captions);
        break;
      case "seo.start":
        setOneAgent("seo", "working");
        break;
      case "seo.done":
        setOneAgent("seo", "done", event.agentMeta);
        setHashtags(event.hashtags);
        break;
      case "visual.start":
        setOneAgent("visual", "working");
        break;
      case "visual.done":
        setOneAgent("visual", "done", event.agentMeta);
        setPhotoOrder(event.photoOrder);
        break;
      case "visual.skipped":
        setOneAgent("visual", "skipped");
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
    setLoading(true);
    resetResults();
    try {
      const formData = new FormData();
      formData.append("topic", topic);
      formData.append("tone", tone);
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
  const hasResults = context || captions || hashtags || photoOrder;
  const showVisualization = loading || hasResults;

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
            멀티에이전트 + 멀티프로바이더 (자동 백업 전환)
          </p>
        </header>

        <div className="grid lg:grid-cols-[400px_1fr] gap-6">
          {/* === 입력 영역 === */}
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6 lg:sticky lg:top-6 lg:self-start">
            <h2 className="text-lg font-semibold mb-4">입력</h2>

            <div className="mb-5">
              <label className="text-sm text-gray-400 mb-2 flex items-center justify-between">
                <span>사진 (최대 {MAX_PHOTOS}장)</span>
                <span className="text-xs text-gray-500">
                  {photos.length}/{MAX_PHOTOS}
                </span>
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
                disabled={photos.length >= MAX_PHOTOS}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer hover:file:bg-purple-700 disabled:opacity-50"
              />
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2 mt-3">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.previewUrl}
                        alt={p.filename}
                        className="w-full aspect-square object-cover rounded border border-gray-800"
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
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-2 block">톤</label>
              <div className="grid grid-cols-2 gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-4 py-2 rounded text-sm transition ${
                      tone === t
                        ? "bg-purple-600 text-white"
                        : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
            >
              {loading ? "에이전트 작동 중..." : "▶ 콘텐츠 생성"}
            </button>

            {!canSubmit && !loading && (
              <p className="text-xs text-gray-500 mt-2">
                사진이나 주제 중 최소 하나는 입력해야 합니다.
              </p>
            )}

            {meta && (
              <div className="mt-5 pt-4 border-t border-gray-800 text-xs text-gray-500 font-mono">
                <div>전체 시간: {meta.durationMs}ms</div>
                <div>사진: {meta.photoCount}장</div>
              </div>
            )}
          </section>

          {/* === 결과 영역 === */}
          <section className="space-y-5">
            {/* 에이전트 시각화 (작업 중이거나 결과 있으면 표시) */}
            {showVisualization && (
              <AgentVisualization states={agentStates} metas={agentMetas} />
            )}

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
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🤔</span>
                  <h2 className="text-lg font-semibold">
                    Planner — Context
                  </h2>
                  <span className="ml-auto text-xs px-2 py-1 bg-purple-950 text-purple-300 rounded font-mono">
                    Gemini Vision
                  </span>
                </div>
                <div className="space-y-4">
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
              </div>
            )}

            {/* Social 결과 */}
            {captions && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">✍️</span>
                  <h2 className="text-lg font-semibold">
                    Social — 캡션 {captions.length}안
                  </h2>
                  <span className="ml-auto text-xs px-2 py-1 bg-emerald-950 text-emerald-300 rounded font-mono">
                    GitHub Models GPT-4o
                  </span>
                </div>
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
              </div>
            )}

            {/* SEO 결과 */}
            {hashtags && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏷️</span>
                  <h2 className="text-lg font-semibold">
                    SEO — 해시태그 20개
                  </h2>
                  <span className="ml-auto text-xs px-2 py-1 bg-pink-950 text-pink-300 rounded font-mono">
                    Groq Llama 3.3
                  </span>
                </div>
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
              </div>
            )}

            {/* Visual 결과 */}
            {photoOrder && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🖼️</span>
                  <h2 className="text-lg font-semibold">
                    Visual — 사진 순서 추천
                  </h2>
                  <span className="ml-auto text-xs px-2 py-1 bg-amber-950 text-amber-300 rounded font-mono">
                    Gemini Vision
                  </span>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2 mb-4">
                  {photoOrder.items.map((item) => {
                    const photo = photos[item.original_index];
                    return (
                      <div key={item.position} className="flex-shrink-0 w-36">
                        <div className="relative">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo.previewUrl}
                              alt={item.caption_hint}
                              className="w-36 h-36 object-cover rounded border border-gray-700"
                            />
                          ) : (
                            <div className="w-36 h-36 bg-gray-800 rounded flex items-center justify-center text-gray-500 text-xs">
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
              </div>
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
