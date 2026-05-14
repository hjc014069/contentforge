/**
 * Pipeline endpoint — NDJSON 스트림 응답
 * - multipart/form-data: topic, tone, mode, photos
 * - 각 에이전트 진행 상태를 한 줄당 한 JSON 이벤트로 스트리밍
 */

import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/orchestrator";
import type {
  Tone,
  ContentMode,
  BlogLength,
  PhotoInput,
  ContentRequest,
  ProgressEvent,
} from "@/types";

const VALID_TONES: Tone[] = ["감성", "정보", "유머", "전문가"];
const VALID_MODES: ContentMode[] = ["instagram", "blog", "shorts"];
const MAX_PHOTOS = 10;

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const topicRaw = formData.get("topic")?.toString() ?? "";
  const toneRaw = formData.get("tone")?.toString() ?? "";
  // modes 는 JSON 배열 문자열 또는 단일 mode 호환
  const modesRaw = formData.get("modes")?.toString() ?? "";
  const singleModeRaw = formData.get("mode")?.toString() ?? "";
  const notesRaw = formData.get("notes")?.toString() ?? "";
  const blogLengthRaw = formData.get("blogLength")?.toString() ?? "normal";
  const generateImageRaw = formData.get("generateImage")?.toString() ?? "false";
  const fileEntries = formData.getAll("photos");

  if (!VALID_TONES.includes(toneRaw as Tone)) {
    return new Response(
      JSON.stringify({
        type: "error",
        message: `유효하지 않은 톤: ${toneRaw}`,
      } satisfies ProgressEvent) + "\n",
      {
        status: 400,
        headers: { "Content-Type": "application/x-ndjson" },
      }
    );
  }

  // 다중 모드 파싱
  let parsedModes: ContentMode[] = [];
  if (modesRaw) {
    try {
      const arr = JSON.parse(modesRaw);
      if (Array.isArray(arr)) {
        parsedModes = arr.filter((m): m is ContentMode =>
          VALID_MODES.includes(m as ContentMode)
        );
      }
    } catch {
      // ignore parse error
    }
  }
  // 단일 mode fallback (구버전 호환)
  if (parsedModes.length === 0 && VALID_MODES.includes(singleModeRaw as ContentMode)) {
    parsedModes = [singleModeRaw as ContentMode];
  }
  // 기본값
  const modes: ContentMode[] =
    parsedModes.length > 0 ? parsedModes : ["instagram"];

  const VALID_BLOG_LENGTHS: BlogLength[] = ["short", "normal", "long"];
  const blogLength: BlogLength = VALID_BLOG_LENGTHS.includes(
    blogLengthRaw as BlogLength
  )
    ? (blogLengthRaw as BlogLength)
    : "normal";

  const photos: PhotoInput[] = [];
  for (const entry of fileEntries) {
    if (entry instanceof File && entry.size > 0) {
      if (photos.length >= MAX_PHOTOS) break;
      const buffer = Buffer.from(await entry.arrayBuffer());
      photos.push({
        data: buffer,
        mimeType: entry.type || "image/jpeg",
      });
    }
  }

  const request: ContentRequest = {
    topic: topicRaw.trim(),
    tone: toneRaw as Tone,
    modes,
    blogLength,
    notes: notesRaw.trim() || undefined,
    generateImage: generateImageRaw === "true",
    photos: photos.length > 0 ? photos : undefined,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: ProgressEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await runPipeline(request, send);
      } catch {
        // runPipeline 내부에서 이미 'error' 이벤트 send
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
