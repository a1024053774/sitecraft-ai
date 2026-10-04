import { updateAnnotationSchema } from "@/lib/annotations";
import { deleteAnnotation, getAnnotation, updateAnnotation } from "@/lib/annotation-store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; annotationId: string }> }) {
  const { siteId, annotationId } = await params;
  try {
    return Response.json({ annotation: await getAnnotation(siteId, annotationId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "批注不存在" }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ siteId: string; annotationId: string }> }) {
  const { siteId, annotationId } = await params;
  const parsed = updateAnnotationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "批注更新参数无效", issues: parsed.error.issues }, { status: 400 });
  try {
    return Response.json({ annotation: await updateAnnotation(siteId, annotationId, parsed.data) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "批注更新失败" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ siteId: string; annotationId: string }> }) {
  const { siteId, annotationId } = await params;
  try {
    await deleteAnnotation(siteId, annotationId);
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "批注删除失败" }, { status: 404 });
  }
}
