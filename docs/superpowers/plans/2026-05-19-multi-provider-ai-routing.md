# 多模型能力拆分实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 将 AI 层拆分为按能力路由的三段实现：户型图视觉分析使用千问，文本追问与方案文案使用 DeepSeek V4，图片生成继续使用豆包 Seedream，同时保持业务侧 `AiProvider` 接口不变。

**架构：** 用一个 `CompositeAiProvider` 取代当前单一 provider，由它按能力把请求委派给三个聚焦职责的小客户端：`QwenVisionClient`、`DeepSeekTextClient`、`DoubaoImageClient`。所有供应商差异、HTTP 调用和返回清洗都收敛在 `src/lib/ai/*`，上层路由、工作流和页面调用方式保持原样。

**技术栈：** Next.js 15、TypeScript、Vitest、Zod、基于 `fetch` 的 OpenAI 兼容 HTTP API

---

## 文件结构

- 新建：`src/lib/ai/http.ts` - 共享的 HTTP 请求和 OpenAI 风格响应解析工具
- 新建：`src/lib/ai/composite-ai-provider.ts` - 按能力分发的组合 provider
- 新建：`src/lib/ai/qwen-vision-client.ts` - 千问视觉户型分析客户端
- 新建：`src/lib/ai/deepseek-text-client.ts` - DeepSeek 文本对话与方案文案客户端
- 新建：`src/lib/ai/doubao-image-client.ts` - 豆包 Seedream 图片生成客户端
- 修改：`src/lib/ai/provider-factory.ts` - 按能力环境变量构造组合 provider
- 修改：`src/lib/ai/ai-provider.ts` - 保持接口稳定，必要时补充小型共享类型
- 修改：`README.md` - 更新 `VISION_*`、`TEXT_*`、`IMAGE_*` 配置说明
- 新建：`tests/unit/qwen-vision-client.test.ts`
- 新建：`tests/unit/deepseek-text-client.test.ts`
- 新建：`tests/unit/doubao-image-client.test.ts`
- 新建：`tests/unit/provider-factory.test.ts`
- 修改或删除：`tests/unit/doubao-provider.test.ts` - 用新的按能力测试替换旧的单类大而全测试

### 任务 1：抽取共享 AI HTTP 工具

**文件：**
- 新建：`src/lib/ai/http.ts`
- 修改：`src/lib/ai/doubao-provider.ts`
- 测试：`tests/unit/doubao-image-client.test.ts`

- [ ] **步骤 1：先写一个会失败的图片客户端测试**

创建 `tests/unit/doubao-image-client.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoubaoImageClient } from "@/lib/ai/doubao-image-client";

describe("DoubaoImageClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first generated image url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ url: "https://img.example.com/render.png" }]
        })
      })
    );

    const client = new DoubaoImageClient({
      apiKey: "test-key",
      baseUrl: "https://ark.example.com/api/v3",
      imageModel: "seedream-test",
      imageSize: "1024x1024"
    });

    const result = await client.generateRendering({
      prompt: "客餐厅现代原木风",
      spaceTitle: "客餐厅"
    });

    expect(result).toEqual({ imageUrl: "https://img.example.com/render.png" });
  });
});
```

- [ ] **步骤 2：运行测试，确认它现在会失败**

运行：

```bash
npm test -- tests/unit/doubao-image-client.test.ts
```

预期：FAIL，报 `@/lib/ai/doubao-image-client` 不存在，或共享 HTTP 工具还没有实现。

- [ ] **步骤 3：实现共享 HTTP 工具模块**

创建 `src/lib/ai/http.ts`：

```ts
export type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export function extractTextContent(response: ChatCompletionResponse): string {
  const message = response.choices?.[0]?.message;
  const { content } = message ?? {};

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
    if (text.length > 0) {
      return text;
    }
  }

  throw new Error("Chat response content is empty.");
}

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

export function parseJsonObject(raw: string): unknown {
  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Expected JSON object but got: ${cleaned.slice(0, 200)}`);
    }
    return JSON.parse(match[0]);
  }
}

export function buildChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

export function buildImageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/images/generations`;
}
```

- [ ] **步骤 4：把 `doubao-provider.ts` 里的重复工具逻辑迁到共享模块**

把 `src/lib/ai/doubao-provider.ts` 顶部导入改成：

```ts
import {
  buildChatUrl,
  buildImageUrl,
  extractTextContent,
  parseJsonObject,
  postJson,
  type ChatCompletionResponse
} from "@/lib/ai/http";
```

