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

    return floorPlanAnalysisSchema.parse(parseJsonObject(extractTextContent(response)));
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

    return {
      type: "question",
      question: agentQuestionSchema.parse(parsed.question)
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

    return designPlanSchema.parse(raw);
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
