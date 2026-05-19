import { afterEach, describe, expect, it, vi } from "vitest";
import { DoubaoImageClient } from "@/lib/ai/doubao-image-client";

describe("DoubaoImageClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first image URL from a Doubao image response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ url: "https://cdn.example.com/renderings/living-room.png" }]
        })
      })
    );

    const client = new DoubaoImageClient({
      apiKey: "test-key",
      baseUrl: "https://example.com/api/v3",
      imageModel: "seedream",
      imageSize: "1024x1024"
    });

    await expect(
      client.generateRendering({
        prompt: "客餐厅现代原木风效果图",
        spaceTitle: "客餐厅"
      })
    ).resolves.toEqual({
      imageUrl: "https://cdn.example.com/renderings/living-room.png"
    });
  });
});
