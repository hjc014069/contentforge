/**
 * LLM Fallback Pattern — 통합 진입점 ★
 *
 * 텍스트 작업의 자동 백업 전환을 담당한다.
 * 시도 순서: GitHub Models → Groq → Gemini
 *
 * 한 프로바이더가 다음 에러로 실패하면 다음 프로바이더로 전환:
 *   - 429 (Rate limit / 한도 초과)
 *   - 5xx (서버 에러)
 *   - timeout / network 에러
 *
 * 다음 에러는 즉시 실패 (다른 프로바이더로 가도 똑같이 실패할 것이므로):
 *   - 400 (잘못된 요청 — 코드 버그)
 *   - 401 (인증 실패 — 키 문제)
 *
 * 발표 포인트: "한 API가 막혀도 시스템은 멈추지 않는다"
 */

import { callGitHubModels, type GitHubModel } from "@/lib/llm/github-models";
import { callGroq, type GroqModel } from "@/lib/llm/groq";
import { callGemini } from "@/lib/llm/gemini";
import type { LLMResponse, Provider } from "@/types";

export type FallbackOptions = {
  jsonMode?: boolean;
};

type ProviderConfig = {
  provider: Provider;
  model: string;
  call: (prompt: string, jsonMode?: boolean) => Promise<string>;
};

// 텍스트 작업의 시도 순서 — 1순위가 실패하면 다음으로
const TEXT_PROVIDERS: ProviderConfig[] = [
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

/**
 * 다음 프로바이더로 넘어갈 에러인지 판단
 */
function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  // 429 — Rate limit / 한도 초과
  if (/\b429\b|rate.?limit|too\s*many\s*requests|quota\s*exceeded/i.test(message))
    return true;
  // 5xx — 서버 에러
  if (/\b5\d{2}\b|server\s*error|internal\s*error|service\s*unavailable/i.test(message))
    return true;
  // Timeout
  if (/timeout|timed\s*out|ETIMEDOUT|deadline\s*exceeded/i.test(message))
    return true;
  // Network
  if (/ECONNRESET|ENETUNREACH|ENOTFOUND|fetch\s*failed|network\s*error/i.test(message))
    return true;

  return false;
}

/**
 * 텍스트 작업의 LLM 호출 — 자동 Fallback 적용
 *
 * @param prompt 사용자 프롬프트
 * @param options { jsonMode } 등
 * @returns LLMResponse — 실제로 성공한 프로바이더의 응답
 * @throws 모든 프로바이더가 실패한 경우 마지막 에러 throw
 */
export async function callWithFallback(
  prompt: string,
  options?: FallbackOptions
): Promise<LLMResponse> {
  const errors: { provider: Provider; error: string }[] = [];

  for (const config of TEXT_PROVIDERS) {
    try {
      const content = await config.call(prompt, options?.jsonMode);
      // 성공한 프로바이더 정보와 함께 반환
      return {
        content,
        provider: config.provider,
        model: config.model,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push({ provider: config.provider, error: errorMsg });

      if (isRetryableError(e)) {
        // 다음 프로바이더로 전환 (콘솔에 로그 남김)
        console.warn(
          `[Fallback] ${config.provider} failed (${errorMsg.slice(0, 80)}). 다음 프로바이더로 전환.`
        );
        continue;
      } else {
        // 즉시 실패 (코드 버그 또는 키 문제)
        throw new Error(
          `[${config.provider}] 복구 불가 에러: ${errorMsg}`
        );
      }
    }
  }

  // 모든 프로바이더 실패
  const summary = errors
    .map((e) => `${e.provider}: ${e.error.slice(0, 100)}`)
    .join("\n");
  throw new Error(`모든 LLM 프로바이더 실패:\n${summary}`);
}
