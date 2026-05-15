import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import { designPlanSchema, floorPlanAnalysisSchema } from "@/lib/domain/schemas";

type DoubaoConfig = {
  apiKey: string;
  visionUrl: string;
  chatUrl: string;
  seedreamUrl: string;
};

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Doubao request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export class DoubaoProvider implements AiProvider {
  constructor(private readonly config: DoubaoConfig) {}

  async analyzeFloorPlan(input: { imageUrl: string }) {
    const result = await postJson<{ output: unknown }>(this.config.visionUrl, this.config.apiKey, {
      image_url: input.imageUrl,
      instruction:
        "分析装修户型图，返回 JSON：rooms, relationships, issues, uncertainItems, userCorrections。不要输出施工图或精确报价。"
    });

    return floorPlanAnalysisSchema.parse(result.output);
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const result = await postJson<{ output: AgentTurnOutput }>(this.config.chatUrl, this.config.apiKey, {
      instruction: "你是装修设计师 Agent。最多追问 12 个问题。若信息足够，返回 ready；否则返回 question。",
      analysis: input.analysis,
      profile: input.profile,
      conversation: input.conversation
    });

    return result.output;
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    const result = await postJson<{ output: unknown }>(this.config.chatUrl, this.config.apiKey, {
      instruction:
        "生成装修设计 brief JSON，包含 overallStrategy, styleSummary, budgetAssumptions, keySpaces, disclaimer。keySpaces 数量必须是 2 到 3。",
      analysis: input.analysis,
      profile: input.profile,
      conversationSummary: input.conversationSummary
    });

    return designPlanSchema.parse(result.output);
  }

  async generateRendering(input: { prompt: string; spaceTitle: string }) {
    const result = await postJson<{ image_url?: string; data?: Array<{ url?: string }> }>(
      this.config.seedreamUrl,
      this.config.apiKey,
      {
        prompt: input.prompt,
        size: "1280x720",
        watermark: false
      }
    );

    const imageUrl = result.image_url ?? result.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error(`Seedream did not return an image URL for ${input.spaceTitle}`);
    }

    return { imageUrl };
  }
}