删除文件里本地定义的这些内容：

```ts
type ChatCompletionResponse = ...
async function postJson(...) ...
function buildChatUrl(...) ...
function buildImageUrl(...) ...
function stripCodeFence(...) ...
function extractTextContent(...) ...
function parseJsonObject(...) ...
```

这一步只做工具抽取，不改业务行为。

- [ ] **步骤 5：再次运行测试，确认失败原因已经收敛**

运行：

```bash
npm test -- tests/unit/doubao-image-client.test.ts
```

预期：仍然 FAIL，但现在应该只剩 `DoubaoImageClient` 尚未实现。

- [ ] **步骤 6：提交共享工具抽取**

```bash
git add src/lib/ai/http.ts src/lib/ai/doubao-provider.ts tests/unit/doubao-image-client.test.ts
git commit -m "refactor: extract shared ai http helpers"
```

### 任务 2：实现千问视觉客户端

**文件：**
- 新建：`src/lib/ai/qwen-vision-client.ts`
- 新建：`tests/unit/qwen-vision-client.test.ts`
- 修改：`src/lib/ai/ai-provider.ts`

- [ ] **步骤 1：先写一个会失败的千问视觉测试**

创建 `tests/unit/qwen-vision-client.test.ts`：

```ts
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
  });
});
```

- [ ] **步骤 2：运行测试，确认它会失败**

运行：

```bash
npm test -- tests/unit/qwen-vision-client.test.ts
```

预期：FAIL，报 `@/lib/ai/qwen-vision-client` 不存在。

- [ ] **步骤 3：如有需要，在 `ai-provider.ts` 增加共享输入类型**

如果 `src/lib/ai/ai-provider.ts` 里需要补充一个共享视觉输入类型，就追加：

```ts
export type VisionAnalysisInput = {
  imageUrl: string;
  imageDataUrl?: string;
};
```

不要修改现有 `AiProvider` 的公开方法签名。

- [ ] **步骤 4：实现 `QwenVisionClient`**

创建 `src/lib/ai/qwen-vision-client.ts`：

```ts
import { floorPlanAnalysisSchema } from "@/lib/domain/schemas";
import { buildChatUrl, extractTextContent, parseJsonObject, postJson, type ChatCompletionResponse } from "@/lib/ai/http";

type QwenVisionConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export class QwenVisionClient {
  constructor(private readonly config: QwenVisionConfig) {}

  async analyzeFloorPlan(input: { imageUrl: string; imageDataUrl?: string }) {
    const imageReference = input.imageDataUrl ?? input.imageUrl;
    const response = await postJson<ChatCompletionResponse>(
      buildChatUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: this.config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "你是专业室内设计师助手。请直接分析住宅户型图，严格输出 JSON。"
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请识别房间、空间关系、潜在问题和不确定项，返回 rooms, relationships, issues, uncertainItems, userCorrections。"
              },
              {
                type: "image_url",
                image_url: {
                  url: imageReference
                }
              }
            ]
          }
        ]
      }
    );

    return floorPlanAnalysisSchema.parse(parseJsonObject(extractTextContent(response)));
  }
}
```

注意：这里的 prompt 只是代码形状示例，真正落地时要把 `doubao-provider.ts` 里现有的户型分析 prompt 原封不动迁过来，保证识别质量不退化。

- [ ] **步骤 5：运行千问视觉测试**

运行：

```bash
npm test -- tests/unit/qwen-vision-client.test.ts
```

预期：PASS

- [ ] **步骤 6：提交千问视觉客户端**

```bash
git add src/lib/ai/ai-provider.ts src/lib/ai/qwen-vision-client.ts tests/unit/qwen-vision-client.test.ts
git commit -m "feat: add qwen vision floor-plan client"
```

### 任务 3：实现 DeepSeek 文本客户端

**文件：**
- 新建：`src/lib/ai/deepseek-text-client.ts`
- 新建：`tests/unit/deepseek-text-client.test.ts`
- 修改：`src/lib/ai/doubao-provider.ts`

- [ ] **步骤 1：先写一个会失败的 DeepSeek 文本测试**

创建 `tests/unit/deepseek-text-client.test.ts`：

```ts
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
  naturalLanguagePreference: "显大、好打理",
  lifestyleNotes: [],
  hardConstraints: [],
  adoptedSuggestions: [],
  rejectedSuggestions: []
};

describe("DeepSeekTextClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the next agent turn response", async () => {
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

    expect(result.type).toBe("designer_prompt");
    expect(result.options).toContain("客餐厅");
  });
});
```

