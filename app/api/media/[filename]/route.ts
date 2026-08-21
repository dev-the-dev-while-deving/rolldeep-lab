import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { filesDirFor } from "@/lib/paths";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const safe = path.basename(filename);
  if (safe !== filename || safe.includes("..")) {
    return new NextResponse("Bad filename", { status: 400 });
  }
  const filePath = path.join(filesDirFor(getStore().homeDir), safe);
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const data = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `inline; filename="${safe}"`,
    },
  });
}
