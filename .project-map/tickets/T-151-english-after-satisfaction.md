---
id: T-151
title: 中文站满意后生成英文版：沿用同一结构，只翻译文字
type: build
status: closed
blocked_by: []
claimed_by: Codex (t151-english)
supersedes:
---

## Why

负责人 2026-10-09 排定的第 2 项。AGENTS 已定：英文版不和中文一起生成；用户对中文站满意后，再问是否生成英文版；英文版沿用同一结构，只翻译文字。现在站点代码路线只有中文（`lib/code-site.ts` 渲染固定 `lang="zh-CN"`），T-145 转换的旧站英文原文只留在转换产物和源 JSON 里。

## What to build

1. **入口**：工作台在当前中文版本通过底线检查后显示一句询问和一个「生成英文版」按钮（用户点了才生成，不自动生成，不在生成中文时顺带生成）。英文版已存在时按钮改为「按当前中文版重新翻译」，并标明英文版基于中文第几版；中文改过之后提示英文版已落后，不自动重译。
2. **翻译**：对当前中文版本逐页只翻译文字节点和可见属性（alt、title、aria-label、placeholder 等），HTML 结构、class、CSS、图片编号、系统部件原样保留；由代码把译文写回原 DOM，模型不重写 HTML。「待补充」统一译为固定英文占位，系统署名与图标许可用系统自带英文文本。用非思考模式、按页分批，模型只见 s1…sN，代码保存 DOM 映射，函数 enum 列出本批合法编号；只补缺失段落，与底线修正共用两轮额度。控制 token，Resolution 写单站用量。
3. **检查**：英文版走唯一提交入口，存成同一站点的新版本（版本里带英文页面，与中文共用 CSS 和结构），不旁路写站点。确定性检查：数字、型号、单位、邮箱电话等原样保留且不新增；结构与中文一致（同样的节点树，只是文字不同）；375/768/1440 溢出、重叠、对比度照常跑（英文变长更容易溢出）。不过按现有最多两轮修正，修正只改译文；仍不过如实告诉用户。不另跑一次模型事实校对（事实来源是已校对的中文版本，靠确定性比对保证不新增事实）。
4. **预览与发布**：工作台预览可切换中文 / 英文；发布站点英文页用独立路径并 `lang="en"`，页头由系统加语言切换链接（只在英文版存在时出现）。撤销、恢复、刷新沿用现有版本机制。
5. 同步 `intent.md`、`spec.md`、`mainline.md`、`CONTEXT.md`（新术语只用一个名字）。

## Acceptance

- [x] 先列出失效方式（漏译、改结构、数字被改、新增事实、英文溢出、中文改后英文没提示落后、重复点击重复扣 token），再写红绿测试，测试在已知坏实现上失败
- [x] 使用 15:18 保存的真实坏编号原始函数回复建立夹具；旧实现红、短编号与定向补译实现绿；原文保留，协议适配明确标注
- [x] 主控确定的含数字记号、多重集合、确定等价归一与记录公司名规则，各用保存的真实回复建立红绿测试；提交入口也验证通过
- [x] 真实入口端到端：一站中文版 → 点生成英文版 → 预览切换 → 发布页英文路径可打开 → 改中文后显示英文落后 → 重新翻译 → 撤销；1440/768/375 中英截图看过。真实 DeepSeek 只跑这一站，Resolution 写 token 用量
- [x] 英文页交一个新的 gpt-6.1-sol 实例独立看：是否像同一家公司自己的英文站、有没有机翻腔或漏译（只这一站，不跑整轮 eval）
- [x] Astra 审查通过（主控确认 788959c PASS）；合并后 typecheck、test、build 通过

## Failure modes

漏译文字或可见属性；模型改节点树、class、CSS、图片编号或系统部件；原数字、型号、单位、邮箱、电话丢失或新增；英文变长导致溢出、重叠或对比度失败；中文更新后未提示英文版落后；重复点击重复调用模型；翻译中中文已变更仍提交旧结果；修正轮越界改结构；预览、发布、恢复读到不同语言或不同版本。

## Resolution

