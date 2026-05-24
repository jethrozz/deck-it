import path from "node:path";

export function getUploadRootDir() {
  const baseDir = process.env.VERCEL === "1" ? "/tmp" : process.cwd();
  return path.join(baseDir, ".data", "uploads");
}
