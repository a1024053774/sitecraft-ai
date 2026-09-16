import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Github, Sparkles } from "lucide-react";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import { templates } from "@/lib/site-model";
import {
  EDIT_PREVIEW_CTA_LABEL,
  SOURCE_MATERIAL_NOTICE,
  getTemplateReadiness,
} from "@/lib/template-readiness";

export default async function TemplatePreviewPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const template = templates.find((item) => item.id === templateId);
  if (!template) notFound();
  const readiness = getTemplateReadiness(template.id);

  return (
    <main className="template-preview-page">
      <header className="template-preview-toolbar">
        <div className="template-preview-toolbar-title">
          <Link href="/templates" className="icon-button" aria-label="返回模板列表">
            <ArrowLeft size={15} />
          </Link>
          <div>
            <strong>{template.name}</strong>
            <small style={{ display: "block", marginTop: 3, color: "var(--muted)", fontSize: 9, lineHeight: 1.5 }}>
              {readiness.snapshotLabel} · {readiness.assetLabel}
              <br />
              {SOURCE_MATERIAL_NOTICE}
            </small>
          </div>
        </div>
        <div className="template-preview-toolbar-actions">
          <span className="template-tag">{readiness.snapshotLabel}</span>
          <span className="template-tag">{readiness.assetLabel}</span>
          <a className="secondary-button" href={template.source.repoUrl} target="_blank" rel="noreferrer">
            <Github size={14} /> 源码
          </a>
          <a className="secondary-button" href={template.source.demoUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> 查看官方演示
          </a>
          {readiness.canEnterEditPreview ? (
            <Link className="primary-button" href={`/workspace?template=${template.id}` as Route}>
              <Sparkles size={14} /> {EDIT_PREVIEW_CTA_LABEL}
            </Link>
          ) : null}
        </div>
      </header>
      <div className="template-preview-canvas">
        <OpenSourceTemplateFrame templateId={template.id} variant="preview" />
      </div>
    </main>
  );
}
