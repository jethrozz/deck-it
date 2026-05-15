import { describe, expect, it, vi } from "vitest";
import { runNextAgentStep } from "@/lib/agent/workflow";
import type { AiProvider } from "@/lib/ai/ai-provider";

const analysis = {
  rooms: [{ name: "客餐厅", type: "living_dining" as const, confidence: 0.8 }],
  relationships: ["客餐厅连接阳台"],
  issues: [{ type: "lighting" as const, description: "采光集中在阳台一侧", confidence: 0.7 }],
  uncertainItems: [],
  userCorrections: []
};

const profile = {
  style: "warm_wood" as const,
  budgetTier: "quality" as const,
  naturalLanguagePreference: "显大，好打理",
  lifestyleNotes: [],
  hardConstraints: [],
  adoptedSuggestions: [],
  rejectedSuggestions: []
};

describe("designer agent workflow", () => {
  it("stops asking after 12 agent questions", async () => {
    const provider = {
      nextAgentTurn: vi.fn().mockResolvedValue({
        type: "question",
        question: {
          id: "q-13",
          question: "还要继续问吗？",
          options: ["不需要"],
          reason: "测试"
        }
      })
    } as unknown as AiProvider;

    const conversation = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? ("agent" as const) : ("user" as const),
      content: `message ${index}`
    }));

    const result = await runNextAgentStep({ provider, analysis, profile, conversation });

    expect(result.type).toBe("ready");
    expect(provider.nextAgentTurn).not.toHaveBeenCalled();
  });

  it("returns provider question when under limit", async () => {
    const provider = {
      nextAgentTurn: vi.fn().mockResolvedValue({
        type: "question",
        question: {
          id: "q-1",
          question: "是否保留客餐厅开放感？",
          options: ["采纳", "拒绝"],
          reason: "影响布局"
        }
      })
    } as unknown as AiProvider;

    const result = await runNextAgentStep({ provider, analysis, profile, conversation: [] });

    expect(result.type).toBe("question");
    expect(provider.nextAgentTurn).toHaveBeenCalledTimes(1);
  });
});
