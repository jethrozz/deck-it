import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

function getContentType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return "image/png";
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string; fileName: string }> }
) {
  const { projectId, fileName } = await context.params;
  const filePath = path.join(process.cwd(), ".data", "uploads", projectId, fileName);

  try {
    const file = await readFile(filePath);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": getContentType(fileName),
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return NextResponse.json({ error: "文件不存在。" }, { status: 404 });
  }
}
