import { afterEach, describe, expect, it, vi } from "vitest";
import { DoubaoProvider } from "@/lib/ai/doubao-provider";

describe("DoubaoProvider compatibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("keeps the legacy image-generation path working for AI_PROVIDER=doubao", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ url: "https://cdn.example.com/legacy-render.png" }]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const provider = new DoubaoProvider({
      apiKey: "legacy-key",
      baseUrl: "https://legacy.example.com/api/v3",
      chatModel: "doubao-chat",
      visionModel: "doubao-vision",
      imageModel: "seedream-legacy",
      imageSize: "1792x1024"
    });

    await expect(
      provider.generateRendering({
        prompt: "老链路测试效果图",
        spaceTitle: "客厅"
      })
    ).resolves.toEqual({
      imageUrl: "https://cdn.example.com/legacy-render.png"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://legacy.example.com/api/v3/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer legacy-key",
          "Content-Type": "application/json"
        })
      })
    );

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));
    expect(body).toMatchObject({
      model: "seedream-legacy",
      prompt: "老链路测试效果图",
      size: "1792x1024",
      response_format: "url"
    });
  });

  it("prefers TEXT_* overrides when delegating text capability on the legacy provider", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                type: "designer_prompt",
                message: "更想先聊客餐厅还是卧室？",
                options: ["客餐厅", "卧室"],
                progress: { current: 2, max: 12 }
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("TEXT_API_KEY", "deepseek-key");
    vi.stubEnv("TEXT_BASE_URL", "https://api.deepseek.com");
    vi.stubEnv("TEXT_MODEL", "deepseek-v4-pro");

    const provider = new DoubaoProvider({
      apiKey: "legacy-key",
      baseUrl: "https://legacy.example.com/api/v3",
      chatModel: "doubao-chat",
      visionModel: "doubao-vision",
      imageModel: "seedream-legacy",
      imageSize: "1792x1024"
    });

    await expect(
      provider.nextAgentTurn({
        analysis: {
          rooms: [{ name: "客餐厅", type: "living_dining", confidence: 0.9 }],
          relationships: ["客餐厅连接阳台"],
          issues: [{ type: "lighting", description: "采光集中在阳台一侧", confidence: 0.8 }],
          uncertainItems: [],
          userCorrections: []
        },
        profile: {
          style: "warm_wood",
          budgetTier: "quality",
          naturalLanguagePreference: "显大、好打理",
          lifestyleNotes: [],
          hardConstraints: [],
          adoptedSuggestions: [],
          rejectedSuggestions: []
        },
        conversation: [{ role: "agent", content: "先确认家庭成员结构。" }]
      })
    ).resolves.toEqual({
      type: "designer_prompt",
      message: "更想先聊客餐厅还是卧室？",
      options: ["客餐厅", "卧室"],
      progress: { current: 2, max: 12 }
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));

    expect(requestUrl).toBe("https://api.deepseek.com/chat/completions");
    expect(requestInit?.headers).toMatchObject({
      Authorization: "Bearer deepseek-key"
    });
    expect(body.model).toBe("deepseek-v4-pro");
  });
});
