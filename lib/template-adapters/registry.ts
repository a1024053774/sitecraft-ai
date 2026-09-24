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
      textSlot("companyName", '[data-sitecraft-brand-name="nav"]'),
      textSlot("companyName", '[data-sitecraft-brand="footer"]'),
      textSlot("hero.title", '[data-sitecraft-benchmark="hero-title"]'),
      textSlot("hero.subtitle", '[data-sitecraft-benchmark="hero-subtitle"]'),
      textSlot("hero.cta", '[data-sitecraft-benchmark="hero-cta"]'),
      textSlot("industry", '[data-sitecraft-optional="industry"]'),
      textSlot("primaryAction", '[data-sitecraft-optional="action"]'),
      textSlot("navigation.products", '[data-sitecraft-nav="products"]'),
      textSlot("navigation.services", '[data-sitecraft-nav="services"]'),
      textSlot("navigation.contact", '[data-sitecraft-nav="contact"]'),
      srcSlot("hero.image", '[data-sitecraft-benchmark="hero-image"]'),
      textSlot("contact.title", '[data-sitecraft-contact="title"]'),
      textSlot("contact.body", '[data-sitecraft-contact="body"]'),
      textSlot("contact.email", '[data-sitecraft-contact="email"]'),
      textSlot("contact.phone", '[data-sitecraft-contact="phone"]'),
      textSlot("services.title", '[data-sitecraft-benchmark="services-title"]'),
      textSlot("services.intro", '[data-sitecraft-benchmark="services-intro"]'),
      textSlot("services.items.0.title", '[data-sitecraft-benchmark="services-item-0-title"]'),
      textSlot("services.items.0.body", '[data-sitecraft-benchmark="services-item-0-body"]'),
      textSlot("services.items.1.title", '[data-sitecraft-benchmark="services-item-1-title"]'),
      textSlot("services.items.1.body", '[data-sitecraft-benchmark="services-item-1-body"]'),
      textSlot("services.items.2.title", '[data-sitecraft-benchmark="services-item-2-title"]'),
      textSlot("services.items.2.body", '[data-sitecraft-benchmark="services-item-2-body"]'),
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
      { key: "products", selector: '[data-sitecraft-section="products"]' },
      { key: "services", selector: '[data-sitecraft-section="services"]' },
      { key: "faq", selector: '[data-sitecraft-section="faq"]' },
      { key: "contact", selector: '[data-sitecraft-section="contact"]' },
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
      background: "#ffffff",
      surface: "#ffffff",
      text: "#17212b",
      muted: "#5d6872",
      accent: "#3b6b86",
      accentStrong: "#284d63",
      accentSoft: "#e8f0f4",
      border: "#d8e0e5",
      diagram: "#e8eff2",
      tint: "#f3f6f7",
      font: 'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"',
      radius: "1rem",
      },
      palettes: {
        "industrial-white": {
          background: "#ffffff", surface: "#ffffff", text: "#17212b", muted: "#5d6872", accent: "#3b6b86", accentStrong: "#284d63", accentSoft: "#e8f0f4", border: "#d8e0e5", diagram: "#e8eff2", tint: "#f3f6f7", font: 'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"', radius: "1rem",
        },
        "industrial-minimal-gray": {
          background: "#f2f4f5", surface: "#fbfcfc", text: "#202a31", muted: "#5b6870", accent: "#4d6676", accentStrong: "#354b5a", accentSoft: "#e8edf0", border: "#d3dce1", diagram: "#e3eaed", tint: "#eef2f4", font: 'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"', radius: "1rem",
        },
        "industrial-mint": {
          background: "#eff5f2", surface: "#ffffff", text: "#17302c", muted: "#55716c", accent: "#1d6b63", accentStrong: "#145049", accentSoft: "#e2f0ed", border: "#cfe0dc", diagram: "#deece8", tint: "#eaf3f0", font: 'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"', radius: "1rem",
        },
        "industrial-sand": {
          background: "#f5f1eb", surface: "#fffdf9", text: "#30261e", muted: "#746455", accent: "#805b37", accentStrong: "#604326", accentSoft: "#f2e7d9", border: "#dfd3c4", diagram: "#ebe0d2", tint: "#f3eadf", font: 'ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol,"Noto Color Emoji"', radius: "1rem",
        },
      },
      modules: [
        kitShell("nav", '[data-sitecraft-brand="nav"]'),
        kitShell("footer", '[data-sitecraft-brand="footer"]'),
        kitContent("products", '[data-sitecraft-section="products"]'),
        kitContent("services", '[data-sitecraft-section="services"]'),
        kitContent("faq", '[data-sitecraft-section="faq"]'),
        kitContent("contact", '[data-sitecraft-section="contact"]'),
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
      textSlot("hero.title", '[data-sitecraft-benchmark="hero-title"]'),
      textSlot("hero.subtitle", '[data-sitecraft-benchmark="hero-subtitle"]'),
      textSlot("hero.cta", '[data-sitecraft-benchmark="hero-cta"]'),
      textSlot("industry", '[data-sitecraft-optional="industry"]'),
      textSlot("primaryAction", '[data-sitecraft-optional="action"]'),
      textSlot("navigation.products", '[data-sitecraft-nav="products"]'),
      textSlot("navigation.services", '[data-sitecraft-nav="services"]'),
      textSlot("navigation.contact", '[data-sitecraft-nav="contact"]'),
      srcSlot("hero.image", '[data-sitecraft-benchmark="hero-image"]'),
      textSlot("products.title", '[data-sitecraft-benchmark="products-title"]'),
      textSlot("products.intro", '[data-sitecraft-benchmark="products-intro"]'),
      textSlot("services.title", '[data-sitecraft-benchmark="services-title"]'),
      textSlot("services.intro", '[data-sitecraft-benchmark="services-intro"]'),
      textSlot("services.items.0.title", '[data-sitecraft-benchmark="services-item-0-title"]'),
      textSlot("services.items.0.body", '[data-sitecraft-benchmark="services-item-0-body"]'),
      textSlot("services.items.1.title", '[data-sitecraft-benchmark="services-item-1-title"]'),
      textSlot("services.items.1.body", '[data-sitecraft-benchmark="services-item-1-body"]'),
      textSlot("services.items.2.title", '[data-sitecraft-benchmark="services-item-2-title"]'),
      textSlot("services.items.2.body", '[data-sitecraft-benchmark="services-item-2-body"]'),
      textSlot("faq.title", '[data-sitecraft-benchmark="faq-title"]'),
      textSlot("faq.intro", '[data-sitecraft-benchmark="faq-intro"]'),
      textSlot("faq.items.0.title", '[data-sitecraft-benchmark="faq-item-0-title"]'),
      textSlot("faq.items.0.body", '[data-sitecraft-benchmark="faq-item-0-body"]'),
      textSlot("faq.items.1.title", '[data-sitecraft-benchmark="faq-item-1-title"]'),
      textSlot("faq.items.1.body", '[data-sitecraft-benchmark="faq-item-1-body"]'),
      textSlot("faq.items.2.title", '[data-sitecraft-benchmark="faq-item-2-title"]'),
      textSlot("faq.items.2.body", '[data-sitecraft-benchmark="faq-item-2-body"]'),
      textSlot("contact.title", '[data-sitecraft-benchmark="contact-title"]'),
      textSlot("contact.body", '[data-sitecraft-benchmark="contact-body"]'),
      textSlot("contact.email", '[data-sitecraft-contact="email"]'),
      textSlot("contact.phone", '[data-sitecraft-contact="phone"]'),
    ],
    sections: [
      { key: "products", selector: '[data-sitecraft-section="products"]' },
      { key: "services", selector: '[data-sitecraft-section="services"]' },
      { key: "faq", selector: '[data-sitecraft-section="faq"]' },
      { key: "contact", selector: '[data-sitecraft-section="contact"]' },
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
        background: "#f4f5f3",
        surface: "#ffffff",
        text: "#151817",
        muted: "#5e6762",
        accent: "#d9652b",
        accentStrong: "#ad451d",
        accentSoft: "#fff0e8",
        border: "#d7ddd8",
        diagram: "#e8ece8",
        tint: "#eef4f0",
        font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
        radius: "1.125rem",
      },
      palettes: {
        "engineering-orange": {
          background: "#f4f5f3",
          surface: "#ffffff",
          text: "#151817",
          muted: "#5e6762",
          accent: "#d9652b",
          accentStrong: "#ad451d",
          accentSoft: "#fff0e8",
          border: "#d7ddd8",
          diagram: "#e8ece8",
          tint: "#eef4f0",
          font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          radius: "1.125rem",
        },
        "engineering-slate": {
          background: "#eef2f5",
          surface: "#fbfcfd",
          text: "#17212b",
          muted: "#526273",
          accent: "#2d6f95",
          accentStrong: "#1d4f70",
          accentSoft: "#e2eef5",
          border: "#cbd6df",
          diagram: "#dfe8ee",
          tint: "#e8f0f4",
          font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
          radius: "1.125rem",
        },
        "engineering-deep-blue": {
          background: "#eef3f6", surface: "#ffffff", text: "#12212c", muted: "#536875", accent: "#236b8e", accentStrong: "#164862", accentSoft: "#e3f0f5", border: "#cddbe2", diagram: "#dfeaf0", tint: "#edf4f7", font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"', radius: "1.125rem",
        },
        "engineering-oxide": {
          background: "#f2f4f1", surface: "#ffffff", text: "#1d2723", muted: "#58655e", accent: "#9a5b35", accentStrong: "#6f3f25", accentSoft: "#f4e9e1", border: "#d8ded8", diagram: "#e7ece7", tint: "#eef3ee", font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"', radius: "1.125rem",
        },
      },
      modules: [
        kitShell("nav", '[data-sitecraft-brand="nav"]'),
        kitShell("footer", '[data-sitecraft-brand="footer"]'),
        kitContent("products", '[data-sitecraft-section="products"]'),
        kitContent("services", '[data-sitecraft-section="services"]'),
        kitContent("faq", '[data-sitecraft-section="faq"]'),
        kitContent("contact", '[data-sitecraft-section="contact"]'),
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
      textSlot("companyName", '[data-sitecraft-brand-name="nav"]'),
      textSlot("companyName", '[data-sitecraft-brand="footer"]'),
      textSlot("hero.title", '[data-sitecraft-benchmark="hero-title"]'),
      textSlot("hero.subtitle", '[data-sitecraft-benchmark="hero-subtitle"]'),
      textSlot("hero.cta", '[data-sitecraft-benchmark="hero-cta"]'),
      textSlot("industry", '[data-sitecraft-optional="industry"]'),
      textSlot("primaryAction", '[data-sitecraft-optional="action"]'),
      textSlot("navigation.products", '[data-sitecraft-nav="products"]'),
      textSlot("navigation.services", '[data-sitecraft-nav="services"]'),
      textSlot("navigation.contact", '[data-sitecraft-nav="contact"]'),
      srcSlot("hero.image", '[data-sitecraft-benchmark="hero-image"]'),
      textSlot("products.title", '[data-sitecraft-benchmark="products-title"]'),
      textSlot("products.intro", '[data-sitecraft-benchmark="products-intro"]'),
      textSlot("services.title", '[data-sitecraft-benchmark="services-title"]'),
      textSlot("services.intro", '[data-sitecraft-benchmark="services-intro"]'),
      textSlot("services.items.0.title", '[data-sitecraft-benchmark="services-item-0-title"]'),
      textSlot("services.items.0.body", '[data-sitecraft-benchmark="services-item-0-body"]'),
      textSlot("services.items.1.title", '[data-sitecraft-benchmark="services-item-1-title"]'),
      textSlot("services.items.1.body", '[data-sitecraft-benchmark="services-item-1-body"]'),
      textSlot("services.items.2.title", '[data-sitecraft-benchmark="services-item-2-title"]'),
      textSlot("services.items.2.body", '[data-sitecraft-benchmark="services-item-2-body"]'),
      textSlot("faq.title", '[data-sitecraft-faq="title"]'),
      textSlot("faq.intro", '[data-sitecraft-faq="intro"]'),
      textSlot("faq.items.0.title", '[data-sitecraft-faq="q1"]'),
      textSlot("faq.items.0.body", '[data-sitecraft-faq="a1"]'),
      textSlot("faq.items.1.title", '[data-sitecraft-faq="q2"]'),
      textSlot("faq.items.1.body", '[data-sitecraft-faq="a2"]'),
      textSlot("faq.items.2.title", '[data-sitecraft-faq="q3"]'),
      textSlot("faq.items.2.body", '[data-sitecraft-faq="a3"]'),
      textSlot("contact.title", '[data-sitecraft-contact="title"]'),
      textSlot("contact.body", '[data-sitecraft-contact="body"]'),
      textSlot("contact.email", '[data-sitecraft-contact="email"]'),
      textSlot("contact.phone", '[data-sitecraft-contact="phone"]'),
    ],
    sections: [
      { key: "products", selector: '[data-sitecraft-section="products"]' },
      { key: "services", selector: '[data-sitecraft-section="services"]' },
      { key: "faq", selector: '[data-sitecraft-section="faq"]' },
      { key: "contact", selector: '[data-sitecraft-section="contact"]' },
    ],
    alternatives: { ...contactToHeroCta },
    kit: {
      familyId: "technical-product",
      tokens: {
        background: "#f1f3f4", surface: "#ffffff", text: "#1c2933", muted: "#5d6b76", accent: "#466f87", accentStrong: "#2f5166", accentSoft: "#e8f0f4", border: "#d4dde2", diagram: "#dfe8ec", tint: "#f5f7f8", font: 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', radius: "1rem",
      },
      palettes: {
        "technical-white": {
          background: "#f1f3f4", surface: "#ffffff", text: "#1c2933", muted: "#5d6b76", accent: "#466f87", accentStrong: "#2f5166", accentSoft: "#e8f0f4", border: "#d4dde2", diagram: "#dfe8ec", tint: "#f5f7f8", font: 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', radius: "1rem",
        },
        "technical-neutral": {
          background: "#e7eaec", surface: "#fafbfb", text: "#202a31", muted: "#606c74", accent: "#526b7b", accentStrong: "#384f5e", accentSoft: "#e4ebef", border: "#ccd7dc", diagram: "#d8e2e7", tint: "#f0f3f4", font: 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', radius: "1rem",
        },
        "technical-cobalt": {
          background: "#eef1f5", surface: "#ffffff", text: "#162330", muted: "#5a6a79", accent: "#1f5fae", accentStrong: "#16457f", accentSoft: "#e4eefb", border: "#cedae8", diagram: "#dfe9f4", tint: "#edf3fa", font: 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', radius: "1rem",
        },
        "technical-olive": {
          background: "#f0f2ed", surface: "#ffffff", text: "#273026", muted: "#647064", accent: "#596d2f", accentStrong: "#3d4e20", accentSoft: "#e9efdf", border: "#d5ddca", diagram: "#e2e9d8", tint: "#eef3e8", font: 'ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', radius: "1rem",
        },
      },
      modules: [
        kitShell("nav", '[data-sitecraft-brand="nav"]'),
        kitShell("footer", '[data-sitecraft-brand="footer"]'),
        kitContent("products", '[data-sitecraft-section="products"]'),
        kitContent("services", '[data-sitecraft-section="services"]'),
        kitContent("faq", '[data-sitecraft-section="faq"]'),
        kitContent("contact", '[data-sitecraft-section="contact"]'),
      ],
    },
  },
  landwind: {
    templateId: "landwind",
    runtime: "static-html",
    slots: [
      textSlot("companyName", '[data-sitecraft-brand-name="nav"]'),
      textSlot("companyName", '[data-sitecraft-brand="footer"]'),
      textSlot("hero.title", '[data-sitecraft-benchmark="hero-title"]'),
      textSlot("hero.subtitle", '[data-sitecraft-benchmark="hero-subtitle"]'),
      textSlot("hero.cta", '[data-sitecraft-benchmark="hero-cta"]'),
      textSlot("industry", '[data-sitecraft-optional="industry"]'),
      textSlot("primaryAction", '[data-sitecraft-optional="action"]'),
      textSlot("navigation.products", '[data-sitecraft-nav="products"]'),
      textSlot("navigation.services", '[data-sitecraft-nav="services"]'),
      textSlot("navigation.contact", '[data-sitecraft-nav="contact"]'),
      srcSlot("hero.image", '[data-sitecraft-benchmark="hero-image"]'),
      textSlot("products.title", '[data-sitecraft-benchmark="products-title"]'),
      textSlot("products.intro", '[data-sitecraft-benchmark="products-intro"]'),
      textSlot("services.title", '[data-sitecraft-benchmark="services-title"]'),
      textSlot("services.intro", '[data-sitecraft-benchmark="services-intro"]'),
      textSlot("services.items.0.title", '[data-sitecraft-benchmark="services-item-0-title"]'),
      textSlot("services.items.0.body", '[data-sitecraft-benchmark="services-item-0-body"]'),
      textSlot("services.items.1.title", '[data-sitecraft-benchmark="services-item-1-title"]'),
      textSlot("services.items.1.body", '[data-sitecraft-benchmark="services-item-1-body"]'),
      textSlot("services.items.2.title", '[data-sitecraft-benchmark="services-item-2-title"]'),
      textSlot("services.items.2.body", '[data-sitecraft-benchmark="services-item-2-body"]'),
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
      textSlot("contact.email", '[data-sitecraft-contact="email"]'),
      textSlot("contact.phone", '[data-sitecraft-contact="phone"]'),
    ],
    sections: [
      { key: "products", selector: '[data-sitecraft-section="products"]' },
      { key: "services", selector: '[data-sitecraft-section="services"]' },
      { key: "faq", selector: '[data-sitecraft-section="faq"]' },
      { key: "contact", selector: '[data-sitecraft-section="contact"]' },
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
        background: "#f6f9fc",
        surface: "#ffffff",
        text: "#10233d",
        muted: "#5d7188",
        accent: "#1e5f91",
        accentStrong: "#174b73",
        accentSoft: "#e8f2fa",
        border: "#d8e3ee",
        diagram: "#e3eef7",
        tint: "#eef5fa",
        font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        radius: "0.875rem",
      },
      palettes: {
        "export-sea": {
          background: "#f6f9fc", surface: "#ffffff", text: "#10233d", muted: "#5d7188", accent: "#1e5f91", accentStrong: "#174b73", accentSoft: "#e8f2fa", border: "#d8e3ee", diagram: "#e3eef7", tint: "#eef5fa", font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif', radius: "0.875rem",
        },
        "export-industrial-slate": {
          background: "#f3f5f7", surface: "#ffffff", text: "#1b2734", muted: "#5b6b79", accent: "#4f718c", accentStrong: "#35566f", accentSoft: "#eaf0f4", border: "#d6e0e7", diagram: "#e6edf2", tint: "#f0f4f7", font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif', radius: "0.875rem",
        },
        "export-cobalt": {
          background: "#f4f7fb", surface: "#ffffff", text: "#102541", muted: "#5a6f8b", accent: "#1f5fae", accentStrong: "#15447f", accentSoft: "#e4effb", border: "#d2dfef", diagram: "#e2edf8", tint: "#eef5fc", font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif', radius: "0.875rem",
        },
        "export-ink": {
          background: "#f2f7f8", surface: "#ffffff", text: "#102b38", muted: "#58717d", accent: "#0f5b78", accentStrong: "#0a4055", accentSoft: "#e0f0f4", border: "#cadde3", diagram: "#dcebf0", tint: "#ebf4f6", font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif', radius: "0.875rem",
        },
      },
      modules: [
        kitShell("nav", '[data-sitecraft-brand="nav"]'),
        kitShell("footer", '[data-sitecraft-brand="footer"]'),
        kitContent("products", '[data-sitecraft-section="products"]', "self", "nordic-store"),
        kitContent("services", '[data-sitecraft-section="services"]'),
        kitContent("faq", '[data-sitecraft-section="faq"]'),
        kitContent("contact", '[data-sitecraft-section="contact"]'),
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
        background: "#f6f9fc",
        surface: "#ffffff",
        text: "#10233d",
        muted: "#5d7188",
        accent: "#1e5f91",
        accentStrong: "#174b73",
        accentSoft: "#e8f2fa",
        border: "#d8e3ee",
        diagram: "#e3eef7",
        tint: "#eef5fa",
        font: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
        radius: "0.875rem",
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
