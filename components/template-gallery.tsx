"use client";

import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { OpenSourceTemplateFrame } from "@/components/open-source-template-frame";
import { templates } from "@/lib/site-model";

const filters = ["全部模板", "制造业", "外贸目录", "科技企业", "专业服务"];

export type TemplateReadinessView = {
  templateId: string;
  hasLocalSnapshot: boolean;
  snapshotLabel: string;
  assetLabel: string;
  canEnterEditPreview: boolean;
};

export function TemplateGallery({
  readiness,
  materialNotice,
  editPreviewCtaLabel,
}: {
  readiness: TemplateReadinessView[];
  materialNotice: string;
  editPreviewCtaLabel: string;
}) {
  const [filter, setFilter] = useState("全部模板");
  const [selected, setSelected] = useState("forge");
  const readinessById = useMemo(
    () => Object.fromEntries(readiness.map((item) => [item.templateId, item])),
    [readiness],
  );
  const visible = useMemo(
    () =>
      filter === "全部模板"
        ? templates
        : templates.filter((item) => item.category === filter),
    [filter],
  );
  const selectedTemplate = templates.find((item) => item.id === selected);
  const selectedReadiness = readinessById[selected];
  const canEnterEditPreview = selectedReadiness?.canEnterEditPreview === true;
  const localPreviewCount = readiness.filter((item) => item.hasLocalSnapshot).length;

  return (
    <div className="template-page">
      <header className="topbar">
        <div className="breadcrumbs">
          <Link href="/">
            <ArrowLeft size={14} />
          </Link>
          <ChevronRight size={12} />
          <strong>选择一个方向</strong>
        </div>
        <div className="top-actions">
          <span className="save-status">
            <Check size={13} />
            自动保存
          </span>
          <span className="eyebrow" style={{ marginLeft: 7 }}>
            Step 01 / 03
          </span>
        </div>
      </header>
      <main className="page-content">
        <div className="template-intro">
          <div className="eyebrow">
            {templates.length} 套开源模板候选 · {localPreviewCount} 套本地静态预览
          </div>
          <h1>
            先选一个方向，
            <br />
            <span style={{ color: "#2e6b4f" }}>再让 AI 继续。</span>
          </h1>
          <p>
            代码来源均可浏览。有本地静态快照的模板可进入编辑预览（非发布），没有快照的只能看上游演示或待构建快照，不能当作已可生成的客户站点。
            {materialNotice}。当前没有已核验的完整客户素材包。
          </p>
        </div>
        <div className="template-filters">
          {filters.map((item) => (
            <button
              key={item}
              className={`filter ${item === filter ? "active" : ""}`}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="template-grid">
          {visible.map((template) => {
            const status = readinessById[template.id];
            return (
              <article
                className={`template-card ${selected === template.id ? "selected" : ""}`}
                key={template.id}
                onClick={() => setSelected(template.id)}
              >
                <div className="template-cover template-live-cover">
                  <OpenSourceTemplateFrame templateId={template.id} variant="thumbnail" />
                  <div className="template-live-badge">{status?.snapshotLabel ?? "仅上游演示／待构建快照"}</div>
                  <Link
                    href={`/templates/${template.id}/preview` as Route}
                    className="template-preview-open"
                    onClick={(event) => event.stopPropagation()}
                  >
                    预览整页 <ExternalLink size={11} />
                  </Link>
                </div>
                <div className="template-info">
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                  <div className="template-tags">
                    <span className="template-tag">{status?.assetLabel ?? "素材待核验"}</span>
                    {template.tags.map((tag) => (
                      <span className="template-tag" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="template-ai-profile">
                    <Sparkles size={11} />
                    <span>{template.promptProfile.role}</span>
                  </div>
                  <div className="template-source">
                    <span>
                      {template.source.name} · {template.source.framework}
                    </span>
                    <div>
                      <a
                        href={template.source.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        官方演示 <ExternalLink size={10} />
                      </a>
                      <Link
                        href={`/templates/${template.id}/preview` as Route}
                        onClick={(event) => event.stopPropagation()}
                      >
                        预览 <ExternalLink size={10} />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="template-bottom">
          {canEnterEditPreview ? (
            <Link
              href={`/workspace?template=${selected}`}
              className="primary-button"
            >
              <Sparkles size={15} />
              {editPreviewCtaLabel} <ArrowRight size={15} />
            </Link>
          ) : (
            <p>
              当前模板没有本地静态快照，不能进入生成。请浏览官方演示或整页预览。
            </p>
          )}
        </div>
      </main>
      <div className="template-selected">
        <div>
          <strong>
            {selectedTemplate?.name}
          </strong>
          <small>
            {canEnterEditPreview
              ? `有限预览 · 非发布 · ${selectedReadiness?.assetLabel ?? "素材待核验"}`
              : `${selectedReadiness?.snapshotLabel ?? "仅上游演示／待构建快照"} · 不可生成`}
          </small>
        </div>
        <Check size={17} color="#b9f56b" />
      </div>
    </div>
  );
}
