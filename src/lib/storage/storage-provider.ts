export type StoredFile = {
  url: string;
  storageKey: string;
};

export interface StorageProvider {
  saveProjectFile(input: {
    projectId: string;
    fileName: string;
    contentType: string;
    bytes: Uint8Array;
  }): Promise<StoredFile>;
}
