import type { BlockId } from "../catalog.ts";
import { baseFragment } from "./base.ts";
import { contactFragment, footerFragment } from "./contact.ts";
import { heroFragment } from "./hero.ts";
import { capabilitiesFragment, industriesFragment } from "./lists.ts";
import { commercialTermsFragment } from "./commercial-terms.ts";
import { equipmentFragment } from "./equipment.ts";
import { navFragment } from "./nav.ts";
import { productsFragment } from "./products.ts";
import { certificationsFragment, faqFragment, servicesFragment } from "./sections.ts";
import type { BlockFragment } from "./types.ts";

// Server-side only: the preview route composes pages from these. The catalog (client-safe data)
// lives in ../catalog.ts.
export const blockFragments: Readonly<Record<BlockId, BlockFragment>> = {
  nav: navFragment,
  hero: heroFragment,
  products: productsFragment,
  commercialTerms: commercialTermsFragment,
  equipment: equipmentFragment,
  industries: industriesFragment,
  capabilities: capabilitiesFragment,
  services: servicesFragment,
  certifications: certificationsFragment,
  faq: faqFragment,
  contact: contactFragment,
  footer: footerFragment,
};

export { baseFragment };
export { BREAKPOINTS } from "./types.ts";
export type { BlockFragment } from "./types.ts";