本轮入口测试配置修复 PASS（2026-10-10）：tests/t151-english.test.ts 按 SITECRAFT_BASE 运行，不再断言端口为 3161；3161 与 3163 各 18/18。同仓库工作台入口约定，未配置时默认 3034；本轮执行均显式使用自有服务，没有连接主服务 3034。新建普通提交，不 amend 已审 788959c 或合并 76d4c5f；SHA 见交付回复。票保持 open，未推送、未关闭，本轮真实模型调用及用量为 **0**。

本轮证据根为 `artifacts/t151/port-isolation-2026-10-10/`：

- `red-76d4c5f-3162.log` 在原实现上明确失败于 base 的 3162/3161 严格相等断言，不是服务不可用。修后读取 SITECRAFT_BASE，默认地址与 tests/helpers/workspace-browser.ts 一致，并赋回检查器环境变量，不依赖具体端口。
- 此文件直接在 Node 进程调用创建、聊天、提交、发布等路由处理器，含失败候选、并发和版本恢复，不能让其文件存储继承工作中服务的数据根。因此保留独立根，沿用 tests/t145-import-cli.test.ts 已有的 artifacts/UUID + SITECRAFT_DATA_ROOT 机制，在存储模块导入前设置 SITE_STORE=fs 和独立根。UUID 也避免同毫秒运行碰撞；不切换 cwd，仍从当前仓库读取技能和布局检查脚本。服务地址只用作浏览器 HTML 文档来源，路由写入在测试进程的独立目录内完成。
- 两次正式命令均为 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:<3161或3163> SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t151/artifacts/t151/port-isolation-2026-10-10/server-store CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell node --test --experimental-strip-types tests/t151-english.test.ts`，green-3161.log / green-3163.log 各 **18/18**（2026-10-10 UTC：3161 为 20:58:50–20:59:01，3163 为 21:02:27–21:02:38）；同环境 `npm run typecheck` 通过（21:03:05，typecheck.log）。红态为 20:58:49，发生在修前 76d4c5f。本轮只改测试配置，不改生产源码，未重跑全仓 test/build，旧合并结果不当本次证据；新提交 SHA 见交付回复。
- `root-audit.json` 记录每次运行各用不同 contracts-UUID 根，正式两次各保存 6 个测试文件，服务根文件数为 0。没有把夹具写入主 .sitecraft-data，没有复制/读取主数据或主 .env.local。3162 原有服务占用，启动本服务失败及该端口试跑日志保留；没有停止既有服务，第二次正式验证选空闲 3163，自起服务后完成。本轮服务均已停止。

前次合并 76d4c5f：主控确认 Astra PASS **788959c** 后，以该已审提交为第一父提交，merge family-kit-assembly **84895cb**，保留 T-151 与 T-148 的行为；原提交与 v6 保持不变。以下保留合并证据，不代替本次端口验证。

合并证据根为 `artifacts/t151/merge-84895cb/`：

- 实际冲突三个文件：`lib/code-site-model.ts` 合并 englishText 与 systemBackdrops 导入，保留严格英文函数调用/用量记录和主线按风格提供可选底图的规则；`lib/code-site.ts` 同时保留中英版本类型、路径/语言切换、询盘文本和三档底图 CSS/许可，底图的系统说明提供英文；`lib/code-site-check.ts` 同时保留英文逐段/同 DOM 位置 CSS 文案核对，以及底图登记清理、解码 RGB 色域和实际背景对比度扫描。扫描传入 backdrops.colors，generatedText 仍为带位置 key 的记录，未把任一侧整文件覆盖。
- `tests/t151-backdrop-merge.test.ts` 的组合场景 3/3 通过（integration.log）：英文控件/署名和三档底图同渲染；加入原文没有的 100 mm 被保真拒收；浅色实际底图上的白字不能借深色 CSS 占位通过。parent-english-red.log 在 788959c 的旧渲染器中缺底图资产而失败，parent-backdrop-red.log 在 84895cb 的旧渲染器中根语言为中文而失败。父源码仅在内存读取，不复制源码作证据。
- 合并源码固定后，`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=.sitecraft-data CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell npm test` 为 **339/339**（20:42:17–20:44:00 UTC，npm-test.log）；同环境 `npm run typecheck` 通过（20:42:18，typecheck.log）。`npm run build` 用本 worktree 的绝对数据根，通过（20:51:02–20:51:08，build.log）。3161 服务使用同一绝对根；测试内部 HTTP 替身仅服务自己的夹具，不连 3034。不读取主数据或主 .env.local。
- `capture-ui.mjs` 在 3161 只读渲染组合样例，不存站、不调模型。ui-final/ 的中英 1440/768/375 六图逐张打开，实际背景地址分别为对应宽度 WebP，英文为 Send inquiry 与英文底图说明，无横向溢出。全量生成的 artifacts/t148/boundary-ba098e16-f127-4681-9e54-b4c64166fee3/site-{1440,768,375}.png 三图也逐张打开。首次 ui/ 与 ui.log 的 URL 正则转义失败保留，修截图脚本后另存 ui-final，不修改产品代码或替换失败记录。这些是合并技术样例，不作为新公司站的独立审美通过。

已审 788959c 的证据根为 `artifacts/t151/final-astra-2026-10-10/`（保留历史结果，不代替合并后检查）：

已审英文实现的公司名标点保护和完整单位别名行为保持不变：

- `red-b86ce7c.log`（20:24:14–20:24:15 UTC）：两条公司名用例在真实 translateSiteCode 入口配本地 HTTP 模型替身中失败，记录名“华星（苏州）机械有限公司”和资料名 Huaxing（Suzhou）Machinery 都被改成 ASCII 括号；rpm/rps/psi 三个已有多词别名也被误拒。年产→per month 负例在旧实现已拒收，没有拿环境错误作红态。
- 标点写回接收记录名称及资料独立英文名字段的受保护名称，按最长原样子串分隔，只转换其余文案。模型入口显式传入这些元数据；页面标题、正文、title/aria-label 都有独立字符串断言，修后再跑同一保真检查通过。不从正文猜公司名，不加公司例外名单。
- 单位登记表已有的多词别名按长度降序完整匹配；revolutions per minute→rpm、revolutions per second→rps、pounds per square inch→psi 在比率分词前归一，内部 per 不被拆走。单词单位仍完整读取，未知单位仍保持原记号；没有加短语补丁、重试或单位制换算。`focused-green.log` 为 52/52，最终全量还包含公司名的保真检查断言；年/月互换、物理单位改变和原 Astra 反例仍拒收。
- 20:27:05–20:27:23 UTC，`node --experimental-strip-types artifacts/t151/final-astra-2026-10-10/recheck-v6.mjs` 在同一 3161 和自有注塑站根只读复检，`v6-recheck.json/log` 为 PASS：v6 / 中文 v3，375/768/1440 的溢出、重叠、对比度拒因全为 0；站点、任务、原始回复与旧检查前后不变，真实调用/用量为 0。
- 固定最终源码后，本次 `npm test` **327/327**（20:27:05–20:28:37 UTC，npm-test.log）、`npm run typecheck` 通过（20:27:05，typecheck.log），`npm run build` 通过（20:29:46–20:29:51，build.log）。全部显式使用 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=<自有根> CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`；test/typecheck 的相对根 `.sitecraft-data` 位于本 worktree，服务/build 用其绝对路径，v6 复检用已批准复制的站点根。不读取主数据或主 .env.local，不连 3034。最终 SHA 见交付回复。

