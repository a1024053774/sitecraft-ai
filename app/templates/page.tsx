import { TemplateGallery } from "@/components/template-gallery";
import {
  EDIT_PREVIEW_CTA_LABEL,
  SOURCE_MATERIAL_NOTICE,
  listTemplateReadiness,
} from "@/lib/template-readiness";

export default function TemplatesPage() {
  return (
    <TemplateGallery
      readiness={listTemplateReadiness()}
      materialNotice={SOURCE_MATERIAL_NOTICE}
      editPreviewCtaLabel={EDIT_PREVIEW_CTA_LABEL}
    />
  );
}
