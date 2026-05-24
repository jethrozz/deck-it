import { afterEach, describe, expect, it, vi } from "vitest";

function stubCompositeEnv() {
  vi.stubEnv("AI_PROVIDER", "multi");

  vi.stubEnv("VISION_PROVIDER", "qwen");
  vi.stubEnv("VISION_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1");
  vi.stubEnv("VISION_API_KEY", "qwen-key");
  vi.stubEnv("VISION_MODEL", "qwen3-vl-plus");

  vi.stubEnv("TEXT_PROVIDER", "deepseek");
  vi.stubEnv("TEXT_BASE_URL", "https://api.deepseek.com");
  vi.stubEnv("TEXT_API_KEY", "deepseek-key");
  vi.stubEnv("TEXT_MODEL", "deepseek-v4-pro");

  vi.stubEnv("IMAGE_PROVIDER", "doubao");
  vi.stubEnv("IMAGE_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3");
  vi.stubEnv("IMAGE_API_KEY", "doubao-key");
  vi.stubEnv("IMAGE_MODEL", "seedream-model");
  vi.stubEnv("IMAGE_SIZE", "2048x2048");
}

function stubImageOnlyCompositeEnv(overrides?: Record<string, string>) {
  vi.stubEnv("AI_PROVIDER", "multi");
  vi.stubEnv("IMAGE_PROVIDER", "doubao");

  for (const [key, value] of Object.entries(overrides ?? {})) {
    vi.stubEnv(key, value);
  }
}

describe("createAiProvider", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns MockAiProvider when AI_PROVIDER is not set", async () => {
    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    expect(provider.constructor.name).toBe("MockAiProvider");
  });

  it("builds a composite provider from capability env vars", async () => {
    stubCompositeEnv();

    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    expect(provider.constructor.name).toBe("CompositeAiProvider");
  });

  it.each([
    {
      name: "prefers IMAGE_API_KEY and IMAGE_MODEL",
      overrides: {
        IMAGE_API_KEY: "image-key",
        IMAGE_MODEL: "image-model"
      },
      expectedAuth: "Bearer image-key",
      expectedModel: "image-model"
    },
    {
      name: "falls back to DOUBAO_API_KEY and SEEDREAM_MODEL",
      overrides: {
        DOUBAO_API_KEY: "doubao-key",
        SEEDREAM_MODEL: "seedream-model"
      },
      expectedAuth: "Bearer doubao-key",
      expectedModel: "seedream-model"
    },
    {
      name: "falls back to ARK_API_KEY and SEEDREAM_MODEL",
      overrides: {
        ARK_API_KEY: "ark-key",
        SEEDREAM_MODEL: "seedream-model"
      },
      expectedAuth: "Bearer ark-key",
      expectedModel: "seedream-model"
    }
  ])("supports image-only composite mode and $name", async ({ overrides, expectedAuth, expectedModel }) => {
    stubImageOnlyCompositeEnv(overrides);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ url: "https://cdn.example.com/image.png" }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    await expect(
      provider.generateRendering({
        prompt: "测试效果图",
        spaceTitle: "客厅"
      })
    ).resolves.toEqual({ imageUrl: "https://cdn.example.com/image.png" });

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));
    expect(requestInit?.headers).toMatchObject({
      Authorization: expectedAuth
    });
    expect(body.model).toBe(expectedModel);
  });

  it.each([
    {
      name: "prefers IMAGE_BASE_URL and IMAGE_SIZE",
      overrides: {
        IMAGE_API_KEY: "image-key",
        IMAGE_MODEL: "image-model",
        IMAGE_BASE_URL: "https://custom.example.com/api/v3",
        IMAGE_SIZE: "1536x1024"
      },
      expectedUrl: "https://custom.example.com/api/v3/images/generations",
      expectedSize: "1536x1024"
    },
    {
      name: "falls back to default IMAGE_BASE_URL and SEEDREAM_SIZE",
      overrides: {
        IMAGE_API_KEY: "image-key",
        IMAGE_MODEL: "image-model",
        SEEDREAM_SIZE: "1152x768"
      },
      expectedUrl: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      expectedSize: "1152x768"
    },
    {
      name: "falls back to default IMAGE_BASE_URL and default IMAGE_SIZE",
      overrides: {
        IMAGE_API_KEY: "image-key",
        IMAGE_MODEL: "image-model"
      },
      expectedUrl: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
      expectedSize: "2048x2048"
    }
  ])("applies image base url and size fallback chain: $name", async ({ overrides, expectedUrl, expectedSize }) => {
    stubImageOnlyCompositeEnv(overrides);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ url: "https://cdn.example.com/image.png" }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    await provider.generateRendering({
      prompt: "测试效果图",
      spaceTitle: "客厅"
    });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));

    expect(requestUrl).toBe(expectedUrl);
    expect(body.size).toBe(expectedSize);
  });

  it.each([
    {
      name: "uses DOUBAO_API_KEY when provided",
      env: {
        DOUBAO_API_KEY: "legacy-key",
        DOUBAO_BASE_URL: "https://legacy.example.com/api/v3",
        DOUBAO_CHAT_MODEL: "doubao-chat",
        DOUBAO_VISION_MODEL: "doubao-vision",
        SEEDREAM_MODEL: "seedream-legacy",
        SEEDREAM_SIZE: "1792x1024"
      },
      expectedAuth: "Bearer legacy-key"
    },
    {
      name: "falls back to ARK_API_KEY when DOUBAO_API_KEY is absent",
      env: {
        ARK_API_KEY: "ark-legacy-key",
        DOUBAO_BASE_URL: "https://legacy.example.com/api/v3",
        DOUBAO_CHAT_MODEL: "doubao-chat",
        DOUBAO_VISION_MODEL: "doubao-vision",
        SEEDREAM_MODEL: "seedream-legacy",
        SEEDREAM_SIZE: "1792x1024"
      },
      expectedAuth: "Bearer ark-legacy-key"
    }
  ])("supports the legacy AI_PROVIDER=doubao path and $name", async ({ env, expectedAuth }) => {
    vi.stubEnv("AI_PROVIDER", "doubao");
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ url: "https://cdn.example.com/legacy-image.png" }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    await expect(
      provider.generateRendering({
        prompt: "老链路测试效果图",
        spaceTitle: "客厅"
      })
    ).resolves.toEqual({ imageUrl: "https://cdn.example.com/legacy-image.png" });

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(requestInit?.body));

    expect(requestUrl).toBe("https://legacy.example.com/api/v3/images/generations");
    expect(requestInit?.headers).toMatchObject({
      Authorization: expectedAuth
    });
    expect(body).toMatchObject({
      model: "seedream-legacy",
      prompt: "老链路测试效果图",
      size: "1792x1024",
      response_format: "url"
    });
  });

  it("throws for unsupported image provider labels when that capability is used", async () => {
    stubImageOnlyCompositeEnv({
      IMAGE_PROVIDER: "not-doubao",
      IMAGE_API_KEY: "image-key",
      IMAGE_MODEL: "image-model"
    });

    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    await expect(
      provider.generateRendering({
        prompt: "测试效果图",
        spaceTitle: "客厅"
      })
    ).rejects.toThrow("Unsupported IMAGE_PROVIDER: not-doubao");
  });
});
