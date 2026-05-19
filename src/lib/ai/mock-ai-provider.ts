import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import type { DesignPlan, FloorPlanAnalysis } from "@/lib/domain/schemas";

const mockAnalysis: FloorPlanAnalysis = {
  rooms: [
    { name: "客餐厅", type: "living_dining", confidence: 0.86 },
    { name: "主卧", type: "master_bedroom", confidence: 0.84 },
    { name: "厨房", type: "kitchen", confidence: 0.74 }
  ],
  relationships: ["客餐厅连接阳台", "厨房靠近餐厅", "主卧位于安静区域"],
  issues: [
    { type: "lighting", description: "客餐厅采光主要来自阳台一侧", confidence: 0.76 },
    { type: "storage", description: "玄关和餐边收纳需要提前规划", confidence: 0.68 }
  ],
  uncertainItems: ["厨房具体尺寸不可见"],
  userCorrections: []
};

export class MockAiProvider implements AiProvider {
  async analyzeFloorPlan(): Promise<FloorPlanAnalysis> {
    return mockAnalysis;
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    if (input.conversation.length >= 4) {
      return {
        type: "complete",
        summary: "已收集风格、采光、收纳和第三空间偏好，接下来开始生成方案。",
        nextPath: "/generating"
      };
    }

    return {
      type: "designer_prompt",
      message:
        input.conversation.length === 0
          ? "我看这个户型的客餐厅连接阳台，可以优先考虑显大和采光。你们最在意哪个生活场景？"
          : "明白。我会把这个需求纳入方案里。还有没有需要兼顾的收纳、办公或儿童活动需求？",
      options:
        input.conversation.length === 0
          ? ["孩子活动区", "朋友聚餐", "投影观影"]
          : ["需要收纳", "需要办公", "没有了"],
      progress: {
        current: Math.min(Math.floor(input.conversation.length / 2) + 1, 12),
        max: 12
      }
    };
  }

  async generateDesignPlan(): Promise<DesignPlan> {
    return {
      overallStrategy: "以温暖、通透、易打理为主线，优先优化客餐厅开放感和主卧舒适度。",
      styleSummary: "原木风作为基础，减少过度日式元素，加入更克制的现代线条。",
      budgetAssumptions: "品质型预算下，优先保证高频使用空间的柜体、灯光和耐用材料。",
      keySpaces: [
        {
          spaceType: "living_dining",
          title: "客餐厅",
          designGoal: "提升开放感与日常收纳效率。",
          explanation: "客餐厅采光集中在阳台一侧，因此使用浅木色、低饱和墙面和轻体量家具来放大空间。",
          layoutSuggestion: "沙发靠长墙布置，餐边柜控制深度，避免遮挡阳台采光。",
          paletteAndMaterials: ["浅橡木", "暖白墙面", "低反光耐磨地面"],
          furnitureAndSoftDecor: ["低背沙发", "圆角餐桌", "线性灯"],
          budgetTradeOffs: "品质型档位建议把预算放在定制餐边柜和灯光层次上。",
          practicalNotes: ["避免深色满墙柜", "保留阳台到客厅的通透视线"],
          renderingPrompt: "温暖原木风客餐厅，浅橡木，暖白墙面，开放通透，适合一家三口"
        },
        {
          spaceType: "master_bedroom",
          title: "主卧",
          designGoal: "营造安静、耐看的休息空间。",
          explanation: "主卧以低刺激配色和足够收纳为重点，减少复杂造型。",
          layoutSuggestion: "床头背景保持简洁，衣柜使用浅色平板门。",
          paletteAndMaterials: ["米灰色", "浅木饰面", "柔和织物"],
          furnitureAndSoftDecor: ["软包床", "薄款床头柜", "遮光窗帘"],
          budgetTradeOffs: "品质型档位优先选择环保板材和舒适床垫。",
          practicalNotes: ["预留床两侧通行空间", "控制床头吊灯高度"],
          renderingPrompt: "温暖原木风主卧，米灰色，浅木饰面，安静舒适，柔和灯光"
        }
      ],
      disclaimer: "本方案为装修前沟通 brief，不是施工图或正式报价单。"
    };
  }

  async generateRendering(input: { prompt: string }): Promise<{ imageUrl: string }> {
    const encodedPrompt = encodeURIComponent(input.prompt.slice(0, 40));
    return { imageUrl: `https://placehold.co/1280x720?text=${encodedPrompt}` };
  }
}
