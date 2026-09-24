/**
 * Preview frame load timing: when to start the failure clock, and how to
 * phrase upstream failure reasons for visitors.
 *
 * - Non-thumbnail: if the document never loads, fail after PREVIEW_TIMEOUT_MS from arming.
 * - Thumbnail: do not arm until the frame is in (or near) the viewport.
 * - After document load: only the “loaded but no sitecraft:applied” window counts.
 */

export const PREVIEW_TIMEOUT_MS = 10_000;
export const PREVIEW_CHROME_HINT = "如果预览打不开，请用 Chrome 打开。";

export type PreviewFrameVariant = "thumbnail" | "preview" | "workspace" | "published" | "quality";

export type PreviewLoadTimerHooks = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

export type PreviewLoadController = {
  /** Arm the “document never arrived” wait. Thumbnails must call markVisible first. */
  armDocumentWait: () => void;
  /** Thumbnail entered (or neared) the viewport — start the document wait. */
  markVisible: () => void;
  /** iframe onLoad fired — switch to the bridge-ack wait. */
  markDocumentLoaded: () => void;
  clear: () => void;
};

const DOCUMENT_NEVER_LOADED =
  `预览没有载入。请重试。${PREVIEW_CHROME_HINT}`;
const DOCUMENT_LOADED_NO_BRIDGE =
  `页面已经打开，但内容没有显示出来。请重试。${PREVIEW_CHROME_HINT}`;

/**
 * Map upstream/preview English Error.message values to plain Chinese.
 * Keeps the catalog style: no raw status codes or AbortError text for visitors.
 */
export function mapPreviewUpstreamReason(raw: string): string {
  const text = raw.trim();
  if (!text) return "预览暂时无法加载。";
  if (/[\u4e00-\u9fff]/.test(text) && !/upstream|AbortError|Error:|status \d/i.test(text)) {
    return text;
  }
  if (/abort|timeout|timed?\s*out/i.test(text)) {
    return "预览载入超时，请稍后重试。";
  }
  if (/upstream status\s*\d+/i.test(text)) {
    return "上游模板暂时无法访问，请稍后重试。";
  }
  if (/did not return HTML|not return html/i.test(text)) {
    return "上游没有返回可用页面，请稍后重试。";
  }
  if (/unknown upstream|fetch failed|network/i.test(text)) {
    return "预览暂时无法加载，请稍后重试。";
  }
  return "预览暂时无法加载，请稍后重试。";
}

export function createPreviewLoadController(
  args: {
    variant: PreviewFrameVariant;
    onTimeout: (message: string) => void;
  } & PreviewLoadTimerHooks,
): PreviewLoadController {
  let timer: unknown = null;
  let visible = args.variant !== "thumbnail";
  let documentLoaded = false;
  let documentWaitArmed = false;

  const clear = () => {
    if (timer !== null) {
      args.clearTimeout(timer);
      timer = null;
    }
  };

  const startBridgeWait = () => {
    clear();
    timer = args.setTimeout(() => {
      timer = null;
      args.onTimeout(DOCUMENT_LOADED_NO_BRIDGE);
    }, PREVIEW_TIMEOUT_MS);
  };

  const startDocumentWait = () => {
    if (!visible || documentLoaded || documentWaitArmed) return;
    documentWaitArmed = true;
    clear();
    timer = args.setTimeout(() => {
      timer = null;
      args.onTimeout(DOCUMENT_NEVER_LOADED);
    }, PREVIEW_TIMEOUT_MS);
  };

  return {
    armDocumentWait: () => {
      startDocumentWait();
    },
    markVisible: () => {
      visible = true;
      startDocumentWait();
    },
    markDocumentLoaded: () => {
      documentLoaded = true;
      documentWaitArmed = true;
      startBridgeWait();
    },
    clear,
  };
}
