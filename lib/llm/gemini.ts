/**
 * Gemini API 래퍼
 * - 텍스트 생성: callGemini()
 * - 이미지 + 텍스트(Vision): callGeminiVision()
 * - JSON 모드: options.jsonMode = true 로 강제
 *
 * 환경변수: GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// 2026년 5월 기준 안정 무료 모델
const GEMINI_MODEL = "gemini-2.5-flash";

let cachedClient: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!cachedClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in .env.local");
    }
    cachedClient = new GoogleGenerativeAI(apiKey);
  }
  return cachedClient;
}

export type GeminiOptions = {
  jsonMode?: boolean;
};

function getModel(options?: GeminiOptions) {
  const client = getClient();
  return client.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: options?.jsonMode
      ? { responseMimeType: "application/json" }
      : undefined,
  });
}

/**
 * 텍스트만 입력 받아 응답 생성
 */
export async function callGemini(
  prompt: string,
  options?: GeminiOptions
): Promise<string> {
  const model = getModel(options);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * 이미지(Buffer) + 텍스트 입력 받아 응답 생성
 */
export async function callGeminiVision(
  prompt: string,
  images: { data: Buffer; mimeType: string }[],
  options?: GeminiOptions
): Promise<string> {
  const model = getModel(options);

  const imageParts = images.map((img) => ({
    inlineData: {
      data: img.data.toString("base64"),
      mimeType: img.mimeType,
    },
  }));

  const result = await model.generateContent([prompt, ...imageParts]);
  return result.response.text();
}
