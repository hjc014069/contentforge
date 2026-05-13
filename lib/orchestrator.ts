/**
 * Orchestrator — ContentForge의 심장 ★
 *
 * 멀티에이전트 흐름을 모드별로 분기:
 *   1) Planner 가 공통 Context 생성
 *   2) instagram 모드: Social + SEO + Visual 병렬
 *      blog 모드     : Writer + SEO + Visual 병렬
 *
 * 발표 포인트:
 *  - Promise.all 한 줄 = 멀티에이전트 병렬의 본질
 *  - 모드 분기 = 같은 입력으로 다른 포맷 생성 (인스타/블로그)
 */

import { runPlanner } from "@/lib/agents/planner";
import { runSocial } from "@/lib/agents/social";
import { runSeo } from "@/lib/agents/seo";
import { runVisual } from "@/lib/agents/visual";
import { runWriter } from "@/lib/agents/writer";
import { runScripter } from "@/lib/agents/scripter";
import type {
  ContentRequest,
  ProgressCallback,
  PipelineResult,
} from "@/types";

export async function runPipeline(
  req: ContentRequest,
  onProgress: ProgressCallback
): Promise<void> {
  const start = Date.now();
  const photoCount = req.photos?.length ?? 0;
  const mode = req.mode ?? "instagram";

  try {
    // [1단계] Planner
    onProgress({ type: "planner.start" });
    const plannerResult = await runPlanner(req);
    onProgress({
      type: "planner.done",
      context: plannerResult.context,
      agentMeta: plannerResult.agentMeta,
    });

    // [2단계] 모드별 분기 ★
    const seoPromise = (async () => {
      onProgress({ type: "seo.start" });
      const result = await runSeo(plannerResult.context);
      onProgress({
        type: "seo.done",
        hashtags: result.hashtags,
        agentMeta: result.agentMeta,
      });
    })();

    const visualPromise = (async () => {
      if (!req.photos || req.photos.length < 2) {
        onProgress({ type: "visual.skipped" });
        return;
      }
      onProgress({ type: "visual.start" });
      const result = await runVisual(req.photos, plannerResult.context);
      onProgress({
        type: "visual.done",
        photoOrder: result.photoOrder,
        agentMeta: result.agentMeta,
      });
    })();

    if (mode === "blog") {
      // 블로그 모드: Writer + SEO + Visual 병렬
      const writerPromise = (async () => {
        onProgress({ type: "writer.start" });
        const result = await runWriter(
          plannerResult.context,
          req.topic,
          req.tone,
          photoCount,
          req.notes
        );
        onProgress({
          type: "writer.done",
          blog: result.blog,
          agentMeta: result.agentMeta,
        });
      })();

      await Promise.all([writerPromise, seoPromise, visualPromise]);
    } else if (mode === "shorts") {
      // 쇼츠 모드: Scripter + SEO + Visual 병렬
      const scripterPromise = (async () => {
        onProgress({ type: "scripter.start" });
        const result = await runScripter(
          plannerResult.context,
          req.tone,
          photoCount,
          req.notes
        );
        onProgress({
          type: "scripter.done",
          shorts: result.shorts,
          agentMeta: result.agentMeta,
        });
      })();

      await Promise.all([scripterPromise, seoPromise, visualPromise]);
    } else {
      // 인스타 모드: Social + SEO + Visual 병렬
      const socialPromise = (async () => {
        onProgress({ type: "social.start" });
        const result = await runSocial(plannerResult.context, req.tone, req.notes);
        onProgress({
          type: "social.done",
          captions: result.captions,
          agentMeta: result.agentMeta,
        });
      })();

      await Promise.all([socialPromise, seoPromise, visualPromise]);
    }

    onProgress({
      type: "complete",
      meta: {
        durationMs: Date.now() - start,
        photoCount,
        topic: req.topic,
        tone: req.tone,
        mode,
      },
    });
  } catch (e) {
    onProgress({
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export type { PipelineResult };
