import { describe, expect, it } from "vitest";
import {
  agentInterviewResponseSchema,
  budgetTierSchema,
  floorPlanAnalysisSchema,
  generationStatusSchema,
  preferenceProfileSchema,
  styleSchema
} from "@/lib/domain/schemas";

describe("domain schemas", () => {
  it("accepts supported styles and budget tiers", () => {
    expect(styleSchema.parse("warm_wood")).toBe("warm_wood");
    expect(budgetTierSchema.parse("quality")).toBe("quality");
  });

  it("rejects unsupported style values", () => {
    expect(() => styleSchema.parse("industrial")).toThrow();
  });

  it("accepts the UI style set", () => {
    expect(styleSchema.options).toEqual([
      "warm_wood",
      "vintage",
      "modern_minimal",
      "bright",
      "wabi_sabi"
    ]);
  });

  it("validates floor plan analysis uncertainty", () => {
    const analysis = floorPlanAnalysisSchema.parse({
      rooms: [{ name: "客餐厅", type: "living_dining", confidence: 0.82 }],
      relationships: ["客餐厅连接阳台"],
      issues: [{ type: "lighting", description: "采光集中在阳台一侧", confidence: 0.72 }],
      uncertainItems: ["厨房面积不可见"],
      userCorrections: []
    });

    expect(analysis.rooms[0]?.type).toBe("living_dining");
    expect(analysis.uncertainItems).toContain("厨房面积不可见");
  });

  it("stores style, budget, and user preference text", () => {
    const profile = preferenceProfileSchema.parse({
      style: "bright",
      budgetTier: "quality",
      naturalLanguagePreference: "显大，好打理，适合一家三口",
      household: "一家三口",
      adoptedSuggestions: ["保留客餐厅开放感"],
      rejectedSuggestions: []
    });

    expect(profile.style).toBe("bright");
    expect(profile.budgetTier).toBe("quality");
  });

  it("parses designer prompt interview responses", () => {
    expect(
      agentInterviewResponseSchema.parse({
        type: "designer_prompt",
        message: "我建议把次卧做成多功能书房，你们对这个空间有什么需求吗？",
        options: ["书房", "客房", "儿童活动区"],
        progress: { current: 1, max: 12 }
      }).type
    ).toBe("designer_prompt");
  });

  it("parses generation task status", () => {
    expect(
      generationStatusSchema.parse({
        tasks: [
          { key: "requirement_profile", label: "整理需求画像", status: "done" },
          { key: "plan", label: "生成整体设计策略", status: "running" },
          { key: "spaces", label: "生成重点空间方案", status: "waiting" },
          { key: "renderings", label: "生成效果图", status: "waiting" },
          { key: "brief", label: "生成 PDF brief", status: "waiting" }
        ]
      }).tasks
    ).toHaveLength(5);
  });
});
