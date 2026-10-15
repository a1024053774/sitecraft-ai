import { z } from "zod";

const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/);
const siteIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i);
const pagePathSchema = z.string().min(1).max(2000).refine(
  (value) => value.startsWith("/") && !value.startsWith("//") && !/[?#\\]/.test(value),
  "批注页面必须是站点路径",
);
const localizedLocaleSchema = z.enum(["zh", "en"]);
const elementHintSchema = z.object({
  path: z.array(z.number().int().nonnegative().max(10000)).max(40),
  tag: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/), text: z.string().max(1000),
}).strict();

// DOM paths are element-child indices below the page's single main element.
// A version and text snapshot prevent an old path from silently moving to new copy.
export const annotationTargetSchema = z.object({
  kind: z.literal('dom'), pageId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  versionId: z.string().min(1).max(120),
  path: z.array(z.number().int().nonnegative().max(10000)).min(1).max(40),
  text: z.string().min(1).max(1000), label: z.string().min(1).max(200),
  element: elementHintSchema.optional(),
  elements: z.array(elementHintSchema).min(1).optional(),
}).strict();

// Drafts stay in the browser; sent threads use the existing server store.
export const annotationDraftSchema = z.object({
  id: idSchema, target: annotationTargetSchema, revision: z.number().int().positive(),
  body: z.string().trim().min(1).max(4000), status: z.enum(['draft', 'sending', 'archived']),
  submissionId: z.string().uuid().optional(), error: z.string().optional(),
}).strict().refine(draft => draft.status !== 'sending' || !!draft.submissionId, '发送中的草稿必须绑定发送标识');
export type AnnotationDraft = z.infer<typeof annotationDraftSchema>;

// A browser-frozen set of drafts sent together. The draft id is only a
// reconciliation key; the server still validates every DOM anchor before any
// model request or version commit.
export const annotationBatchItemSchema = z.object({
  draftId: idSchema, target: annotationTargetSchema, revision: z.number().int().positive(),
  body: z.string().trim().min(1).max(4000),
}).strict();
export type AnnotationBatchItem = z.infer<typeof annotationBatchItemSchema>;

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
}).strict();

export const annotationCaptureSchema = z.object({
  pageId: idSchema,
  pagePath: pagePathSchema,
  revision: z.number().int().nonnegative(),
  locale: localizedLocaleSchema,
  viewport: viewportSchema.optional(),
  scroll: z.object({ x: z.number().finite().nonnegative(), y: z.number().finite().nonnegative() }).strict().optional(),
  target: annotationTargetSchema,
  rect: rectSchema.optional(),
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
  // Stored anchors are opaque records. Only new writes require the current DOM
  // contract; unknown old anchors remain intact and are never used for selection.
  anchor: z.record(z.string(), z.unknown()),
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
  if (value.anchor.target.pageId !== value.pageId) context.addIssue({ code: "custom", message: "批注目标与页面不一致", path: ["anchor", "target", "pageId"] });
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
