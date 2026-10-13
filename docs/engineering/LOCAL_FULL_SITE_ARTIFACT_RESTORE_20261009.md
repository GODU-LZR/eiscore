# 本地完整站点制品恢复记录

日期：2026-10-09（Asia/Shanghai）。状态：完整静态站点已恢复，加载验收通过；下列功能与界面限制仍需单独处理。本轮没有访问或发布远端，没有提交或推送本轮修改。

## 结果与范围

本地入口为 `http://127.0.0.1:18080/login`，WSL Ubuntu Docker Compose 项目为 `eiscore-codex-local`。已恢复基座及 11 个子应用，共 12 个 HTML 入口。当前运行目录 `eiscore-base/dist` 与暂存完整制品逐文件相同，登录后的子应用资源不再返回 404。

只重建了 `nginx`，后续两次配置修正只做热加载。DB、API、Agent Runtime、Harness Bridge、DeepSeek Web、Swagger 和 IDE 的容器 ID、启动时间与挂载集合均保持不变；数据库卷仍为 `eiscore-codex-local_pgdata`。未执行数据库迁移、release/recovery、卷切换或业务单据写入测试。登录与页面初始化可能生成认证、ACL 或显示标签元数据，因此不将本轮描述为“数据库零写入”。

## 故障与恢复来源

恢复前 `eiscore-base/dist` 只有基座，缺少 11 个聚合子应用目录与缓存 manifest，HR、materials、sales 等入口返回 404。入口主包为 `/assets/index-DyyD7Swn.js`，index SHA-256 为 `c389e49549254dfd24717e2bc84fc008842660686458a1376811fff162edf958`。没有找到完整的原 67 项验收制品备份，不能称为逐字节恢复原整站版本。

本次在独立 staging 组装并验证组件制品：

- 基座及公共资源取当前重构仓库内的 `output/lundu-locale-fix-20261009/full-dist`，其基座来源提交为 `10dde8b64a006c37d221f1ad75e5eb915f856c0e`，保留伦度服务详情页与语言修复。
- 11 个子应用取当前仓库各 `eiscore-*/dist` 的本地验收制品；逐文件复制校验与入口哈希记录在 `release-proof.json`。没有使用 locale 备份中较旧的微应用，以免丢失此前移动端修复。移动端入口仍引用 `index-DNpfwUEn.js`。
- 重新生成前端聚合清单和客户端缓存 manifest，验证所有本地资源、伦度配置和 Logo。

本轮开始时分支为 `codex/systematic-refactor`，HEAD 为 `63c15ea195462a9d60eb2fafe29d24aa3a51ff1d`。这是有来源与哈希的组件制品恢复，**不是当前未提交工作树的 clean-build 发布**。期间另一独立站 Agent 正常提交了 `a2db08bc` 客服头像和 `7dac1592` 发布文档；这些授权提交已保留，但本轮没有将其制品切入本地服务。

## 当前制品与备份

| 项目 | 实际值 |
| --- | --- |
| 暂存完整目录 | `output/local-site-restore-20261009/full-dist` |
| 当前运行目录 | `eiscore-base/dist` |
| 切换前目录备份 | `output/local-site-restore-20261009/before-incomplete-dist` |
| Nginx 切换前配置 | `output/local-site-restore-20261009/nginx.conf.before` |
| 主包 | `/assets/index-Dac0SPOV.js` |
| index 大小 / SHA-256 | 6,295 bytes / `ba78b13b76b03f9f7eed909bb7c0ed62ea2e6bed911f132b24cc18222877183a` |
| 缓存 manifest | `4ca2a32617f37441` / 566 URL / 78,063,152 bytes |
| 整个静态目录 | 571 文件 / 78,131,015 bytes |
| 归档 | `output/local-site-restore-20261009/full-site-4ca2a32617f37441.tar.gz` |
| 归档大小 / SHA-256 | 42,174,787 bytes / `cb6c3e136f40443fb575b12c905fdf39abec48567aaca8782ba2e1728ca04c94` |

Manifest 不缓存自身、企业配置、前端聚合配置、服务页配置和 `sw.js`，因此缓存数量比实际文件少 5；这 5 个文件也纳入了 HTTP 字节核验。备份不含于运行目录或 manifest，归档仅打包完整 staging。

## Nginx 发布与修正

目标服务声明后，备份原目录并切换完整 dist；仅执行 Compose `up -d --no-deps --force-recreate nginx`。首次执行因 Compose 全局插值缺少 `DEEPSEEK_API_KEY` 被阻断，未替换后端服务；随后在内存中复用现有容器必要环境变量完成 nginx-only 重建，没有输出密钥或生成密钥文件。首次失败证据保留于 `publication-error.json`，成功证据为 `publication.json`。

新 Nginx 容器 ID 为 `314c92316daf7475ff43733dbd4dd63277a23b42ea25bc465a1298b89acdbdbd`，启动时间 `2026-10-09T06:39:13.569102524Z`（14:39:13 北京时间）。此后没有再次重建。

在 `nginx/conf.d/default.conf` 只补两处配置：

1. 精确静态路径 `/agent/company-site/public/assets/site/factory-overview.jpg`，避免此 manifest 图片被通用 Agent API 代理截走而返回 404。
2. 同步 `deploy/lundu/nginx/lundu-eiscore.conf` 已有的 Harness 内测弹窗关闭逻辑：在嵌入 HTML 的现有脚本中观察“内测声明”并点击继续。没有禁用模型设置插件，没有关闭 API Key 配置提示。

