import Link from "next/link";
import { ChevronRight, FileSpreadsheet, PackageOpen, Plus } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";

export default function ContentPage() {
  return (
    <div className="app-shell">
      <AppSidebar active="content" />
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <Link href="/">Workspace</Link>
            <ChevronRight size={12} />
            <strong>内容与商品</strong>
          </div>
          <Link className="primary-button" href="/workspace?new=1&import=products">
            <FileSpreadsheet size={14} /> 导入商品表格
          </Link>
        </header>
        <div className="page-content data-page">
          <div className="data-page-head">
            <div>
              <div className="eyebrow">Content / Catalog</div>
              <h1>内容与商品</h1>
              <p>维护产品目录，导入后可以继续通过对话完善网站内容。</p>
            </div>
            <div className="data-kpi">
              <PackageOpen size={18} />
              <strong>0</strong>
              <span>商品草稿</span>
            </div>
          </div>
          <div className="product-admin-grid">
            <Link className="product-admin-add" href="/workspace?new=1&import=products">
              <Plus size={21} />
              <strong>批量导入商品</strong>
              <span>支持 CSV 与 XLSX</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