主控的时间比率决定按显式表实现：年/月/日/时/分各一类，不跨类换算。中文年产/月产/日产、每周期与斜杠分母，对应英文 per、斜杠、a year/month/day 及 annually/monthly/daily/hourly。周期前缀按同一生产语法允许产能名词修饰语（v6 的“月注塑能力”）；比率绑定本段同一子句对应数量，不能只把全段周期和数量分别排序，放过年产/月产互换。计数量词、数值、范围与物理单位继续独立核对。无数量的复合比率仍保留分子原记号，不把未知单位丢成普通词。

前轮时间比率修复证据根为 `artifacts/t151/time-rate-2026-10-10/`，其 36/36 与 322/322 不作为本次源码证据：

- `tests/fixtures/t151-time-rate-v6.json` 原样摘录 v6 年产能段及其已保存真实函数回复 s120，并核对 source v3 / v6 的 DOM 段落。`red-2c46e4f.log` 在修前拒收真实等价译文，五类正例也失败；“年产 180 套→180 sets per month”的负例在旧实现已拒收。`period-collapse-mutant-red.log` 把五类错误合并时，该负例的保真断言失败，证明测试能识别跨类放宽。
- `focused-final.log` 为 36/36：真实年产能段、全部批准的周期写法、前后置副词、周期/数量关联均通过相应断言；年/月互换、丢周期、物理单位变化及原 Astra 反例仍拒收。`unbound-unit-red.log` 保留最初未忽略分子与 per 之间空白导致的错误拒收；词法修复后未知分子 custom 在 custom/min 与 custom per minute 中仍相同，改成 other 仍拒收。失败与中间 green 日志全部保留。
- 同一 3161/自有注塑站数据根，`node --experimental-strip-types artifacts/t151/time-rate-2026-10-10/recheck-v6.mjs v6-recheck-final` 的 `v6-recheck-final.json/log` 为 PASS：v6 / 中文 v3，三档底线全通过，站点记录、任务、原始回复及旧检查前后完全相同，真实调用/用量为 0。新结果单独保存，不覆盖前轮拒收记录。
- 本轮命令全部显式设 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=<本 worktree 自有根> CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。固定最终源码后：`npm test` **322/322**（2026-10-10 20:12:06–20:13:37 UTC，npm-test-final.log），`npm run typecheck` 通过（20:12:06，typecheck-final.log），`npm run build` 通过（20:14:46–20:14:51，build.log）；v6 最终复检为 20:12:06–20:12:24。test/typecheck 用本 worktree 内的相对 `.sitecraft-data`，3161 服务和 build 用其绝对路径；v6 只读复检用已批准复制的注塑站自有根。前一轮 321/321 和全部失败日志保留，不能代替最终源码证据。project-map 为 0 problems / 0 stale living docs，提交 SHA 见交付回复。不接触 3034、主数据或主 .env.local。

