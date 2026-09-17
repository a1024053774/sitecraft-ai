import type { SlotApplyReport, TemplateAdapter, TemplateSlot } from "./types.ts";

const textSlot = (target: string, selector: string): TemplateSlot => ({
  target,
  selector,
  attr: "text",
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

export const templateAdapters: Readonly<Record<string, TemplateAdapter>> = {
  forge: {
    templateId: "forge",
    runtime: "astro-static",
    slots: [
      textSlot("hero.title", '[data-testid="hero-text"]'),
      textSlot("hero.subtitle", '[data-testid="intro-text"]'),
      textSlot("contact.email", 'footer a[href^="mailto:"]'),
      textSlot("contact.phone", "footer tel"),
      textSlot("contact.address", "footer ul.max-w-\\[160px\\] > li:first-child > a"),
      textSlot("services.items.0.title", "main > section.max-w-\\[80\\%\\] > div:nth-of-type(1) > p.mb-4"),
      textSlot("services.items.0.body", "main > section.max-w-\\[80\\%\\] > div:nth-of-type(1) > p.text-lg"),
      textSlot("services.items.1.title", "main > section.max-w-\\[80\\%\\] > div:nth-of-type(2) > p.mb-4"),
      textSlot("services.items.1.body", "main > section.max-w-\\[80\\%\\] > div:nth-of-type(2) > p.text-lg"),
      textSlot("services.items.2.title", "main > section.max-w-\\[80\\%\\] > div:nth-of-type(3) > p.mb-4"),
      textSlot("services.items.2.body", "main > section.max-w-\\[80\\%\\] > div:nth-of-type(3) > p.text-lg"),
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
      textSlot("hero.title", "section.md\\:grid-cols-2.md\\:items-center.md\\:gap-8 > div > h1"),
      textSlot("hero.subtitle", "section.md\\:grid-cols-2.md\\:items-center.md\\:gap-8 p.mt-3"),
      textSlot("hero.cta", "section.md\\:grid-cols-2.md\\:items-center.md\\:gap-8 a.bg-orange-400"),
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
    sanitize: {
      sections: ["Simple, Transparent Pricing"],
      leafPatterns: ["Explore ScrewFast on GitHub", "Contact Sales Team", "7K[+]", "Crafted by"],
    },
  },
  fresh: {
    templateId: "fresh",
    runtime: "astro-static",
    slots: [
      textSlot("hero.title", "h1.title.is-1"),
      textSlot("hero.subtitle", "h2.subtitle.is-5.is-muted"),
      textSlot("hero.cta", "a.button.cta.primary-btn"),
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
    ],
    alternatives: { ...contactToHeroCta },
  },
  landwind: {
    templateId: "landwind",
    runtime: "static-html",
    slots: [
      textSlot("companyName", "span.self-center.text-xl"),
      textSlot("hero.title", "h1.max-w-2xl.mb-4"),
      textSlot("hero.subtitle", "p.max-w-2xl.mb-6.font-light"),
      textSlot("hero.cta", "a.text-center.text-gray-900.border.border-gray-200"),
    ],
    sections: [
      { key: "solutions", selector: 'img[alt="dashboard feature image"]', root: "section" },
      { key: "partners", selector: "h2.mt-3.mb-4", root: "section" },
      { key: "faq", selector: "#accordion-flush", root: "section" },
      { key: "contact", selector: "h2.leading-tight", root: "section" },
    ],
    alternatives: { ...contactToHeroCta },
    sanitize: {
      leafPatterns: ["Get Figma file", "Star themesberg/landwind"],
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
