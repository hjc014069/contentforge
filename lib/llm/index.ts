/**
 * LLM Fallback Pattern — 통합 진입점 ★
 *
 * 두 가지 호출 경로:
 *
 * 1) 텍스트 (callWithFallback):
 *    GitHub Models → Groq → Gemini
 *
 * 2) Vision (callVisionWithFallback):
 *    Gemini → GitHub Models GPT-4o-mini Vision
 *
 * 각 단계에서 다음 에러는 자동 전환:
 *   - 429 (Rate limit / 한도 초과)
 *   - 5xx (서버 에러)
 *   - timeout / network 에러
 *
 * 다음 에러는 즉시 실패:
 *   - 400 (잘못된 요청 — 코드 버그)
 *   - 401 (인증 실패 — 키 문제)
 *
 * 발표 포인트: "한 API가 막혀도 시스템은 멈추지 않는다 — Vision도"
 */

import {
  callGitHubModels,
  callGitHubModelsVision,
  type GitHubModel,
} from "@/lib/llm/github-models";
import { callGroq, type GroqModel } from "@/lib/llm/groq";
import { callGemini, callGeminiVision } from "@/lib/llm/gemini";
import type { LLMResponse, Provider, PhotoInput } from "@/types";

export type FallbackOptions = {
  jsonMode?: boolean;
};

// ===== 텍스트 fallback =====

type TextProviderConfig = {
  provider: Provider;
  model: string;
  call: (prompt: string, jsonMode?: boolean) => Promise<string>;
};

const TEXT_PROVIDERS: TextProviderConfig[] = [
  {
    provider: "github-models",
    model: "openai/gpt-4o-mini",
    call: (prompt, jsonMode) =>
      callGitHubModels(prompt, {
        model: "openai/gpt-4o-mini" as GitHubModel,
        jsonMode,
      }),
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    call: (prompt, jsonMode) =>
      callGroq(prompt, {
        model: "llama-3.3-70b-versatile" as GroqModel,
        jsonMode,
      }),
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    call: (prompt, jsonMode) => callGemini(prompt, { jsonMode }),
  },
];

// ===== Vision fallback =====

type VisionProviderConfig = {
  provider: Provider;
  model: string;
  call: (
    prompt: string,
    images: PhotoInput[],
    jsonMode?: boolean
  ) => Promise<string>;
};

const VISION_PROVIDERS: VisionProviderConfig[] = [
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    call: (prompt, images, jsonMode) =>
      callGeminiVision(prompt, images, { jsonMode }),
  },
  {
    provider: "github-models",
    model: "openai/gpt-4o-mini",
    call: (prompt, images, jsonMode) =>
      callGitHubModelsVision(prompt, images, {
        model: "openai/gpt-4o-mini" as GitHubModel,
        jsonMode,
      }),
  },
];

// ===== 공통 에러 분류 =====

function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  // 429 — Rate limit / 한도 초과
  if (
    /\b429\b|rate.?limit|too\s*many\s*requests|quota\s*exceeded/i.test(message)
  )
    return true;
  // 5xx — 서버 에러 (503 포함)
  if (
    /\b5\d{2}\b|server\s*error|internal\s*error|service\s*unavailable|high\s*demand/i.test(
      message
    )
  )
    return true;
  // Timeout
  if (/timeout|timed\s*out|ETIMEDOUT|deadline\s*exceeded/i.test(message))
    return true;
  // Network
  if (
    /ECONNRESET|ENETUNREACH|ENOTFOUND|fetch\s*failed|network\s*error/i.test(
      message
    )
  )
    return true;
  // 인증 실패 (키 문제) — 다른 프로바이더는 다른 키를 쓰니까 fallback이 맞음
  // Gemini는 키 invalid를 400으로 반환하기 때문에 메시지 패턴으로 잡음
  if (
    /\b401\b|\b403\b|unauthorized|forbidden|API[_\s]?KEY[_\s]?(?:NOT[_\s]?VALID|INVALID)|invalid\s*api\s*key|API\s*key\s*not\s*valid/i.test(
      message
    )
  )
    return true;

  return false;
}

// ===== 텍스트 호출 =====

export async function callWithFallback(
  prompt: string,
  options?: FallbackOptions
): Promise<LLMResponse> {
  const errors: { provider: Provider; error: string }[] = [];

  for (const config of TEXT_PROVIDERS) {
    try {
      const content = await config.call(prompt, options?.jsonMode);
      return {
        content,
        provider: config.provider,
        model: config.model,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push({ provider: config.provider, error: errorMsg });

      if (isRetryableError(e)) {
        console.warn(
          `[Text Fallback] ${config.provider} failed (${errorMsg.slice(0, 80)}). 다음 프로바이더로 전환.`
        );
        continue;
      } else {
        throw new Error(`[${config.provider}] 복구 불가 에러: ${errorMsg}`);
      }
    }
  }

  const summary = errors
    .map((e) => `${e.provider}: ${e.error.slice(0, 100)}`)
    .join("\n");
  throw new Error(`모든 텍스트 프로바이더 실패:\n${summary}`);
}

// ===== Vision 호출 =====

export async function callVisionWithFallback(
  prompt: string,
  images: PhotoInput[],
  options?: FallbackOptions
): Promise<LLMResponse> {
  if (!images || images.length === 0) {
    throw new Error("Vision 호출에는 최소 1장의 이미지가 필요합니다.");
  }

  const errors: { provider: Provider; error: string }[] = [];

  for (const config of VISION_PROVIDERS) {
    try {
      const content = await config.call(prompt, images, options?.jsonMode);
      return {
        content,
        provider: config.provider,
        model: config.model,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push({ provider: config.provider, error: errorMsg });

      if (isRetryableError(e)) {
        console.warn(
          `[Vision Fallback] ${config.provider} failed (${errorMsg.slice(0, 80)}). 다음 프로바이더로 전환.`
        );
        continue;
      } else {
        throw new Error(
          `[${config.provider}] Vision 복구 불가 에러: ${errorMsg}`
        );
      }
    }
  }

  const summary = errors
    .map((e) => `${e.provider}: ${e.error.slice(0, 100)}`)
    .join("\n");
  throw new Error(`모든 Vision 프로바이더 실패:\n${summary}`);
}
