import type { SlotApplyReport, TemplateAdapter } from "./types.ts";
import { siteStyleCss } from "../blocks/site-style.ts";

export const PREVIEW_BRIDGE_NONCE = "sitecraft-template-bridge";
const SITE_STYLE_CSS_SOURCE = `(${siteStyleCss.toString()})`;

/**
 * Browser/iframe runtime. Keep this body as plain JavaScript: it is stringified
 * into the preview document and also executed by tests.
 */
export const PREVIEW_BRIDGE_SOURCE = String.raw`
function sitecraftPreviewBridge(templateId, adapter) {
  var global = this || (typeof window !== "undefined" ? window : globalThis);
  var document = global.document;
  var parent = global.parent || global;
  var siteStyleCss = ${SITE_STYLE_CSS_SOURCE};

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

  function stableProductIdentity(product) {
    return product && typeof product.id === "string" && product.id ? product.id : null;
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

  function specValueText(value, locale) {
    return typeof value === "string" ? value : localize(value, locale) || "";
  }

  function longestRunEm(value) {
    var text = String(value || "").trim();
    var runs = text.split(/[\s，、。；：！？]+/).filter(Boolean);
    var width = function (run) {
      return Array.from(run).reduce(function (sum, char) {
        if (/[\u3400-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) return sum + 1;
        if (/[A-Za-z0-9]/.test(char)) return sum + 0.6;
        return sum + 0.4;
      }, 0);
    };
    return Math.max(1, ...runs.map(width)).toFixed(2);
  }

  function fitTextEnabled() {
    return Boolean(adapter && adapter.blocks && adapter.blocks.fitText === "container");
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
      "hero.image": hero.image && hero.image.url,
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
      "contact.address": contact.address,
      "faq.title": (content.faq || {}).title,
      "faq.intro": (content.faq || {}).intro,
      industry: draft.industry,
      "navigation.about": draft.navigation && draft.navigation.about,
      "navigation.features": draft.navigation && draft.navigation.features,
      "navigation.services": draft.navigation && draft.navigation.services,
      "navigation.products": draft.navigation && draft.navigation.products,
      "navigation.contact": draft.navigation && draft.navigation.contact
    };
    if (Object.prototype.hasOwnProperty.call(table, target)) {
      return localize(table[target], locale);
    }
    var itemMatch = /^(features|services|faq)\.items\.([^.]+)\.(title|body)$/.exec(target);
    if (itemMatch) {
      var section = content[itemMatch[1]] || {};
      var items = section.items || [];
      var item = null;
      for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        if (items[itemIndex] && items[itemIndex].id === itemMatch[2]) { item = items[itemIndex]; break; }
      }
      if (!item) return undefined;
      return localize(item[itemMatch[3]], locale);
    }
    var productMatch = /^products\.([^.]+)\.(name|summary|image)$/.exec(target);
    if (productMatch) {
      var list = draft.products || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && stableProductIdentity(list[i], i) === productMatch[1]) {
          if (productMatch[2] === "image") {
            return list[i].image && typeof list[i].image.url === "string" ? list[i].image.url : undefined;
          }
          return localize(list[i][productMatch[2]], locale);
        }
      }
    }
    var catalogMatch = /^(industries|capabilities|certifications)\.(title|intro)$/.exec(target);
    if (catalogMatch) {
      var catalog = content[catalogMatch[1]] || {};
      return localize(catalog[catalogMatch[2]], locale);
    }
    var catalogItemMatch = /^(industries|capabilities|certifications)\.items\.(\d+)\.(title|body|status)$/.exec(target);
    if (catalogItemMatch) {
      var catalogSection = content[catalogItemMatch[1]] || {};
      var catalogItems = catalogSection.items || [];
      var catalogItem = catalogItems[Number(catalogItemMatch[2])];
      if (!catalogItem) return undefined;
      if (catalogItemMatch[3] === "status") return catalogItem.status;
      return localize(catalogItem[catalogItemMatch[3]], locale);
    }
    return undefined;
  }

  function renderProductGrid(draft, locale, applied, variant) {
    var grid = uniqueNode('[data-sitecraft-product-grid]');
    if (!grid || !document || !document.createElement) return;
    // The collection root is a declared host capability. Individual cards
    // report their own product targets below, while this marker confirms that
    // replace_products rendered the collection itself.
    applied.add("products");
    grid.textContent = "";
    var products = draft && Array.isArray(draft.products) ? draft.products : [];
    var visible = products.filter(function (product) {
      if (!product || product.status === "archived") return false;
      return !(isGapMarker(localize(product.name, locale) || "") && isGapMarker(localize(product.summary, locale) || ""));
    });
    if (!visible.length) {
      // Visitors never see an empty shell (hideEmptyProductSection hides the block); the workspace keeps a hint.
      if (variant === "workspace") {
        var empty = document.createElement("p");
        empty.className = "sitecraft-product-empty";
        empty.textContent = locale === "en" ? "Product information to be completed." : "产品资料待补充。";
        grid.appendChild(empty);
      }
      return;
    }
    var cardSpec = adapter && adapter.kit && adapter.kit.productCard;
    var layout = blockRender("products");
    if (layout && layout.products === "compare") {
      renderCompare(grid, visible, locale, applied, layout);
      return;
    }
    if (layout && layout.products === "grouped") {
      renderGrouped(grid, visible, locale, applied, layout);
      return;
    }
    if (layout && layout.products === "index") {
      renderIndex(grid, visible, locale, applied, layout);
      return;
    }
    if (layout && (layout.products === "cards" || layout.products === "rows")) cardSpec = layout;
    if (cardSpec) {
      for (var c = 0; c < visible.length; c++) renderCatalogCard(grid, visible[c], c, locale, applied, cardSpec);
      return;
    }
    var hasProductImage = visible.some(function (product) {
      return product && product.image && typeof product.image.url === "string" && product.image.url;
    });
    for (var i = 0; i < visible.length; i++) {
      var product = visible[i];
      var productId = stableProductIdentity(product);
      if (!productId) continue;
      var sku = typeof product.sku === "string" ? product.sku : "product-" + i;
      var productName = localize(product.name, locale) || "";
      var productSummary = localize(product.summary, locale) || "";
      if (isGapMarker(productName) && isGapMarker(productSummary)) continue;
      var card = document.createElement("article");
      card.className = "sitecraft-product-card";
      card.setAttribute("data-sitecraft-product", sku);
      if (product.image && typeof product.image.url === "string" && product.image.url) {
        var image = document.createElement("img");
        image.className = "sitecraft-product-image";
        image.src = product.image.url;
        image.setAttribute("src", product.image.url);
        image.alt = localize(product.image.alt, locale) || (locale === "en" ? "Product photo" : "产品图");
        image.setAttribute("data-sitecraft-slot", "products." + productId + ".image");
        card.appendChild(image);
        applied.add("products." + productId + ".image");
        var creditText = localize(product.image.credit, locale) || "";
        if (creditText) {
          var credit = document.createElement("p");
          credit.className = "sitecraft-product-image-credit";
          credit.textContent = creditText;
          credit.setAttribute("data-sitecraft-slot", "products." + productId + ".image.credit");
          card.appendChild(credit);
          applied.add("products." + productId + ".image.credit");
        }
      } else {
        var placeholder = document.createElement("div");
        placeholder.className = "sitecraft-product-image-placeholder sitecraft-product-schematic";
        placeholder.setAttribute("role", "img");
        placeholder.setAttribute("aria-label", locale === "en" ? "Schematic" : "示意");
        var schematicMark = document.createElement("span");
        schematicMark.className = "sitecraft-product-schematic-mark";
        schematicMark.setAttribute("aria-hidden", "true");
        var schematicLabel = document.createElement("span");
        schematicLabel.className = "sitecraft-product-schematic-label";
        schematicLabel.textContent = locale === "en" ? "Schematic" : "示意";
        placeholder.appendChild(schematicMark);
        placeholder.appendChild(schematicLabel);
        card.appendChild(placeholder);
        if (hasProductImage) {
          // Keep prior missing-photo marker when the catalog already has at least one real photo.
          placeholder.className += " sitecraft-product-image-missing";
        }
      }
      var category = document.createElement("p");
      category.className = "sitecraft-product-category";
      category.textContent = localize(product.category, locale) ||
        (locale === "en" ? "Product category" : "产品类别");
      category.setAttribute("data-sitecraft-slot", "products." + productId + ".category");
      var title = document.createElement("h3");
      title.textContent = productName || (locale === "en" ? "Product name to be completed" : "产品名称待补充");
      title.setAttribute("data-sitecraft-slot", "products." + productId + ".name." + locale);
      var summary = document.createElement("p");
      summary.textContent = productSummary || (locale === "en" ? "Product description to be completed." : "产品说明待补充。");
      summary.setAttribute("data-sitecraft-slot", "products." + productId + ".summary." + locale);
      card.appendChild(category);
      card.appendChild(title);
      card.appendChild(summary);
      var specs = Array.isArray(product.specs) ? product.specs : [];
      var visibleSpecs = [];
      for (var s = 0; s < specs.length; s++) {
        var specItem = specs[s];
        if (!specItem) continue;
        var specName = localize(specItem.name, locale) || "";
        var specValue = specValueText(specItem.value, locale);
        if (isGapMarker(specName) && isGapMarker(specValue)) continue;
        visibleSpecs.push({ name: specName, value: specValue });
      }
      if (visibleSpecs.length) {
        var table = document.createElement("table");
        table.className = "sitecraft-product-specs";
        table.setAttribute("data-sitecraft-slot", "products." + productId + ".specs");
        var tbody = document.createElement("tbody");
        for (var si = 0; si < visibleSpecs.length; si++) {
          var row = document.createElement("tr");
          var th = document.createElement("th");
          th.scope = "row";
          th.textContent = visibleSpecs[si].name || (locale === "en" ? "Parameter" : "参数");
          var td = document.createElement("td");
          td.textContent = visibleSpecs[si].value || (locale === "en" ? "To be provided" : "待补充");
          row.appendChild(th);
          row.appendChild(td);
          tbody.appendChild(row);
        }
        table.appendChild(tbody);
        card.appendChild(table);
        applied.add("products." + productId + ".specs");
      }
      grid.appendChild(card);
      applied.add("products." + productId + ".category");
      applied.add("products." + productId + ".name." + locale);
      applied.add("products." + productId + ".summary." + locale);
    }
  }

  // Catalog-book card: photo (only a real one), series, name, the key specs, a short line, the
  // full spec list folded away, then credit and a per-series inquiry link on their own lines.
  // cardSpec options for the grouped layout: showCategory false (the group already names it),
  // titleTag "h4" (the group title is the h3), hideGapSpecs (spec rows without a value are left out).
  function renderCatalogCard(grid, product, index, locale, applied, cardSpec) {
    var productId = stableProductIdentity(product);
    if (!productId) return;
    var sku = typeof product.sku === "string" ? product.sku : "product-" + index;
    var productName = localize(product.name, locale) || "";
    var productSummary = localize(product.summary, locale) || "";
    if (isGapMarker(productName) && isGapMarker(productSummary)) return;
    var card = document.createElement("article");
    card.className = "sitecraft-product-card";
    card.setAttribute("data-sitecraft-product", sku);
    var hasPhoto = product.image && typeof product.image.url === "string" && product.image.url;
    card.setAttribute("data-sitecraft-product-photo", hasPhoto ? "true" : "false");
    if (hasPhoto) {
      var media = document.createElement("div");
      media.className = "sitecraft-product-media";
      var image = document.createElement("img");
      image.className = "sitecraft-product-image";
      image.src = product.image.url;
      image.setAttribute("src", product.image.url);
      image.alt = localize(product.image.alt, locale) || productName;
      image.setAttribute("data-sitecraft-slot", "products." + productId + ".image");
      media.appendChild(image);
      card.appendChild(media);
      applied.add("products." + productId + ".image");
    }
    var body = document.createElement("div");
    body.className = "sitecraft-product-body";
    var productCategory = localize(product.category, locale) || "";
    if (cardSpec.showCategory !== false && productCategory && productCategory !== productName) {
      var category = document.createElement("p");
      category.className = "sitecraft-product-category";
      category.textContent = productCategory;
      category.setAttribute("data-sitecraft-slot", "products." + productId + ".category");
      body.appendChild(category);
      applied.add("products." + productId + ".category");
    }
    var title = document.createElement(cardSpec.titleTag || "h3");
    title.textContent = productName;
    title.setAttribute("data-sitecraft-slot", "products." + productId + ".name." + locale);
    body.appendChild(title);
    applied.add("products." + productId + ".name." + locale);
    var specs = visibleSpecs(product, locale);
    if (cardSpec.hideGapSpecs) specs = specs.filter(function (spec) { return !isGapMarker(spec.name) && !isGapMarker(spec.value); });
    var keys = specs.filter(function (spec) { return !isGapMarker(spec.value); }).slice(0, cardSpec.keySpecs || 3);
    if (keys.length) {
      var dl = document.createElement("dl");
      dl.className = "sitecraft-product-keys";
      renderFacts(dl, keys.map(function (spec) { return { label: spec.name, value: spec.value }; }), "sitecraft-product-key");
      body.appendChild(dl);
    }
    if (!isGapMarker(productSummary)) {
      var summary = document.createElement("p");
      summary.className = "sitecraft-product-summary";
      summary.textContent = productSummary;
      summary.setAttribute("data-sitecraft-slot", "products." + productId + ".summary." + locale);
      body.appendChild(summary);
      applied.add("products." + productId + ".summary." + locale);
    }
    if (specs.length > keys.length || (!cardSpec.collapseSpecs && specs.length)) {
      var table = document.createElement("table");
      table.className = "sitecraft-product-specs";
      table.setAttribute("data-sitecraft-slot", "products." + productId + ".specs");
      var tbody = document.createElement("tbody");
      for (var si = 0; si < specs.length; si++) {
        var row = document.createElement("tr");
        var th = document.createElement("th");
        th.scope = "row";
        th.textContent = specs[si].name;
        var td = document.createElement("td");
        setValueText(td, specs[si].value || (locale === "en" ? "To be provided" : "待补充"));
        row.appendChild(th);
        row.appendChild(td);
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      if (cardSpec.collapseSpecs) {
        var more = document.createElement("details");
        more.className = "sitecraft-product-more";
        var toggle = document.createElement("summary");
        toggle.textContent = (locale === "en" ? "All specifications (" : "全部参数（") + specs.length + (locale === "en" ? ")" : " 项）");
        more.appendChild(toggle);
        more.appendChild(table);
        body.appendChild(more);
      } else {
        body.appendChild(table);
      }
      applied.add("products." + productId + ".specs");
    }
    var foot = document.createElement("div");
    foot.className = "sitecraft-product-foot";
    var ask = document.createElement("a");
    ask.className = "sitecraft-product-ask";
    ask.setAttribute("href", cardSpec.askHref || "#inquiry");
    ask.textContent = locale === "en" ? "Ask about this series" : "询这款规格";
    foot.appendChild(ask);
    var creditText = hasPhoto ? (localize(product.image.credit, locale) || "") : "";
    if (creditText) {
      var credit = document.createElement("p");
      credit.className = "sitecraft-product-image-credit";
      credit.textContent = creditText;
      credit.setAttribute("data-sitecraft-slot", "products." + productId + ".image.credit");
      foot.appendChild(credit);
      applied.add("products." + productId + ".image.credit");
    }
    body.appendChild(foot);
    card.appendChild(body);
    grid.appendChild(card);
  }

  // Render parameters of the variant a block shows (from the block catalog). Without an entity on
  // the page (hand-built fragments) the look's default variant applies; other looks have none.
  function blockRender(block) {
    var blocks = adapter && adapter.blocks;
    if (!blocks || !blocks.render || !blocks.render[block]) return null;
    var entity = uniqueNode('[data-sc-block="' + block + '"]');
    var variant = entity && entity.getAttribute ? entity.getAttribute("data-sc-variant") : (blocks.defaults && blocks.defaults[block]);
    return blocks.render[block][variant] || null;
  }

  // Specs with a real name and value, keyed by the Chinese name so series can be matched on the
  // English page too. The comparison and grouped layouts never show a gap in a spec cell.
  function valuedSpecs(product, locale) {
    var specs = product && Array.isArray(product.specs) ? product.specs : [];
    var list = [];
    for (var s = 0; s < specs.length; s++) {
      var item = specs[s];
      if (!item) continue;
      var name = localize(item.name, locale) || "";
      var value = specValueText(item.value, locale).trim();
      var key = (item.name && typeof item.name === "object" ? item.name.zh : item.name) || name;
      key = String(key || "").trim();
      if (isGapMarker(key) || isGapMarker(name) || isGapMarker(value)) continue;
      list.push({ key: key, name: name, value: value });
    }
    return list;
  }

  function askLink(href, locale) {
    var ask = document.createElement("a");
    ask.className = "sitecraft-product-ask";
    ask.setAttribute("href", href || "#inquiry");
    ask.textContent = locale === "en" ? "Ask about this series" : "询这款规格";
    return ask;
  }

  // 按类别分组: products in first-seen category order, each category heading its own cards; products
  // without a category go last under a plain label.
  function renderGrouped(grid, products, locale, applied, layout) {
    var groups = [];
    var byLabel = {};
    var other = null;
    for (var i = 0; i < products.length; i++) {
      var label = String(localize(products[i].category, locale) || "").trim();
      if (isGapMarker(label)) {
        if (!other) other = { label: "", items: [] };
        other.items.push({ product: products[i], index: i });
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(byLabel, label)) {
        byLabel[label] = { label: label, items: [] };
        groups.push(byLabel[label]);
      }
      byLabel[label].items.push({ product: products[i], index: i });
    }
    if (other) groups.push(other);
    var cardSpec = { keySpecs: layout.keySpecs || 3, collapseSpecs: layout.collapseSpecs !== false, askHref: layout.askHref || "#inquiry", showCategory: false, titleTag: "h4", hideGapSpecs: true };
    for (var g = 0; g < groups.length; g++) {
      var group = document.createElement("div");
      group.className = "sitecraft-product-group";
      var heading = document.createElement("h3");
      heading.className = "sitecraft-product-group-title";
      heading.textContent = groups[g].label || (locale === "en" ? "Other products" : "其他产品");
      var cards = document.createElement("div");
      cards.className = "sitecraft-product-group-cards";
      group.appendChild(heading);
      group.appendChild(cards);
      for (var c = 0; c < groups[g].items.length; c++) renderCatalogCard(cards, groups[g].items[c].product, groups[g].items[c].index, locale, applied, cardSpec);
      grid.appendChild(group);
    }
  }

  // 型号索引表: one row per product — name with its category, then that
  // product's own first valued specs (each cell names its spec, so rows need not share any), then
  // the inquiry link. The summary and the specs after those sit in a folded band under the row that
  // spans its whole width, so the ledger stays tight and no material fact is left off the page. Each
  // product is one <tbody> that carries the specs target; the row cells and the band are inside it.
  // On phones each row stacks and the specs read as name/value lines.
  function renderIndex(grid, products, locale, applied, layout) {
    var limit = layout.keySpecs || 3;
    var rows = [];
    var columns = 0;
    for (var i = 0; i < products.length; i++) {
      var productId = stableProductIdentity(products[i]);
      if (!productId) continue;
      var specs = valuedSpecs(products[i], locale).slice(0, limit);
      if (specs.length > columns) columns = specs.length;
      rows.push({ product: products[i], id: productId, specs: specs, index: i });
    }
    if (!rows.length) return;
    var table = document.createElement("table");
    table.className = "sitecraft-index-table";
    table.setAttribute("data-sc-cols", String(columns));
    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    var nameHead = document.createElement("th");
    nameHead.setAttribute("scope", "col");
    nameHead.className = "sitecraft-index-name-col";
    nameHead.textContent = locale === "en" ? "Product" : "产品";
    headRow.appendChild(nameHead);
    if (columns) {
      var specHead = document.createElement("th");
      specHead.setAttribute("scope", "col");
      specHead.setAttribute("colspan", String(columns));
      specHead.textContent = locale === "en" ? "Key specifications" : "关键参数";
      headRow.appendChild(specHead);
    }
    var askHead = document.createElement("td");
    askHead.setAttribute("aria-hidden", "true");
    askHead.className = "sitecraft-index-ask-col";
    headRow.appendChild(askHead);
    head.appendChild(headRow);
    table.appendChild(head);
    for (var r = 0; r < rows.length; r++) {
      var product = rows[r].product;
      var id = rows[r].id;
      var sku = typeof product.sku === "string" ? product.sku : "product-" + rows[r].index;
      var productName = localize(product.name, locale) || "";
      var allSpecs = valuedSpecs(product, locale);
      // One row group per product. It is the single node of the product's specs target: the cells of
      // the row and of the detail band sit inside it, so a click on any spec resolves to that target.
      var item = document.createElement("tbody");
      item.className = "sitecraft-index-item";
      if (allSpecs.length) {
        item.setAttribute("data-sitecraft-slot", "products." + id + ".specs");
        applied.add("products." + id + ".specs");
      }
      var tr = document.createElement("tr");
      tr.setAttribute("data-sitecraft-product", sku);
      var nameCell = document.createElement("th");
      nameCell.setAttribute("scope", "row");
      nameCell.className = "sitecraft-index-name";
      var productCategory = localize(product.category, locale) || "";
      if (productCategory && !isGapMarker(productCategory) && productCategory !== productName) {
        var category = document.createElement("p");
        category.className = "sitecraft-product-category";
        category.textContent = productCategory;
        category.setAttribute("data-sitecraft-slot", "products." + id + ".category");
        nameCell.appendChild(category);
        applied.add("products." + id + ".category");
      }
      var title = document.createElement("h3");
      title.textContent = productName;
      title.setAttribute("data-sitecraft-slot", "products." + id + ".name." + locale);
      nameCell.appendChild(title);
      applied.add("products." + id + ".name." + locale);
      tr.appendChild(nameCell);
      for (var c = 0; c < columns; c++) {
        var cell = document.createElement("td");
        cell.className = "sitecraft-index-spec";
        var spec = rows[r].specs[c];
        if (spec) {
          var label = document.createElement("span");
          label.className = "sitecraft-index-spec-label";
          label.textContent = spec.name;
          var value = document.createElement("span");
          value.className = "sitecraft-index-spec-value";
          setValueText(value, spec.value);
          cell.appendChild(label);
          cell.appendChild(value);
        }
        tr.appendChild(cell);
      }
      var askCell = document.createElement("td");
      askCell.className = "sitecraft-index-ask";
      var ask = askLink(layout.askHref, locale);
      ask.setAttribute("aria-label", (locale === "en" ? "Ask about this series: " : "询这款规格：") + productName);
      askCell.appendChild(ask);
      tr.appendChild(askCell);
      item.appendChild(tr);
      // The detail band under the row, folded: the summary and the specs after the ones in the row.
      var productSummary = localize(product.summary, locale) || "";
      var hasSummary = !isGapMarker(productSummary);
      var restSpecs = allSpecs.slice(rows[r].specs.length);
      if (hasSummary || restSpecs.length) {
        var en = locale === "en";
        var detailRow = document.createElement("tr");
        detailRow.className = "sitecraft-index-detail";
        var detailCell = document.createElement("td");
        detailCell.setAttribute("colspan", String(columns + 2));
        var more = document.createElement("details");
        more.className = "sitecraft-index-more";
        var toggle = document.createElement("summary");
        toggle.textContent = restSpecs.length
          ? (hasSummary ? (en ? "Summary and more specifications (" : "简介与其余参数（") : (en ? "More specifications (" : "其余参数（")) + restSpecs.length + (en ? ")" : " 项）")
          : (en ? "Summary" : "简介");
        more.appendChild(toggle);
        var bandBody = document.createElement("div");
        bandBody.className = "sitecraft-index-detail-body";
        if (hasSummary) {
          var summary = document.createElement("p");
          summary.className = "sitecraft-index-summary";
          summary.textContent = productSummary;
          summary.setAttribute("data-sitecraft-slot", "products." + id + ".summary." + locale);
          bandBody.appendChild(summary);
          applied.add("products." + id + ".summary." + locale);
        }
        if (restSpecs.length) {
          var restList = document.createElement("dl");
          restList.className = "sitecraft-index-rest";
          for (var si = 0; si < restSpecs.length; si++) {
            var restItem = document.createElement("div");
            restItem.className = "sitecraft-index-rest-item";
            var restName = document.createElement("dt");
            restName.className = "sitecraft-index-spec-label";
            restName.textContent = restSpecs[si].name;
            var restValue = document.createElement("dd");
            restValue.className = "sitecraft-index-spec-value";
            setValueText(restValue, restSpecs[si].value);
            restItem.appendChild(restName);
            restItem.appendChild(restValue);
            restList.appendChild(restItem);
          }
          bandBody.appendChild(restList);
        }
        more.appendChild(bandBody);
        detailCell.appendChild(more);
        detailRow.appendChild(detailCell);
        item.appendChild(detailRow);
      }
      table.appendChild(item);
    }
    grid.appendChild(table);
  }

  // A folded "other specifications" list: the specs only one series has.
  function extraSpecs(extras, locale, slot) {
    var more = document.createElement("details");
    more.className = "sitecraft-product-more sitecraft-compare-more";
    var toggle = document.createElement("summary");
    toggle.textContent = locale === "en" ? "Other specifications (" + extras.length + ")" : "其他参数（" + extras.length + " 项）";
    var list = document.createElement("dl");
    list.className = "sitecraft-compare-extra";
    if (slot) list.setAttribute("data-sitecraft-slot", slot);
    for (var e = 0; e < extras.length; e++) {
      var row = document.createElement("div");
      var dt = document.createElement("dt");
      dt.textContent = extras[e].name;
      var dd = document.createElement("dd");
      setValueText(dd, extras[e].value);
      row.appendChild(dt);
      row.appendChild(dd);
      list.appendChild(row);
    }
    more.appendChild(toggle);
    more.appendChild(list);
    return more;
  }

  // 参数对比表: a short note per series (name, category, summary, the specs only it has, folded, and
  // an inquiry link), then a table with a row for each spec every series has with a value and a
  // column per series. Each value cell also names its series for the stacked phone layout.
  function renderCompare(grid, products, locale, applied, layout) {
    var specsBySeries = [];
    for (var p = 0; p < products.length; p++) specsBySeries.push(valuedSpecs(products[p], locale));
    var shared = [];
    if (products.length >= 2) {
      for (var f = 0; f < specsBySeries[0].length; f++) {
        var key = specsBySeries[0][f].key;
        var everywhere = true;
        for (var o = 1; o < specsBySeries.length && everywhere; o++) {
          everywhere = specsBySeries[o].some(function (spec) { return spec.key === key; });
        }
        if (everywhere) shared.push(specsBySeries[0][f]);
      }
    }
    var sharedKeys = shared.map(function (spec) { return spec.key; });
    var series = document.createElement("div");
    series.className = "sitecraft-compare-series";
    var names = [];
    var extrasBySeries = [];
    for (var i = 0; i < products.length; i++) {
      var product = products[i];
      var productId = stableProductIdentity(product);
      if (!productId) continue;
      var sku = typeof product.sku === "string" ? product.sku : "product-" + i;
      var productName = localize(product.name, locale) || "";
      var productSummary = localize(product.summary, locale) || "";
      names.push({ id: productId, name: productName });
      var card = document.createElement("article");
      card.className = "sitecraft-compare-series-card";
      card.setAttribute("data-sitecraft-product", sku);
      var productCategory = localize(product.category, locale) || "";
      if (productCategory && !isGapMarker(productCategory) && productCategory !== productName) {
        var category = document.createElement("p");
        category.className = "sitecraft-product-category";
        category.textContent = productCategory;
        category.setAttribute("data-sitecraft-slot", "products." + productId + ".category");
        card.appendChild(category);
        applied.add("products." + productId + ".category");
      }
      var title = document.createElement("h3");
      title.textContent = productName;
      title.setAttribute("data-sitecraft-slot", "products." + productId + ".name." + locale);
      card.appendChild(title);
      applied.add("products." + productId + ".name." + locale);
      if (!isGapMarker(productSummary)) {
        var summary = document.createElement("p");
        summary.className = "sitecraft-compare-summary";
        summary.textContent = productSummary;
        summary.setAttribute("data-sitecraft-slot", "products." + productId + ".summary." + locale);
        card.appendChild(summary);
        applied.add("products." + productId + ".summary." + locale);
      }
      var extras = specsBySeries[i].filter(function (spec) { return sharedKeys.indexOf(spec.key) === -1; });
      extrasBySeries.push(extras);
      // With a table, a product's specs target is its one column header and the other specs sit in
      // the table's last row; without one (nothing shared) they stay in the card, under the target.
      if (extras.length && !shared.length) card.appendChild(extraSpecs(extras, locale, "products." + productId + ".specs"));
      if (extras.length || shared.length) applied.add("products." + productId + ".specs");
      card.appendChild(askLink(layout.askHref, locale));
      series.appendChild(card);
    }
    grid.appendChild(series);
    if (!shared.length) return;
    var table = document.createElement("table");
    table.className = "sitecraft-compare-table";
    var head = document.createElement("thead");
    var headRow = document.createElement("tr");
    var corner = document.createElement("th");
    corner.setAttribute("scope", "col");
    corner.textContent = locale === "en" ? "Specification" : "参数";
    headRow.appendChild(corner);
    for (var n = 0; n < names.length; n++) {
      var column = document.createElement("th");
      column.setAttribute("scope", "col");
      column.id = "sitecraft-compare-" + String(names[n].id).replace(/[^\w-]/g, "-");
      names[n].headerId = column.id;
      column.textContent = names[n].name;
      // The one node of this product's specs target; its cells point at it with headers=.
      column.setAttribute("data-sitecraft-slot", "products." + names[n].id + ".specs");
      headRow.appendChild(column);
    }
    head.appendChild(headRow);
    table.appendChild(head);
    var bodyRows = document.createElement("tbody");
    for (var r = 0; r < shared.length; r++) {
      var tr = document.createElement("tr");
      var th = document.createElement("th");
      th.setAttribute("scope", "row");
      th.textContent = shared[r].name;
      tr.appendChild(th);
      for (var s = 0; s < specsBySeries.length; s++) {
        var match = null;
        for (var m = 0; m < specsBySeries[s].length; m++) {
          if (specsBySeries[s][m].key === shared[r].key) { match = specsBySeries[s][m]; break; }
        }
        var td = document.createElement("td");
        td.setAttribute("headers", names[s].headerId);
        var cellLabel = document.createElement("span");
        cellLabel.className = "sitecraft-compare-label";
        cellLabel.textContent = names[s].name;
        var cellValue = document.createElement("span");
        cellValue.className = "sitecraft-compare-value";
        setValueText(cellValue, match ? match.value : "");
        td.appendChild(cellLabel);
        td.appendChild(cellValue);
        tr.appendChild(td);
      }
      bodyRows.appendChild(tr);
    }
    if (extrasBySeries.some(function (list) { return list.length > 0; })) {
      var extraRow = document.createElement("tr");
      extraRow.className = "sitecraft-compare-extra-row";
      var extraHead = document.createElement("th");
      extraHead.setAttribute("scope", "row");
      extraHead.textContent = locale === "en" ? "Other specifications" : "其他参数";
      extraRow.appendChild(extraHead);
      for (var x = 0; x < names.length; x++) {
        var extraCell = document.createElement("td");
        extraCell.className = "sitecraft-compare-extra-cell";
        extraCell.setAttribute("headers", names[x].headerId);
        if (extrasBySeries[x] && extrasBySeries[x].length) {
          var extraLabel = document.createElement("span");
          extraLabel.className = "sitecraft-compare-label";
          extraLabel.textContent = names[x].name;
          extraCell.appendChild(extraLabel);
          extraCell.appendChild(extraSpecs(extrasBySeries[x], locale, ""));
        }
        extraRow.appendChild(extraCell);
      }
      bodyRows.appendChild(extraRow);
    }
    table.appendChild(bodyRows);
    grid.appendChild(table);
  }

  function renderCatalogSections(draft, locale, applied, variant) {
    var keys = ["industries", "capabilities", "certifications"];
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var sectionNode = uniqueNode('[data-sitecraft-section="' + key + '"]');
      var grid = uniqueNode('[data-sitecraft-catalog-grid="' + key + '"]');
      if (!sectionNode && !grid) continue;
      var section = draft && draft.content ? draft.content[key] : null;
      var items = section && Array.isArray(section.items) ? section.items : [];
      var visibleItems = [];
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item) continue;
        var title = localize(item.title, locale) || "";
        var body = localize(item.body, locale) || "";
        if (isGapMarker(title) && isGapMarker(body)) continue;
        var status = typeof item.status === "string" ? item.status : "";
        if (key === "certifications" && variant === "published" && status === "待补充") continue;
        visibleItems.push({
          index: i,
          id: item.id,
          title: title,
          body: body,
          status: status,
        });
      }
      var draftHidden = draft && Array.isArray(draft.hiddenSections) && draft.hiddenSections.indexOf(key) !== -1;
      var shouldHide = draftHidden || !section || !visibleItems.length;
      if (sectionNode) setSectionHidden(sectionNode, key, shouldHide);
      if (!grid || shouldHide) continue;
      grid.textContent = "";
      applied.add(key);
      for (var v = 0; v < visibleItems.length; v++) {
        var visible = visibleItems[v];
        var itemTarget = visible.id;
        if (!itemTarget) continue;
        var card = document.createElement("article");
        card.className = "sitecraft-catalog-card";
        card.setAttribute("data-sc-part", "item");
        if (visible.id) card.setAttribute("data-sitecraft-catalog-item", String(visible.id));
        var heading = document.createElement("h3");
        heading.textContent = visible.title ? (adapter && adapter.blocks ? emailBreakPoints(visible.title) : visible.title) : (locale === "en" ? "To be provided" : "待补充");
        heading.setAttribute("data-sitecraft-slot", key + ".items." + itemTarget + ".title." + locale);
        var copy = null;
        // Visitors see no "待补充" body, and a certification body that only repeats its status is dropped.
        var repeatsStatus = key === "certifications" && visible.status && (visible.body === visible.status || visible.body === certificationStatusLabel(visible.status, locale));
        var bodyIsGap = isGapMarker(visible.body);
        if (!((bodyIsGap || repeatsStatus) && variant !== "workspace")) {
          copy = document.createElement("p");
          copy.textContent = visible.body ? (adapter && adapter.blocks ? emailBreakPoints(visible.body) : visible.body) : (locale === "en" ? "To be provided" : "待补充");
          copy.setAttribute("data-sitecraft-slot", key + ".items." + itemTarget + ".body." + locale);
        }
        card.appendChild(heading);
        if (key === "certifications" && visible.status) {
          var statusNode = document.createElement("p");
          statusNode.className = "sitecraft-cert-status";
          statusNode.textContent = certificationStatusLabel(visible.status, locale);
          statusNode.setAttribute("data-sitecraft-slot", key + ".items." + itemTarget + ".status");
          card.appendChild(statusNode);
        }
        if (copy) card.appendChild(copy);
        grid.appendChild(card);
        applied.add(key + ".items." + itemTarget + ".title." + locale);
        applied.add(key + ".items." + itemTarget + ".body." + locale);
        if (key === "certifications" && visible.status) applied.add(key + ".items." + itemTarget + ".status");
      }
    }
  }

  var commercialTermLabels = {
    moq: { zh: "起订量", en: "MOQ" },
    lead_time: { zh: "交期", en: "Lead time" },
    capacity: { zh: "产能", en: "Capacity" },
    trade_terms: { zh: "贸易条款", en: "Trade terms" },
    payment: { zh: "付款方式", en: "Payment" },
    packaging: { zh: "包装", en: "Packaging" }
  };

  function renderCommercialTerms(draft, locale, applied, variant) {
    var sectionNode = uniqueNode('[data-sitecraft-section="commercialTerms"]');
    var grid = uniqueNode('[data-sitecraft-commercial-terms-grid]');
    if (!sectionNode && !grid) return;
    var terms = draft && draft.content && Array.isArray(draft.content.commercialTerms) ? draft.content.commercialTerms : [];
    var visible = [];
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      if (!term || !term.id || !commercialTermLabels[term.kind]) continue;
      var value = localize(term.value, locale) || "";
      if (isGapMarker(value)) continue;
      visible.push({ id: term.id, kind: term.kind, value: value });
    }
    var hidden = draft && Array.isArray(draft.hiddenSections) && draft.hiddenSections.indexOf("commercialTerms") !== -1;
    var shouldHide = hidden || !visible.length;
    if (sectionNode) setSectionHidden(sectionNode, "commercialTerms", shouldHide);
    if (!grid || shouldHide) return;
    grid.textContent = "";
    // Layouts that arrange the terms in columns follow how many there are.
    grid.setAttribute("data-sitecraft-entry-count", String(visible.length));
    applied.add("commercialTerms");
    for (var v = 0; v < visible.length; v++) {
      var item = visible[v];
      var row = document.createElement("article");
      row.className = "sitecraft-commercial-term";
      row.setAttribute("data-sc-part", "item");
      var label = document.createElement("h3");
      label.textContent = commercialTermLabels[item.kind][locale];
      var valueNode = document.createElement("p");
      valueNode.textContent = adapter && adapter.blocks ? emailBreakPoints(item.value) : item.value;
      valueNode.setAttribute("data-sitecraft-slot", "commercialTerms.items." + item.id + ".value." + locale);
      row.appendChild(label);
      row.appendChild(valueNode);
      grid.appendChild(row);
      applied.add("commercialTerms.items." + item.id + ".value." + locale);
    }
    void variant;
  }

  function selectUiTarget(slotKey) {
    var base = stripLocale(slotKey);
    if (base === "hero.title") return "heroTitle";
    if (base === "hero.subtitle") return "heroSubtitle";
    if (base === "hero.cta") return "primaryCta";
    if (base === "hero.image") return "heroImage";
    if (base === "companyName" || base === "siteName") return "brand";
    if (base === "about" || base.indexOf("about.") === 0) return "about";
    if (base === "features" || base.indexOf("features.") === 0) return "features";
    if (base === "services" || base.indexOf("services.") === 0) return "services";
    if (base === "products" || base.indexOf("products.") === 0) return "products";
    if (base === "commercialTerms" || base.indexOf("commercialTerms.") === 0) return "commercialTerms";
    if (base === "contact" || base.indexOf("contact.") === 0) return "contact";
    if (base === "faq" || base.indexOf("faq.") === 0) return "faq";
    if (base === "industries" || base.indexOf("industries.") === 0) return "industries";
    if (base === "capabilities" || base.indexOf("capabilities.") === 0) return "capabilities";
    if (base === "certifications" || base.indexOf("certifications.") === 0) return "certifications";
    return null;
  }

  function writeSlot(node, slot, value, locale, applied, variant) {
    if (!node) return false;
    var appliedKey = slot.attr === "src" ? slot.target : slot.target + "." + locale;
    if (slot.attr === "src") {
      if (typeof value !== "string" || !value) {
        var original = node.getAttribute && node.getAttribute("data-sitecraft-original-src");
        if (original != null) {
          if (node.setAttribute) node.setAttribute("src", original);
          else node.src = original;
        }
        return false;
      }
      if (node.getAttribute && node.getAttribute("data-sitecraft-original-src") == null) {
        node.setAttribute("data-sitecraft-original-src", node.getAttribute("src") || "");
      }
      if (node.setAttribute) node.setAttribute("src", value);
      else node.src = value;
    } else {
      if (typeof value !== "string") return false;
      var nextValue = value;
      // A contact line ("电话：…") whose whole value is a gap is left out, prefix and all.
      var line = node.closest ? node.closest("[data-sitecraft-line]") : null;
      if (line) {
        var gapLine = isGapMarker(nextValue);
        setEntryHidden(line, gapLine);
        if (gapLine) return false;
      }
      var optional = (node.getAttribute && node.getAttribute("data-sitecraft-optional")) || isStandaloneSentenceTarget(slot.target);
      var trimmed = nextValue.trim();
      if (optional && (!trimmed || trimmed === "待补充" || trimmed === "To be provided")) {
        node.textContent = "";
        node.hidden = true;
        return false;
      }
      if (optional) node.hidden = false;
      if (fitTextEnabled() && slot.target === "hero.title" && node.style && node.style.setProperty) node.style.setProperty("--sitecraft-title-run", longestRunEm(nextValue));
      if (fitTextEnabled() && (slot.target === "companyName" || slot.target === "siteName") && node.style && node.style.setProperty) {
        node.style.setProperty("--sitecraft-brand-run", longestRunEm(nextValue));
      }
      if (adapter && adapter.blocks && adapter.blocks.heroTitle === "words" && slot.target === "hero.title") {
        node.textContent = "";
        writeHeroTitle(node, nextValue);
      } else {
        node.textContent = adapter && adapter.blocks ? emailBreakPoints(nextValue) : nextValue;
      }
      if (slot.target === "contact.email" && node.getAttribute && node.setAttribute) {
        var href = node.getAttribute("href") || "";
        if (/^mailto:/i.test(href)) node.setAttribute("href", "mailto:" + nextValue);
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

  // appliedSlots are the declared targets on the page now, the blocks mounted with the look's default
  // layout included; the workspace uses them only to confirm that a change's targets landed. What a
  // change wrote is its change set's appliedTargets (server side), which the change markers name.
  function report(applied, expected, adapterObj, extraMissing) {
    var appliedSlots = Array.from(applied);
    var missingSlots = expected.filter(function (target) {
      return appliedSlots.indexOf(target) === -1;
    });
    var extras = extraMissing || [];
    for (var m = 0; m < extras.length; m++) {
      if (missingSlots.indexOf(extras[m]) === -1) missingSlots.push(extras[m]);
    }
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
    syncHiddenNavigation(hidden);
  }

  function syncHiddenNavigation(hiddenKeys) {
    if (!document || !document.querySelectorAll) return;
    var links = document.querySelectorAll("a[href^='#']");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = link.getAttribute ? link.getAttribute("href") || "" : "";
      var target = null;
      if (href.charAt(0) === "#" && href.length > 1 && document.querySelector) {
        target = document.querySelector("#" + href.slice(1));
      }
      var navKey = link.getAttribute ? link.getAttribute("data-sitecraft-nav") : "";
      var pointsAtHidden = Boolean(target && target.getAttribute && target.getAttribute("data-sitecraft-section-hidden") === "true");
      if (!pointsAtHidden && navKey && hiddenKeys.indexOf(navKey) !== -1) pointsAtHidden = true;
      link.hidden = pointsAtHidden;
      // Overlay button styles (display:flex) beat the [hidden] default, so enforce it inline.
      if (link.style && link.style.setProperty && link.setAttribute) {
        if (pointsAtHidden) {
          link.style.setProperty("display", "none", "important");
          link.setAttribute("data-sitecraft-nav-hidden", "true");
        } else if (link.getAttribute("data-sitecraft-nav-hidden") === "true") {
          if (link.style.removeProperty) link.style.removeProperty("display");
          if (link.removeAttribute) link.removeAttribute("data-sitecraft-nav-hidden");
        }
      }
    }
    var indexes = document.querySelectorAll("[data-sitecraft-section-index]");
    var visibleCount = 0;
    for (var n = 0; n < indexes.length; n++) {
      var indexNode = indexes[n];
      var owner = indexNode.closest ? indexNode.closest("section") : null;
      if (owner && owner.getAttribute && owner.getAttribute("data-sitecraft-section-hidden") === "true") continue;
      visibleCount += 1;
      indexNode.textContent = visibleCount < 10 ? "0" + visibleCount : String(visibleCount);
    }
  }

  function applyDemoChrome(applied, extraMissing) {
    var specs = adapter && adapter.demoChrome ? adapter.demoChrome : [];
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      if (!spec || !spec.key || !spec.selector) continue;
      var slotKey = "demoChrome." + spec.key;
      var node = visibilityNode(spec);
      if (!node) {
        extraMissing.push(slotKey);
        continue;
      }
      setSectionHidden(node, "demo:" + spec.key, true);
      applied.add(slotKey);
    }
  }

  function visibleSpecs(product, locale) {
    var specs = product && Array.isArray(product.specs) ? product.specs : [];
    var list = [];
    for (var s = 0; s < specs.length; s++) {
      var item = specs[s];
      if (!item) continue;
      var name = localize(item.name, locale) || "";
      var value = specValueText(item.value, locale);
      if (isGapMarker(name) && isGapMarker(value)) continue;
      list.push({ name: name, value: value });
    }
    return list;
  }

  function visibleProducts(draft, locale) {
    var products = draft && Array.isArray(draft.products) ? draft.products : [];
    return products.filter(function (product) {
      if (!product || product.status === "archived") return false;
      return !(isGapMarker(localize(product.name, locale)) && isGapMarker(localize(product.summary, locale)));
    });
  }

  // The first specs of each series, labelled with the series, for the hero nameplate and strip.
  function heroFacts(draft, locale) {
    var products = visibleProducts(draft, locale);
    var perProduct = products.length > 1 ? 2 : 4;
    var facts = [];
    for (var i = 0; i < products.length && facts.length < 4; i++) {
      var specs = visibleSpecs(products[i], locale).filter(function (spec) { return !isGapMarker(spec.value); });
      var name = localize(products[i].name, locale) || "";
      for (var j = 0; j < specs.length && j < perProduct && facts.length < 4; j++) {
        facts.push({ label: products.length > 1 ? name + " · " + specs[j].name : specs[j].name, value: specs[j].value });
      }
    }
    return facts;
  }

  function renderFooterProducts(draft, locale) {
    var list = uniqueNode("[data-sitecraft-footer-products]");
    if (!list || !document.createElement) return;
    // Shown again if the page was first shown without a draft (hideGapsWithoutDraft hides it).
    if (list.parentNode && list.parentNode.hidden) setEntryHidden(list.parentNode, false);
    list.textContent = "";
    var products = visibleProducts(draft, locale);
    for (var i = 0; i < products.length; i++) {
      var link = document.createElement("a");
      link.setAttribute("href", "#products");
      link.textContent = localize(products[i].name, locale) || "";
      list.appendChild(link);
    }
  }

  function renderFacts(container, facts, cellClass) {
    container.textContent = "";
    for (var i = 0; i < facts.length; i++) {
      var cell = document.createElement("div");
      cell.className = cellClass;
      var dt = document.createElement("dt");
      dt.textContent = facts[i].label;
      var dd = document.createElement("dd");
      setValueText(dd, facts[i].value);
      if (adapter && adapter.blocks && cellClass === "sitecraft-hero-spec") {
        cell.setAttribute("data-sc-part", "spec");
        dt.setAttribute("data-sc-part", "spec-label");
        dd.setAttribute("data-sc-part", "spec-value");
      }
      cell.appendChild(dt);
      cell.appendChild(dd);
      container.appendChild(cell);
    }
  }

  // Spec values (T-053): on block-library pages a value breaks only at spaces and after / + – 、,
  // and the cell CSS keeps words and Chinese runs whole. A zero-width space marks each such point
  // in the rendered text; the draft keeps the value as written. (A <wbr> element gives the same
  // breaks but shifts glyphs even where the line does not wrap.) A slash breaks between normal
  // alphabetic pieces of at least two characters or any pieces of at least three characters, so
  // units such as r/min, G1/4 and N/m stay whole. Other looks write values as is.
  function setValueText(node, value) {
    var text = value == null ? "" : String(value);
    node.textContent = adapter && adapter.blocks ? valueBreakPoints(text) : text;
  }

  function slashPiece(text, at, step) {
    var length = 0;
    for (var i = at + step; i >= 0 && i < text.length; i += step) {
      var ch = text.charAt(i);
      if (ch === "/" || /\s/.test(ch)) break;
      length += 1;
    }
    return length;
  }

  function valueBreakPoints(text) {
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      out += ch;
      var next = text.charAt(i + 1);
      if (!next || /\s/.test(next)) continue;
      if (ch === "+" || ch === "–" || ch === "、") out += "\u200b";
      else if (ch === "/" && slashBreakAllowed(text, i)) out += "\u200b";
    }
    return out;
  }

  function slashBreakAllowed(text, at) {
    var before = slashPiece(text, at, -1);
    var after = slashPiece(text, at, 1);
    if (before < 3 || after < 3) {
      var left = text.slice(at - before, at);
      var right = text.slice(at + 1, at + 1 + after);
      if (before < 2 || after < 2 || !/^[A-Za-z]+$/.test(left) || !/^[A-Za-z]+$/.test(right)) return false;
    }
    return true;
  }

  // On a block-library page an email address wraps only at the @ (T-053), whether it is the contact
  // email or sits in a sentence: a word joiner after each hyphen keeps p3i-sim.test whole, and
  // zero-width spaces on both sides of the @ are its break points. The draft and the mailto link keep
  // the text as written; copying drops the marks.
  function emailBreakPoints(text) {
    return String(text).replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+/g, function (email) {
      return email.replace(/-(?=.)/g, "-\u2060").replace("@", "\u200b@\u200b");
    });
  }

  // Look-specific title handling is declared in adapter.blocks.heroTitle. This function only writes
  // text and word nodes; line balancing belongs to the look's CSS.
  function writeHeroTitle(node, text) {
    var value = String(text);
    if (!node.ownerDocument || !document.createTextNode || !document.createElement) {
      node.textContent = value;
      return;
    }
    var segmenter = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh", { granularity: "word" }) : null;
    if (!segmenter) {
      node.textContent = value;
      return;
    }
    node.textContent = "";
    for (var part of segmenter.segment(value)) {
      var segment = String(part.segment || "");
      if (!segment) continue;
      if (!part.isWordLike || /^\s+$/.test(segment)) {
        node.appendChild(document.createTextNode(segment));
        continue;
      }
      var span = document.createElement("span");
      span.setAttribute("data-sitecraft-hero-word", "true");
      span.style.display = "inline-block";
      span.style.maxWidth = "100%";
      span.style.whiteSpace = "normal";
      span.style.wordBreak = "keep-all";
      span.style.overflowWrap = "anywhere";
      span.textContent = segment;
      node.appendChild(span);
    }
  }

  // Hero picture: a product photo when the draft has one; otherwise a nameplate of the key specs;
  // otherwise text only. No drawn stand-in pretends to be a product. The key-spec strip shows under
  // a photo, or, for the statement layout (render heroSpecs "always"), whenever there are specs.
  // 目录封面: the hero's right side lists the product series (category and name, each a link to the
  // products block), up to 6. The names carry no edit slot: editing a product stays on its block.
  function renderHeroIndex(draft, locale) {
    var nav = uniqueNode("[data-sitecraft-hero-index]");
    if (!nav || !document || !document.createElement) return;
    var heading = nav.querySelector("p");
    var list = nav.querySelector("ul");
    if (!list) return;
    if (heading) heading.textContent = locale === "en" ? "Product series" : "产品系列";
    list.textContent = "";
    var products = visibleProducts(draft, locale).slice(0, 6);
    nav.hidden = products.length === 0;
    for (var i = 0; i < products.length; i++) {
      var item = document.createElement("li");
      var link = document.createElement("a");
      link.setAttribute("href", "#products");
      var name = document.createElement("span");
      name.className = "sitecraft-cover-index-name";
      name.textContent = localize(products[i].name, locale) || "";
      link.appendChild(name);
      var category = localize(products[i].category, locale) || "";
      if (category && !isGapMarker(category) && category !== name.textContent) {
        var tag = document.createElement("span");
        tag.className = "sitecraft-cover-index-category";
        tag.textContent = category;
        link.appendChild(tag);
      }
      item.appendChild(link);
      list.appendChild(item);
    }
  }

  function applyHeroVisual(draft, locale, applied) {
    if (!document || !document.querySelector) return;
    renderHeroIndex(draft, locale);
    var hero = uniqueNode('[data-sitecraft-section="hero"]');
    var visual = uniqueNode("[data-sitecraft-hero-visual]");
    var heroImage = uniqueNode('[data-sitecraft-benchmark="hero-image"]');
    var credit = uniqueNode("[data-sitecraft-hero-credit]");
    var nameplate = uniqueNode("[data-sitecraft-hero-nameplate]");
    var strip = uniqueNode("[data-sitecraft-hero-specs]");
    var heroRender = blockRender("hero");
    var compareProducts = Boolean(draft && draft.blockVariants && draft.blockVariants.products === "compare");
    var stripAlways = Boolean(heroRender && heroRender.heroSpecs === "always") && !compareProducts;
    if (compareProducts && strip) strip.hidden = true;
    if (!visual && !heroImage && !(strip && stripAlways)) return;
    var products = visibleProducts(draft, locale);
    var photo = null;
    for (var i = 0; i < products.length; i++) {
      if (products[i].image && typeof products[i].image.url === "string" && products[i].image.url) {
        photo = products[i].image;
        break;
      }
    }
    var facts = heroFacts(draft, locale);
    var mode = photo ? "photo" : (nameplate && facts.length ? "nameplate" : "none");
    if (hero && hero.setAttribute) hero.setAttribute("data-sitecraft-hero-mode", mode);
    if (visual && visual.setAttribute) {
      visual.setAttribute("data-sitecraft-hero-mode", mode);
      visual.hidden = mode === "none";
    }
    if (heroImage) {
      if (photo) {
        heroImage.setAttribute("src", photo.url);
        heroImage.src = photo.url;
        heroImage.alt = localize(photo.alt, locale) || (locale === "en" ? "Product photo" : "产品图");
        heroImage.hidden = false;
        if (heroImage.removeAttribute) heroImage.removeAttribute("hidden");
        applied.add("hero.image");
      } else {
        heroImage.hidden = true;
        if (heroImage.setAttribute) heroImage.setAttribute("hidden", "");
      }
    }
    if (credit) {
      var creditText = photo ? (localize(photo.credit, locale) || "") : "";
      credit.textContent = creditText;
      credit.hidden = !creditText;
    }
    if (nameplate) {
      nameplate.hidden = mode !== "nameplate";
      if (mode === "nameplate") renderFacts(nameplate, facts, "sitecraft-nameplate-cell");
    }
    if (strip) {
      var showStrip = facts.length > 0 && !compareProducts && (stripAlways || mode === "photo");
      strip.hidden = !showStrip;
      var stripList = strip.querySelector ? (strip.querySelector("dl") || strip) : strip;
      if (showStrip) renderFacts(stripList, facts, "sitecraft-hero-spec");
    }
  }

  // Block-library pages (T-053) keep every variant of a block in a <template> and show one entity
  // per block. Mount the variant the draft picked (or the look's default) before any slot is
  // written, so each declared selector still hits one node. An entity that already shows the
  // wanted variant is left alone: content is re-sent several times and must not rebuild the page.
  function mountBlockVariants(draft, applied, extraMissing) {
    var blocks = adapter && adapter.blocks;
    if (!blocks || !Array.isArray(blocks.order) || !document || !document.querySelectorAll) return;
    var chosen = draft && draft.blockVariants && typeof draft.blockVariants === "object" ? draft.blockVariants : {};
    // A grouped industries/capabilities pair must keep one visual treatment. Resolve a
    // mismatched model choice at render time without mutating the saved draft.
    var industryVariant = typeof chosen.industries === "string" ? chosen.industries : (blocks.defaults && blocks.defaults.industries);
    var capabilityVariant = typeof chosen.capabilities === "string" ? chosen.capabilities : (blocks.defaults && blocks.defaults.capabilities);
    if (industryVariant && capabilityVariant && industryVariant !== capabilityVariant) {
      var pairVariant = industryVariant === "cards" || capabilityVariant === "cards" ? "cards" : "list";
      chosen = {};
      var originalChoices = draft && draft.blockVariants && typeof draft.blockVariants === "object" ? draft.blockVariants : {};
      for (var chosenKey in originalChoices) chosen[chosenKey] = originalChoices[chosenKey];
      chosen.industries = pairVariant;
      chosen.capabilities = pairVariant;
    }
    for (var i = 0; i < blocks.order.length; i++) {
      var block = blocks.order[i];
      var available = (blocks.variants && blocks.variants[block]) || [];
      var requested = typeof chosen[block] === "string" ? chosen[block] : "";
      var known = !requested || available.indexOf(requested) !== -1;
      var wanted = requested && known ? requested : (blocks.defaults && blocks.defaults[block]);
      var live = asList(document.querySelectorAll('[data-sc-block="' + block + '"]'));
      var templates = asList(document.querySelectorAll('template[data-sc-template^="' + block + ':"]'));
      if (!live.length && !templates.length) continue;
      var showing = live.length === 1 && live[0].getAttribute && live[0].getAttribute("data-sc-variant") === wanted;
      if (!showing) {
        var source = null;
        for (var t = 0; t < templates.length; t++) {
          if (templates[t].getAttribute("data-sc-template") === block + ":" + wanted) source = templates[t];
        }
        if (!source || !source.content || !source.content.cloneNode) {
          extraMissing.push("blockVariants." + block);
          continue;
        }
        var anchor = live[0] || templates[0];
        anchor.parentNode.insertBefore(source.content.cloneNode(true), anchor);
        for (var l = 0; l < live.length; l++) {
          if (live[l].parentNode) live[l].parentNode.removeChild(live[l]);
        }
      }
      if (known) applied.add("blockVariants." + block);
      else extraMissing.push("blockVariants." + block);
    }
  }

  function resolveBlockOrder(rawOrder, blocks) {
    var main = Array.isArray(blocks && blocks.main) ? blocks.main.slice() : [];
    if (!Array.isArray(rawOrder) || !rawOrder.length || !main.length) return main;
    var allowed = {};
    for (var i = 0; i < main.length; i++) allowed[main[i]] = true;
    var requested = [];
    for (var r = 0; r < rawOrder.length; r++) {
      var item = rawOrder[r];
      if (allowed[item] && requested.indexOf(item) === -1) requested.push(item);
    }
    if (!requested.length) return main;
    var rank = {};
    for (var n = 0; n < requested.length; n++) rank[requested[n]] = n;
    var groups = Array.isArray(blocks.groups) ? blocks.groups : [];
    var grouped = {};
    var units = [];
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g].filter(function (block) { return allowed[block] && !grouped[block]; });
      if (group.length < 2) continue;
      for (var gi = 0; gi < group.length; gi++) grouped[group[gi]] = true;
      units.push({ members: group, index: units.length });
    }
    for (var b = 0; b < main.length; b++) {
      if (grouped[main[b]]) continue;
      units.push({ members: [main[b]], index: units.length });
    }
    for (var u = 0; u < units.length; u++) {
      var unit = units[u];
      var best = requested.length + unit.index;
      for (var m = 0; m < unit.members.length; m++) if (rank[unit.members[m]] !== undefined) best = Math.min(best, rank[unit.members[m]]);
      unit.rank = best;
    }
    units.sort(function (a, b) { return a.rank - b.rank || a.index - b.index; });
    var result = [];
    for (var s = 0; s < units.length; s++) {
      var members = units[s].members.slice();
      members.sort(function (a, b) { return (rank[a] === undefined ? requested.length : rank[a]) - (rank[b] === undefined ? requested.length : rank[b]); });
      for (var q = 0; q < members.length; q++) result.push(members[q]);
    }
    // Hero is fixed at the head of every block-library main column.
    var heroIndex = main.indexOf("hero");
    if (heroIndex >= 0 && result.indexOf("hero") >= 0) {
      result.splice(result.indexOf("hero"), 1);
      result.splice(heroIndex, 0, "hero");
    }
    return result;
  }

  function linkBlock(link) {
    var value = link && link.getAttribute ? (link.getAttribute("data-sitecraft-nav") || link.getAttribute("data-sitecraft-ui") || "") : "";
    if (value === "services") return "services";
    if (["products", "industries", "capabilities", "certifications", "faq", "contact"].indexOf(value) >= 0) return value;
    var href = link && link.getAttribute ? link.getAttribute("href") || "" : "";
    return ({ "#products": "products", "#industries": "industries", "#capabilities": "capabilities", "#process": "services", "#certifications": "certifications", "#faq": "faq", "#inquiry": "contact" })[href] || null;
  }

  function reorderLinks(container, order) {
    if (!container || !container.querySelectorAll || !container.appendChild) return;
    var links = asList(container.querySelectorAll("a[href]"));
    var rank = {};
    for (var i = 0; i < order.length; i++) rank[order[i]] = i;
    links.sort(function (a, b) {
      var aBlock = linkBlock(a); var bBlock = linkBlock(b);
      var aRank = aBlock && rank[aBlock] !== undefined ? rank[aBlock] : order.length + links.indexOf(a);
      var bRank = bBlock && rank[bBlock] !== undefined ? rank[bBlock] : order.length + links.indexOf(b);
      return aRank - bRank;
    });
    for (var n = 0; n < links.length; n++) container.appendChild(links[n]);
  }

  function applyBlockOrder(draft, applied) {
    var blocks = adapter && adapter.blocks;
    if (!blocks || !Array.isArray(blocks.main) || !draft || !Array.isArray(draft.sectionOrder) || !draft.sectionOrder.length) return;
    var order = resolveBlockOrder(draft.sectionOrder, blocks);
    var main = uniqueNode("main");
    if (!main) return;
    var groups = Array.isArray(blocks.groups) ? blocks.groups : [];
    var grouped = {};
    var units = {};
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var live = group.length ? uniqueNode('[data-sc-block="' + group[0] + '"]') : null;
      var pair = live && live.closest ? live.closest(".sitecraft-pair") : null;
      if (!pair) continue;
      var groupUnit = { root: pair, nodes: [pair], members: group };
      for (var gi = 0; gi < group.length; gi++) { grouped[group[gi]] = true; units[group[gi]] = groupUnit; }
      var pairParent = live.parentNode;
      var pairOrder = order.filter(function (block) { return group.indexOf(block) >= 0; });
      for (var po = 0; po < pairOrder.length; po++) {
        var blockNodes = asList(pairParent.querySelectorAll('[data-sc-block="' + pairOrder[po] + '"], template[data-sc-template^="' + pairOrder[po] + ':"]'));
        for (var pn = 0; pn < blockNodes.length; pn++) pairParent.appendChild(blockNodes[pn]);
      }
    }
    for (var b = 0; b < blocks.main.length; b++) {
      var block = blocks.main[b];
      if (grouped[block]) continue;
      var entity = uniqueNode('[data-sc-block="' + block + '"]');
      if (!entity) continue;
      var nodeList = [entity];
      var parentNode = entity.parentNode;
      if (parentNode && parentNode.querySelectorAll) nodeList = nodeList.concat(asList(parentNode.querySelectorAll('template[data-sc-template^="' + block + ':"]')));
      units[block] = { root: entity, nodes: nodeList, members: [block] };
    }
    var moved = [];
    for (var o = 0; o < order.length; o++) {
      var unit = units[order[o]];
      if (!unit || moved.indexOf(unit.root) >= 0) continue;
      moved.push(unit.root);
      for (var ni = 0; ni < unit.nodes.length; ni++) if (unit.nodes[ni].parentNode === main) main.appendChild(unit.nodes[ni]);
      if (unit.root.parentNode === main && unit.nodes.indexOf(unit.root) < 0) main.appendChild(unit.root);
    }
    var nav = document.querySelector ? document.querySelector(".sitecraft-nav-links") : null;
    reorderLinks(nav, order);
    var menus = document.querySelectorAll ? document.querySelectorAll(".sitecraft-menu-panel") : [];
    for (var mi = 0; mi < menus.length; mi++) reorderLinks(menus[mi], order);
    var footerLabel = document.querySelector ? document.querySelector('[data-sitecraft-ui="footerNav"]') : null;
    var footerLinks = footerLabel && footerLabel.parentNode ? footerLabel.parentNode.querySelector(".sitecraft-footer-links") : null;
    reorderLinks(footerLinks, order);
    applied.add("sectionOrder");
  }

  function applyFamilyKit(draft, applied, extraMissing) {
    var kit = adapter && adapter.kit;
    if (!kit || !kit.familyId) return;
    var root = document && document.documentElement;
    var baseTokens = kit.tokens || {};
    var customPalette = draft && draft.customPalette && typeof draft.customPalette === "object" ? draft.customPalette : null;
    var paletteId = customPalette ? "custom" : (draft && draft.paletteId ? draft.paletteId : "default");
    var tokens = customPalette || (kit.palettes && kit.palettes[paletteId]) || baseTokens;
    var inputToken = tokens.input || tokens.surface || tokens.background;
    var focusToken = tokens.focus || tokens.accentSoft || tokens.accent;
    var disabledToken = tokens.disabled || tokens.muted || tokens.border;
    if (root && root.dataset) {
      root.dataset.sitecraftFamily = kit.familyId;
      root.dataset.sitecraftPalette = paletteId;
      if (tokens.background) root.dataset.sitecraftTokenBackground = tokens.background;
      if (tokens.surface) root.dataset.sitecraftTokenSurface = tokens.surface;
      if (tokens.text) root.dataset.sitecraftTokenText = tokens.text;
      if (tokens.muted) root.dataset.sitecraftTokenMuted = tokens.muted;
      if (tokens.accent) root.dataset.sitecraftTokenAccent = tokens.accent;
      if (tokens.accentStrong) root.dataset.sitecraftTokenAccentStrong = tokens.accentStrong;
      if (tokens.accentSoft) root.dataset.sitecraftTokenAccentSoft = tokens.accentSoft;
      if (tokens.border) root.dataset.sitecraftTokenBorder = tokens.border;
      if (inputToken) root.dataset.sitecraftTokenInput = inputToken;
      if (focusToken) root.dataset.sitecraftTokenFocus = focusToken;
      if (disabledToken) root.dataset.sitecraftTokenDisabled = disabledToken;
      if (tokens.diagram) root.dataset.sitecraftTokenDiagram = tokens.diagram;
      if (tokens.tint) root.dataset.sitecraftTokenTint = tokens.tint;
      if (tokens.font) root.dataset.sitecraftTokenFont = tokens.font;
      if (tokens.radius) root.dataset.sitecraftTokenRadius = tokens.radius;
      if (root.style && root.style.setProperty) {
        if (tokens.background) root.style.setProperty("--site-bg", tokens.background);
        if (tokens.surface) root.style.setProperty("--site-surface", tokens.surface);
        if (tokens.text) root.style.setProperty("--site-ink", tokens.text);
        if (tokens.muted) root.style.setProperty("--site-muted", tokens.muted);
        if (tokens.accent) root.style.setProperty("--site-accent", tokens.accent);
        if (tokens.accentStrong) root.style.setProperty("--site-accent-strong", tokens.accentStrong);
        if (tokens.accentSoft) root.style.setProperty("--site-accent-soft", tokens.accentSoft);
        if (tokens.border) root.style.setProperty("--site-line", tokens.border);
        if (inputToken) root.style.setProperty("--site-input", inputToken);
        if (focusToken) root.style.setProperty("--site-focus", focusToken);
        if (disabledToken) root.style.setProperty("--site-disabled", disabledToken);
        if (tokens.diagram) root.style.setProperty("--site-diagram", tokens.diagram);
        if (tokens.tint) root.style.setProperty("--site-tint", tokens.tint);
        if (tokens.font) root.style.setProperty("--site-font", tokens.font);
        if (tokens.radius) root.style.setProperty("--site-radius", tokens.radius);
      }
    }
    applied.add("kit.family." + kit.familyId);
    var briefId = draft && draft.visualBrief && draft.visualBrief.id;
    if (briefId && briefId !== kit.familyId) extraMissing.push("kit.family.mismatch");
    var hidden = draft && Array.isArray(draft.hiddenSections) ? draft.hiddenSections : [];
    var modules = kit.modules || [];
    for (var i = 0; i < modules.length; i++) {
      var spec = modules[i];
      if (!spec || !spec.key || !spec.kind) continue;
      if (spec.kind === "shell") {
        applied.add("kit." + spec.key);
        continue;
      }
      if (spec.kind === "content") {
        var contentNode = visibilityNode(spec);
        if (hidden.indexOf(spec.key) !== -1) {
          if (contentNode) setSectionHidden(contentNode, spec.key, true);
          applied.add("kit." + spec.key + ".omitted");
        } else {
          applied.add("kit." + spec.key);
        }
        continue;
      }
      if (spec.kind !== "demo") continue;
      var node = visibilityNode(spec);
      if (!node) {
        extraMissing.push("kit." + spec.key);
        continue;
      }
      setSectionHidden(node, "kit:" + spec.key, true);
      applied.add("kit." + spec.key + ".omitted");
    }
  }

  function applySiteStyle(draft, applied) {
    var existing = document && document.querySelector ? document.querySelector("style[data-sc-site-style]") : null;
    var blocks = adapter && adapter.blocks;
    var siteStyle = draft && draft.siteStyle && typeof draft.siteStyle === "object" ? draft.siteStyle : null;
    var direction = siteStyle && typeof siteStyle.direction === "string" ? siteStyle.direction : "";
    var directionSpec = adapter && adapter.blocks && adapter.blocks.styleDirections && direction ? adapter.blocks.styleDirections[direction] : null;
    var directionRules = directionSpec && Array.isArray(directionSpec.rules) ? directionSpec.rules : [];
    var rules = siteStyle && Array.isArray(siteStyle.rules) ? directionRules.concat(siteStyle.rules) : directionRules;
    if (!blocks || !rules.length) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var node = existing;
    if (!node && document && document.createElement && document.head) {
      node = document.createElement("style");
      node.setAttribute("data-sc-site-style", "true");
      document.head.appendChild(node);
    }
    if (!node) return;
    node.textContent = siteStyleCss(rules);
    if (node.textContent) applied.add("siteStyle");
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

  function setLeadingText(node, text) {
    var children = node.childNodes || [];
    for (var i = 0; i < children.length; i++) {
      if (children[i] && children[i].nodeType === 3) {
        children[i].nodeValue = text;
        return;
      }
    }
    if (node.insertBefore && document && document.createTextNode) {
      node.insertBefore(document.createTextNode(text), node.firstChild || null);
      return;
    }
    node.textContent = text;
  }

  // Intro and body fields are whole sentences: when the entire field is a gap, the sentence is
  // omitted instead of printing a lone 待补充. Headings stay; they are labels, not facts.
  // FAQ, cooperation steps and features have a fixed number of entries on the page. Adapter slots
  // are positional capabilities, but every rendered and selected target is rewritten to the card id.
  // They show the draft's entries that have a title or a body first, in draft order, then its
  // placeholders: a new draft carries empty entries, and an entry added with add_card goes after them,
  // so the page shows authored entries before placeholders (T-053). The slot written for an entry
  // carries that entry's id, so selection remains attached when another card is removed or moved.
  function entryTarget(draft, target, locale) {
    var match = /^(features|services|faq)\.items\.(\d+)\.(title|body)$/.exec(target || "");
    if (!match || !draft || !draft.content) return target;
    var items = (draft.content[match[1]] || {}).items || [];
    var provided = [];
    var placeholders = [];
    for (var i = 0; i < items.length; i++) {
      if (!items[i]) continue;
      if (isGapMarker(localize(items[i].title, locale)) && isGapMarker(localize(items[i].body, locale))) placeholders.push(i);
      else provided.push(i);
    }
    var index = provided.concat(placeholders)[Number(match[2])];
    var item = index === undefined ? null : items[index];
    return item && item.id ? match[1] + ".items." + item.id + "." + match[3] : target;
  }

  function withTarget(slot, target) {
    if (!slot || slot.target === target) return slot;
    var copy = {};
    for (var key in slot) {
      if (Object.prototype.hasOwnProperty.call(slot, key)) copy[key] = slot[key];
    }
    copy.target = target;
    return copy;
  }

  function entryHasContent(draft, target, locale) {
    var match = /^(features|services|faq)\.items\.([^.]+)\.(title|body)$/.exec(target || "");
    if (!match || !draft || !draft.content) return true;
    var items = (draft.content[match[1]] || {}).items || [];
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id === match[2]) { item = items[i]; break; }
    }
    if (!item) return false;
    return !(isGapMarker(localize(item.title, locale)) && isGapMarker(localize(item.body, locale)));
  }

  function isStandaloneSentenceTarget(target) {
    return /\.intro$/.test(target) || target === "contact.body" || target === "hero.subtitle" || target === "about.body";
  }

  function isGapMarker(value) {
    var text = value && typeof value === "object" ? String(value.zh || "").trim() : String(value || "").trim();
    return !text || text === "待补充" || text === "To be provided" || text === "To be completed";
  }

  // Certification status is stored as the Chinese enum; the English page shows its English label.
  function certificationStatusLabel(status, locale) {
    if (locale !== "en") return status;
    if (status === "已有") return "Certified";
    if (status === "认证中") return "In progress";
    if (status === "待补充") return "To be provided";
    return status;
  }

  function setEntryHidden(node, hidden) {
    if (!node) return;
    node.hidden = hidden;
    if (node.style && node.style.setProperty) {
      if (hidden) node.style.setProperty("display", "none", "important");
      else if (node.style.removeProperty) node.style.removeProperty("display");
      else node.style.setProperty("display", "");
    }
  }

  function collapseUnprovidedEntries(draft, locale, variant) {
    if (!document || !adapter) return;
    var slots = adapter.slots || [];
    var groups = ["faq", "features", "services"];
    for (var g = 0; g < groups.length; g++) {
      var group = groups[g];
      var byIndex = {};
      for (var s = 0; s < slots.length; s++) {
        var slot = slots[s];
        if (!slot || !slot.target || !slot.selector) continue;
        var match = new RegExp("^" + group + "\\.items\\.(\\d+)\\.(title|body)$").exec(slot.target);
        if (!match) continue;
        var index = match[1];
        if (!byIndex[index]) byIndex[index] = {};
        byIndex[index][match[2]] = slot;
      }
      var indexes = Object.keys(byIndex);
      if (!indexes.length) continue;

      var sectionSpec = null;
      var sectionList = adapter.sections || [];
      for (var sec = 0; sec < sectionList.length; sec++) {
        if (sectionList[sec] && sectionList[sec].key === group) {
          sectionSpec = sectionList[sec];
          break;
        }
      }
      var sectionNode = sectionSpec ? visibilityNode(sectionSpec) : null;
      var anyVisible = false;
      var visibleCount = 0;
      var sawEntry = false;
      var draftHidden = draft && Array.isArray(draft.hiddenSections) && draft.hiddenSections.indexOf(group) !== -1;

      for (var i = 0; i < indexes.length; i++) {
        var parts = byIndex[indexes[i]];
        var titleSlot = parts.title;
        var bodySlot = parts.body;
        if (!titleSlot || !bodySlot) continue;
        var titleValue = readDraftValue(draft, entryTarget(draft, titleSlot.target, locale), locale);
        var bodyValue = readDraftValue(draft, entryTarget(draft, bodySlot.target, locale), locale);
        var titleNode = uniqueNode(titleSlot.selector);
        var bodyNode = uniqueNode(bodySlot.selector);
        if (!titleNode && !bodyNode) continue;
        sawEntry = true;
        var entry = null;
        if (titleNode && titleNode.closest) entry = titleNode.closest("article");
        if (!entry && bodyNode && bodyNode.closest) entry = bodyNode.closest("article");
        if (!entry) entry = titleNode || bodyNode;
        if (!sectionNode && entry && entry.closest) sectionNode = entry.closest("section");
        var unprovided = isGapMarker(titleValue) && isGapMarker(bodyValue);
        if (unprovided) {
          setEntryHidden(entry, true);
          if (titleNode) titleNode.textContent = "";
          if (bodyNode) bodyNode.textContent = "";
        } else {
          setEntryHidden(entry, false);
          anyVisible = true;
          visibleCount += 1;
          // Visitors see the title alone rather than a "待补充" body (T-045).
          if (bodyNode && variant !== "workspace" && isGapMarker(bodyValue)) {
            bodyNode.textContent = "";
            bodyNode.hidden = true;
          } else if (bodyNode && bodyNode.hidden && !isGapMarker(bodyValue)) {
            bodyNode.hidden = false;
          }
        }
      }

      if (group === "services" && sectionNode) {
        var process = sectionNode.querySelector ? sectionNode.querySelector(".sitecraft-process") : null;
        if (process && process.setAttribute) {
          process.setAttribute("data-sitecraft-entry-count", String(visibleCount));
          var processCards = process.querySelectorAll ? process.querySelectorAll(".sitecraft-process-card") : [];
          var lastVisible = null;
          for (var pc = 0; pc < processCards.length; pc++) {
            if (processCards[pc].removeAttribute) processCards[pc].removeAttribute("data-sitecraft-last-visible");
            if (!processCards[pc].hidden && (!processCards[pc].style || processCards[pc].style.display !== "none")) lastVisible = processCards[pc];
          }
          if (lastVisible && lastVisible.setAttribute) lastVisible.setAttribute("data-sitecraft-last-visible", "true");
        }
      }
      if (sectionNode && !draftHidden && sawEntry) {
        setSectionHidden(sectionNode, group, !anyVisible);
      }
    }

    var hiddenKeys = [];
    var hiddenNodes = document.querySelectorAll("[data-sitecraft-section-hidden='true']");
    for (var h = 0; h < hiddenNodes.length; h++) {
      var hiddenKey = hiddenNodes[h].getAttribute && hiddenNodes[h].getAttribute("data-sitecraft-section");
      if (hiddenKey) hiddenKeys.push(hiddenKey);
    }
    syncHiddenNavigation(hiddenKeys);
  }

  // Gap rule for the product block: with no visible product, visitors see no product section at all.
  // Runs after applySectionVisibility so the draft's own hiddenSections cannot re-show it.
  function hideEmptyProductSection(draft, locale, variant) {
    if (variant === "workspace") return;
    var section = uniqueNode('[data-sitecraft-section="products"]');
    if (!section) return;
    var products = draft && Array.isArray(draft.products) ? draft.products : [];
    var anyVisible = products.some(function (product) {
      if (!product || product.status === "archived") return false;
      return !(isGapMarker(localize(product.name, locale) || "") && isGapMarker(localize(product.summary, locale) || ""));
    });
    if (!anyVisible) setSectionHidden(section, "products", true);
  }

  // Without a draft (the template gallery thumbnail and the template preview page), a block-library
  // page follows the gap rule of a draft that provides nothing (T-059): entries and contact lines with
  // nothing to show are left out, and a block with nothing to show is hidden together with the links
  // to it. Pages with a draft keep the rules above; the old overlays keep their page as it is.
  function hideGapsWithoutDraft(locale, variant, applied) {
    if (!document || !adapter || !adapter.blocks) return;
    renderCatalogSections(null, locale, applied, variant);
    renderCommercialTerms(null, locale, applied, variant);
    hideEmptyProductSection(null, locale, variant);
    var slots = adapter.slots || [];
    for (var s = 0; s < slots.length; s++) {
      var node = slots[s] && slots[s].selector ? uniqueNode(slots[s].selector) : null;
      var line = node && node.closest ? node.closest("[data-sitecraft-line]") : null;
      if (line) setEntryHidden(line, true);
    }
    // The footer products column holds links to the products; with none it would be a lone label.
    var footerProducts = uniqueNode("[data-sitecraft-footer-products]");
    if (footerProducts && footerProducts.parentNode) setEntryHidden(footerProducts.parentNode, true);
    // Last: after hiding the empty entry blocks it also hides the links to every hidden block.
    collapseUnprovidedEntries(null, locale, variant);
  }

  function clearUnprovidedCatalogChrome(draft, variant) {
    if (variant !== "published" || !document) return;
    var keys = ["industries", "capabilities", "certifications"];
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var section = draft && draft.content ? draft.content[key] : null;
      if (section) continue;
      var intro = uniqueNode('[data-sitecraft-benchmark="' + key + '-intro"]');
      var title = uniqueNode('[data-sitecraft-benchmark="' + key + '-title"]');
      if (intro) intro.textContent = "";
      if (title) title.textContent = "";
    }
  }

  function applyDocumentTitle(draft) {
    if (!document) return;
    var name = draft && typeof draft.companyName === "string" ? draft.companyName.trim() : "";
    if (!name && draft && typeof draft.siteName === "string") name = draft.siteName.trim();
    if (name) document.title = name;
  }

  function applyVisitorChrome(locale, draft, variant) {
    if (!document || !document.querySelectorAll) return;
    var copy = locale === "en"
      ? { name: "Name", email: "Email", company: "Company", message: "Request", emailPrefix: "Email", phonePrefix: "Phone", addressPrefix: "Address", products: "Products", commercialTerms: "Commercial terms", services: "How we work", contact: "Inquiry", faq: "Questions", industries: "Industries", capabilities: "Capabilities", certifications: "Certifications", submit: "Send inquiry", viewProducts: "View product series", menu: "Menu", footerContact: "Contact", footerNav: "Navigate", footerProducts: "Products", localeZh: "中", localeEn: "EN" }
      : { name: "姓名", email: "邮箱", company: "公司", message: "需求", emailPrefix: "邮箱", phonePrefix: "电话", addressPrefix: "地址", products: "产品", commercialTerms: "商业条款", services: "合作方式", contact: "询盘", faq: "常见问题", industries: "应用行业", capabilities: "加工能力", certifications: "认证状态", submit: "发送询盘", viewProducts: "看产品系列", menu: "菜单", footerContact: "联系", footerNav: "导航", footerProducts: "产品", localeZh: "中", localeEn: "EN" };
    var labels = document.querySelectorAll("[data-sitecraft-inquiry-label],[data-sitecraft-ui]");
    for (var i = 0; i < labels.length; i++) {
      var node = labels[i];
      var key = (node.getAttribute && (node.getAttribute("data-sitecraft-inquiry-label") || node.getAttribute("data-sitecraft-ui"))) || "";
      if (!copy[key]) continue;
      if (node.querySelector && node.querySelector("input,textarea,select")) setLeadingText(node, copy[key]);
      else node.textContent = copy[key];
    }
    void variant;
  }

  function applyLocaleSwitch(locale, offersVisitorEnglish, variant) {
    if (!document || !document.querySelectorAll) return;
    var switchers = asList(document.querySelectorAll("[data-sitecraft-locale-switch]"));
    for (var i = 0; i < switchers.length; i++) {
      var root = switchers[i];
      var show = variant === "published" && offersVisitorEnglish === true;
      if (root.hidden !== undefined) root.hidden = !show;
      if (root.style && root.style.setProperty) {
        if (!show) root.style.setProperty("display", "none", "important");
        else if (root.style.removeProperty) root.style.removeProperty("display");
      }
      if (!show) continue;
      var buttons = asList(root.querySelectorAll ? root.querySelectorAll("[data-sitecraft-locale]") : []);
      for (var b = 0; b < buttons.length; b++) {
        var button = buttons[b];
        var value = button.getAttribute ? button.getAttribute("data-sitecraft-locale") : "";
        var active = value === locale;
        if (button.classList && button.classList.toggle) button.classList.toggle("active", active);
        else if (button.setAttribute) {
          var className = String(button.className || "").replace(/\bactive\b/g, "").trim();
          button.className = active ? (className + " active").trim() : className;
        }
        if (button.setAttribute) button.setAttribute("aria-pressed", active ? "true" : "false");
      }
    }
  }

  function applyDeclaredContent(draft, locale, expectedTargets, variant, activePage, offersVisitorEnglish) {
    var applied = new Set();
    var extraMissing = [];
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
    mountBlockVariants(draft, applied, extraMissing);
    applyBlockOrder(draft, applied);
    if (adapter && draft) {
      applyDocumentTitle(draft);
      renderProductGrid(draft, currentLocale, applied, variant || "preview");
      renderFooterProducts(draft, currentLocale);
      applyHeroVisual(draft, currentLocale, applied);
      applyVisitorChrome(currentLocale, draft, variant || "preview");
      applyLocaleSwitch(currentLocale, offersVisitorEnglish === true, variant || "preview");
      var slots = adapter.slots || [];
      for (var s = 0; s < slots.length; s++) {
        var slot = slots[s];
        if (!slot || !slot.selector || !slot.target) continue;
        var entrySlot = withTarget(slot, entryTarget(draft, slot.target, currentLocale));
        if (!entryHasContent(draft, entrySlot.target, currentLocale)) continue;
        var value = readDraftValue(draft, entrySlot.target, currentLocale);
        var node = uniqueNode(slot.selector);
        if (!node) continue;
        writeSlot(node, entrySlot, value, currentLocale, applied, variant || "preview");
      }
      applyDocumentTitle(draft);
      applySectionVisibility(draft, applied);
      collapseUnprovidedEntries(draft, currentLocale, variant || "preview");
      renderCatalogSections(draft, currentLocale, applied, variant || "preview");
      renderCommercialTerms(draft, currentLocale, applied, variant || "preview");
      clearUnprovidedCatalogChrome(draft, variant || "preview");
      hideEmptyProductSection(draft, currentLocale, variant || "preview");
      syncHiddenNavigation((function () {
        var hiddenKeys = [];
        var hiddenNodes = document.querySelectorAll("[data-sitecraft-section-hidden='true']");
        for (var h = 0; h < hiddenNodes.length; h++) {
          var hiddenKey = hiddenNodes[h].getAttribute && hiddenNodes[h].getAttribute("data-sitecraft-section");
          if (hiddenKey) hiddenKeys.push(hiddenKey);
        }
        return hiddenKeys;
      })());
      applyDemoChrome(applied, extraMissing);
      applyFamilyKit(draft, applied, extraMissing);
      applySiteStyle(draft, applied);
      applyActivePage(draft, activePage);
      if (variant === "published") {
        sanitizePublished();
      }
    } else if (adapter) {
      hideGapsWithoutDraft(currentLocale, variant || "preview", applied);
    }
    return report(applied, expected, adapter, extraMissing);
  }

  function onMessage(event) {
    var data = event && event.data;
    if (event && event.source && event.source !== parent) return;
    if (data && data.type === "sitecraft:inquiry-result" && data.templateId === templateId) {
      showInquiryResult(data.ok === true, typeof data.message === "string" ? data.message : "");
      return;
    }
    if (!data || data.type !== "sitecraft:content" || data.templateId !== templateId) return;
    var run = function () {
      var reportPayload = applyDeclaredContent(
        data.draft,
        data.locale,
        data.expectedTargets,
        data.variant,
        data.activePage,
        data.offersVisitorEnglish
      );
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

  function fieldValue(form, name) {
    if (!form || !form.querySelector) return "";
    var node = form.querySelector("[name=\"" + name + "\"]");
    if (!node) return "";
    if (typeof node.value === "string") return node.value;
    var attr = node.getAttribute ? node.getAttribute("value") : "";
    if (attr) return String(attr);
    return String(node.textContent || "");
  }

  function inquiryForm() {
    return uniqueNode("[data-sitecraft-inquiry=\"true\"]");
  }

  // The status line lives inside the form so the visitor sees the result where they clicked.
  function inquiryStatusNode(form) {
    var node = form.querySelector ? form.querySelector("[data-sitecraft-inquiry-status]") : null;
    if (node || !document.createElement) return node;
    node = document.createElement("p");
    node.setAttribute("data-sitecraft-inquiry-status", "");
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.className = "sitecraft-inquiry-status";
    node.hidden = true;
    form.appendChild(node);
    return node;
  }

  function setInquiryState(form, state, message) {
    form.setAttribute("data-sitecraft-inquiry-state", state);
    var button = form.querySelector ? form.querySelector("[type=\"submit\"]") : null;
    if (button) button.disabled = state === "sending";
    var status = inquiryStatusNode(form);
    if (!status) return;
    status.textContent = message || "";
    status.hidden = !message;
    if (state === "error") status.setAttribute("role", "alert");
    else status.setAttribute("role", "status");
  }

  function showInquiryResult(ok, message) {
    var form = inquiryForm();
    if (!form) return;
    if (ok && form.reset) form.reset();
    setInquiryState(form, ok ? "sent" : "error", message);
  }

  function onInquirySubmit(event) {
    var rawTarget = event && event.target;
    var form = rawTarget && rawTarget.closest ? rawTarget.closest("[data-sitecraft-inquiry=\"true\"]") : null;
    if (!form) return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    if (form.getAttribute("data-sitecraft-inquiry-state") === "sending") return;
    setInquiryState(form, "sending", "");
    if (parent && parent.postMessage) {
      parent.postMessage({
        type: "sitecraft:inquiry",
        templateId: templateId,
        payload: {
          name: fieldValue(form, "name"),
          email: fieldValue(form, "email"),
          company: fieldValue(form, "company"),
          message: fieldValue(form, "message"),
          honeypot: fieldValue(form, "honeypot")
        }
      }, "*");
    }
  }

  function onClick(event) {
    var rawTarget = event && event.target;
    var localeButton = rawTarget && rawTarget.closest ? rawTarget.closest("[data-sitecraft-locale]") : null;
    if (localeButton) {
      var nextLocale = localeButton.getAttribute ? localeButton.getAttribute("data-sitecraft-locale") : "";
      if ((nextLocale === "zh" || nextLocale === "en") && parent && parent.postMessage) {
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        parent.postMessage({ type: "sitecraft:locale", templateId: templateId, locale: nextLocale }, "*");
      }
      return;
    }
    // The preview document has a <base href> pointing at template assets, so a plain "#section"
    // link would resolve to the assets folder and navigate the frame away. Scroll in place instead.
    var anchor = rawTarget && rawTarget.closest ? rawTarget.closest("a[href^=\"#\"]") : null;
    if (anchor) {
      var hash = anchor.getAttribute("href") || "";
      var section = hash.length > 1 && document.getElementById ? document.getElementById(hash.slice(1)) : null;
      if (event.preventDefault) event.preventDefault();
      if (section && section.scrollIntoView) section.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (hash === "#top" && global.scrollTo) global.scrollTo({ top: 0, behavior: "smooth" });
    }
    var variant = document.documentElement && document.documentElement.dataset
      ? document.documentElement.dataset.sitecraftVariant
      : "";
    if (variant === "published") return;
    if (!rawTarget) return;
    var node = rawTarget && rawTarget.closest ? rawTarget.closest("[data-sitecraft-slot]") : null;
    if (!node && rawTarget && rawTarget.closest && document.getElementById) {
      // A table cell answers for the column header named in its headers= (the comparison table: one
      // header per product carries that product's specs target).
      var headed = rawTarget.closest("td[headers]");
      var header = headed ? document.getElementById(headed.getAttribute("headers")) : null;
      node = header && header.closest ? header.closest("[data-sitecraft-slot]") : null;
    }
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

  // The zero-width break points added to spec values and the marks in an email are not part of the
  // text: a visitor who copies a grade like S136/H13/NAK80 or an address gets it as written.
  function onCopy(event) {
    if (!adapter || !adapter.blocks || !event || !event.clipboardData || !global.getSelection) return;
    var text = String(global.getSelection() || "");
    if (!/[\u200b\u2060]/.test(text)) return;
    event.clipboardData.setData("text/plain", text.replace(/[\u200b\u2060]/g, ""));
    if (event.preventDefault) event.preventDefault();
  }

  if (global.addEventListener) global.addEventListener("message", onMessage);
  if (document && document.addEventListener) {
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onInquirySubmit, true);
    document.addEventListener("copy", onCopy, true);
  }
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
      offersVisitorEnglish?: boolean,
    ) => SlotApplyReport;
  };
}