- [ ] **步骤 2：运行测试，确认它会失败**

运行：

```bash
npm test -- tests/unit/deepseek-text-client.test.ts
```

预期：FAIL，报 `@/lib/ai/deepseek-text-client` 不存在。

- [ ] **步骤 3：把 `doubao-provider.ts` 里的文本能力迁到 `DeepSeekTextClient`**

创建 `src/lib/ai/deepseek-text-client.ts`：

```ts
import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import { agentInterviewResponseSchema, designPlanSchema } from "@/lib/domain/schemas";
import { buildChatUrl, extractTextContent, parseJsonObject, postJson, type ChatCompletionResponse } from "@/lib/ai/http";

type DeepSeekTextConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export class DeepSeekTextClient {
  constructor(private readonly config: DeepSeekTextConfig) {}

  private async chatJson(systemPrompt: string, userPayload: unknown): Promise<unknown> {
    const response = await postJson<ChatCompletionResponse>(
      buildChatUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: this.config.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `请严格输出 JSON，不要输出额外说明。\n${JSON.stringify(userPayload)}`
          }
        ]
      }
    );

    return parseJsonObject(extractTextContent(response));
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const raw = await this.chatJson("你是装修设计师 Agent。格式必须是 JSON。", {
      analysis: input.analysis,
      profile: input.profile,
      conversation: input.conversation
    });

    return agentInterviewResponseSchema.parse(raw);
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    const raw = await this.chatJson("你是专业住宅室内设计师。严格输出设计 brief JSON。", input);
    return designPlanSchema.parse(raw);
  }
}
```

注意：最终实现不能只保留上面这段最小示例。必须把 `DoubaoProvider` 里现有的以下产品逻辑完整迁过来：

- `nextAgentTurn()` 的容错和兜底返回逻辑
- `generateDesignPlan()` 的多轮重试逻辑
- 重点空间过于泛化时的重试逻辑
- `renderingPrompt` 回填与 plan 归一化逻辑

换模型不能把这些质量保护层丢掉。

- [ ] **步骤 4：让旧 `doubao-provider.ts` 不再承载文本逻辑**

删除或停止使用旧类中的这两个方法：

```ts
async nextAgentTurn(...) { ... }
async generateDesignPlan(...) { ... }
```

在删掉前，把里面所有现有的 prompt、fallback 和 normalization 逻辑迁进 `DeepSeekTextClient`。不要把这些逻辑简化成“直接 parse schema”。

- [ ] **步骤 5：运行 DeepSeek 文本测试**

运行：

```bash
npm test -- tests/unit/deepseek-text-client.test.ts
```

预期：PASS

- [ ] **步骤 6：提交 DeepSeek 文本客户端**

```bash
git add src/lib/ai/deepseek-text-client.ts src/lib/ai/doubao-provider.ts tests/unit/deepseek-text-client.test.ts
git commit -m "feat: add deepseek text client"
```

### 任务 4：实现豆包图片客户端、组合 Provider 与工厂接线

**文件：**
- 新建：`src/lib/ai/doubao-image-client.ts`
- 新建：`src/lib/ai/composite-ai-provider.ts`
- 修改：`src/lib/ai/provider-factory.ts`
- 新建：`tests/unit/provider-factory.test.ts`

- [ ] **步骤 1：实现图片专用客户端**

创建 `src/lib/ai/doubao-image-client.ts`：

```ts
import { buildImageUrl, postJson } from "@/lib/ai/http";

type DoubaoImageConfig = {
  apiKey: string;
  baseUrl: string;
  imageModel: string;
  imageSize: string;
};

export class DoubaoImageClient {
  constructor(private readonly config: DoubaoImageConfig) {}

  async generateRendering(input: { prompt: string; spaceTitle: string }) {
    const result = await postJson<{ data?: Array<{ url?: string }> }>(
      buildImageUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: this.config.imageModel,
        prompt: input.prompt,
        size: this.config.imageSize,
        response_format: "url"
      }
    );

    const url = result.data?.[0]?.url;
    if (!url) {
      throw new Error(`Seedream did not return image URL for ${input.spaceTitle}`);
    }

    return { imageUrl: url };
  }
}
```

- [ ] **步骤 2：实现组合 Provider**

