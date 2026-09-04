import type { TemplateAdapter } from "./types.ts";

/**
 * powerai（GENAI / genai）适配 —— 占位：搬运共享 route 既有片段，行为不变。
 * sanitize 为 published 变体残留 demo 清理；暂无专属 servicesFn。
 */
const sanitize: TemplateAdapter["sanitize"] = {
  sections: ["Everything you need to build with AI", "Loved by developers", "Frequently asked questions"],
  leafPatterns: [
    "99.9%",
    "10M[+]",
    "50K[+]",
    "Uptime",
    "AI Requests",
    "Users",
    "[$]0",
    "[$]49",
    "[/]month",
    "Most Popular",
    "API requests",
    "uptime SLA",
    "Basic AI models",
    "Advanced AI models",
    "All AI models",
    "Sarah Chen",
    "Marcus Rodriguez",
    "Emily Watson",
    "TechCorp",
    "StartupXYZ",
    "InnovateLabs",
    "SOC 2",
    "HIPAA",
    "GDPR",
  ],
};

export const poweraiAdapter: TemplateAdapter = {
  templateId: "powerai",
  sanitize,
};
