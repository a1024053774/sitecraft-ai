export type {
  SlotApplyReport,
  TemplateAdapter,
  TemplatePreviewRuntime,
  TemplateSanitizeRules,
  TemplateSlot,
  TemplateSlotAlternative,
  TemplateSlotAttr,
} from "./types.ts";
export { adapterCoverage, getTemplateAdapter, reportDeclaredCoverage, templateAdapters } from "./registry.ts";
export {
  PREVIEW_BRIDGE_NONCE,
  PREVIEW_BRIDGE_SOURCE,
  buildPreviewBridgeScript,
  installPreviewBridge,
  stripHtmlScripts,
} from "./preview-bridge.ts";
