import { createAnnotationSchema } from "@/lib/annotations";
import { createAnnotation, listAnnotations } from "@/lib/annotation-store";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  try {
    const url = new URL(request.url);
    const annotations = await listAnnotations(siteId, {
      pageId: url.searchParams.get("pageId") || undefined,
      pagePath: url.searchParams.get("pagePath") || undefined,
    });
    return Response.json({ annotations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "批注读取失败" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = createAnnotationSchema.safeParse({ ...body, siteId });
  if (!parsed.success) return Response.json({ error: "批注参数无效", issues: parsed.error.issues }, { status: 400 });
  try {
    return Response.json({ annotation: await createAnnotation(parsed.data) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "批注保存失败" }, { status: 400 });
  }
}