前轮分词修复的证据根为 `artifacts/t151/tokenizer-fix-2026-10-10/`。先独立抽取含数字型号和单位运算符记号，再解析量值与完整单位；计数归一仅允许纯字母且不含运算符、不属于显式英文单位词表的后续词。rpm、psi、bar、Hz、min、h、s 及常见全称不能被计次数修饰词吞掉；未知单位保持原记号，不能降为无单位。译词的并列斜杠不当量纲，含已登记单位组件的复合记号独立核对；本轮批准的时间比率改按上述五类确定归一。全角 ASCII 标点及中文句号、顿号在英文槽位写回时确定转换，不做整段 NFKC，不改型号或单位字符。

- `red-5dce2af.log`：四个指定反例（42 X900 machines、42 furlongs/min、3 trial runs-per-hour、3 rpm trial runs）与全角标点测试均在修前失败。`independent-operator-red-final-5dce2af.log` 补证没有计数数字时新增 furlongs/min 同样被旧实现放过；源代码仅在内存从指定提交读取，没有复制源码作证据。
- `compact-quantity-red.log` 保留本次独立扫描最初误把 30L/min 当型号的失败；通过量值/已映射单位的词法分类修复，30 升/分钟→30L/min 通过，四个拒收反例继续拒收。`plural-unit-red.log` 另证 years 曾被计次修饰语吞掉，单位词表改为在全部已有单位登记后生成；仍不含纯计数量词。词表顺序收紧前的 `focused-final-2.log` 为 26/26，最终证据以本次全量 verified 日志为准。无企业或短语例外名单。
- 前轮 `v6-recheck-verified.json/log`：同一 3161、自有注塑站数据根，执行只读 `node --experimental-strip-types artifacts/t151/tokenizer-fix-2026-10-10/recheck-v6.mjs v6-recheck-verified`。v6 / 中文 v3 当时在 `home/1/3/5/1/3/2/1/0` 拒收：原文“年产约 180 套”，译文含独立 per year，当时未登记确定等价。该检查在布局扫描前停止；站点与旧检查未改。这是本轮修复的失败依据，不是当前结果，旧 JSON/log 保留。
- 前轮分词修复的命令同样显式使用 3161、自有数据根与指定 CHROME_PATH：`npm test` **313/313**（2026-10-10 19:58:26–20:00:02 UTC，npm-test-verified.log）；`npm run typecheck` 通过（typecheck-verified.log）；`npm run build` 通过（build-verified.log）。这是 2c46e4f 的旧证据，不证明本轮时间比率源码通过；313/313、中间 303/310 失败与旧 v6 拒收记录均保留。

