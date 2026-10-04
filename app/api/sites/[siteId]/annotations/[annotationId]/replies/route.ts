import { replyAnnotationSchema } from "@/lib/annotations";
import { replyAnnotation } from "@/lib/annotation-store";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; annotationId: string }> }) {
  const { siteId, annotationId } = await params;
  const parsed = replyAnnotationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "回复参数无效", issues: parsed.error.issues }, { status: 400 });
  try {
    return Response.json({ annotation: await replyAnnotation(siteId, annotationId, parsed.data) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "回复保存失败" }, { status: 404 });
  }
}