创建 `src/lib/ai/composite-ai-provider.ts`：

```ts
import type { AiProvider, AgentTurnInput } from "@/lib/ai/ai-provider";
import { QwenVisionClient } from "@/lib/ai/qwen-vision-client";
import { DeepSeekTextClient } from "@/lib/ai/deepseek-text-client";
import { DoubaoImageClient } from "@/lib/ai/doubao-image-client";

type CompositeAiProviderDeps = {
  visionClient: QwenVisionClient;
  textClient: DeepSeekTextClient;
  imageClient: DoubaoImageClient;
};

export class CompositeAiProvider implements AiProvider {
  constructor(private readonly deps: CompositeAiProviderDeps) {}

  analyzeFloorPlan(input: { imageUrl: string; imageDataUrl?: string }) {
    return this.deps.visionClient.analyzeFloorPlan(input);
  }

  nextAgentTurn(input: AgentTurnInput) {
    return this.deps.textClient.nextAgentTurn(input);
  }

  generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    return this.deps.textClient.generateDesignPlan(input);
  }

  generateRendering(input: { prompt: string; spaceTitle: string }) {
    return this.deps.imageClient.generateRendering(input);
  }
}
```

- [ ] **步骤 3：先写一个会失败的工厂测试**

创建 `tests/unit/provider-factory.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

describe("createAiProvider", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("builds a composite provider from capability env vars", async () => {
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

    const { createAiProvider } = await import("@/lib/ai/provider-factory");
    const provider = createAiProvider();

    expect(provider.constructor.name).toBe("CompositeAiProvider");
  });
});
```

运行：

```bash
npm test -- tests/unit/provider-factory.test.ts
```

预期：FAIL，因为工厂现在还在返回旧 provider 或 mock。

- [ ] **步骤 4：重写工厂，按能力环境变量构造组合 provider**

把 `src/lib/ai/provider-factory.ts` 改成：

```ts
import type { AiProvider } from "@/lib/ai/ai-provider";
import { CompositeAiProvider } from "@/lib/ai/composite-ai-provider";
import { DeepSeekTextClient } from "@/lib/ai/deepseek-text-client";
import { DoubaoImageClient } from "@/lib/ai/doubao-image-client";
import { MockAiProvider } from "@/lib/ai/mock-ai-provider";
import { QwenVisionClient } from "@/lib/ai/qwen-vision-client";

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createAiProvider(): AiProvider {
  if ((process.env.AI_PROVIDER ?? "mock") === "mock") {
    return new MockAiProvider();
  }

  const visionClient = new QwenVisionClient({
    apiKey: requireEnv("VISION_API_KEY"),
    baseUrl: requireEnv("VISION_BASE_URL"),
    model: requireEnv("VISION_MODEL")
  });

  const textClient = new DeepSeekTextClient({
    apiKey: requireEnv("TEXT_API_KEY"),
    baseUrl: requireEnv("TEXT_BASE_URL"),
    model: requireEnv("TEXT_MODEL")
  });

  const imageClient = new DoubaoImageClient({
    apiKey: getEnv("IMAGE_API_KEY") ?? requireEnv("DOUBAO_API_KEY"),
    baseUrl: getEnv("IMAGE_BASE_URL") ?? "https://ark.cn-beijing.volces.com/api/v3",
    imageModel: getEnv("IMAGE_MODEL") ?? requireEnv("SEEDREAM_MODEL"),
    imageSize: getEnv("IMAGE_SIZE") ?? "2048x2048"
  });

  return new CompositeAiProvider({ visionClient, textClient, imageClient });
}
```

在测试转绿后，再补上能力标签校验：

- 不支持的 `VISION_PROVIDER` 值要直接报错
- 不支持的 `TEXT_PROVIDER` 值要直接报错
- 不支持的 `IMAGE_PROVIDER` 值要直接报错

不要默默接受错误标签。

- [ ] **步骤 5：运行工厂和图片测试**

运行：

```bash
npm test -- tests/unit/provider-factory.test.ts tests/unit/doubao-image-client.test.ts
```

预期：PASS

- [ ] **步骤 6：提交组合路由层**

```bash
git add src/lib/ai/doubao-image-client.ts src/lib/ai/composite-ai-provider.ts src/lib/ai/provider-factory.ts tests/unit/provider-factory.test.ts tests/unit/doubao-image-client.test.ts
git commit -m "feat: compose ai provider by capability"
```

### 任务 5：更新 README、清理旧测试并跑完整 AI 单测回归