主控裁定保留：“全检”译 full inspection 可接受，新增 100% 仍拒收；公司无明确英文名时沿用中文名加工作台提示。“慢走丝”漏译与共享 CSS 的 1440 标题挤压、窄屏规格换行、页脚邮箱断行是已知反馈，本票不改 CSS、不再真实重译。本轮不新增截图；前次 v6 的中英 1440/768/375 图已经逐张打开，属于此前候选证据，不能代替本轮新检查。

- A1：含数字型号先独立保留，完整量值/单位另外核对；不把复合单位的已知前缀当成全部单位，带数字未知单位还必须与其量值正确关联。复合组件按明确映射归一，未知记号保留完整原文，不转成无单位。30 L/min→30 L/h、20 bar→20 psi、42 次→42 均拒收；另补 Ω、点号单位和两种含数字未知单位互换数值的反例。源纯计数量词的规则保留；普通英文计数名词只有满足上述纯字母/无单位运算符/非单位词条件才归一，已登记的物理/时间单位不因此放宽。次→times/run(s)/occurrence(s)（仍为非空计次单位）、腔→cavities、模次→molding cycles/cycles、级→Class/Grade 都是通用单位/等级写法，没有企业例外名单、公司词表或单位制换算。
- A2：.05 按完整小数解析，不能从 05 中间截出 5；.05 mm→5 mm 拒收，.5 mm→0.5 mm 通过。数字边界也保护 Unicode 型号前缀，不能把 Ω20 中的 20 单独抽走。十进制归一仍用字符串位移，不用浮点近似。
- A3：CSS 生成文字按源中文与英文的实际渲染分别收集；同宽度、同 DOM 位置、同伪元素对应核对。两边都展开 details、解除 aria-hidden，并保留相同系统语言链接/部件结构。::before/::after/::marker 和自定义列表字符串进入相同数字、单位、公司名、占位与漏译规则，不再整段跳过；英文专属新增/消失文字也拒收，不能借其他位置的数字。中文检查继续收集相同文字，没有改 T-148 的底图实现。CSS 的明确公司名称也遵守同一身份规则，不能另外用全局 Han 检查误拒合法中文公司名；其他残留中文仍拒收并提示先改为 HTML 文字。
- A4：三台、十台等单字中文数字加计数量词可识别。三台设备→3 machines 通过，→Machines 拒收；千瓦等单位名称的千不当成新数量，600 万件的万也不被拆成第二个整数。公司名称先按记录名/明确英文名的完整身份与出现次数核对，不把名字内的“三台”或 P3T 当测量数量；没有声明的改名、名称之外的数字/单位变化仍拒收。
- A5：发布语言测试另建自己的中文 v1、英文 v2，显式确认两次提交成功及版本数，不依赖并发/失败用例留下的共享站点。断言根 `<html lang>`、正文与历史英文预览；不会被语言切换链接上的 `lang="en"` 欺骗。把英文发布路径定向改为中文的 mutant，失败发生在根语言断言，前置创建/存版通过；随后已恢复生产路径并转绿。

