import { afterEach, describe, expect, it, vi } from "vitest";
import { DoubaoImageClient } from "@/lib/ai/doubao-image-client";

describe("DoubaoImageClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to the image generations endpoint with the expected payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ url: "https://cdn.example.com/renderings/living-room.png" }]
      })
    });

    vi.stubGlobal("fetch", fetchMock);

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

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/v3/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json"
        })
      })
    );

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));
    expect(body).toMatchObject({
      model: "seedream",
      prompt: "客餐厅现代原木风效果图",
      size: "1024x1024",
      response_format: "url"
    });
  });

  it("throws when Seedream does not return an image url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{}]
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
    ).rejects.toThrow("Seedream did not return image URL for 客餐厅");
  });

  it("surfaces non-2xx request errors with status code and response body details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "upstream overloaded"
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
    ).rejects.toThrow(/503 .*upstream overloaded/);
  });
});
