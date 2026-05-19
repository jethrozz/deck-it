import { afterEach, describe, expect, it, vi } from "vitest";
import { DoubaoProvider } from "@/lib/ai/doubao-provider";

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

describe("DoubaoProvider.generateDesignPlan", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fills required arrays when the live model returns empty lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "整体以温暖、显大和易打理为主。",
                  styleSummary: "原木风，克制温暖。",
                  budgetAssumptions: "按品质型预算做主材和收纳平衡。",
                  keySpaces: [
                    {
                      title: "客餐厅",
                      type: "客餐厅",
                      designGoal: "放大公共空间感",
                      explanation: "以开放感和采光为先。",
                      layoutSuggestion: "减少厚重隔断。",
                      paletteAndMaterials: [],
                      furnitureAndSoftDecor: [],
                      practicalNotes: []
                    },
                    {
                      title: "主卧",
                      type: "主卧",
                      designGoal: "提升休息舒适度",
                      explanation: "保持安静、柔和。",
                      layoutSuggestion: "床头和衣柜位置简洁。",
                      paletteAndMaterials: [],
                      furnitureAndSoftDecor: [],
                      practicalNotes: []
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
    );

    const provider = new DoubaoProvider({
      apiKey: "test-key",
      baseUrl: "https://example.com/api/v3",
      chatModel: "doubao-chat",
      visionModel: "doubao-vision",
      imageModel: "seedream",
      imageSize: "1024x1024"
    });

    const plan = await provider.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 希望显大、温暖、好打理"
    });

    expect(plan.keySpaces).toHaveLength(2);
    expect(plan.keySpaces[0]?.paletteAndMaterials.length).toBeGreaterThan(0);
    expect(plan.keySpaces[0]?.furnitureAndSoftDecor.length).toBeGreaterThan(0);
    expect(plan.keySpaces[1]?.paletteAndMaterials.length).toBeGreaterThan(0);
    expect(plan.keySpaces[1]?.furnitureAndSoftDecor.length).toBeGreaterThan(0);
    expect(plan.keySpaces[0]?.renderingPrompt).toContain("客餐厅室内设计效果图");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("主卧室内设计效果图");
    expect(plan.keySpaces[0]?.renderingPrompt).not.toEqual(plan.keySpaces[1]?.renderingPrompt);
  });

  it("keeps different other-space prompts distinct when the model omits rendering prompts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  overallStrategy: "整体以功能复合和收纳效率为主。",
                  styleSummary: "现代原木，明亮、克制、耐看。",
                  budgetAssumptions: "预算优先给高频家具和家政功能。",
                  keySpaces: [
                    {
                      title: "多功能房",
                      type: "other",
                      designGoal: "兼顾书房、临时客房和收纳",
                      explanation: "平时作为书房使用，偶尔留宿家人。",
                      layoutSuggestion: "靠墙设置书桌和整排收纳，预留展开床位。",
                      paletteAndMaterials: ["浅木饰面", "暖白墙面"],
                      furnitureAndSoftDecor: ["书桌", "墨菲床", "顶天立地收纳柜"],
                      practicalNotes: ["保留临时留宿功能", "优先整洁感"]
                    },
                    {
                      title: "南北阳台+公卫",
                      type: "other",
                      designGoal: "兼顾洗烘家政、清洁收纳和卫浴日常使用",
                      explanation: "需要把阳台家政与公卫动线衔接起来。",
                      layoutSuggestion: "南阳台布置洗烘与清洁柜，公卫强调干湿分离。",
                      paletteAndMaterials: ["防滑地砖", "浅灰柜体"],
                      furnitureAndSoftDecor: ["洗衣机", "烘干机", "家政高柜", "浴室镜柜"],
                      practicalNotes: ["强调洗烘区", "强调家政收纳", "强调干湿分离"]
                    }
                  ],
                  disclaimer: "方案用于前期沟通参考。"
                })
              }
            }
          ]
        })
      })
    );

    const provider = new DoubaoProvider({
      apiKey: "test-key",
      baseUrl: "https://example.com/api/v3",
      chatModel: "doubao-chat",
      visionModel: "doubao-vision",
      imageModel: "seedream",
      imageSize: "1024x1024"
    });

    const plan = await provider.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 一家三口，需要多功能房兼顾客房，也要保留洗烘和家政需求"
    });

    expect(plan.keySpaces[0]?.renderingPrompt).toContain("多功能房室内设计效果图");
    expect(plan.keySpaces[0]?.renderingPrompt).toContain("墨菲床");
    expect(plan.keySpaces[0]?.renderingPrompt).toContain("书桌");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("南北阳台+公卫室内设计效果图");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("洗衣机");
    expect(plan.keySpaces[1]?.renderingPrompt).toContain("干湿分离");
    expect(plan.keySpaces[0]?.renderingPrompt).not.toEqual(plan.keySpaces[1]?.renderingPrompt);
  });

  it("retries when the first design plan is too generic", async () => {
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
                      practicalNotes: ["强调临时留宿", "强调整洁感"],
                      renderingPrompt: "多功能房，书桌、墨菲床、整排收纳柜，现代原木，真实住宅摄影"
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
                      practicalNotes: ["强调洗烘区", "强调干湿分离"],
                      renderingPrompt: "阳台家政区与公卫，洗衣机、烘干机、家政高柜、干湿分离，现代原木，真实住宅摄影"
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

    const provider = new DoubaoProvider({
      apiKey: "test-key",
      baseUrl: "https://example.com/api/v3",
      chatModel: "doubao-chat",
      visionModel: "doubao-vision",
      imageModel: "seedream",
      imageSize: "1024x1024"
    });

    const plan = await provider.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 需要一个兼顾书房和客房的多功能房，还要保留阳台洗烘与公卫效率"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(plan.keySpaces[0]?.title).toBe("多功能房");
    expect(plan.keySpaces[1]?.title).toBe("南阳台家政区+公卫");
  });

  it("retries again when normalization would still fall back to generic copy", async () => {
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
                  overallStrategy: "第二次还是不完整。",
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
                  overallStrategy: "第三次终于给出具体方案。",
                  styleSummary: "现代原木，通透耐看。",
                  budgetAssumptions: "预算优先给柜体、洗烘和儿童房成长型家具。",
                  keySpaces: [
                    {
                      title: "儿童房",
                      type: "child_room",
                      designGoal: "兼顾睡眠、玩耍和未来学习升级",
                      explanation: "先满足低龄玩耍与陪伴需求，再预留学习桌升级位置。",
                      layoutSuggestion: "床靠安静侧，窗边预留成长书桌，矮柜承担玩具与绘本收纳。",
                      paletteAndMaterials: ["暖白墙面", "浅木家具"],
                      furnitureAndSoftDecor: ["儿童床", "矮柜", "成长书桌"],
                      budgetTradeOffs: "先投入在柜体与成长家具。",
                      practicalNotes: ["保留玩耍区", "预留学习位"],
                      renderingPrompt: "儿童房，儿童床、矮柜、成长书桌，现代原木，真实住宅摄影"
                    },
                    {
                      title: "玄关餐厅家政复合区",
                      type: "other",
                      designGoal: "串联玄关收纳、餐边功能和家政洗烘需求",
                      explanation: "解决入户收纳、餐边电器和阳台洗烘外溢的整理问题。",
                      layoutSuggestion: "玄关柜与餐边柜一体化延展，靠近阳台预留洗烘高柜与杂物收纳。",
                      paletteAndMaterials: ["浅木柜体", "耐磨地砖"],
                      furnitureAndSoftDecor: ["玄关柜", "餐边柜", "洗烘高柜"],
                      budgetTradeOffs: "优先做一体化柜体系统。",
                      practicalNotes: ["强调入户收纳", "强调洗烘收纳"],
                      renderingPrompt: "玄关餐厅家政复合区，玄关柜、餐边柜、洗烘高柜，现代原木，真实住宅摄影"
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

    const provider = new DoubaoProvider({
      apiKey: "test-key",
      baseUrl: "https://example.com/api/v3",
      chatModel: "doubao-chat",
      visionModel: "doubao-vision",
      imageModel: "seedream",
      imageSize: "1024x1024"
    });

    const plan = await provider.generateDesignPlan({
      analysis,
      profile,
      conversationSummary: "user: 有孩子，需要儿童房和一体化收纳家政区"
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(plan.keySpaces[0]?.title).toBe("儿童房");
    expect(plan.keySpaces[1]?.title).toBe("玄关餐厅家政复合区");
  });
});
