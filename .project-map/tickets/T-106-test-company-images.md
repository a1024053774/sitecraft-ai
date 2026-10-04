---
id: T-106
title: 三份模拟资料包的测试用公司图片（许可清楚、走上传接口）
type: build
status: open
blocked_by: []
claimed_by: image-scout
supersedes:
---

## What to build

T-104 第 ② 步的素材部分。为工业、外贸、注塑三份模拟资料各找 6–10 张许可清楚的真实照片，当作「这家公司提供的图片」，覆盖产品、设备、厂区 / 车间、检测四类；内容要和这家公司的行业、产品对得上（T-010），不能用和资料无关的图冒充。

- 许可只收 CC0 / 公有领域 / CC-BY / CC-BY-SA；每张记录来源 URL、作者、许可、下载日期、对应资料包和用途类别（`tests/fixtures/company-images/<pack>/LICENSES.md` + 机器可读 `manifest.json`）。CC-BY / CC-BY-SA 的署名要求写清楚，后续页面怎么署名由 T-107 处理。
- 图片压到长边 ≤ 1600px、单张 ≤ 300 KB，原图不入库。
- 写一个脚本，把某份资料包的图片通过工作台已有的 `POST /api/sites/[siteId]/images` 上传进指定站点（不直接写草稿文件），用于后续测试。
- 可改范围：`tests/fixtures/company-images/**`、`scripts/` 下新增上传脚本、这张票。禁止改：`lib/**`、`app/**`、`components/**`、区块库。

## Acceptance

- [ ] 三份资料包各 6–10 张，四类都有；`LICENSES.md` / `manifest.json` 每张都有来源和许可，独立审查逐张核对许可页面与图片内容是否对得上
- [ ] 上传脚本在 dev server 上把三份资料包的图片传进三个新建站点，接口返回成功、`/api/sites/[id]/images` 能列出；证据首行写 SHA、命令、时间
- [ ] 代码审查通过；Claude 验收
