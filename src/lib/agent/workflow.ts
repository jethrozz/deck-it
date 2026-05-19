import type { AiProvider, AgentTurnOutput } from "@/lib/ai/ai-provider";
import type { FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type AgentWorkflowInput = {
  provider: AiProvider;
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  conversation: Array<{ role: "agent" | "user"; content: string }>;
};

const MAX_DESIGNER_TURNS = 12;
const TARGET_DESIGNER_TURNS = 5;
const TARGET_USER_ANSWERS = 5;

function countAgentQuestions(conversation: AgentWorkflowInput["conversation"]): number {
  return conversation.filter((message) => message.role === "agent").length;
}

function countUserAnswers(conversation: AgentWorkflowInput["conversation"]): number {
  return conversation.filter((message) => message.role === "user").length;
}

export async function runNextAgentStep(input: AgentWorkflowInput): Promise<AgentTurnOutput> {
  const agentQuestions = countAgentQuestions(input.conversation);
  const userAnswers = countUserAnswers(input.conversation);

  if (
    agentQuestions >= MAX_DESIGNER_TURNS ||
    (agentQuestions >= TARGET_DESIGNER_TURNS && userAnswers >= TARGET_USER_ANSWERS)
  ) {
    return {
      type: "complete",
      summary: "已收集足够信息，将按当前需求生成装修设计方案。",
      nextPath: "/generating"
    };
  }

  return input.provider.nextAgentTurn({
    analysis: input.analysis,
    profile: input.profile,
    conversation: input.conversation
  });
}
