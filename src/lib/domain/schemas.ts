import { z } from "zod";

export const styleSchema = z.enum([
  "warm_wood",
  "vintage",
  "modern_minimal",
  "cream",
  "wabi_sabi"
]);

export const budgetTierSchema = z.enum(["economy", "quality", "premium"]);

export const roomTypeSchema = z.enum([
  "living_dining",
  "master_bedroom",
  "kitchen",
  "child_room",
  "study",
  "bathroom",
  "balcony",
  "other"
]);

export const floorPlanAnalysisSchema = z.object({
  rooms: z.array(
    z.object({
      name: z.string().min(1),
      type: roomTypeSchema,
      confidence: z.number().min(0).max(1)
    })
  ),
  relationships: z.array(z.string().min(1)),
  issues: z.array(
    z.object({
      type: z.enum(["lighting", "circulation", "storage", "layout", "unclear"]),
      description: z.string().min(1),
      confidence: z.number().min(0).max(1)
    })
  ),
  uncertainItems: z.array(z.string().min(1)),
  userCorrections: z.array(z.string().min(1))
});

export const preferenceProfileSchema = z.object({
  style: styleSchema,
  budgetTier: budgetTierSchema,
  naturalLanguagePreference: z.string().min(1),
  household: z.string().optional(),
  lifestyleNotes: z.array(z.string()).default([]),
  hardConstraints: z.array(z.string()).default([]),
  adoptedSuggestions: z.array(z.string()).default([]),
  rejectedSuggestions: z.array(z.string()).default([])
});

export const agentQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  recommendation: z.string().optional(),
  options: z.array(z.string().min(1)).min(1).max(4),
  reason: z.string().min(1)
});

export const keySpacePlanSchema = z.object({
  spaceType: roomTypeSchema,
  title: z.string().min(1),
  designGoal: z.string().min(1),
  explanation: z.string().min(1),
  layoutSuggestion: z.string().min(1),
  paletteAndMaterials: z.array(z.string().min(1)).min(1),
  furnitureAndSoftDecor: z.array(z.string().min(1)).min(1),
  budgetTradeOffs: z.string().min(1),
  practicalNotes: z.array(z.string().min(1)),
  renderingPrompt: z.string().min(1)
});

export const designPlanSchema = z.object({
  overallStrategy: z.string().min(1),
  styleSummary: z.string().min(1),
  budgetAssumptions: z.string().min(1),
  keySpaces: z.array(keySpacePlanSchema).min(2).max(3),
  disclaimer: z.string().min(1)
});

export type Style = z.infer<typeof styleSchema>;
export type BudgetTier = z.infer<typeof budgetTierSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type FloorPlanAnalysis = z.infer<typeof floorPlanAnalysisSchema>;
export type PreferenceProfile = z.infer<typeof preferenceProfileSchema>;
export type AgentQuestion = z.infer<typeof agentQuestionSchema>;
export type DesignPlan = z.infer<typeof designPlanSchema>;
