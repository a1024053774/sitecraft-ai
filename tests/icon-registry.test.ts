import assert from "node:assert/strict";
import test from "node:test";
import {
  ICON_SET_SPEC,
  iconConcepts,
  iconDefinitionFor,
  iconIds,
  iconRegistry,
  type IconGeometry,
} from "../lib/blocks/icon-registry.ts";

const expectedIds = [
  "contact-email",
  "contact-phone",
  "contact-address",
  "contact-submit",
  "cert-certificate",
  "cert-inspection-report",
  "cert-export-qualification",
  "cert-status-valid",
  "cert-status-pending",
  "cert-status-expired",
] as const;

const geometryTags = new Set(["path", "line", "polyline", "rect", "circle"]);

function assertGeometry(geometry: IconGeometry, id: string) {
  assert.ok(geometryTags.has(geometry.kind), `${id} has an unsupported geometry kind`);
  if (geometry.kind === "path") {
    assert.match(geometry.d, /^[MmZzLlHhVvCcSsQqTtAa0-9.,+\-\s]+$/, `${id} path must contain SVG geometry only`);
    assert.doesNotMatch(geometry.d, /<|>|https?:|url\(|script|[A-Za-z]{2,}/i, `${id} path must not contain markup or text`);
  }
  for (const value of Object.values(geometry)) {
    if (typeof value === "number") assert.equal(Number.isFinite(value), true, `${id} geometry number must be finite`);
  }
}

test("T-092 registry contains one reviewed id per contact/certification concept", () => {
  assert.deepEqual([...iconIds], [...expectedIds]);
  assert.deepEqual(Object.keys(iconRegistry), [...expectedIds]);
  assert.deepEqual(Object.values(iconConcepts).sort(), [...expectedIds].sort());
  assert.equal(new Set(Object.values(iconRegistry).map((icon) => icon.semantic)).size, expectedIds.length);
});

test("every icon carries geometry, source, license, and the 16/20/24 sizing contract", () => {
  for (const id of iconIds) {
    const icon = iconDefinitionFor(id);
    assert.equal(icon.viewBox, "0 0 24 24");
    assert.deepEqual(icon.allowedSizes, [16, 20, 24]);
    assert.ok(icon.defaultSize === 16 || icon.defaultSize === 20 || icon.defaultSize === 24);
    assert.ok(icon.semantic.length > 0);
    assert.ok(icon.source.length > 0);
    assert.ok(icon.license.name.length > 0);
    assert.ok(icon.license.attribution.length > 0);
    assert.ok(icon.paths.length > 0);
    icon.paths.forEach((geometry) => assertGeometry(geometry, id));
  }
});

test("Lucide-sourced icons keep the ISC provenance and exact Lucide geometry", () => {
  const mail = iconDefinitionFor("contact-email");
  assert.equal(mail.source, "lucide-react@0.511.0");
  assert.equal(mail.license.name, "ISC");
  assert.equal(mail.license.url, "https://github.com/lucide-icons/lucide/blob/main/LICENSE");
  assert.deepEqual(mail.paths, [
    { kind: "path", d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" },
    { kind: "rect", x: 2, y: 4, width: 20, height: 16, rx: 2 },
  ]);
  for (const id of ["contact-phone", "contact-address", "contact-submit", "cert-status-valid", "cert-status-pending", "cert-status-expired"] as const) {
    assert.equal(iconDefinitionFor(id).license.name, "ISC", `${id} must retain Lucide's ISC license`);
  }
});

test("self-drawn certification icons carry SiteCraft provenance rather than a copied reference", () => {
  for (const id of ["cert-certificate", "cert-inspection-report", "cert-export-qualification"] as const) {
    const icon = iconDefinitionFor(id);
    assert.equal(icon.source, "SiteCraft original");
    assert.equal(icon.license.name, "SiteCraft original");
    assert.equal(icon.license.url, null);
    assert.equal(icon.selfDrawn, true);
  }
});

test("unregistered ids are rejected before a consumer can render them", () => {
  assert.throws(() => iconDefinitionFor("contact-fax"), /未登记图标|unknown icon/i);
  assert.throws(() => iconDefinitionFor("<svg>"), /未登记图标|unknown icon/i);
});

test("the icon spec records the Cursor-derived geometry rules", () => {
  assert.deepEqual(ICON_SET_SPEC.grid, [24, 24]);
  assert.deepEqual(ICON_SET_SPEC.allowedSizes, [16, 20, 24]);
  assert.equal(ICON_SET_SPEC.defaultStrokeWidth, 1.75);
  assert.equal(ICON_SET_SPEC.defaultLineCap, "round");
  assert.equal(ICON_SET_SPEC.engineeringLineCap, "square");
  assert.equal(ICON_SET_SPEC.minOpticalGap, 3);
  assert.equal(ICON_SET_SPEC.oneConceptOneIcon, true);
});
