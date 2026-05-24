import { afterEach, describe, expect, it, vi } from "vitest";

describe("getUploadRootDir", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("uses /tmp on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");

    const { getUploadRootDir } = await import("@/lib/storage/upload-root");

    expect(getUploadRootDir()).toBe("/tmp/.data/uploads");
  });

  it("uses the workspace on local development", async () => {
    vi.stubEnv("VERCEL", "0");

    const { getUploadRootDir } = await import("@/lib/storage/upload-root");

    expect(getUploadRootDir()).toBe("/Users/jethrozz/Documents/UGit/deck-it/.data/uploads");
  });
});
