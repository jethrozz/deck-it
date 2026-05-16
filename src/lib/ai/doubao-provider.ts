import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import {
  agentQuestionSchema,
  designPlanSchema,
  floorPlanAnalysisSchema
} from "@/lib/domain/schemas";

type DoubaoConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  imageModel: string;
  imageSize: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

const roomTypeMap = new Map<string, string>([
  ["living_dining", "living_dining"],
  ["客餐厅", "living_dining"],
  ["客厅", "living_dining"],
  ["餐厅", "living_dining"],
  ["卧室", "master_bedroom"],
  ["主卧", "master_bedroom"],
  ["master_bedroom", "master_bedroom"],
  ["kitchen", "kitchen"],
  ["厨房", "kitchen"],
  ["child_room", "child_room"],
  ["儿童房", "child_room"],
  ["study", "study"],
  ["书房", "study"],
  ["bathroom", "bathroom"],
  ["卫生间", "bathroom"],
  ["balcony", "balcony"],
  ["阳台", "balcony"],
  ["交通空间", "other"],
  ["过道", "other"],
  ["other", "other"]
]);

const issueTypeMap = new Map<string, string>([
  ["lighting", "lighting"],
  ["采光", "lighting"],
  ["circulation", "circulation"],
  ["动线", "circulation"],
  ["storage", "storage"],
  ["收纳", "storage"],
  ["layout", "layout"],
  ["布局", "layout"],
  ["布局缺陷", "layout"],
  ["unclear", "unclear"],
  ["信息缺失", "unclear"],
  ["未知", "unclear"]
]);

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

function extractTextContent(response: ChatCompletionResponse): string {
  const message = response.choices?.[0]?.message;
  if (!message) {
    throw new Error("Doubao chat response has no choices[0].message.");
  }

  const { content } = message;
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

  throw new Error("Doubao chat response content is empty.");
}

function parseJsonObject(raw: string): unknown {
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

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const candidateKeys = ["description", "text", "name", "label", "value", "reason"];
    for (const key of candidateKeys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return undefined;
}

function asConfidence(value: unknown, fallback = 0.7): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.min(1, Math.max(0, numeric));
    }
  }

  return fallback;
}

function normalizeRoomType(value: unknown): string {
  const label = asString(value);
  if (!label) {
    return "other";
  }

  return roomTypeMap.get(label) ?? "other";
}

function normalizeIssueType(value: unknown): string {
  const label = asString(value);
  if (!label) {
    return "unclear";
  }

  return issueTypeMap.get(label) ?? "unclear";
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item && item.length > 0));
}

function normalizeFloorPlanAnalysis(raw: unknown): unknown {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rooms = Array.isArray(source.rooms)
    ? source.rooms.map((item) => {
        const room = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name: asString(room.name) ?? asString(room.label) ?? "未命名空间",
          type: normalizeRoomType(room.type ?? room.category ?? room.name),
          confidence: asConfidence(room.confidence)
        };
      })
    : [];

  const issues = Array.isArray(source.issues)
    ? source.issues.map((item) => {
        const issue = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          type: normalizeIssueType(issue.type ?? issue.category ?? issue.name),
          description: asString(issue.description) ?? asString(issue.name) ?? "未说明问题",
          confidence: asConfidence(issue.confidence)
        };
      })
    : [];

  return {
    rooms,
    relationships: normalizeStringArray(source.relationships),
    issues,
    uncertainItems: normalizeStringArray(source.uncertainItems),
    userCorrections: normalizeStringArray(source.userCorrections)
  };
}

