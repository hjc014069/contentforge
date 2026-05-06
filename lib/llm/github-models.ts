/**
 * GitHub Models API 래퍼
 * - GPT-4o, Llama 3.3 등 GitHub Models 카탈로그의 모델 호출
 * - GitHub Education Pack 활성 계정에서 무료 사용 가능
 * - JSON 모드 지원
 *
 * 환경변수: GITHUB_TOKEN (Personal Access Token, classic)
 */

import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";

const ENDPOINT = "https://models.github.ai/inference";

let cachedClient: ReturnType<typeof ModelClient> | null = null;

function getClient() {
  if (!cachedClient) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is not set in .env.local");
    }
    cachedClient = ModelClient(ENDPOINT, new AzureKeyCredential(token));
  }
  return cachedClient;
}

export type GitHubModel =
  | "openai/gpt-4o"
  | "openai/gpt-4o-mini"
  | "meta/Llama-3.3-70B-Instruct";

export type GitHubModelsOptions = {
  model?: GitHubModel;
  jsonMode?: boolean;
};

export async function callGitHubModels(
  prompt: string,
  options?: GitHubModelsOptions
): Promise<string> {
  const client = getClient();

  const response = await client.path("/chat/completions").post({
    body: {
      messages: [{ role: "user", content: prompt }],
      model: options?.model ?? "openai/gpt-4o-mini",
      ...(options?.jsonMode
        ? { response_format: { type: "json_object" } }
        : {}),
    },
  });

  if (response.status !== "200") {
    const bodyStr =
      typeof response.body === "string"
        ? response.body
        : JSON.stringify(response.body);
    throw new Error(
      `GitHub Models error (status ${response.status}): ${bodyStr}`
    );
  }

  const body = response.body as {
    choices?: { message?: { content?: string } }[];
  };
  return body.choices?.[0]?.message?.content ?? "";
}
