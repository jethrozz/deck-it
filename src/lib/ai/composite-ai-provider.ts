import type { AiProvider, AgentTurnInput } from "@/lib/ai/ai-provider";

type CompositeAiProviderDeps = {
  getVisionClient: () => Pick<AiProvider, "analyzeFloorPlan">;
  getTextClient: () => Pick<AiProvider, "nextAgentTurn" | "generateDesignPlan">;
  getImageClient: () => Pick<AiProvider, "generateRendering">;
};

export class CompositeAiProvider implements AiProvider {
  constructor(private readonly deps: CompositeAiProviderDeps) {}

  async analyzeFloorPlan(input: Parameters<AiProvider["analyzeFloorPlan"]>[0]) {
    return this.deps.getVisionClient().analyzeFloorPlan(input);
  }

  async nextAgentTurn(input: AgentTurnInput) {
    return this.deps.getTextClient().nextAgentTurn(input);
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    return this.deps.getTextClient().generateDesignPlan(input);
  }

  async generateRendering(input: Parameters<AiProvider["generateRendering"]>[0]) {
    return this.deps.getImageClient().generateRendering(input);
  }
}
