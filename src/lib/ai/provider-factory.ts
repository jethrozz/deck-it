import type { AiProvider } from "@/lib/ai/ai-provider";
import { DoubaoProvider } from "@/lib/ai/doubao-provider";
import { MockAiProvider } from "@/lib/ai/mock-ai-provider";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function createAiProvider(): AiProvider {
  if (process.env.AI_PROVIDER !== "doubao") {
    return new MockAiProvider();
  }

  const apiKey = getEnv("DOUBAO_API_KEY") ?? getEnv("ARK_API_KEY");
  const baseUrl = getEnv("DOUBAO_BASE_URL") ?? "https://ark.cn-beijing.volces.com/api/v3";
  const chatModel = getEnv("DOUBAO_CHAT_MODEL");
  const visionModel = getEnv("DOUBAO_VISION_MODEL");
  const imageModel = getEnv("SEEDREAM_MODEL");
  const imageSize = getEnv("SEEDREAM_SIZE") ?? "2048x2048";

  if (!apiKey || !chatModel || !visionModel || !imageModel) {
    throw new Error(
      "Doubao provider requires DOUBAO_API_KEY (or ARK_API_KEY), DOUBAO_CHAT_MODEL, DOUBAO_VISION_MODEL, and SEEDREAM_MODEL."
    );
  }

  return new DoubaoProvider({
    apiKey,
    baseUrl,
    chatModel,
    visionModel,
    imageModel,
    imageSize
  });
}
