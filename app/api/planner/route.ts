/**
 * Planner Agent endpoint
 * - multipart/form-data 형식으로 사진 + 주제 + 톤 받음
 * - Planner Agent 실행 후 Context JSON 반환
 *
 * 입력 필드:
 *   topic: string (주제, 비어있어도 됨)
 *   tone: Tone ("감성" | "정보" | "유머" | "전문가")
 *   photos: File[] (최대 10장, 클라이언트에서 리사이즈된 JPEG)
 */

import { NextRequest, NextResponse } from "next/server";
import { runPlanner } from "@/lib/agents/planner";
import type { Tone, PhotoInput, ContentRequest } from "@/types";

const VALID_TONES: Tone[] = ["감성", "정보", "유머", "전문가"];
const MAX_PHOTOS = 10;

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    const formData = await req.formData();

    // 입력 추출
    const topicRaw = formData.get("topic")?.toString() ?? "";
    const toneRaw = formData.get("tone")?.toString() ?? "";
    const fileEntries = formData.getAll("photos");

    // 톤 검증
    if (!VALID_TONES.includes(toneRaw as Tone)) {
      return NextResponse.json(
        { ok: false, error: `유효하지 않은 톤: ${toneRaw}` },
        { status: 400 }
      );
    }

    // 사진 추출 + Buffer 변환
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

    const context = await runPlanner(request);

    return NextResponse.json({
      ok: true,
      context,
      meta: {
        durationMs: Date.now() - start,
        photoCount: photos.length,
        topic: request.topic,
        tone: request.tone,
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
