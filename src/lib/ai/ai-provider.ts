import type { AgentInterviewResponse, DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type AgentConversationMessage = {
  role: "agent" | "user";
  content: string;
};

export type AgentTurnInput = {
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  conversation: AgentConversationMessage[];
};

export type AgentTurnOutput = AgentInterviewResponse;

export interface AiProvider {
  analyzeFloorPlan(input: { imageUrl: string; imageDataUrl?: string }): Promise<FloorPlanAnalysis>;
  nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput>;
  generateDesignPlan(input: {
    analysis: FloorPlanAnalysis;
    profile: PreferenceProfile;
    conversationSummary: string;
  }): Promise<DesignPlan>;
  generateRendering(input: { prompt: string; spaceTitle: string }): Promise<{ imageUrl: string }>;
}