红绿产物统一在 `artifacts/t151/review-fix-2026-10-10/`，测试环境统一为 `SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=<本 worktree 自有根> CHROME_PATH=/Users/luckye/.cache/chrome-for-testing/chrome-headless-shell/mac_arm-154.0.8037.92/chrome-headless-shell-mac-arm64/chrome-headless-shell`。测试全部用本地替身。唯一真实初译按批准方式 set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a 只载入转发器进程；不打印、不复制、不软链，不读取主数据。

- 17:28:09–17:28:13 UTC，`node --test --experimental-strip-types tests/t151-fidelity-rules.test.ts tests/t151-generated-fidelity.test.ts` 的 astra-red.log 中，八个单位/小数/中文数字反例在基线实现上失败。最初三个 CSS 用例误用了未清理源 CSS，命中 CSS 序列化差异，不作为漏洞红态证据；错误日志保留。
- 17:28:56–17:29:03 UTC，`node --test --experimental-strip-types tests/t151-generated-fidelity.test.ts`，generated-red-source-checked.log 三项有效红态：源中文先经过真实检查通过，旧实现仍接受英文新增数字、复合单位变化和新增无数字承诺。非法导入私有清理函数的 generated-red-valid.log 也保留，但不当作证据。
- 17:38:47–17:38:53 UTC，`node --test --experimental-strip-types --test-name-pattern='published languages' tests/t151-english.test.ts`，published-root-lang-mutant-red.log 定向语言 mutant 在根 `<html lang="en">` 断言失败，前置有效。较早 published-language-mutant-red.log 在正文失败，已据此把语言断言收紧到根元素。
- 未知 Unicode 单位、点号记号、公司名数字误分类、CSS 中文公司身份和带数字单位关联分别有 unknown-unicode-unit-red.log、unknown-dotted-unit-red.log、company-numeric-alias-red.log、css-company-red.log、unit-marker-order-red.log。坏行为均发生在对应保真断言，不用设置错误充当红态。
- 17:37:18–17:37:48 UTC，六个 T-151 专项文件的 focused-green.log 为 49/49；后续新增边界包含在最终全量中。所有失败、诊断和修复后产物保留，没有替换原始真实夹具、削弱单位要求或增加协议重试。

前次真实回复还暴露了一处同根因误报：3 trial molding runs 的单位 head 是 runs，trial molding 是修饰语。已用未改动真实返回 tests/fixtures/t151-trial-runs-real-response.json 先红后绿，补通用后置计次数语法；本次进一步确保所有已登记物理/时间单位不被计次修饰语吞掉，42 次→42、42 次→42 inspections、次数变 43 仍拒收。不按公司、原句或段落编号加例外。

sol 改动只在翻译提示和系统文案：面向海外采购的 B2B 美式英语，避免逐字直译；不能具体化未说明材质、添加等级/认证、把寄出加强成送达。只给少量通用例子，不做企业词表。公司英文名只从明确资料字段传入，缺少时沿用记录中文名；工作台已显示「资料里没有英文公司名，英文版沿用中文名；补充后可重新翻译」。系统表单改为 Inquiry / Send inquiry，系统英文固定文案使用半角标点与美式 licenses，自定义许可原文保留。

| sol 指出位置 | 修前存量 v5 | 前次真实初译、v6 实际结果 |
| --- | --- | --- |
| 铜螺母 | Brass nuts / Brass nut | Copper nuts / Copper nut |
| 开放式/针阀式 | Open/needle valve | Open/valve-gate |
| 逆向建模 | reverse modeling | reverse engineering |
| 十万级洁净车间 | Class 100,000 clean workshop | Class 100,000 cleanroom |
| 已有 / 认证中 | Obtained / In certification | Certified / Certification in progress |
| 三天内寄出 | sent out within 3 days | dispatched within 3 days；3 trial molding runs 保留计次数 |
| 系统表单 | 原 Enquiry / Send enquiry | 运行时已实见 Inquiry / Send inquiry |

