import type { AiProvider, AgentTurnOutput } from "@/lib/ai/ai-provider";
import type { FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type AgentWorkflowInput = {
  provider: AiProvider;
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  conversation: Array<{ role: "agent" | "user"; content: string }>;
};

function countAgentQuestions(conversation: AgentWorkflowInput["conversation"]): number {
  return conversation.filter((message) => message.role === "agent").length;
}

export async function runNextAgentStep(input: AgentWorkflowInput): Promise<AgentTurnOutput> {
  if (countAgentQuestions(input.conversation) >= 12) {
    return {
      type: "ready",
      reason: "已达到最多 12 个追问，进入方案生成。"
    };
  }

  return input.provider.nextAgentTurn({
    analysis: input.analysis,
    profile: input.profile,
    conversation: input.conversation
  });
}
