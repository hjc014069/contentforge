/**
 * Orchestrator — ContentForge의 심장 ★
 *
 * 멀티에이전트 흐름을 조율하면서 진행 상황과 프로바이더 정보를 실시간 발신.
 *
 * 1) Planner가 공통 Context 생성 → planner.start/done (provider 정보 포함)
 * 2) Social + SEO + Visual 이 같은 Context로 병렬 작업
 *    각각 시작/완료 시점에 이벤트 발신 (Fallback 발생 시 백업 프로바이더 정보 전송)
 *
 * 발표 포인트:
 *  - Promise.all 한 줄 = 멀티에이전트 병렬의 본질
 *  - callWithFallback (lib/llm/index.ts) = 멀티 프로바이더 신뢰성
 */

import { runPlanner } from "@/lib/agents/planner";
import { runSocial } from "@/lib/agents/social";
import { runSeo } from "@/lib/agents/seo";
import { runVisual } from "@/lib/agents/visual";
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

  try {
    // [1단계] Planner — 모든 에이전트가 공유할 컨텍스트 생성
    onProgress({ type: "planner.start" });
    const plannerResult = await runPlanner(req);
    onProgress({
      type: "planner.done",
      context: plannerResult.context,
      agentMeta: plannerResult.agentMeta,
    });

    // [2단계] Social + SEO + Visual 병렬 실행 ★
    const socialPromise = (async () => {
      onProgress({ type: "social.start" });
      const result = await runSocial(plannerResult.context, req.tone);
      onProgress({
        type: "social.done",
        captions: result.captions,
        agentMeta: result.agentMeta,
      });
    })();

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

    await Promise.all([socialPromise, seoPromise, visualPromise]);

    onProgress({
      type: "complete",
      meta: {
        durationMs: Date.now() - start,
        photoCount,
        topic: req.topic,
        tone: req.tone,
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
