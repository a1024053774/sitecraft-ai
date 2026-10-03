/**
 * T-092: the first reviewed icon vocabulary for contact and certification blocks.
 *
 * This is data only. Consumers receive a reviewed id and render these geometric records; the
 * model never supplies SVG, path data, a URL, or an arbitrary icon name. Lucide geometry is
 * copied from lucide-react 0.511.0 and keeps the upstream ISC notice. The certification marks
 * are original SiteCraft drawings made from the house rules below; Amicons/Smallbits are style
 * references only and are not sources for any path in this file.
 */

export const ICON_SET_SPEC = {
  grid: [24, 24] as const,
  allowedSizes: [16, 20, 24] as const,
  defaultStrokeWidth: 1.75,
  defaultLineCap: "round" as const,
  /** Reserved for a future engineering-industrial variant; this ticket ships round caps only. */
  futureEngineeringLineCap: "square" as const,
  /** Cursor's minimum clear space rule, expressed in 16px grid units. */
  minOpticalGap: 3,
  oneConceptOneIcon: true,
} as const;

export type IconGeometry =
  | { kind: "path"; d: string }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "polyline"; points: string }
  | { kind: "rect"; x: number; y: number; width: number; height: number; rx?: number; ry?: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

export type IconLicense = {
  name: "ISC" | "SiteCraft original";
  url: string | null;
  attribution: string;
  copyright: readonly string[];
  notice: string;
};

export type IconId =
  | "contact-email"
  | "contact-phone"
  | "contact-address"
  | "contact-submit"
  | "cert-certificate"
  | "cert-inspection-report"
  | "cert-export-qualification"
  | "cert-status-valid"
  | "cert-status-pending"
  | "cert-status-expired";

export type IconDefinition = {
  id: IconId;
  semantic: string;
  viewBox: "0 0 24 24";
  paths: readonly IconGeometry[];
  defaultSize: 16 | 20 | 24;
  allowedSizes: readonly [16, 20, 24];
  strokeWidth: number;
  lineCap: "round" | "square";
  lineJoin: "round" | "miter";
  source: "lucide-react@0.511.0" | "SiteCraft original";
  license: IconLicense;
  selfDrawn: boolean;
};

const LUCIDE_LICENSE: IconLicense = {
  name: "ISC",
  url: "https://raw.githubusercontent.com/lucide-icons/lucide/0.511.0/LICENSE",
  attribution: "Cole Bemis / Feather and Lucide Contributors",
  copyright: [
    "Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).",
    "All other copyright (c) for Lucide are held by Lucide Contributors 2022.",
  ],
  notice: "ISC License",
};

const SITECRAFT_LICENSE: IconLicense = {
  name: "SiteCraft original",
  url: null,
  attribution: "SiteCraft AI",
  copyright: ["SiteCraft AI"],
  notice: "Original SiteCraft geometry; no third-party license.",
};

const lucide = (
  id: IconId,
  semantic: string,
  paths: readonly IconGeometry[],
): IconDefinition => ({
  id,
  semantic,
  viewBox: "0 0 24 24",
  paths,
  defaultSize: 20,
  allowedSizes: ICON_SET_SPEC.allowedSizes,
  strokeWidth: ICON_SET_SPEC.defaultStrokeWidth,
  lineCap: ICON_SET_SPEC.defaultLineCap,
  lineJoin: "round",
  source: "lucide-react@0.511.0",
  license: LUCIDE_LICENSE,
  selfDrawn: false,
});

const original = (
  id: IconId,
  semantic: string,
  paths: readonly IconGeometry[],
): IconDefinition => ({
  id,
  semantic,
  viewBox: "0 0 24 24",
  paths,
  defaultSize: 20,
  allowedSizes: ICON_SET_SPEC.allowedSizes,
  strokeWidth: ICON_SET_SPEC.defaultStrokeWidth,
  lineCap: ICON_SET_SPEC.defaultLineCap,
  lineJoin: "round",
  source: "SiteCraft original",
  license: SITECRAFT_LICENSE,
  selfDrawn: true,
});

export const iconRegistry: Readonly<Record<IconId, IconDefinition>> = {
  "contact-email": lucide("contact-email", "contact email", [
    { kind: "path", d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" },
    { kind: "rect", x: 2, y: 4, width: 20, height: 16, rx: 2 },
  ]),
  "contact-phone": lucide("contact-phone", "contact phone", [
    { kind: "path", d: "M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" },
  ]),
  "contact-address": lucide("contact-address", "contact address", [
    { kind: "path", d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" },
    { kind: "circle", cx: 12, cy: 10, r: 3 },
  ]),
  "contact-submit": lucide("contact-submit", "submit inquiry", [
    { kind: "path", d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" },
    { kind: "path", d: "m21.854 2.147-10.94 10.939" },
  ]),

  // Original geometry: a certificate sheet with a ribbon, built from the 24px house grid.
  "cert-certificate": original("cert-certificate", "certificate document", [
    { kind: "path", d: "M5 2.75h14A1.75 1.75 0 0 1 20.75 4.5v11A1.75 1.75 0 0 1 19 17.25H5A1.75 1.75 0 0 1 3.25 15.5v-11A1.75 1.75 0 0 1 5 2.75Z" },
    { kind: "path", d: "M5.75 6.5h12.5M5.75 10h9.5M5.75 13.5h7" },
    { kind: "path", d: "M8.25 17.25v4.5L12 19.6l3.75 2.15v-4.5" },
  ]),
  // Original geometry: report sheet plus a separate inspection lens and check.
  "cert-inspection-report": original("cert-inspection-report", "inspection report", [
    { kind: "path", d: "M5 2.75h8.5l5.5 5.5v8.5a2.25 2.25 0 0 1-2.25 2.25H5A2.25 2.25 0 0 1 2.75 16.75V5A2.25 2.25 0 0 1 5 2.75Z" },
    { kind: "path", d: "M13.5 2.75v5.5H19M5.75 9.5h5.25M5.75 13h4.25" },
    { kind: "circle", cx: 15, cy: 15, r: 4 },
    { kind: "path", d: "m17.9 17.9 3.35 3.35" },
  ]),
  // Original geometry: a qualification sheet with an outward export arrow.
  "cert-export-qualification": original("cert-export-qualification", "export qualification", [
    { kind: "path", d: "M4 2.75h8.5l4.5 4.5v4M12.5 2.75v4.5H17M5.5 11h4.25M5.5 14h3.25M4 2.75v18.5h5" },
    { kind: "path", d: "M11.5 17h10M17.5 13.5l4 3.5-4 3.5" },
  ]),
  "cert-status-valid": lucide("cert-status-valid", "certification status valid", [
    { kind: "path", d: "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" },
    { kind: "path", d: "m9 12 2 2 4-4" },
  ]),
  "cert-status-pending": lucide("cert-status-pending", "certification status pending", [
    { kind: "circle", cx: 12, cy: 12, r: 10 },
    { kind: "polyline", points: "12 6 12 12 16.5 12" },
  ]),
  "cert-status-expired": lucide("cert-status-expired", "certification status expired", [
    { kind: "circle", cx: 12, cy: 12, r: 10 },
    { kind: "path", d: "m15 9-6 6M9 9l6 6" },
  ]),
};

export const iconIds = Object.keys(iconRegistry) as IconId[];

export const iconConcepts = {
  email: "contact-email",
  phone: "contact-phone",
  address: "contact-address",
  submit: "contact-submit",
  certificate: "cert-certificate",
  inspectionReport: "cert-inspection-report",
  exportQualification: "cert-export-qualification",
  statusValid: "cert-status-valid",
  statusPending: "cert-status-pending",
  statusExpired: "cert-status-expired",
} as const satisfies Record<string, IconId>;

export function isIconId(value: unknown): value is IconId {
  return typeof value === "string" && Object.hasOwn(iconRegistry, value);
}

/** Resolve only a registry id. Callers must not pass model-authored SVG, paths, or URLs. */
export function iconDefinitionFor(id: string): IconDefinition {
  if (!isIconId(id)) throw new Error(`未登记图标：${id}`);
  return iconRegistry[id];
}
