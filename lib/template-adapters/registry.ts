import type { SlotApplyReport, TemplateAdapter, TemplateKitModule, TemplateSlot } from "./types.ts";

const textSlot = (target: string, selector: string): TemplateSlot => ({
  target,
  selector,
  attr: "text",
});

const srcSlot = (target: string, selector: string): TemplateSlot => ({
  target,
  selector,
  attr: "src",
});

const contactToEmail = {
  "contact.title": "contact.email",
  "contact.body": "contact.email",
} as const;

const contactToHeroCta = {
  "contact.title": "hero.cta",
  "contact.body": "hero.cta",
  "contact.email": "hero.cta",
  "contact.phone": "hero.cta",
  "contact.address": "hero.cta",
} as const;

const kitShell = (key: string, selector: string): TemplateKitModule => ({
  key,
  kind: "shell",
  selector,
});

const kitContent = (
  key: string,
  selector: string,
  root?: "self" | "section",
  sourceTemplateId?: string,
): TemplateKitModule => ({
  key,
  kind: "content",
  selector,
  ...(root ? { root } : {}),
  ...(sourceTemplateId ? { sourceTemplateId } : {}),
});

const kitDemo = (key: string, selector: string, root?: "self" | "section"): TemplateKitModule => ({
  key,
  kind: "demo",
  selector,
  ...(root ? { root } : {}),
});

const demoMarker = (key: string) => `[data-sitecraft-demo="${key}"]`;

