import type { AiProvider } from "@/lib/ai/ai-provider";
import { CompositeAiProvider } from "@/lib/ai/composite-ai-provider";
import { DeepSeekTextClient } from "@/lib/ai/deepseek-text-client";
import { DoubaoImageClient } from "@/lib/ai/doubao-image-client";
import { DoubaoProvider } from "@/lib/ai/doubao-provider";
import { MockAiProvider } from "@/lib/ai/mock-ai-provider";
import { QwenVisionClient } from "@/lib/ai/qwen-vision-client";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requireProvider(name: "VISION_PROVIDER" | "TEXT_PROVIDER" | "IMAGE_PROVIDER", expected: string) {
  const provider = requireEnv(name);
  if (provider !== expected) {
    throw new Error(`Unsupported ${name}: ${provider}`);
  }
}

function once<T>(factory: () => T): () => T {
  let instance: T | undefined;

  return () => {
    if (!instance) {
      instance = factory();
    }

    return instance;
  };
}

export function createAiProvider(): AiProvider {
  const aiProvider = getEnv("AI_PROVIDER") ?? "mock";

  if (aiProvider === "mock") {
    return new MockAiProvider();
  }

  if (aiProvider === "doubao") {
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

  const getVisionClient = once(
    () =>
      new QwenVisionClient({
        apiKey: requireEnv("VISION_API_KEY"),
        baseUrl: requireEnv("VISION_BASE_URL"),
        model: requireEnv("VISION_MODEL")
      })
  );

  const getTextClient = once(
    () =>
      new DeepSeekTextClient({
        apiKey: requireEnv("TEXT_API_KEY"),
        baseUrl: requireEnv("TEXT_BASE_URL"),
        model: requireEnv("TEXT_MODEL")
      })
  );

  const getImageClient = once(
    () =>
      new DoubaoImageClient({
        apiKey: getEnv("IMAGE_API_KEY") ?? getEnv("DOUBAO_API_KEY") ?? requireEnv("ARK_API_KEY"),
        baseUrl: getEnv("IMAGE_BASE_URL") ?? "https://ark.cn-beijing.volces.com/api/v3",
        imageModel: getEnv("IMAGE_MODEL") ?? requireEnv("SEEDREAM_MODEL"),
        imageSize: getEnv("IMAGE_SIZE") ?? getEnv("SEEDREAM_SIZE") ?? "2048x2048"
      })
  );

  return new CompositeAiProvider({
    getVisionClient: () => {
      requireProvider("VISION_PROVIDER", "qwen");
      return getVisionClient();
    },
    getTextClient: () => {
      requireProvider("TEXT_PROVIDER", "deepseek");
      return getTextClient();
    },
    getImageClient: () => {
      requireProvider("IMAGE_PROVIDER", "doubao");
      return getImageClient();
    }
  });
}
