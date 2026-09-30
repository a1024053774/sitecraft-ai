// Test fixture: splits a stylesheet into comparable rules (media context, selector, declarations).
// Enough for the stylesheets SiteCraft writes itself: plain rules and one level of @media.

export type CssRule = { context: string; selector: string; declarations: string[] };

const squash = (value: string) => value.replace(/\s+/g, " ").trim();

export function cssRules(css: string, context = ""): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{", index);
    if (open < 0) break;
    const prelude = squash(source.slice(index, open));
    let depth = 1;
    let end = open + 1;
    while (end < source.length && depth) {
      if (source[end] === "{") depth += 1;
      else if (source[end] === "}") depth -= 1;
      end += 1;
    }
    const body = source.slice(open + 1, end - 1);
    if (prelude.startsWith("@media")) rules.push(...cssRules(body, prelude));
    else {
      rules.push({
        context,
        selector: prelude.split(",").map(squash).join(", "),
        declarations: body.split(";").map(squash).filter(Boolean),
      });
    }
    index = end;
  }
  return rules;
}

export function styleText(html: string) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");
}

/** Declarations of `:root` as a name -> value map. */
export function rootVariables(rules: CssRule[]) {
  const values = new Map<string, string>();
  for (const rule of rules) {
    if (rule.context || rule.selector !== ":root") continue;
    for (const declaration of rule.declarations) {
      const at = declaration.indexOf(":");
      values.set(declaration.slice(0, at).trim(), declaration.slice(at + 1).trim());
    }
  }
  return values;
}