export const templateAdapters: Readonly<Record<string, TemplateAdapter>> = {
  forge: {
    templateId: "forge",
    runtime: "astro-static",
    slots: [
      textSlot("hero.title", '[data-testid="hero-text"]'),
      textSlot("hero.subtitle", '[data-testid="intro-text"]'),
      srcSlot("hero.image", 'img[alt="hero"]'),
      textSlot("contact.email", 'footer a[href^="mailto:"]'),
      textSlot("contact.phone", "footer tel"),
      textSlot("contact.address", "footer ul.max-w-\\[160px\\] > li:first-child > a"),
      textSlot("contact.title", '[data-sitecraft-contact="title"]'),
      textSlot("contact.body", '[data-sitecraft-contact="body"]'),
      textSlot("services.title", "[data-sitecraft-why-title]"),
      textSlot("services.intro", "[data-sitecraft-why-intro]"),
      textSlot("services.items.0.title", '[data-sitecraft-service="1"] > p.mb-4'),
      textSlot("services.items.0.body", '[data-sitecraft-service="1"] > p.text-lg'),
      textSlot("services.items.1.title", '[data-sitecraft-service="2"] > p.mb-4'),
      textSlot("services.items.1.body", '[data-sitecraft-service="2"] > p.text-lg'),
      textSlot("services.items.2.title", '[data-sitecraft-service="3"] > p.mb-4'),
      textSlot("services.items.2.body", '[data-sitecraft-service="3"] > p.text-lg'),
      textSlot("faq.title", '[data-sitecraft-faq="title"]'),
      textSlot("faq.intro", '[data-sitecraft-faq="intro"]'),
      textSlot("faq.items.0.title", '[data-sitecraft-faq="q1"]'),
      textSlot("faq.items.0.body", '[data-sitecraft-faq="a1"]'),
      textSlot("faq.items.1.title", '[data-sitecraft-faq="q2"]'),
      textSlot("faq.items.1.body", '[data-sitecraft-faq="a2"]'),
      textSlot("faq.items.2.title", '[data-sitecraft-faq="q3"]'),
      textSlot("faq.items.2.body", '[data-sitecraft-faq="a3"]'),
    ],
    sections: [
      { key: "services", selector: "section.border-y-8.border-blue-400" },
      { key: "features", selector: "div.bg-opacity-30", root: "section" },
      { key: "faq", selector: "#FAQ" },
    ],
    alternatives: { ...contactToEmail },
    sanitize: {
      leafPatterns: [
        "A List If Needed",
        "part [1-4]",
        "One or two sentences about what your company offers[.]",
        "brief description of services",
      ],
    },
    kit: {
      familyId: "industrial",
      tokens: {
        background: "#f3f4f6",
        text: "#0a0a0a",
        accent: "#60a5fa",
        border: "#9ca3af",
        font: 'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"',
        radius: "0.5rem",
      },
      modules: [
        kitShell("hero", '[data-testid="hero-text"]'),
        kitContent("services", "section.border-y-8.border-blue-400"),
        kitContent("features", "div.bg-opacity-30", "section"),
        kitContent("faq", "#FAQ"),
      ],
    },
  },
  atlas: {
    templateId: "atlas",
    runtime: "astro-static",
    slots: [
      textSlot("hero.title", "section.pt-14 h1"),
      textSlot("hero.subtitle", "section.pt-14 p.mb-8"),
      textSlot("hero.cta", "section.pt-14 a.btn-primary"),
    ],
    sanitize: {
      sections: [
        "Top Reasons to Choose Astro",
        "Ready to build your next project with Astro",
        "What Users Are Saying About Astroplate",
      ],
      leafPatterns: [
        "Lorem ipsum",
        "Marvin McKinney",
        "Web Designer",
        "Zero JS, by default",
        "UI-agnostic",
        "10[+] Pre-build pages",
        "Google Pagespeed",
      ],
    },
  },
  kindred: {
    templateId: "kindred",
    runtime: "astro-static",
    slots: [
      textSlot("hero.title", ".hero-section__text > h1"),
      textSlot("hero.cta", ".hero-btns__container > :first-child"),
    ],
  },
  signal: {
    templateId: "signal",
    runtime: "astro-static",
    slots: [textSlot("hero.title", "div.md\\:max-w-\\[520px\\] > h1")],
    sanitize: {
      sections: [
        "Drop in your customer logos",
        "Frequently asked questions",
        "Latest articles",
        "Start building your SaaS today",
      ],
      leafPatterns: ["View on GitHub", "Star on GitHub", "Get Template"],
    },
  },
  lonestone: {
    templateId: "lonestone",
    runtime: "astro-static",
    slots: [textSlot("hero.title", "section.relative.h-full.bg-black h2 .gradient-text")],
  },
  powerai: {
    templateId: "powerai",
    runtime: "astro-static",
    slots: [textSlot("hero.title", "section.py-20 h1.tracking-tight")],
    sanitize: {
      sections: ["Everything you need to build with AI", "Loved by developers", "Frequently asked questions"],
      leafPatterns: [
        "^(99.9%|10M[+]|50K[+]|Uptime|AI Requests|Users|[$]0|[$]49|[/]month|Most Popular)$",
        "API requests",
        "uptime SLA",
        "Sarah Chen",
        "Marcus Rodriguez",
        "Emily Watson",
        "TechCorp",
        "StartupXYZ",
        "InnovateLabs",
      ],
    },
  },
  screwfast: {
    templateId: "screwfast",
    runtime: "astro-static",
    slots: [
      textSlot("companyName", '[data-sitecraft-brand="nav"]'),
      textSlot("companyName", '[data-sitecraft-brand="footer"]'),
      textSlot("hero.title", "section.md\\:grid-cols-2.md\\:items-center.md\\:gap-8 > div > h1"),
      textSlot("hero.subtitle", "section.md\\:grid-cols-2.md\\:items-center.md\\:gap-8 p.mt-3"),
      textSlot("hero.cta", "section.md\\:grid-cols-2.md\\:items-center.md\\:gap-8 a.bg-orange-400"),
      srcSlot("hero.image", 'img[alt="Stack of ScrewFast product boxes containing assorted hardware tools"]'),
      textSlot("features.title", "section.py-10 .lg\\:grid-cols-3 > .lg\\:col-span-1 > h2"),
      textSlot("features.intro", "section.py-10 .lg\\:grid-cols-3 > .lg\\:col-span-1 > p"),
      textSlot("features.items.0.title", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(1) h3"),
      textSlot("features.items.0.body", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(1) p"),
      textSlot("features.items.1.title", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(2) h3"),
      textSlot("features.items.1.body", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(2) p"),
      textSlot("features.items.2.title", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(3) h3"),
      textSlot("features.items.2.body", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(3) p"),
      textSlot("features.items.3.title", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(4) h3"),
      textSlot("features.items.3.body", "section.py-10 .lg\\:col-span-2 > .grid.sm\\:grid-cols-2 > div:nth-of-type(4) p"),
      textSlot("faq.items.0.title", '[data-sitecraft-faq="q1"]'),
      textSlot("faq.items.0.body", "#hs-basic-with-title-and-arrow-stretched-collapse1 > p"),
      textSlot("faq.items.1.title", '[data-sitecraft-faq="q2"]'),
      textSlot("faq.items.1.body", "#hs-basic-with-title-and-arrow-stretched-collapse2 > p"),
      textSlot("faq.items.2.title", '[data-sitecraft-faq="q3"]'),
      textSlot("faq.items.2.body", "#hs-basic-with-title-and-arrow-stretched-collapse3 > p"),
      textSlot("faq.items.3.title", '[data-sitecraft-faq="q4"]'),
      textSlot("faq.items.3.body", "#hs-basic-with-title-and-arrow-stretched-collapse4 > p"),
      textSlot("faq.items.4.title", '[data-sitecraft-faq="q5"]'),
      textSlot("faq.items.4.body", "#hs-basic-with-title-and-arrow-stretched-collapse5 > p"),
      textSlot("faq.items.5.title", '[data-sitecraft-faq="q6"]'),
      textSlot("faq.items.5.body", "#hs-basic-with-title-and-arrow-stretched-collapse6 > p"),
      textSlot("contact.title", '[data-sitecraft-contact="title"]'),
      textSlot("contact.body", '[data-sitecraft-contact="body"]'),
    ],
    sections: [
      { key: "partners", selector: "h2.leading-tight.text-2xl", root: "section" },
      { key: "features", selector: 'img[alt="ScrewFast products in floating boxes"]', root: "section" },
      { key: "solutions", selector: "#tabs-with-card-item-1", root: "section" },
      { key: "process", selector: "h2.mb-2.text-3xl", root: "section" },
      { key: "faq", selector: "div.hs-accordion-group", root: "section" },
      { key: "contact", selector: "section.pt-10.pb-24" },
    ],
    alternatives: { ...contactToHeroCta },
    demoChrome: [
      { key: "pricing", selector: '[data-sitecraft-demo="pricing"]' },
      { key: "reviews", selector: '[data-sitecraft-demo="reviews"]' },
      { key: "wordmark", selector: '[data-sitecraft-demo="wordmark"]' },
      { key: "footer-wordmark", selector: '[data-sitecraft-demo="footer-wordmark"]' },
      { key: "github", selector: '[data-sitecraft-demo="github"]' },
      { key: "logo-wall", selector: '[data-sitecraft-demo="logo-wall"]' },
      { key: "solutions", selector: '[data-sitecraft-demo="solutions"]' },
      { key: "testimonial", selector: '[data-sitecraft-demo="testimonial"]' },
      { key: "feature-extra", selector: '[data-sitecraft-demo="feature-extra"]' },
    ],
    sanitize: {
      leafPatterns: ["Contact Sales Team", "7K[+]", "Crafted by"],
    },
    kit: {
      familyId: "engineering-industrial",
      tokens: {
        background: "#fff",
        text: "oklch(20.5% 0 0)",
        accent: "oklch(67.4% .2072 39.23)",
        border: "oklch(92.2% 0 0)",
        font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        radius: "0.5rem",
      },
      modules: [
        kitShell("nav", '[data-sitecraft-brand="nav"]'),
        kitShell("footer", '[data-sitecraft-brand="footer"]'),
        kitContent("partners", "h2.leading-tight.text-2xl", "section"),
        kitContent("features", 'img[alt="ScrewFast products in floating boxes"]', "section"),
        kitContent("process", "h2.mb-2.text-3xl", "section"),
        kitContent("faq", "div.hs-accordion-group", "section"),
        kitContent("contact", "section.pt-10.pb-24"),
        kitDemo("pricing", demoMarker("pricing")),
        kitDemo("reviews", demoMarker("reviews")),
        kitDemo("wordmark", demoMarker("wordmark")),
        kitDemo("footer-wordmark", demoMarker("footer-wordmark")),
        kitDemo("github", demoMarker("github")),
        kitDemo("logo-wall", demoMarker("logo-wall")),
        kitDemo("solutions", demoMarker("solutions")),
        kitDemo("testimonial", demoMarker("testimonial")),
        kitDemo("feature-extra", demoMarker("feature-extra")),
      ],
    },
  },
  fresh: {
    templateId: "fresh",
    runtime: "astro-static",
    slots: [
      textSlot("hero.title", "h1.title.is-1"),
      textSlot("hero.subtitle", "h2.subtitle.is-5.is-muted"),
      textSlot("hero.cta", "a.button.cta.primary-btn"),
      srcSlot("hero.image", "img.hero-image"),
    ],
    alternatives: { ...contactToHeroCta },
  },
  "tailwind-landing": {
    templateId: "tailwind-landing",
    runtime: "static-html",
    slots: [
      textSlot("hero.title", "h1.my-4.text-5xl"),
      textSlot("hero.subtitle", "p.leading-normal.text-2xl"),
      textSlot("hero.cta", "div.pt-24 button"),
      srcSlot("hero.image", "img.z-50"),
    ],
    alternatives: { ...contactToHeroCta },
  },
  landwind: {
    templateId: "landwind",
    runtime: "static-html",
    slots: [
      textSlot("companyName", "span.self-center.text-xl"),
      textSlot("companyName", '[data-sitecraft-brand="footer"]'),
      textSlot("hero.title", "h1.max-w-2xl.mb-4"),
      textSlot("hero.subtitle", "p.max-w-2xl.mb-6.font-light"),
      textSlot("hero.cta", "a.text-center.text-gray-900.border.border-gray-200"),
      srcSlot("hero.image", 'img[alt="hero image"]'),
      textSlot("faq.title", '[data-sitecraft-faq="title"]'),
      textSlot("faq.intro", '[data-sitecraft-faq="intro"]'),
      textSlot("faq.items.0.title", '[data-sitecraft-faq="q1"]'),
      textSlot("faq.items.0.body", '[data-sitecraft-faq="a1"]'),
      textSlot("faq.items.1.title", '[data-sitecraft-faq="q2"]'),
      textSlot("faq.items.1.body", '[data-sitecraft-faq="a2"]'),
      textSlot("faq.items.2.title", '[data-sitecraft-faq="q3"]'),
      textSlot("faq.items.2.body", '[data-sitecraft-faq="a3"]'),
      textSlot("faq.items.3.title", '[data-sitecraft-faq="q4"]'),
      textSlot("faq.items.3.body", '[data-sitecraft-faq="a4"]'),
      textSlot("contact.title", '[data-sitecraft-contact="title"]'),
      textSlot("contact.body", '[data-sitecraft-contact="body"]'),
    ],
    sections: [
      { key: "solutions", selector: 'img[alt="dashboard feature image"]', root: "section" },
      { key: "partners", selector: "h2.mt-3.mb-4", root: "section" },
      { key: "faq", selector: "#accordion-flush", root: "section" },
      { key: "contact", selector: "h2.leading-tight", root: "section" },
    ],
    alternatives: { ...contactToHeroCta },
    demoChrome: [
      { key: "pricing", selector: '[data-sitecraft-demo="pricing"]' },
      { key: "logo-wall", selector: '[data-sitecraft-demo="logo-wall"]' },
      { key: "figma", selector: '[data-sitecraft-demo="figma"]' },
      { key: "testimonial", selector: '[data-sitecraft-demo="testimonial"]' },
      { key: "footer-copyright", selector: '[data-sitecraft-demo="footer-copyright"]' },
    ],
    kit: {
      familyId: "export-catalog",
      tokens: {
        background: "#ffffff",
        text: "#111827",
        accent: "#6c2bd9",
        border: "#e5e7eb",
        font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        radius: "0.5rem",
      },
      modules: [
        kitShell("nav", "span.self-center.text-xl"),
        kitShell("footer", '[data-sitecraft-brand="footer"]'),
        kitContent("solutions", 'img[alt="dashboard feature image"]', "section"),
        kitContent("partners", "h2.mt-3.mb-4", "section"),
        kitContent("faq", "#accordion-flush", "section"),
        kitContent("contact", "h2.leading-tight", "section"),
        kitContent("products", '[data-sitecraft-kit="product-grid"]', "self", "nordic-store"),
        kitDemo("pricing", demoMarker("pricing")),
        kitDemo("logo-wall", demoMarker("logo-wall")),
        kitDemo("figma", demoMarker("figma")),
        kitDemo("testimonial", demoMarker("testimonial")),
        kitDemo("footer-copyright", demoMarker("footer-copyright")),
      ],
    },
  },
  "nordic-store": {
    templateId: "nordic-store",
    runtime: "static-html",
    slots: [
      textSlot("products.title", "nav#store a.uppercase"),
    ],
    kit: {
      familyId: "export-catalog",
      tokens: {
        background: "#ffffff",
        text: "#111827",
        accent: "#6c2bd9",
        border: "#e5e7eb",
        font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        radius: "0.5rem",
      },
      modules: [
        kitContent("products", '[data-sitecraft-kit="product-grid"]', "self", "nordic-store"),
      ],
    },
  },
  "nextjs-landing": {
    templateId: "nextjs-landing",
    runtime: "next-static",
    slots: [
      textSlot("hero.title", "h1.leading-hero"),
      textSlot("hero.subtitle", "header.text-center > div.mb-16"),
      textSlot("hero.cta", "header.text-center .btn"),
    ],
  },
  "shadcn-landing": {
    templateId: "shadcn-landing",
    runtime: "spa-bundle",
    slots: [textSlot("hero.title", "main h1")],
    sanitize: {
      sections: ["Sponsors", "Testimonials", "Our Team", "Frequently Asked Questions"],
    },
  },
  "shadcn-landing2": {
    templateId: "shadcn-landing2",
    runtime: "next-static",
    slots: [textSlot("hero.title", "main h1")],
    sanitize: {
      sections: ["Sponsors", "Testimonials", "Our Team", "Community", "Frequently Asked Questions"],
    },
  },
};

export function getTemplateAdapter(templateId: string) {
  return templateAdapters[templateId];
}

export function declaredFamilySections(templateId: string) {
  return getTemplateAdapter(templateId)?.sections ?? [];
}

function stripLocaleSuffix(target: string) {
  return target.replace(/\.(zh|en)$/, "");
}

export function reportDeclaredCoverage(input: {
  templateId: string;
  expectedTargets: string[];
  appliedSlots?: string[];
}): SlotApplyReport {
  const adapter = getTemplateAdapter(input.templateId);
  const appliedSlots = [...(input.appliedSlots ?? [])];
  if (!adapter) {
    return {
      appliedSlots: [],
      missingSlots: [...input.expectedTargets],
      fallbackMatched: [],
      proposedAlternatives: [],
    };
  }
  const missingSlots = input.expectedTargets.filter((target) => !appliedSlots.includes(target));
  const proposedAlternatives = [];
  for (const requested of missingSlots) {
    const proposed = adapter.alternatives?.[stripLocaleSuffix(requested)] ?? adapter.alternatives?.[requested];
    if (proposed && appliedSlots.some((slot) => slot === proposed || slot.startsWith(`${proposed}.`))) proposedAlternatives.push({ requested, proposed });
  }
  return {
    appliedSlots,
    missingSlots,
    fallbackMatched: [],
    proposedAlternatives,
  };
}

/** @deprecated Use reportDeclaredCoverage for locale-exact applied/missing. */
export function adapterCoverage(templateId: string, expectedTargets: string[], appliedSlots: string[] = []) {
  return reportDeclaredCoverage({ templateId, expectedTargets, appliedSlots });
}
