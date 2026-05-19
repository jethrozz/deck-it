export type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
}

export function extractTextContent(response: ChatCompletionResponse): string {
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
    throw new Error(`Doubao request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export function buildChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

export function buildImageUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/images/generations`;
}
