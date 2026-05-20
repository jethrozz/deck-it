import { afterEach, describe, expect, it, vi } from "vitest";
import { DeepSeekTextClient } from "@/lib/ai/deepseek-text-client";

const analysis = {
  rooms: [{ name: "客餐厅", type: "living_dining" as const, confidence: 0.9 }],
  relationships: ["客餐厅连接阳台"],
  issues: [{ type: "lighting" as const, description: "采光集中在阳台一侧", confidence: 0.8 }],
  uncertainItems: [],
  userCorrections: []
};

const profile = {
  style: "warm_wood" as const,
  budgetTier: "quality" as const,
  naturalLanguagePreference: "显大、好打理，适合一家三口",
  lifestyleNotes: [],
  hardConstraints: [],
  adoptedSuggestions: [],
  rejectedSuggestions: []
};

describe("DeepSeekTextClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a designer_prompt next agent turn response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: "designer_prompt",
                  message: "你们更想优先优化客餐厅还是多功能房？",
                  options: ["客餐厅", "多功能房", "一起考虑"],
                  progress: { current: 2, max: 12 }
                })
              }
            }
          ]
        })
      })
    );

    const client = new DeepSeekTextClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro"
    });

    const result = await client.nextAgentTurn({
      analysis,
      profile,
      conversation: [{ role: "agent", content: "先确认家庭成员结构。" }]
    });

    expect(result).toEqual({
      type: "designer_prompt",
      message: "你们更想优先优化客餐厅还是多功能房？",
      options: ["客餐厅", "多功能房", "一起考虑"],
      progress: { current: 2, max: 12 }
    });
  });

  it("retries generic design plans and backfills rendering prompts during normalization", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "先给出一个非常泛化的方案。",
                  styleSummary: "温暖原木。",
                  budgetAssumptions: "控制在品质型预算。",
                  keySpaces: [
                    {
                      title: "重点空间",
                      type: "other",
                      designGoal: "重点空间的功能优化与风格统一",
                      explanation: "重点空间以提升使用体验为核心。",
                      layoutSuggestion: "重点空间优先保证通行、采光和主要功能布局。"
                    },
                    {
                      title: "重点空间",
                      type: "other",
                      designGoal: "重点空间的功能优化与风格统一",
                      explanation: "重点空间以提升使用体验为核心。",
                      layoutSuggestion: "重点空间优先保证通行、采光和主要功能布局。"
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "围绕家庭互动、多功能收纳和家政效率做重点优化。",
                  styleSummary: "现代原木，明亮克制。",
                  budgetAssumptions: "优先投入在高频家具、收纳与家政功能。",
                  keySpaces: [
                    {
                      title: "多功能房",
                      type: "other",
                      designGoal: "兼顾书房、临时客房和整洁收纳",
                      explanation: "平时作为书房与阅读区，偶尔给父母留宿。",
                      layoutSuggestion: "靠墙布置书桌、墨菲床和整排高柜，保留展开床位后的通行。",
                      paletteAndMaterials: ["浅木饰面", "暖白墙面"],
                      furnitureAndSoftDecor: ["书桌", "墨菲床", "顶天立地收纳柜"],
                      budgetTradeOffs: "优先保证收纳系统和隐藏床结构。",
                      practicalNotes: ["强调临时留宿", "强调整洁感"]
                    },
                    {
                      title: "南阳台家政区+公卫",
                      type: "other",
                      designGoal: "兼顾洗烘、清洁收纳和卫浴动线",
                      explanation: "南阳台承担洗烘与家政，公卫保持清爽耐用。",
                      layoutSuggestion: "洗衣机烘干机上下叠放，侧边高柜收纳清洁用品，公卫强化干湿分离。",
                      paletteAndMaterials: ["防滑地砖", "浅灰柜体"],
                      furnitureAndSoftDecor: ["洗衣机", "烘干机", "家政高柜", "镜柜"],
                      budgetTradeOffs: "预算优先保证洗烘设备位和家政高柜。",
                      practicalNotes: ["强调洗烘区", "强调干湿分离"]
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = new DeepSeekTextClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro"
    });

    const plan = await client.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 需要一个兼顾书房和客房的多功能房，还要保留阳台洗烘与公卫效率"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(plan.keySpaces[0]?.title).toBe("多功能房");
    expect(plan.keySpaces[0]?.renderingPrompt).toContain("多功能房室内设计效果图");
    expect(plan.keySpaces[0]?.renderingPrompt).toContain("墨菲床");
    expect(plan.keySpaces[1]?.title).toBe("南阳台家政区+公卫");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("南阳台家政区+公卫室内设计效果图");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("干湿分离");
  });

  it("does not retry when valid other spaces are already specific", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                overallStrategy: "围绕复合功能和家政效率做重点优化。",
                styleSummary: "现代原木，克制耐看。",
                budgetAssumptions: "优先投入高频收纳与复合家具。",
                keySpaces: [
                  {
                    title: "多功能房",
                    type: "other",
                    designGoal: "兼顾办公、客房和杂物收纳",
                    explanation: "平时作为书房，父母来住时可临时展开床位。",
                    layoutSuggestion: "书桌靠窗，侧边整排高柜，预留墨菲床展开通道。",
                    paletteAndMaterials: ["浅木柜体", "暖白墙面"],
                    furnitureAndSoftDecor: ["书桌", "墨菲床", "整排高柜"],
                    budgetTradeOffs: "优先保证隐藏床结构和收纳五金。",
                    practicalNotes: ["确认床位展开尺寸", "优先封闭收纳"],
                    renderingPrompt: "多功能房，书桌、墨菲床、整排高柜，现代原木，真实住宅摄影"
                  },
                  {
                    title: "阳台家政区+公卫",
                    type: "other",
                    designGoal: "兼顾洗烘、清洁收纳与卫浴动线",
                    explanation: "阳台承担洗烘与清洁收纳，公卫需要更顺手的干湿分离。",
                    layoutSuggestion: "洗烘叠放靠边，家政高柜靠侧墙，公卫镜柜与壁龛补足收纳。",
                    paletteAndMaterials: ["防滑地砖", "浅灰柜体"],
                    furnitureAndSoftDecor: ["洗衣机", "烘干机", "家政高柜", "镜柜"],
                    budgetTradeOffs: "优先做设备位和耐水柜体。",
                    practicalNotes: ["确认洗烘尺寸", "明确干湿分离边界"],
                    renderingPrompt: "阳台家政区+公卫，洗衣机、烘干机、家政高柜、干湿分离，现代原木，真实住宅摄影"
                  }
                ],
                disclaimer: "方案用于前期沟通参考。"
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new DeepSeekTextClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro"
    });

    const plan = await client.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 需要多功能房和阳台家政区+公卫，强调复合功能"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(plan.keySpaces.map((space) => space.title)).toEqual(["多功能房", "阳台家政区+公卫"]);
  });

  it("falls back to deterministic plan after repeated weak responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "第一次返回方案。",
                  styleSummary: "温暖原木。",
                  budgetAssumptions: "控制在品质型预算。",
                  keySpaces: [
                    { title: "", type: "other" },
                    { title: "", type: "other" }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "第二次还是很泛。",
                  styleSummary: "现代原木。",
                  budgetAssumptions: "预算平衡。",
                  keySpaces: [
                    {
                      title: "重点空间",
                      type: "other",
                      explanation: "提升使用体验为核心。"
                    },
                    {
                      title: "重点空间",
                      type: "other",
                      explanation: "提升使用体验为核心。"
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "第三次依然不具体。",
                  styleSummary: "现代原木。",
                  budgetAssumptions: "预算平衡。",
                  keySpaces: [
                    {
                      title: "重点空间",
                      type: "other",
                      designGoal: "重点空间的功能优化与风格统一",
                      explanation: "重点空间以提升使用体验为核心。",
                      layoutSuggestion: "重点空间优先保证通行、采光和主要功能布局。"
                    },
                    {
                      title: "重点空间",
                      type: "other",
                      designGoal: "重点空间的功能优化与风格统一",
                      explanation: "重点空间以提升使用体验为核心。",
                      layoutSuggestion: "重点空间优先保证通行、采光和主要功能布局。"
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = new DeepSeekTextClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro"
    });

    const plan = await client.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 需要一个兼顾书房和客房的多功能房，还要保留阳台洗烘与公卫效率"
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(plan.keySpaces[0]?.title).toBe("客餐厅");
    expect(plan.keySpaces[1]?.title).toBe("多功能房");
    expect(plan.keySpaces[2]?.title).toBe("阳台家政区+公卫");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("墨菲床或沙发床");
    expect(plan.keySpaces[2]?.renderingPrompt).toContain("干湿分离");
  });

  it("builds a schema-valid deterministic fallback even for sparse floor plans", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "第一次返回方案。",
                  styleSummary: "温暖原木。",
                  budgetAssumptions: "控制在品质型预算。",
                  keySpaces: [{ title: "", type: "other" }, { title: "", type: "other" }],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "第二次还是很泛。",
                  styleSummary: "温暖原木。",
                  budgetAssumptions: "控制在品质型预算。",
                  keySpaces: [
                    { title: "重点空间", type: "other", explanation: "提升使用体验为核心。" },
                    { title: "重点空间", type: "other", explanation: "提升使用体验为核心。" }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "第三次依然不具体。",
                  styleSummary: "温暖原木。",
                  budgetAssumptions: "控制在品质型预算。",
                  keySpaces: [
                    {
                      title: "重点空间",
                      type: "other",
                      designGoal: "重点空间的功能优化与风格统一",
                      explanation: "重点空间以提升使用体验为核心。",
                      layoutSuggestion: "重点空间优先保证通行、采光和主要功能布局。"
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const client = new DeepSeekTextClient({
      apiKey: "deepseek-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro"
    });

    const plan = await client.generateDesignPlan({
      analysis: {
        rooms: [{ name: "客餐厅", type: "living_dining", confidence: 0.92 }],
        relationships: [],
        issues: [],
        uncertainItems: [],
        userCorrections: []
      },
      profile,
      conversationSummary: "user: 希望整体显大、好打理。"
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(plan.keySpaces).toHaveLength(2);
    expect(plan.keySpaces[0]?.title).toBe("客餐厅");
    expect(plan.keySpaces[1]?.title).not.toBe("重点空间");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("室内设计效果图");
  });
});
