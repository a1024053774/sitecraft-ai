import type { BlockLook } from "../catalog.ts";
import { engineeringLook } from "./engineering.ts";

/** Looks that have moved to the block library. The other looks still use their overlay. */
export const blockLooks: readonly BlockLook[] = [engineeringLook];

export function blockLookForTemplate(templateId: string) {
  return blockLooks.find((look) => look.templateId === templateId);
}

export { engineeringLook };
