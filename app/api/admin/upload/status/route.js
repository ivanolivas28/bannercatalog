import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/libs/next-auth";
import { list } from "@vercel/blob";

const FILE_KEYS = ["mx", "usa", "chn", "banner", "sourcing"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = {};
  await Promise.all(
    FILE_KEYS.map(async (key) => {
      try {
        const { blobs } = await list({ prefix: `catalog/${key}.` });
        status[key] = blobs[0]
          ? { uploadedAt: blobs[0].uploadedAt, pathname: blobs[0].pathname, url: blobs[0].url }
          : null;
      } catch {
        status[key] = null;
      }
    })
  );

  return NextResponse.json(status);
}
