import type { BlockLook } from "../catalog.ts";
import { engineeringLook } from "./engineering.ts";
import { brightLook } from "./bright.ts";
import { catalogLook } from "./catalog.ts";

/** Looks that have moved to the block library. The other looks still use their overlay. */
export const blockLooks: readonly BlockLook[] = [engineeringLook, brightLook, catalogLook];

export function blockLookForTemplate(templateId: string) {
  return blockLooks.find((look) => look.templateId === templateId);
}

export { engineeringLook, brightLook, catalogLook };
