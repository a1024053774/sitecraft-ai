"use client";

/**
 * 商品目录导入弹窗（B4 拆文件 · 第一刀）。
 *
 * ## 边界
 *
 * 从 `app/workspace/page.tsx` 搬出的**一个自包含模态**：上传表格 → 解析 →
 * 逐商品上传主图。业务写入仍走父级的 `onImportProducts` / `onUploadImage`
 * 回调（＝原来的 `commitImportedRows` / `applyImageToProduct`），
 * **本组件不直接发请求、不碰草稿状态**。
 *
 * ## 纯搬家声明（B4 红线：零行为变更）
 *
 * JSX 逐字来自拆分前的 workspace 页（`showImport && (...)` 那一块），
 * 只把闭包引用改成 props：
 *  - `draft.products` → `products`；`importState` → `importState`；
 *  - `fileRef` / `handleFile` → 组件内自己的 ref 与 `onPickFile`；
 *  - 关闭动作 `setShowImport(false)` → `onClose`。
 *
 * ⚠️ **不接管 `showImport` 开关**：父级仍在挂载点做条件渲染（`{showImport && <ProductImportDialog/>}`），
 * 与拆分前逐字一致——这样"什么时候渲染"这件事零改动。
 */
import { ChevronRight, CircleAlert, Check, CloudUpload, FileSpreadsheet, Image as ImageIcon, X } from "lucide-react";
import { useRef } from "react";

export type ProductImageRow = {
  sku: string;
  name: { zh: string; en: string };
  image?: string | null;
  imageColor?: string | null;
};

export type ImportOutcome = { name: string; imported: number; errors: string[] };

type Props = {
  products: ProductImageRow[];
  /** 上一次导入的结果（成功/失败摘要），null = 还没导过 */
  importState: ImportOutcome | null;
  /** 正在上传主图的 SKU；null = 空闲 */
  productImageBusy: string | null;
  onClose: () => void;
  /** 用户选了表格文件（父级做解析 + 保存，保持原有错误处理位置不变） */
  onPickFile: (file: File) => void;
  /** 上传/清除某个商品的主图（file=null 表示清除） */
  onUploadImage: (sku: string, file: File | null) => void;
};

export function ProductImportDialog({
  products,
  importState,
  productImageBusy,
  onClose,
  onPickFile,
  onUploadImage,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const withImage = products.filter((item) => item.image).length;

  return (
    <div className="modal-backdrop" onClick={onClose}><div className="import-modal" onClick={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><div className="eyebrow">Content / Products</div><h3>填充你的商品目录</h3></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={15} /></button></div>
      <p className="modal-copy">上传 CSV 或 XLSX 商品表格，校验后直接保存为可撤销草稿。AI 可以继续修改指定 SKU 的中英文名称、简介和分类。</p>
      <div className="upload-zone" onClick={() => fileRef.current?.click()}><input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onPickFile(file); }} /><div className="upload-icon"><CloudUpload size={20} /></div><strong>点击上传表格</strong><span>需要包含 SKU、产品名称、分类等字段</span><small>CSV / XLSX · 最多 1000 行</small></div>
      <div className="import-options"><div><FileSpreadsheet size={15} /><span>支持中英文列名自动识别</span><ChevronRight size={13} style={{ marginLeft: "auto" }} /></div><div><ImageIcon size={15} /><span>可选"图片/图片URL"列填产品主图</span><ChevronRight size={13} style={{ marginLeft: "auto" }} /></div></div>
      {importState && <div className={`import-result ${importState.imported ? "" : "error"}`}>{importState.imported ? <Check size={14} /> : <CircleAlert size={14} />}<div><strong>{importState.name} {importState.imported ? "已保存" : "导入失败"}</strong><span>{importState.imported ? `新增或更新 ${importState.imported} 个商品` : importState.errors[0]}{importState.imported && importState.errors.length ? `，${importState.errors.length} 行需要检查` : ""}</span></div></div>}
      {/* 商品主图：2026-09-10 接线。`/api/product-images` 与 `product.image` 早已就绪，
          但此前**没有任何入口能写它**——工厂站的说服力主要来自实拍图，这条是主路径。 */}
      {products.length > 0 && (
        <div className="product-image-list">
          <div className="product-image-head">为商品上传实拍主图（当前 {withImage} / {products.length} 已有图）</div>
          {products.map((product) => (
            <div className="product-image-row" key={product.sku}>
              <span className="product-image-thumb" style={product.image ? { backgroundImage: `url(${product.image})` } : { background: product.imageColor || "#e5e7eb" }} />
              <span className="product-image-name">{product.name.zh || product.name.en || product.sku}</span>
              <span className="product-image-sku">{product.sku}</span>
              <label className="secondary-button product-image-upload">
                {productImageBusy === product.sku ? "上传中…" : product.image ? "更换" : "上传"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={productImageBusy !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.target.value = "";
                    if (file) onUploadImage(product.sku, file);
                  }}
                />
              </label>
              {product.image && (
                <button type="button" className="icon-button" aria-label={`清除 ${product.sku} 主图`} disabled={productImageBusy !== null} onClick={() => onUploadImage(product.sku, null)}><X size={13} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {/* ⚠️ 位置必须与拆分前逐字一致：`modal-foot` 在 `product-image-list` **外面**、
          无条件渲染（商品为空时也要显示"当前草稿商品：0 / 1000"和完成按钮）。 */}
      <div className="modal-foot"><span>当前草稿商品：{products.length} / 1000</span><button className="primary-button" onClick={onClose}>完成</button></div>
    </div></div>
  );
}