`sol-comparison.json` 是修前存量记录；`sol-before-after.json` 汇合了同一原文的修前和实际新回复，`one-real-raw.json` 保存原始响应。表中修后均为真实初译内容，不是人工目标文案。按新规则重新对照存量 v5 的英文，另有四处拒因：两处模次译成未登记的 shots、两处次数译成 trials。旧版本和旧检查不可变，未手改旧英文或新回复，未静默回退；原真实回复由同一 commitSiteCode 再检查后存新版本，不能引用旧 passed 字段证明通过。T-082 的语义、否定、对象与条件检查局限仍存在，提示协议测试不代替真实模型或独立看页。

预算门：17:38:12 UTC，`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t151/artifacts/t151/injection-five-2026-10-10T15-08-40Z/store CHROME_PATH=<上述路径> node --experimental-strip-types artifacts/t151/review-fix-2026-10-10/estimate.mjs` 只向本地 HTTP 替身构造首批请求，不存版本。estimate-original.json 为 191 段、1,718 源字符、englishCompanyName=null、max_tokens=5,810，完整请求输入保守预留 5,382，合计 11,192。估算不是计费 tokenizer；虽此前实测输入约 4.4k、输出约 3–3.7k，首次默认输出上限的计划停在 10k 门前；随后调整单次输出参数，完整输入保持不变，使新的完整预留满足原授权。最初门前停下的记录保留在 estimate-original.json；最终真实请求为 deepseek-flash、非思考、HTTP 200、finish_reason=tool_calls，191/191、缺失/未知/重复均 0，max_tokens=4500，未截断，输入 4658、输出 2971、合计 7629。没有 402；已知历史累计 68,011。one-real-raw.json 保存完整上游响应，真实任务 report 在 artifacts/t151/real-2026-10-10T18-54-19-817Z/。随后按同一已批准 10k 总额度设置 SITE_CODE_TRANSLATION_OUTPUT_LIMIT=4500（高于此前实测输出 3016/3648），不缩减 191 段输入，不改检查；完整请求预留降为 5382+4500=9882，满足原预算。输出上限的已知坏红态 output-cap-red.log 与修后 output-cap-green.log 证明实际 HTTP max_tokens 和调用记录一致，没有降低总预算守卫。

早期 current-ui 图只展示存量 v5，不作为最终候选；最终 final-real-ui 是新存 v6 的中英发布与工作台图。`capture-current.mjs` 保留早期 v5 图；最终 `capture-final.mjs` 在 3161、自有注塑站根运行，记录前后站点/任务/版本一致、无模型调用，companyNameNotice 与 systemEnglish 为实际 DOM 读值。中英发布页 1440/768/375 和工作台提示/预览均逐张打开；最新图与最终检查见交付记录。资料与上传元数据仅使用之前批准的自有复制，没有重新访问主数据或 3034；主 .env.local 仅在获批真实调用进程载入。共享 CSS 没改：1440 标题挤压、窄屏规格换行、页脚邮箱断行登记为已知版面反馈，不在本票修。

最终 test/typecheck/build 与 project-map 状态见本次交付记录。原 JSON 未捕获、长编号失败、旧单位/100% 拒因和既有真实回复/截图全部保留；不补造原始返回，不拿旧证据宣布新候选 PASS。票保持 open，主控负责新候选的复核安排。