function normalizeDesignPlan(raw: unknown): unknown {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const keySpaces = Array.isArray(source.keySpaces)
    ? source.keySpaces.map((item) => {
        const space = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const designPoints = normalizeStringArray(space.designPoints);
        const title = asString(space.title) ?? asString(space.name) ?? "重点空间";
        const type = normalizeRoomType(space.spaceType ?? space.type ?? space.title ?? space.name);
        const designGoal =
          asString(space.designGoal) ??
          designPoints[0] ??
          `${title}的功能优化与风格统一`;
        const explanation =
          asString(space.explanation) ??
          `${title}以${designPoints.slice(0, 2).join("，") || "提升使用体验"}为核心，结合当前户型信息做原木风方向设计。`;
        const layoutSuggestion =
          asString(space.layoutSuggestion) ??
          designPoints[0] ??
          `${title}优先保证通行、采光和主要功能布局。`;
        const paletteAndMaterials = normalizeStringArray(space.paletteAndMaterials);
        const furnitureAndSoftDecor = normalizeStringArray(space.furnitureAndSoftDecor);
        const practicalNotes = normalizeStringArray(space.practicalNotes);
        const budgetTradeOffs =
          asString(space.budgetTradeOffs) ??
          `优先把预算投入在${title}的高频使用面、基础收纳和耐用材质上。`;
        const renderingPrompt =
          asString(space.renderingPrompt) ??
          `${title}，${asString(source.styleSummary) ?? "温暖原木风"}，${designPoints.slice(0, 3).join("，")}`;

        return {
          ...space,
          spaceType: type,
          title,
          designGoal,
          explanation,
          layoutSuggestion,
          paletteAndMaterials:
            paletteAndMaterials.length > 0 ? paletteAndMaterials : designPoints.slice(0, 3),
          furnitureAndSoftDecor:
            furnitureAndSoftDecor.length > 0 ? furnitureAndSoftDecor : designPoints.slice(0, 3),
          budgetTradeOffs,
          practicalNotes: practicalNotes.length > 0 ? practicalNotes : designPoints,
          renderingPrompt
        };
      })
    : [];

  return {
    ...source,
    keySpaces
  };
}

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
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
    throw new Error(`Doubao request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

function buildChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function buildImageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/images/generations`;
}

export class DoubaoProvider implements AiProvider {
  constructor(private readonly config: DoubaoConfig) {}

  private async chatJson(input: {
    model: string;
    systemPrompt: string;
    userPayload: unknown;
  }): Promise<unknown> {
    const response = await postJson<ChatCompletionResponse>(
      buildChatUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: input.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: `请严格输出 JSON，不要输出额外说明。\n${JSON.stringify(input.userPayload)}`
          }
        ]
      }
    );

    return parseJsonObject(extractTextContent(response));
  }

  async analyzeFloorPlan(input: { imageUrl: string; imageDataUrl?: string }) {
    const imageReference = input.imageDataUrl ?? input.imageUrl;
    const response = await postJson<ChatCompletionResponse>(
      buildChatUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: this.config.visionModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "你是室内设计师助手。分析户型图并返回 JSON：rooms, relationships, issues, uncertainItems, userCorrections。不要输出施工图结论或精确报价。"
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请输出 JSON。rooms 里每项包含 name,type,confidence。issues 里每项包含 type,description,confidence。"
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

    return floorPlanAnalysisSchema.parse(
      normalizeFloorPlanAnalysis(parseJsonObject(extractTextContent(response)))
    );
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const raw = await this.chatJson({
      model: this.config.chatModel,
      systemPrompt:
        "你是装修设计师 Agent。最多追问 12 个问题。信息不足时返回 question；信息足够时返回 ready。格式必须是 JSON。",
      userPayload: {
        schema: {
          question: {
            type: "question",
            question: {
              id: "string",
              question: "string",
              recommendation: "string (optional)",
              options: ["string", "string"],
              reason: "string"
            }
          },
          ready: {
            type: "ready",
            reason: "string"
          }
        },
        analysis: input.analysis,
        profile: input.profile,
        conversation: input.conversation
      }
    });

    const parsed = raw as { type?: string; question?: unknown; reason?: string };
    if (parsed.type === "ready") {
      return {
        type: "ready",
        reason: typeof parsed.reason === "string" ? parsed.reason : "信息已足够，进入方案生成。"
      };
    }

    const questionCandidate =
      parsed.question && typeof parsed.question === "object"
        ? ({ ...(parsed.question as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    const normalizedOptions = normalizeStringArray(questionCandidate.options);

    return {
      type: "question",
      question: agentQuestionSchema.parse({
        ...questionCandidate,
        id: asString(questionCandidate.id) ?? `q-${Date.now()}`,
        question: asString(questionCandidate.question) ?? "请补充一个会影响装修方案的重要信息。",
        recommendation: asString(questionCandidate.recommendation),
        options:
          normalizedOptions.length > 0
            ? normalizedOptions
            : ["接受推荐方案", "我想自己补充说明"],
        reason: asString(questionCandidate.reason) ?? "需要进一步确认设计偏好。"
      })
    };
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    const raw = await this.chatJson({
      model: this.config.chatModel,
      systemPrompt:
        "你是装修设计师。请输出 JSON 设计 brief，必须包含 overallStrategy, styleSummary, budgetAssumptions, keySpaces(2-3), disclaimer。",
      userPayload: {
        analysis: input.analysis,
        profile: input.profile,
        conversationSummary: input.conversationSummary
      }
    });

    return designPlanSchema.parse(normalizeDesignPlan(raw));
  }

  async generateRendering(input: { prompt: string; spaceTitle: string }) {
    const result = await postJson<{ data?: Array<{ url?: string; b64_json?: string }> }>(
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
