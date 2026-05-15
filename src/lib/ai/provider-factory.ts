import type { AiProvider } from "@/lib/ai/ai-provider";
import { DoubaoProvider } from "@/lib/ai/doubao-provider";
import { MockAiProvider } from "@/lib/ai/mock-ai-provider";

export function createAiProvider(): AiProvider {
  if (process.env.AI_PROVIDER !== "doubao") {
    return new MockAiProvider();
  }

  const apiKey = process.env.DOUBAO_API_KEY;
  const visionUrl = process.env.DOUBAO_VISION_URL;
  const chatUrl = process.env.DOUBAO_CHAT_URL;
  const seedreamUrl = process.env.SEEDREAM_IMAGE_URL;

  if (!apiKey || !visionUrl || !chatUrl || !seedreamUrl) {
    throw new Error(
      "Doubao provider requires DOUBAO_API_KEY, DOUBAO_VISION_URL, DOUBAO_CHAT_URL, and SEEDREAM_IMAGE_URL."
    );
  }

  return new DoubaoProvider({ apiKey, visionUrl, chatUrl, seedreamUrl });
}
