import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider, StoredFile } from "@/lib/storage/storage-provider";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir = path.join(process.cwd(), ".data", "uploads")) {}

  async saveProjectFile(input: {
    projectId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<StoredFile> {
    const fileName = `${Date.now()}-${safeFileName(input.fileName)}`;
    const projectDir = path.join(this.rootDir, input.projectId);
    await mkdir(projectDir, { recursive: true });
    const diskPath = path.join(projectDir, fileName);
    await writeFile(diskPath, input.bytes);

    return {
      storageKey: `${input.projectId}/${fileName}`,
      url: `/local-uploads/${input.projectId}/${fileName}`
    };
  }
}