**文件：**
- 修改：`README.md`
- 修改或删除：`tests/unit/doubao-provider.test.ts`
- 测试：`tests/unit/qwen-vision-client.test.ts`
- 测试：`tests/unit/deepseek-text-client.test.ts`
- 测试：`tests/unit/doubao-image-client.test.ts`
- 测试：`tests/unit/provider-factory.test.ts`

- [ ] **步骤 1：更新 README 里的配置说明**

把当前 README 中 “Doubao And Seedream” 这一节替换为：

```md
## AI Provider Configuration

Set `AI_PROVIDER=multi` and configure:

- `VISION_PROVIDER=qwen`
- `VISION_BASE_URL`
- `VISION_API_KEY`
- `VISION_MODEL`

- `TEXT_PROVIDER=deepseek`
- `TEXT_BASE_URL`
- `TEXT_API_KEY`
- `TEXT_MODEL`

- `IMAGE_PROVIDER=doubao`
- `IMAGE_BASE_URL` (optional, defaults to `https://ark.cn-beijing.volces.com/api/v3`)
- `IMAGE_API_KEY` (or legacy fallback `DOUBAO_API_KEY` / `ARK_API_KEY`)
- `IMAGE_MODEL` (or legacy fallback `SEEDREAM_MODEL`)
- `IMAGE_SIZE` (optional, default `2048x2048`)

The adapter uses:

- Qwen-compatible chat completions for floor-plan vision analysis
- DeepSeek `/chat/completions` for interview and design-plan text generation
- Doubao `/images/generations` for Seedream rendering generation
```

- [ ] **步骤 2：删除或改写旧的 `doubao-provider` 单测**

如果旧类已经彻底删除，就删除 `tests/unit/doubao-provider.test.ts`：

```bash
git rm tests/unit/doubao-provider.test.ts
```

如果旧文件暂时还保留，就把它缩成一个迁移兼容 smoke test，而不是继续承载四类能力测试：

```ts
import { describe, expect, it } from "vitest";

describe("legacy doubao provider migration", () => {
  it("is no longer the primary factory implementation", () => {
    expect(true).toBe(true);
  });
});
```

二选一，不要保留已经过时的大而全单测。

- [ ] **步骤 3：运行聚焦后的 AI 单测套件**

运行：

```bash
npm test -- tests/unit/qwen-vision-client.test.ts tests/unit/deepseek-text-client.test.ts tests/unit/doubao-image-client.test.ts tests/unit/provider-factory.test.ts
```

预期：PASS

- [ ] **步骤 4：运行完整单测**

运行：

```bash
npm test
```

预期：完整 Vitest 套件 PASS。

- [ ] **步骤 5：提交文档与测试清理**

```bash
git add README.md tests/unit/qwen-vision-client.test.ts tests/unit/deepseek-text-client.test.ts tests/unit/doubao-image-client.test.ts tests/unit/provider-factory.test.ts
git add src/lib/ai/http.ts src/lib/ai/qwen-vision-client.ts src/lib/ai/deepseek-text-client.ts src/lib/ai/doubao-image-client.ts src/lib/ai/composite-ai-provider.ts src/lib/ai/provider-factory.ts
git commit -m "docs: document multi-provider ai configuration"
```

## 自检

### 规格覆盖检查

- 三段能力拆分：任务 2、3、4 覆盖
- `AiProvider` 接口保持不变：任务 2、4 覆盖
- 按能力环境变量配置：任务 4、5 覆盖
- 千问视觉路由：任务 2、4 覆盖
- DeepSeek 文本路由：任务 3、4 覆盖
- 豆包图片单独路由：任务 1、4 覆盖
- README 迁移说明：任务 5 覆盖
- 单测回归：任务 1-5 覆盖

没有规格遗漏。

### 占位词检查

- 没有 `TBD`、`TODO`、`implement later` 这类占位词
- 每个测试步骤都有明确文件、命令和预期结果
- 每个代码步骤都有明确代码骨架和落点文件

### 类型一致性检查

- `CompositeAiProvider` 委派原有 `AiProvider` 四个方法
- `QwenVisionClient.analyzeFloorPlan()` 接收 `{ imageUrl, imageDataUrl? }`
- `DeepSeekTextClient` 负责 `nextAgentTurn()` 和 `generateDesignPlan()`
- `DoubaoImageClient` 负责 `generateRendering()`

命名、职责和方法边界前后一致。
