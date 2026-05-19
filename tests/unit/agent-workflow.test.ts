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
  it("returns a designer opening prompt when conversation is empty", async () => {
    const provider = {
      nextAgentTurn: vi.fn().mockResolvedValue({
        type: "designer_prompt",
        message: "我看客餐厅连接阳台，可以优先考虑显大和采光。你们最在意哪个生活场景？",
        options: ["孩子活动区", "朋友聚餐", "投影观影"],
        progress: { current: 1, max: 12 }
      })
    } as unknown as AiProvider;

    const result = await runNextAgentStep({ provider, analysis, profile, conversation: [] });

    expect(result.type).toBe("designer_prompt");
    expect(provider.nextAgentTurn).toHaveBeenCalledTimes(1);
  });

  it("completes after 12 designer turns", async () => {
    const provider = {
      nextAgentTurn: vi.fn()
    } as unknown as AiProvider;

    const conversation = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? ("agent" as const) : ("user" as const),
      content: `message ${index}`
    }));

    const result = await runNextAgentStep({ provider, analysis, profile, conversation });

    expect(result).toEqual({
      type: "complete",
      summary: "已收集足够信息，将按当前需求生成装修设计方案。",
      nextPath: "/generating"
    });
    expect(provider.nextAgentTurn).not.toHaveBeenCalled();
  });

  it("completes early after enough designer turns and user answers", async () => {
    const provider = {
      nextAgentTurn: vi.fn()
    } as unknown as AiProvider;

    const conversation = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ("agent" as const) : ("user" as const),
      content: `message ${index}`
    }));

    const result = await runNextAgentStep({ provider, analysis, profile, conversation });

    expect(result).toEqual({
      type: "complete",
      summary: "已收集足够信息，将按当前需求生成装修设计方案。",
      nextPath: "/generating"
    });
    expect(provider.nextAgentTurn).not.toHaveBeenCalled();
  });
});
