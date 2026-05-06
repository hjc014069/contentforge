/**
 * Pipeline endpoint — NDJSON 스트림 응답
 * - multipart/form-data 형식으로 사진 + 주제 + 톤 받음
 * - 각 에이전트의 진행 상태를 한 줄당 한 JSON 이벤트로 스트리밍
 * - 클라이언트는 line 단위로 파싱해 캐릭터 시각화 상태 업데이트
 *
 * 입력 필드:
 *   topic: string
 *   tone: Tone
 *   photos: File[] (최대 10장)
 */

import { NextRequest } from "next/server";
import { runPipeline } from "@/lib/orchestrator";
import type {
  Tone,
  PhotoInput,
  ContentRequest,
  ProgressEvent,
} from "@/types";

const VALID_TONES: Tone[] = ["감성", "정보", "유머", "전문가"];
const MAX_PHOTOS = 10;

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const topicRaw = formData.get("topic")?.toString() ?? "";
  const toneRaw = formData.get("tone")?.toString() ?? "";
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
        // runPipeline 내부에서 이미 'error' 이벤트를 send했으므로 추가 처리 불필요
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // nginx 등에서 버퍼링 방지
    },
  });
}
