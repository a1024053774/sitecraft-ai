import type { SlotApplyReport, TemplateAdapter } from "./types.ts";

export const PREVIEW_BRIDGE_NONCE = "sitecraft-template-bridge";

/**
 * Browser/iframe runtime. Keep this body as plain JavaScript: it is stringified
 * into the preview document and also executed by tests.
 */
export const PREVIEW_BRIDGE_SOURCE = String.raw`
function sitecraftPreviewBridge(templateId, adapter) {
  var global = this || (typeof window !== "undefined" ? window : globalThis);
  var document = global.document;
  var parent = global.parent || global;

  function asList(result) {
    return Array.prototype.slice.call(result || []);
  }

  function uniqueNode(selector) {
    if (!selector || !document || !document.querySelectorAll) return null;
    var nodes;
    try {
      nodes = asList(document.querySelectorAll(selector));
    } catch (error) {
      return null;
    }
    return nodes.length === 1 ? nodes[0] : null;
  }

  function isRequestedTarget(target) {
    return typeof target === "string" && target.length > 0;
  }

  function stripLocale(target) {
    return String(target || "").replace(/\.(zh|en)$/, "");
  }

  function localize(value, locale) {
    if (value == null) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "object" && typeof value[locale] === "string") return value[locale];
    return undefined;
  }

  function readDraftValue(draft, target, locale) {
    if (!draft) return undefined;
    var content = draft.content || {};
    var hero = content.hero || {};
    var about = content.about || {};
    var features = content.features || {};
    var services = content.services || {};
    var products = content.products || {};
    var contact = content.contact || {};
    var table = {
      siteName: draft.siteName,
      companyName: draft.companyName,
      "hero.title": hero.title,
      "hero.subtitle": hero.subtitle,
      "hero.cta": hero.cta,
      "about.title": about.title,
      "about.body": about.body,
      "features.title": features.title,
      "features.intro": features.intro,
      "services.title": services.title,
      "services.intro": services.intro,
      "products.title": products.title,
      "products.intro": products.intro,
      "contact.title": contact.title,
      "contact.body": contact.body,
      "contact.email": contact.email,
      "contact.phone": contact.phone,
      "contact.address": contact.address
    };
    if (Object.prototype.hasOwnProperty.call(table, target)) {
      return localize(table[target], locale);
    }
    var itemMatch = /^(features|services)\.items\.(\d+)\.(title|body)$/.exec(target);
    if (itemMatch) {
      var section = content[itemMatch[1]] || {};
      var items = section.items || [];
      var item = items[Number(itemMatch[2])];
      if (!item) return undefined;
      return localize(item[itemMatch[3]], locale);
    }
    var productMatch = /^products\.([^.]+)\.(name|summary)$/.exec(target);
    if (productMatch) {
      var list = draft.products || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].sku === productMatch[1]) {
          return localize(list[i][productMatch[2]], locale);
        }
      }
    }
    return undefined;
  }

  function selectUiTarget(slotKey) {
    var base = stripLocale(slotKey);
    if (base === "hero.title") return "heroTitle";
    if (base === "hero.subtitle") return "heroSubtitle";
    if (base === "hero.cta") return "primaryCta";
    if (base === "companyName" || base === "siteName") return "brand";
    if (base === "about" || base.indexOf("about.") === 0) return "about";
    if (base === "features" || base.indexOf("features.") === 0) return "features";
    if (base === "services" || base.indexOf("services.") === 0) return "services";
    if (base === "products" || base.indexOf("products.") === 0) return "products";
    if (base === "contact" || base.indexOf("contact.") === 0) return "contact";
    return null;
  }

  function writeSlot(node, slot, value, locale, applied) {
    if (!node || typeof value !== "string") return false;
    var appliedKey = slot.target + "." + locale;
    if (slot.attr === "src") {
      if (node.setAttribute) node.setAttribute("src", value);
      else node.src = value;
    } else {
      node.textContent = value;
      if (slot.target === "contact.email" && node.getAttribute && node.setAttribute) {
        var href = node.getAttribute("href") || "";
        if (/^mailto:/i.test(href)) node.setAttribute("href", "mailto:" + value);
      }
    }
    if (node.dataset) node.dataset.sitecraftSlot = appliedKey;
    else if (node.setAttribute) node.setAttribute("data-sitecraft-slot", appliedKey);
    applied.add(appliedKey);
    return true;
  }

  function proposedFor(adapterObj, requested) {
    if (!adapterObj || !adapterObj.alternatives) return null;
    var semantic = stripLocale(requested);
    return adapterObj.alternatives[semantic] || adapterObj.alternatives[requested] || null;
  }

  function report(applied, expected, adapterObj) {
    var appliedSlots = Array.from(applied);
    var missingSlots = expected.filter(function (target) {
      return appliedSlots.indexOf(target) === -1;
    });
    var proposedAlternatives = [];
    for (var i = 0; i < missingSlots.length; i++) {
      var requested = missingSlots[i];
      var proposed = proposedFor(adapterObj, requested);
      if (proposed && appliedSlots.some(function (slot) {
        return slot === proposed || slot.indexOf(proposed + ".") === 0;
      })) proposedAlternatives.push({ requested: requested, proposed: proposed });
    }
    return {
      appliedSlots: appliedSlots,
      missingSlots: missingSlots,
      fallbackMatched: [],
      proposedAlternatives: proposedAlternatives
    };
  }

  function visibilityNode(spec) {
    var node = uniqueNode(spec && spec.selector);
    if (!node) return null;
    if (spec.root === "section") {
      return node.closest ? node.closest("section") : null;
    }
    return node;
  }

  function setSectionHidden(node, key, hidden) {
    node.hidden = hidden;
    if (node.style && node.style.setProperty) {
      if (hidden) node.style.setProperty("display", "none", "important");
      else if (node.style.removeProperty) node.style.removeProperty("display");
      else node.style.setProperty("display", "");
    }
    if (node.setAttribute) node.setAttribute("data-sitecraft-section", key);
    if (hidden) {
      if (node.setAttribute) node.setAttribute("data-sitecraft-section-hidden", "true");
    } else if (node.removeAttribute) {
      node.removeAttribute("data-sitecraft-section-hidden");
    } else if (node.setAttribute) {
      node.setAttribute("data-sitecraft-section-hidden", "false");
    }
  }

  function applySectionVisibility(draft, applied) {
    var specs = adapter && adapter.sections ? adapter.sections : [];
    var hidden = draft && Array.isArray(draft.hiddenSections) ? draft.hiddenSections : [];
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      if (!spec || !spec.key || !spec.selector) continue;
      var node = visibilityNode(spec);
      if (!node) continue;
      setSectionHidden(node, spec.key, hidden.indexOf(spec.key) !== -1);
      applied.add(spec.key + ".visibility");
    }
  }

  function hideSectionByHeading(pattern) {
    var headings = asList(document.querySelectorAll("h1,h2,h3"));
    for (var i = 0; i < headings.length; i++) {
      var heading = headings[i];
      if (!pattern.test(heading.textContent || "")) continue;
      var scope = heading.closest ? heading.closest("section, article") : heading.parentElement;
      if (!scope) scope = heading;
      scope.hidden = true;
      if (scope.style && scope.style.setProperty) scope.style.setProperty("display", "none", "important");
    }
  }

  function hideLeafMatches(pattern) {
    var nodes = asList(document.querySelectorAll("body *"));
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.children && node.children.length) continue;
      if (!pattern.test((node.textContent || "").trim())) continue;
      var scope = node.closest ? node.closest("li, blockquote") || node : node;
      scope.hidden = true;
      if (scope.style && scope.style.setProperty) scope.style.setProperty("display", "none", "important");
    }
  }

  function sanitizePublished() {
    if (!adapter || !adapter.sanitize) return;
    var sections = adapter.sanitize.sections || [];
    for (var i = 0; i < sections.length; i++) hideSectionByHeading(new RegExp(sections[i], "i"));
    var leaves = adapter.sanitize.leafPatterns || [];
    for (var j = 0; j < leaves.length; j++) hideLeafMatches(new RegExp(leaves[j], "i"));
  }

  function applyActivePage(draft, activePage) {
    var current = activePage || {};
    if (current.placement === "route") return;
    if (!current.section || current.role === "home" || current.id === "home") return;
    var specs = adapter && adapter.sections ? adapter.sections : [];
    var planPages = draft && draft.pagePlan && Array.isArray(draft.pagePlan.pages) ? draft.pagePlan.pages : [];
    var familyHidden = draft && Array.isArray(draft.hiddenSections) ? draft.hiddenSections : [];
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      if (!spec || !spec.key) continue;
      if (familyHidden.indexOf(spec.key) !== -1) continue;
      var node = visibilityNode(spec);
      if (!node) continue;
      var owners = [];
      for (var p = 0; p < planPages.length; p++) {
        if (planPages[p] && planPages[p].placement === "section" && planPages[p].section === spec.key) owners.push(planPages[p]);
      }
      var belongsToOther = false;
      for (var o = 0; o < owners.length; o++) {
        if (owners[o].id !== current.id) belongsToOther = true;
      }
      if (belongsToOther) {
        setSectionHidden(node, spec.key, true);
        if (node.setAttribute) node.setAttribute("data-sitecraft-page-hidden", "true");
      }
    }
    for (var s = 0; s < specs.length; s++) {
      if (specs[s] && specs[s].key === current.section) {
        var target = visibilityNode(specs[s]);
        if (target && target.scrollIntoView) target.scrollIntoView();
        break;
      }
    }
  }

  function applyDeclaredContent(draft, locale, expectedTargets, variant, activePage) {
    var applied = new Set();
    var currentLocale = locale || "zh";
    var expected = Array.isArray(expectedTargets) ? expectedTargets.filter(isRequestedTarget) : [];
    if (document && document.documentElement) {
      document.documentElement.lang = currentLocale;
      if (document.documentElement.dataset) {
        document.documentElement.dataset.sitecraftTemplate = templateId;
        document.documentElement.dataset.sitecraftVariant = variant || "preview";
        document.documentElement.dataset.sitecraftActivePage = (activePage && activePage.id) || "";
        document.documentElement.dataset.sitecraftPagePlacement = (activePage && activePage.placement) || "";
      }
    }
    if (adapter && draft) {
      var slots = adapter.slots || [];
      for (var s = 0; s < slots.length; s++) {
        var slot = slots[s];
        if (!slot || !slot.selector || !slot.target) continue;
        var value = readDraftValue(draft, slot.target, currentLocale);
        var node = uniqueNode(slot.selector);
        if (!node) continue;
        writeSlot(node, slot, value, currentLocale, applied);
      }
      applySectionVisibility(draft, applied);
      applyActivePage(draft, activePage);
      if (variant === "published") sanitizePublished();
    }
    return report(applied, expected, adapter);
  }

  function onMessage(event) {
    var data = event && event.data;
    if (event && event.source && event.source !== parent) return;
    if (!data || data.type !== "sitecraft:content" || data.templateId !== templateId) return;
    var run = function () {
      var reportPayload = applyDeclaredContent(data.draft, data.locale, data.expectedTargets, data.variant, data.activePage);
      if (parent && parent.postMessage) {
        parent.postMessage({
          type: "sitecraft:applied",
          templateId: templateId,
          revision: data.draft && data.draft.revision,
          appliedSlots: reportPayload.appliedSlots,
          missingSlots: reportPayload.missingSlots,
          fallbackMatched: reportPayload.fallbackMatched,
          proposedAlternatives: reportPayload.proposedAlternatives
        }, "*");
      }
    };
    if (global.requestAnimationFrame) {
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(run);
      });
    } else {
      run();
    }
  }

  function onClick(event) {
    var variant = document.documentElement && document.documentElement.dataset
      ? document.documentElement.dataset.sitecraftVariant
      : "";
    if (variant === "published") return;
    var rawTarget = event && event.target;
    var node = rawTarget && rawTarget.closest ? rawTarget.closest("[data-sitecraft-slot]") : null;
    if (!node) return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    var slot = (node.dataset && node.dataset.sitecraftSlot) || (node.getAttribute && node.getAttribute("data-sitecraft-slot")) || "";
    var uiTarget = selectUiTarget(slot);
    if (!uiTarget) return;
    if (parent && parent.postMessage) {
      parent.postMessage({ type: "sitecraft:select", target: uiTarget, slot: slot }, "*");
    }
  }

  if (global.addEventListener) global.addEventListener("message", onMessage);
  if (document && document.addEventListener) document.addEventListener("click", onClick, true);
  if (parent && parent.postMessage) parent.postMessage({ type: "sitecraft:ready", templateId: templateId }, "*");
  global.__sitecraftApplyDeclared = applyDeclaredContent;
  return { applyDeclaredContent: applyDeclaredContent };
}
`.trim();

export function stripHtmlScripts(html: string) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

export function buildPreviewBridgeScript(
  templateId: string,
  adapter: TemplateAdapter | null,
  nonce = PREVIEW_BRIDGE_NONCE,
) {
  return `<script nonce="${nonce}">(${PREVIEW_BRIDGE_SOURCE}).call(window, ${JSON.stringify(templateId)}, ${JSON.stringify(adapter)});</script>`;
}

export function installPreviewBridge(
  globalObject: object,
  templateId: string,
  adapter: TemplateAdapter | null,
) {
  const runner = new Function(
    "globalObject",
    "templateId",
    "adapter",
    `${PREVIEW_BRIDGE_SOURCE}\nreturn sitecraftPreviewBridge.call(globalObject, templateId, adapter);`,
  );
  return runner(globalObject, templateId, adapter) as {
    applyDeclaredContent: (
      draft: unknown,
      locale: string,
      expectedTargets?: string[],
      variant?: string,
      activePage?: { id?: string; role?: string; placement?: string; section?: string },
    ) => SlotApplyReport;
  };
}
