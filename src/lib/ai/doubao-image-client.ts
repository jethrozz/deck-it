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
