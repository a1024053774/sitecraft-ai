// Evaluated in a visitor page: `(${source})(root)`, root defaults to document.body.
// The text a visitor can read, for checking that the material facts landed on the page (T-053):
// every text node that is drawn, with the folded <details> outside the header (spec lists, FAQ
// answers) opened while reading and closed again. Text nodes are read as written, so CSS
// text-transform does not change them; the break marks the bridge adds (U+200B, U+2060) are dropped
// and white space is collapsed.
((root) => {
  root = root || document.body;
  const opened = [...root.querySelectorAll("details:not([open])")].filter((node) => !node.closest("header"));
  for (const node of opened) node.open = true;
  try {
    const parts = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || !node.textContent.trim() || parent.closest("script, style, noscript, template")) continue;
      if (getComputedStyle(parent).visibility === "hidden") continue;
      range.selectNodeContents(node);
      if (![...range.getClientRects()].some((rect) => rect.width > 0 && rect.height > 0)) continue;
      parts.push(node.textContent);
    }
    return parts.join(" ").replace(/[\u200b\u2060]/g, "").replace(/\s+/g, " ").trim();
  } finally {
    for (const node of opened) node.open = false;
  }
})
