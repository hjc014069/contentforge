/**
 * Groq API 래퍼
 * - Llama 3.3 70B 또는 Llama 3.1 8B 사용
 * - JSON 모드 지원
 *
 * 환경변수: GROQ_API_KEY
 */

import Groq from "groq-sdk";

let cachedClient: Groq | null = null;

function getClient(): Groq {
  if (!cachedClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set in .env.local");
    }
    cachedClient = new Groq({ apiKey });
  }
  return cachedClient;
}

export type GroqModel =
  | "llama-3.3-70b-versatile"
  | "llama-3.1-8b-instant";

export type GroqOptions = {
  model?: GroqModel;
  jsonMode?: boolean;
};

export async function callGroq(
  prompt: string,
  options?: GroqOptions
): Promise<string> {
  const client = getClient();
  const completion = await client.chat.completions.create({
    model: options?.model ?? "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    ...(options?.jsonMode
      ? { response_format: { type: "json_object" as const } }
      : {}),
  });
  return completion.choices[0]?.message?.content ?? "";
}
