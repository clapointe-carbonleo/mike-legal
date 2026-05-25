import { NextRequest } from "next/server";

export const runtime = "edge";

export async function PUT(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !url.includes(".r2.cloudflarestorage.com/")) {
    return new Response("Invalid URL", { status: 400 });
  }
  const r2 = await fetch(url, {
    method: "PUT",
    // @ts-ignore — duplex required for streaming body in fetch
    duplex: "half",
    body: req.body,
  });
  if (!r2.ok) {
    return new Response(await r2.text(), { status: r2.status });
  }
  return new Response(null, { status: 200 });
}
