/**
 * 테스트 엔드포인트
 *
 * GET  /api/test           — 3종 LLM 호출 확인 (이전 단계)
 * GET  /api/test?planner=1 — Planner Agent 호출 확인 (사진 없이, 텍스트만)
 *
 * 사진 입력 테스트는 다음 단계의 입력 폼에서 진행합니다.
 */

import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/llm/gemini";
import { callGroq } from "@/lib/llm/groq";
import { callGitHubModels } from "@/lib/llm/github-models";
import { runPlanner } from "@/lib/agents/planner";

const TEST_PROMPT =
  "안녕하세요. 한 문장으로 자기소개 해주세요. 어떤 모델인지도 알려주세요.";

type TestResult = {
  ok: boolean;
  response?: unknown;
  error?: string;
  durationMs?: number;
};

async function runTest(fn: () => Promise<unknown>): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fn();
    return { ok: true, response, durationMs: Date.now() - start };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    };
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const plannerOnly = url.searchParams.get("planner");

  // Planner 단독 테스트
  if (plannerOnly) {
    const planner = await runTest(() =>
      runPlanner({
        topic: "신촌 카페 탐방",
        tone: "감성",
        // 사진 없이 텍스트만으로 동작 확인
      })
    );
    return NextResponse.json({ planner }, {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // 3종 LLM 동시 테스트
  const results = {
    prompt: TEST_PROMPT,
    gemini: await runTest(() => callGemini(TEST_PROMPT)),
    groq: await runTest(() => callGroq(TEST_PROMPT)),
    github_models: await runTest(() => callGitHubModels(TEST_PROMPT)),
  };

  return NextResponse.json(results, {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
