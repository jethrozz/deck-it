import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import { DeepSeekTextClient } from "@/lib/ai/deepseek-text-client";
import {
  buildChatUrl,
  buildImageUrl,
  extractTextContent,
  parseJsonObject,
  postJson,
  type ChatCompletionResponse
} from "@/lib/ai/http";
import { floorPlanAnalysisSchema } from "@/lib/domain/schemas";

type DoubaoConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  imageModel: string;
  imageSize: string;
};

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

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

export class DoubaoProvider implements AiProvider {
  constructor(private readonly config: DoubaoConfig) {}

  private createTextClient() {
    return new DeepSeekTextClient({
      apiKey: getEnv("TEXT_API_KEY") ?? this.config.apiKey,
      baseUrl: getEnv("TEXT_BASE_URL") ?? this.config.baseUrl,
      model: getEnv("TEXT_MODEL") ?? this.config.chatModel
    });
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
              [
                "你是专业室内设计师助手，正在直接查看一张住宅户型图本身，而不是网页截图、上传界面或文件列表。",
                "你的任务是尽最大可能从图片中识别户型空间、空间关系和潜在问题。",
                "即使图片信息不完整，也必须先做尽可能合理的识别，再把不确定点放进 uncertainItems。",
                "禁止输出“只上传了文件”“未执行分析”“没有进行识别操作”“无法确认所有信息”这类把任务本身误解成系统流程说明的话。",
                "返回严格 JSON，字段必须是 rooms, relationships, issues, uncertainItems, userCorrections。",
                "rooms 里每项包含 name,type,confidence；type 只能是 living_dining, master_bedroom, kitchen, child_room, study, bathroom, balcony, other。",
                "issues 里每项包含 type,description,confidence；type 只能是 lighting, circulation, storage, layout, unclear。",
                "如果无法分辨房间功能，可以先用 other，并在 uncertainItems 里写清楚原因。",
                "不要输出施工图结论、尺寸复核结论或精确报价。"
              ].join(" ")
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "下面这张图片就是待分析的住宅户型图本身。",
                  "请直接阅读图片里的空间轮廓、文字标注、门窗关系和阳台/卫浴/厨房等典型位置，输出 JSON。",
                  "请优先识别：客餐厅、主卧、次卧/儿童房、书房、厨房、卫生间、阳台、过道等。",
                  "relationships 请写空间连接关系，例如“客餐厅连接阳台”“厨房靠近餐厅”“主卧位于安静一侧”。",
                  "issues 请写户型层面的潜在问题，例如采光、动线、收纳、布局冲突。",
                  "如果有不确定的区域，请只把不确定项放进 uncertainItems，不要把整张图都判成未分析。",
                  "请严格输出 JSON，不要加解释文字。"
                ].join(" ")
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
    return this.createTextClient().nextAgentTurn(input);
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    return this.createTextClient().generateDesignPlan(input);
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