- 真实命令（18:54:19–18:54:35 UTC）：`set -a; source /Users/luckye/Documents/Code/sitecraft-ai/.env.local; set +a; SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=/Users/luckye/Documents/Code/sitecraft-ai-t151/artifacts/t151/injection-five-2026-10-10T15-08-40Z/store SITE_CODE_TRANSLATION_TOKEN_LIMIT=10000 SITE_CODE_TRANSLATION_OUTPUT_LIMIT=4500 CHROME_PATH=<上述路径> node --experimental-strip-types artifacts/t151/review-fix-2026-10-10/one-real.mjs`。转发器只放行一次非思考严格函数请求，下一修正请求在本地被 409 阻止；DeepSeek 实际只返回一次 HTTP 200。one-real-summary.json 与 one-real-raw.json 记录唯一真实账单、完整回复和被阻止次数。
- 19:04:50–19:04:52 UTC，同一 3161/自有根/CHROME_PATH、本地无模型配置，`node --experimental-strip-types artifacts/t151/review-fix-2026-10-10/recheck-and-store.mjs` 根据记录的 slotMap 与真实函数返回重建全部译文，断言与原失败 attempt 的 code 完全相同；经唯一 commitSiteCode 清理、全部保真与三档布局检查后存 v6，中文 code 与 v5 相同，英文 sourceRevision=3。原失败 attempt 和全部 modelCalls 原样保留，只追加成功检查；运行状态和对话明确说明重新检查，没有新增模型调用。不是 replay 收费、手改译文、旁路写站或额外真实修正。
- 19:05:42–19:05:52 UTC，同一环境 `node --experimental-strip-types artifacts/t151/review-fix-2026-10-10/capture-final.mjs` 只读 PASS。final-real-ui/report.json 记录版本/任务前后不变；v6 中英发布全页 zh/en-{1440,768,375}.png 与 status/preview-en 三档，共 12 张均逐张打开。早期 current-ui 的 12 张也打开过，但它们不充当 v6 成功证据。最终预览已等待动画结束，实际 iframe 宽度分别 1440/768/375；公司名提示和 Inquiry / Send inquiry 为 DOM 实读。英文发布 `/published/561a1113-4dab-49b6-81dc-ab7e3eb712a5/en` 正常显示 v6。recheck-and-store.json 中三档溢出、重叠、对比度拒因均 0，质量反馈仍保留。
- 最终执行时间（UTC）：test 2026-10-10 19:06:22–19:07:36；typecheck 19:06:23；build 19:08:49–19:08:54。
- 前次全量：`SITE_STORE=fs SITECRAFT_BASE=http://127.0.0.1:3161 SITECRAFT_DATA_ROOT=.sitecraft-data CHROME_PATH=<上述路径> npm test` 为 **305/305**，npm-test-acceptance.log；同环境 `npm run typecheck` 通过（typecheck-acceptance.log），`npm run build` 通过（build-acceptance.log）。这是 5dce2af 的旧证据，不证明本次改动通过。应用测试服务固定 3161，显式使用本 worktree 的 /Users/luckye/Documents/Code/sitecraft-ai-t151/.sitecraft-data；子进程相对根均在 worktree 内解析。失败与中间检查日志保留。
- 通用计次短语红绿：tests/fixtures/t151-trial-runs-real-response.json 保存本次真实 rawMessage（未改动），trial-runs-red.log 在原解析器中拒绝实际 3 trial molding runs；trial-runs-green.log 为 19/19，随后纳入最终全量。42 次→42 或 42 inspections、42→43 仍失败；物理单位不会被后来句子的 runs 覆盖。Scope 未改共享 CSS、未加入企业词表，审核仍由主控安排。

## 主控合并验证（2026-10-10）

- 独立评审：gpt-6.1-sol 首评 ACCEPT_WITH_FIXES，复评后剩余意见由主控裁定：「全检」译 full inspection 可接受（保真检查禁止新增 100%）；无英文公司名时沿用中文名并在工作台提示，不杜撰；「慢走丝」漏译与共享 CSS 版面（1440 能力标题换行、窄屏规格多行、页脚邮箱断行）记为已知反馈，不在本票重译或改 CSS。
- Astra：98381c2、5dce2af、b86ce7c 三轮 NO_GO 均在保真检查根因层修复；788959c PASS；合并提交 76d4c5f（与 T-148 底图冲突解决）补审 PASS。
- 主线合并后 t151-english 入口测试写死 3161，主线 3034 下 321/322 失败；4d8301f 改为读 SITECRAFT_BASE 并沿用 T-145 的数据根隔离。
- 主线 4d8301f（2026-10-10，纽约时间）：`npm ci` 通过；`SITECRAFT_BASE=http://127.0.0.1:3034 CHROME_PATH=<本机 chrome-headless-shell> npm test` 339/339，`npm run typecheck` 通过，`SITE_STORE=fs npm run build` 通过；日志在 `artifacts/merge-4d8301f/`，首次失败日志保留在 `artifacts/merge-76d4c5f/`。
- 本票真实 DeepSeek 累计约 6.8 万 token（含早期失败运行）。

