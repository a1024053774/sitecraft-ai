import { z } from "zod";

const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/);
const siteIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i);
const pagePathSchema = z.string().min(1).max(2000).refine(
  (value) => value.startsWith("/") && !value.startsWith("//") && !/[?#\\]/.test(value),
  "批注页面必须是站点路径",
);
const localizedLocaleSchema = z.enum(["zh", "en"]);

const slotTargetSchema = z.object({
  kind: z.literal("slot"),
  slot: z.string().min(1).max(200),
  section: z.string().min(1).max(80),
  itemId: idSchema.optional(),
  productId: idSchema.optional(),
  locale: localizedLocaleSchema.optional(),
}).strict();

const regionTargetSchema = z.object({
  kind: z.literal("region"),
  slots: z.array(z.string().min(1).max(200)).min(1).max(80),
  primarySlot: z.string().min(1).max(200).optional(),
}).strict().superRefine((value, context) => {
  if (new Set(value.slots).size !== value.slots.length)
    context.addIssue({ code: "custom", message: "圈选目标不能重复", path: ["slots"] });
  if (value.primarySlot && !value.slots.includes(value.primarySlot))
    context.addIssue({ code: "custom", message: "主目标必须来自圈选目标", path: ["primarySlot"] });
});

export const annotationTargetSchema = z.union([slotTargetSchema, regionTargetSchema]);

const rectSchema = z.object({
  x: z.number().finite().nonnegative(),
  y: z.number().finite().nonnegative(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  space: z.enum(["target-ratio", "iframe-viewport"]),
}).strict();

const viewportSchema = z.object({
  width: z.number().int().positive().max(20000),
  height: z.number().int().positive().max(20000),
  device: z.enum(["desktop", "tablet", "mobile"]),
}).strict();

const snapshotSchema = z.object({
  text: z.string().max(1000).optional(),
  label: z.string().max(200).optional(),
  tag: z.string().max(32).optional(),
  slotLabel: z.string().max(200).optional(),
}).strict();

export const annotationCaptureSchema = z.object({
  pageId: idSchema,
  pagePath: pagePathSchema,
  templateId: z.string().min(1).max(80),
  revision: z.number().int().nonnegative(),
  locale: localizedLocaleSchema,
  viewport: viewportSchema,
  scroll: z.object({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative() }).strict(),
  target: annotationTargetSchema,
  rect: rectSchema,
  snapshot: snapshotSchema,
  capturedAt: z.string().min(1).max(80),
}).strict();

export const annotationCurrentSchema = z.object({
  state: z.enum(["attached", "stale", "ambiguous"]),
  revision: z.number().int().nonnegative(),
  rect: rectSchema.optional(),
  reason: z.string().max(300).optional(),
}).strict();

export const annotationCommentSchema = z.object({
  id: idSchema,
  body: z.string().trim().min(1).max(4000),
  author: z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(80) }).strict(),
  createdAt: z.string().min(1).max(80),
  editedAt: z.string().min(1).max(80).optional(),
}).strict();

export const annotationThreadSchema = z.object({
  id: idSchema,
  siteId: siteIdSchema,
  pageId: idSchema,
  pagePath: pagePathSchema,
  status: z.enum(["open", "resolved"]),
  anchor: annotationCaptureSchema,
  current: annotationCurrentSchema,
  comments: z.array(annotationCommentSchema).min(1).max(200),
  changeSetId: idSchema.optional(),
  createdAt: z.string().min(1).max(80),
  updatedAt: z.string().min(1).max(80),
}).strict();

export const createAnnotationSchema = z.object({
  siteId: siteIdSchema,
  pageId: idSchema,
  pagePath: pagePathSchema,
  anchor: annotationCaptureSchema,
  body: z.string().trim().min(1).max(4000),
  author: z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(80) }).strict(),
}).strict().superRefine((value, context) => {
  if (value.anchor.pageId !== value.pageId) context.addIssue({ code: "custom", message: "批注页面与锚点页面不一致", path: ["anchor", "pageId"] });
  if (value.anchor.pagePath !== value.pagePath) context.addIssue({ code: "custom", message: "批注路径与锚点路径不一致", path: ["anchor", "pagePath"] });
});

export const replyAnnotationSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  author: z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(80) }).strict(),
}).strict();

export const updateAnnotationSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  current: annotationCurrentSchema.optional(),
  changeSetId: idSchema.optional(),
}).strict().refine((value) => value.status !== undefined || value.current !== undefined || value.changeSetId !== undefined, "批注更新不能为空");

export type AnnotationTarget = z.infer<typeof annotationTargetSchema>;
export type AnnotationCapture = z.infer<typeof annotationCaptureSchema>;
export type AnnotationCurrent = z.infer<typeof annotationCurrentSchema>;
export type AnnotationComment = z.infer<typeof annotationCommentSchema>;
export type AnnotationThread = z.infer<typeof annotationThreadSchema>;
export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type ReplyAnnotationInput = z.infer<typeof replyAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;

export function parseAnnotation(value: unknown): AnnotationThread {
  return annotationThreadSchema.parse(value);
}

export function newAnnotationId() {
  return `ann_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function newAnnotationCommentId() {
  return `ac_${crypto.randomUUID().replaceAll("-", "")}`;
}
