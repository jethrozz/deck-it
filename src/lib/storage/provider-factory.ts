import type { StorageProvider } from "@/lib/storage/storage-provider";
import { LocalStorageProvider } from "@/lib/storage/local-storage-provider";

export function createStorageProvider(): StorageProvider {
  return new LocalStorageProvider();
}
