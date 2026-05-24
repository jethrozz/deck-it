import { afterEach, describe, expect, it, vi } from "vitest";
import { QwenVisionClient } from "@/lib/ai/qwen-vision-client";

describe("QwenVisionClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a multimodal request and parses floor-plan analysis", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rooms: [{ name: "客餐厅", type: "living_dining", confidence: 0.92 }],
                relationships: ["客餐厅连接阳台"],
                issues: [{ type: "lighting", description: "采光集中在阳台一侧", confidence: 0.81 }],
                uncertainItems: [],
                userCorrections: []
              })
            }
          }
        ]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = new QwenVisionClient({
      apiKey: "qwen-key",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3-vl-plus"
    });

    const result = await client.analyzeFloorPlan({
      imageUrl: "/uploads/x.png",
      imageDataUrl: "data:image/png;base64,abc123"
    });

    expect(result.rooms[0]?.name).toBe("客餐厅");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer qwen-key",
          "Content-Type": "application/json"
        })
      })
    );

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const payload = JSON.parse(String(requestInit?.body));

    expect(payload.model).toBe("qwen3-vl-plus");
    expect(payload.messages[1]?.content[1]?.image_url?.url).toBe("data:image/png;base64,abc123");
  });

  it("normalizes common qwen response variants before schema parsing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: [
                  {
                    type: "text",
                    text: "```json"
                  },
                  {
                    type: "text",
                    text: JSON.stringify({
                      rooms: [{ label: "客餐厅", category: "客餐厅", confidence: "0.88" }],
                      relationships: [{ text: "客餐厅连接阳台" }],
                      issues: [{ name: "采光", confidence: "0.75", description: "采光主要来自阳台一侧" }],
                      uncertainItems: [{ text: "次卧标注不够清晰" }],
                      userCorrections: [{ text: "如次卧实际作为书房，请在下一轮更正" }]
                    })
                  },
                  {
                    type: "text",
                    text: "```"
                  }
                ]
              }
            }
          ]
        })
      })
    );

    const client = new QwenVisionClient({
      apiKey: "qwen-key",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3-vl-plus"
    });

    const result = await client.analyzeFloorPlan({
      imageUrl: "/uploads/floor-plan.png"
    });

    expect(result).toEqual({
      rooms: [{ name: "客餐厅", type: "living_dining", confidence: 0.88 }],
      relationships: ["客餐厅连接阳台"],
      issues: [{ type: "lighting", description: "采光主要来自阳台一侧", confidence: 0.75 }],
      uncertainItems: ["次卧标注不够清晰"],
      userCorrections: ["如次卧实际作为书房，请在下一轮更正"]
    });
  });

  it("maps 次卧 to a supported bedroom type instead of other", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  rooms: [{ name: "次卧", type: "次卧", confidence: 0.83 }],
                  relationships: [],
                  issues: [],
                  uncertainItems: [],
                  userCorrections: []
                })
              }
            }
          ]
        })
      })
    );

    const client = new QwenVisionClient({
      apiKey: "qwen-key",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3-vl-plus"
    });

    const result = await client.analyzeFloorPlan({
      imageUrl: "/uploads/floor-plan.png"
    });

    expect(result.rooms).toEqual([{ name: "次卧", type: "child_room", confidence: 0.83 }]);
  });
});