两次均先通过 `nginx -t` 再 `nginx -s reload`。存在既有 duplicate MIME type `text/html` 警告，但配置检查与 reload 成功。两次 reload 不改变完整静态制品和 manifest。

## 实际验收

| 验收 | 结果与证据 |
| --- | --- |
| HTTP 资源核对 | 574/574 通过：571 文件与 3 个公开路由均 200，响应 SHA-256 与 staging 一致，JS/CSS/JSON 类型正确；`http-qa.json` |
| 静态完整性 | 12 HTML、258 JS 解析、133 CSS、1,740 条本地资源引用通过；缓存 URL 无重复或缺失 |
| 11 子应用代表页面 | 11/11 加载通过，无 pageerror、失败请求或 JS/CSS/index 4xx；`browser-qa.json` 与 `output/playwright/local-site-restore-<mount>.png` |
| 左侧栏 | 登录后已点击人事管理进入人事应用，随后逐模块加载验证；截图可见 11 个模块标签 |
| 手机工作台 | 390×844 下正常显示，内容宽度与视口相同；`local-site-restore-mobile-390.png` |
| 伦度公开登录页 | 1440×900、390×844 下 Logo、公司名、中英按钮和图片正常，无君乐缘正文、坏图、页面异常或横向溢出；`local-site-restore-login-1440.png`、`-390.png` |
| Harness 数字分身 | 同源认证交接成功，原生面板加载，点击插件入口后窗口、消息输入及发送按钮出现；未发送模型消息 |
| Harness 智能 BI | 原生面板及插件窗口可打开，经营指标数据可读取、分析输入出现；未提交分析请求 |
| 内测声明修复 | 全新 `local-harness-auth-restore` 浏览器登录后 auth/status=200，内测 dialog 数量=0，数字分身 dialog 数量=1；`local-site-restore-harness-probe.js` 与 `local-site-restore-harness-after.png` |
| 服务与源码保护 | 独立只读审计确认 7 个后端容器、数据库卷未变，运行/staging 文件完全一致，既有业务修改保留；`git diff --check` 通过 |

代表路由：`/hr/employee`、`/materials/inventory-current`、`/sales/cockpit`、`/purchase/dashboard`、`/production/overview`、`/quality/dashboard`、`/equipment/dashboard`、`/apps/workflow-designer`、`/decision/`、`/company-site/preview`、`/mobile/`。

首次浏览器探测的 6 个失败来自测试预期错误：4 项用导航标签代替实际页标题，2 项 broad `main` 定位遇到嵌套 main。修正测试后 11 项通过。公开页探测也修正了把滚动条宽度误判为溢出的等式，按 `scrollWidth === clientWidth` 验收。

未经登录直接访问 Harness 的新浏览器出现 auth/status 401，符合未认证状态；该探测不计为登录后验收。重新用全新会话完成登录交接后无控制台 error。汇总见 `output/local-site-restore-20261009/final-qa.json`。

## 保留的限制

- 本轮没有重新执行原 67 项全业务测试，也没有完成真实 DeepSeek Provider completion、Bridge clean-build 或数据库 release/recovery 验收，不能据此宣布系统全部功能上线就绪。
- 用户导出汉字标签与“操作指引岗位”修改保留在源码中，本次恢复原点击验收微应用，没有部署这些新修改。客服头像/客服窗体的并发独立站更新也没有切入本地制品。
- Harness 原生 API Key 提示仍可能出现。本次通过“稍后配置”进入插件，未录入或保存密钥。外层 `#digital-twin` / `#enterprise-bi` 不会自动展开对应插件窗口，仍需点原生侧栏入口。
- 自动化跨 iframe 点击时曾使隐藏 overflow 的宿主 main `scrollTop` 变为 752，造成 iframe 裁切；将该容器滚动位置复原后操作通过。主布局同时保留全高子应用容器的问题本轮只记录，没有发布布局修复。
- 现有 AG Grid 生命周期、BPMN EOT 字体与 Three.js 警告保留；未联网核验两个外部字体地址。桌面首页轮播文字处于动画过渡的截图不作为新的视觉改版验收。

## 后续构建与恢复方式

后续完整前端应在隔离工作树或 staging 中运行 `npm.cmd run build:frontends`，然后 `node scripts/generate-client-cache-manifest.mjs eiscore-base/dist`。该命令会构建基座及微应用并聚合；不能在正在提供点击测试的 live `eiscore-base/dist` 只构建基座，否则会再次清除子应用目录。新制品须核对 12 入口、11 mounts、manifest 和来源后才切换。

再次恢复本轮良好版本时，从完整 staging 或上述 tar.gz 解包到新暂存目录，核对归档哈希及资源清单，在同一发布锁下备份活跃 dist、原子替换，再只重建本地 nginx；不得重新执行本轮已有备份的 `publish.cjs`。不回退数据库卷或用户源码。

`before-incomplete-dist` 是切换前故障现场，不是可供正常使用的好版本。它仅用于取证；若明确要撤销本轮恢复，应在同一锁下恢复该目录并只重建 nginx，同时保留当前完整良好制品。若只撤销 Nginx 修正，须在当前配置中逆向应用本轮两处差异后检查/热加载，不能整文件覆盖其他 Agent 后续修改。
