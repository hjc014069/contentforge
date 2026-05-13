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
  const modeRaw = formData.get("mode")?.toString() ?? "instagram";
  const notesRaw = formData.get("notes")?.toString() ?? "";
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

  const mode: ContentMode = VALID_MODES.includes(modeRaw as ContentMode)
    ? (modeRaw as ContentMode)
    : "instagram";

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
    mode,
    notes: notesRaw.trim() || undefined,
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
