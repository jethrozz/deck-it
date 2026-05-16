import { Queue } from "bullmq";

export type JobName = "analyze-floor-plan" | "generate-renderings" | "generate-brief";

export function createQueue(name: JobName) {
  const connectionUrl = process.env.REDIS_URL;
  if (!connectionUrl) {
    return null;
  }

  return new Queue(name, {
    connection: {
      url: connectionUrl
    }
  });
}
