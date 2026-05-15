import { describe, expect, it } from "vitest";
import {
  budgetTierSchema,
  floorPlanAnalysisSchema,
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
      style: "warm_wood",
      budgetTier: "quality",
      naturalLanguagePreference: "显大，好打理，适合一家三口",
      household: "一家三口",
      adoptedSuggestions: ["保留客餐厅开放感"],
      rejectedSuggestions: []
    });

    expect(profile.budgetTier).toBe("quality");
  });
});
