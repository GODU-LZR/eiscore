# 伦度客服智能体悬浮触发器恢复记录

## 目标

根据用户上传的截图，将伦度独立站右下角客服智能体恢复为原来的宽版展开/收缩组件：绿色横向按钮、圆形图标、白色“客服智能体”文字、固定在右下角。客服面板、流式对话、采购单入口和点击展开/收起逻辑保持不变。

## 源码与构建

- 工作区：`github-eiscore-refactor`
- 分支：`codex/systematic-refactor`
- 基线提交：`561f3d83`
- 源码：`eiscore-base/src/styles/login-view.scss`
- 构建命令：`npm --prefix eiscore-base run build`
- 构建结果：4523 个模块转换成功；仅有既有 Sass `@import` 弃用、循环 chunk 和大 chunk 警告。
- 触发器规则：宽度 `min(256px, calc(100vw - 32px))`、最小高度 `88px`、图标 `42px`、绿色 `#1f6b4a`。
- 本轮没有清理其他 Agent 的未提交改动，也没有创建 Git commit。

## 发布制品

- 完整制品：`output/lundu-customer-service-trigger-release-20261007.tar.gz`
- SHA-256：`129445c64e9e80f52189e56e06d5ffde8731ec31d8fa0e37757346152e3823c1`
- 制品包含根站和 11 个微应用入口：`agent`、`apps`、`company-site`、`decision`、`equipment`、`hr`、`materials`、`mobile`、`production`、`purchase`、`quality`、`sales`。
- `asset-manifest.json`：version `6926a391b7574d9c`，576 项，`77,143,439` bytes。
- 根入口：6258 bytes，主包 `/assets/index-AwakYcN8.js`。
- 品牌门禁：`enterprise.id=lundu`；Logo `/enterprise-assets/site/lundu-logo.png` 存在；根入口、根 assets 和公开配置没有“君乐缘”或 `junleyuan`。

## 远端发布

- 远端：`149.104.26.71`，站点：`https://lundu.eiscore.top/login`。
- 目标服务：`web`。
- 发布目录：`/opt/lundu-eiscore/release`。
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261007071802.tgz`，40,875,454 bytes。
- 使用 `/opt/lundu-eiscore/.lundu-web-publish.lock`，上传后在远端完成 SHA、品牌、Logo、配置和 manifest 门禁，再原子替换 release。
- 实际重建：`docker compose ... up -d --no-deps --force-recreate web`。
- 未重建或修改：`db`、`api`、`agent`、`deepseek-web`、`Harness`。Compose 提示存在既有 orphan `lundu-eiscore-deepseek-web-1`，没有使用 `--remove-orphans`，未删除该容器。
- 发布后 `lundu-eiscore-web-1` 状态为 `running`。

## 线上验收

HTTP 检查通过：

- `/login`：200，HTML 6258 bytes。
- `/config/eiscore-enterprise.json`：200，`application/json`，`enterprise.id=lundu`。
- `/asset-manifest.json`：200，`application/json`，version `6926a391b7574d9c`，576 项，`77,143,439` bytes。
- `/enterprise-assets/site/lundu-logo.png`：200，`image/png`，26404 bytes。

Playwright 真实浏览器验收脚本：`output/playwright/lundu-procurement-customer-service-qa.cjs`。

| 视口 | 触发器 | 面板 | 结果 |
| --- | --- | --- | --- |
| 390×844 | 256×88，fixed | 366×658，竖向 | PASS |
| 414×896 | 256×88，fixed | 390×680，竖向 | PASS |
| 768×1024 | 256×88，fixed | 390×720，竖向 | PASS |
| 1440×900 | 256×88，fixed | 390×720，竖向 | PASS |

四个视口均确认：采购单可打开并提交入口存在、客服面板展开/收起正常、模拟 SSE 流式响应完整、页面无横向溢出、无旧“询价单”文案、无控制台错误，页面标题为“伦度机电｜电机与水泵制造”。

## 协作交接

后续任何 Agent 发布 `web` 时，必须继续使用当前 `github-eiscore-refactor` 的完整 12 入口 dist，先声明目标服务、分支/提交、制品路径和影响范围，再通过 `LUNDU_MULTI_AGENT_BRANDING_COORDINATION.md` 中的品牌门禁和 web-only Compose 命令。不能用旧 tarball、单独入口或其他客户 release 覆盖本版本。

## 2026-10-07 图标尺寸微调

用户反馈宽版触发器中的圆形图标过大。本轮只调整 `.customer-service-trigger-icon`：CSS 尺寸改为 `32×32px`，`font-size:16px`，并增加 `box-sizing:border-box`，使包含边框的实际外框严格为 `32×32px`；按钮整体仍为 `256×88px`，展开/收起、流式对话和采购单逻辑不变。

- 最新构建主包：`/assets/index-CKrqz14A.js`
- 最新制品：`output/lundu-customer-service-trigger-icon32-box-release-20261007.tar.gz`
- 最新制品 SHA-256：`ebed499786a172351adccc6a255aeca93c421290a3019efb86c4fceb323d8144`
- 最新 manifest：`b143c4064b8ba709`，576 项，`77,143,932` bytes
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261007083053.tgz`
- 实际重建服务：`web`；`web` 容器已启动，其他服务未重建

新增浏览器检查脚本 `output/playwright/check-customer-service-icon.cjs` 在 390×844、414×896、768×1024、1440×900 实测通过：触发器 `256×88px`，图标 `32×32px`，位置 `fixed`，页面标题为伦度标题，页面无横向溢出且无君乐缘文本。

## 2026-10-07 回退图标微调

用户要求撤回上一轮图标缩小。本轮已恢复到上一版的图标样式：CSS `42×42px`、桌面字号 `22px`、移动字号 `20px`，移除上一轮新增的 `box-sizing:border-box`；按钮整体和客服交互保持不变。

- 回退制品：`output/lundu-customer-service-trigger-icon42-revert-20261007.tar.gz`
- 回退制品 SHA-256：`3ef43373e5cfac1c1f3073e9bc252d21ea4f53117cdef2b1453ae5d5d292f6c5`
- 远端主包：`/assets/index-AwakYcN8.js`
- 远端 manifest：`ba506cf7163eb68a9`，576 项，`77,143,439` bytes
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261007092141.tgz`
- 实际重建服务：`web`；其他服务未重建
- 四视口实测实际图标外框为 `44×44px`（42px CSS 内容加边框），按钮为 `256×88px`，均通过。

## 2026-10-07 等比例缩放

用户要求在不改变客服按钮视觉样式和功能的情况下整体缩小右下角触发器。本轮在最终级联规则中对 `.customer-service-widget .customer-service-trigger` 使用 `transform: scale(.8)`，并设置 `transform-origin: bottom right`。绿色、圆角、阴影、文字、图标和间距按同一比例缩小，右下角锚点保持不变；展开面板不缩放。

- 最新制品：`output/lundu-customer-service-trigger-scaled-release-20261007.tar.gz`
- 最新制品 SHA-256：`222c9020077116de7c10c05862080238f2ecd09e6632f790171f46c2b173cd23`
- 最新主包：`/assets/index-DACKreSB.js`
- 最新 manifest：`b2cf23b7f4c777ab`，576 项，`77,143,557` bytes
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261007111533.tgz`
- 实际重建服务：`web`；其他后端服务未重建
- 四视口视觉实测：按钮约 `204.8×70.4px`，图标约 `35.2×35.2px`，右下角无溢出；采购单、客服展开/收起、模拟 SSE 流式响应均通过。

## 2026-10-07 绿色外层按钮调整

用户指出上一轮等比例 `transform:scale(.8)` 作用对象理解错误，要求撤回该修改，并调整承载“客服智能体”文字和图标的绿色外层按钮。已移除触发器上的 transform；最终规则把绿色 `.customer-service-trigger` 调整为约 `205×70px`，同步调整外层内边距、间距和文字字号，保留原绿色、圆角、阴影和固定定位。内部 `.customer-service-trigger-icon` 保持 CSS `42×42px`，实际外框约 `44×44px`，不再缩小小圆圈。

- 最新制品：`output/lundu-customer-service-green-surface-release-20261007.tar.gz`
- 最新制品 SHA-256：`107915a141eebbcf2d322f0c67626d21ba9c5b43c424b92a183a135aae809032`
- 最新主包：`/assets/index-CH7qYgTa.js`
- 最新 manifest：`0c1cc12ad6685c0a`，576 项，`77,143,438` bytes
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261007142732.tgz`
- 实际重建服务：`web`；其他后端服务未重建
- 四视口实测：绿色外层按钮 `205×70px`，内部图标 `44×44px`，无 transform、无横向溢出；客服展开/收起、采购单和模拟 SSE 流式响应均通过。

## 2026-10-08 规则收敛与远端复核

用户再次明确：缩小对象是承载“客服智能体”文字和图标的整个绿色外层按钮，内部圆形图标不单独缩小。本轮清理了 `login-view.scss` 中重复的历史触发器覆盖块，只保留文件末尾唯一的最终规则：`.customer-service-widget .customer-service-trigger` 使用 `transform: scale(.8)` 和 `transform-origin: bottom right`；图标保留 `42×42px` CSS 尺寸，由父按钮统一缩放。基础 `.customer-service-trigger` 通用规则仍保留，面板不参与缩放。

- 源码构建：`npm --prefix eiscore-base run build`，4523 个模块转换成功；仅有既有 Sass、循环 chunk 和大 chunk 警告。
- 发布脚本修正：默认制品改为 `output/lundu-customer-service-trigger-uniform-scale-release-20261007.tar.gz`；Docker 状态输出模板修正为 `{{.Names}} {{.Status}}`。
- 本轮没有重建远端服务；远端继续使用上一轮完整 12 入口制品，manifest `882386849347a48f`，576 项，`77,143,963` bytes，主入口 `/assets/index-BkpASzTr.js`。
- 远端 QA：`output/playwright/lundu-procurement-customer-service-qa.cjs` 和 `output/playwright/check-customer-service-icon.cjs` 均通过，覆盖 `390×844`、`414×896`、`768×1024`、`1440×900`；按钮实测约 `204.8×70.4px`，图标约 `35.2×35.2px`，无横向溢出，无“君乐缘”文本。
- 影响范围：仅客服入口样式源码、客服发布脚本和本协作文档；未修改其他 Agent 的服务、配置、数据库或未提交改动。

## 2026-10-08 绿色客服入口再次缩小

用户指出截图中红框标记的整个绿色客服按钮仍偏大。本轮继续以外层 `.customer-service-trigger` 为唯一缩放对象，将 `transform` 从 `scale(.8)` 调整为 `scale(.65)`；按钮内的图标、文字、间距、圆角、阴影按同一比例缩小，右下角锚点保持不变，客服面板不缩放。图标 CSS 基准仍为 `42×42px`，没有单独修改内部圆形图标。

发布前声明：目标服务为 `web`；工作区为 `github-eiscore-refactor`，分支 `codex/systematic-refactor`；制品为当前工作区重新构建并聚合的完整 12 入口 dist，影响范围仅静态 web，未重建 DB、API、agent、DeepSeek Web 或 Harness。

- 源码：`eiscore-base/src/styles/login-view.scss`；验收脚本：`output/playwright/check-customer-service-icon.cjs`。
- 构建：`npm --prefix eiscore-base run build` 和 `node scripts/aggregate-frontend-dist.mjs` 通过；4523 个模块转换成功。
- 制品：`output/lundu-customer-service-trigger-scale65-release-20261008.tar.gz`，SHA-256 `2A58ED6C9188D6379BB072258F2253872F176C9BCC01913D8D6852F7C8F27CFA`，40,670,100 bytes。
- 入口：`/assets/index-DA94Q0-c.js`；manifest `423a2f642b263846`，561 项，`76,540,864` bytes；`enterprise.id=lundu`，伦度 Logo 和品牌门禁通过。
- 远端备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261008032352.tgz`。
- 实际重建服务：`lundu-eiscore-web-1`（仅 `web`）。
- 视觉验收：`390×844`、`414×896`、`768×1024`、`1440×900` 均通过；按钮约 `166.4×57.2px`，图标约 `28.6×28.6px`，固定右下角、无横向溢出、文字未截断；采购单、客服展开/收起和流式对话均通过，页面无“君乐缘”文本。

## 2026-10-08 绿色客服入口再次缩小 v2

用户要求继续缩小截图红框中的整个绿色客服按钮。本轮将外层 `.customer-service-trigger` 的整体缩放从 `scale(.65)` 调整为 `scale(.55)`，实际约 `140.8×48.4px`；图标和文字随外层同比缩小，客服面板及其他页面按钮保持不变。

- 完整制品：`output/lundu-customer-service-trigger-scale55-release-20261008.tar.gz`，SHA-256 `13A112A55D9C804747394E81DB9447134275782F5AD4C30E2C9148EDB9A39E57`，40,670,057 bytes。
- 入口：`/assets/index-B5S7UzWh.js`；manifest `ce128412dce32e13`，561 项，`76,540,864` bytes。
- 远端备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261008035829.tgz`。
- 实际重建服务：`lundu-eiscore-web-1`，仅 `web`；DB、API、agent、DeepSeek Web 和 Harness 未重建。
- 四视口视觉验收通过：按钮约 `140.8×48.4px`，图标约 `24.2×24.2px`，文字保持单行且未截断；采购单、客服展开/收起、流式对话、无横向溢出和品牌门禁均通过。

## 2026-10-08 独立站绿色主题改为蓝色

用户要求将独立站页面的绿色视觉改为蓝色。本轮将伦度品牌主色统一为 `#1557A6`，悬停/深色强调改为蓝色，原有浅绿色状态底色调整为蓝灰色；页面白色底、深蓝首屏产品图、Logo 的蓝橙配色和语义性红橙状态保持不变。客服入口同步使用蓝色，BOM 展示组件的强调色和浅色背景也同步调整。

运行时曾发现 `/agent/company-site/public/site-config` 返回旧的 `#0B6E69`。为避免旧站点配置覆盖当前独立站品牌，`LoginView.vue` 的公开登录页主题现在优先使用当前 web 包的 `systemStore.config.themeColor`，再回退到企业档案颜色；当前线上计算主题色已验证为 `#1557A6`。

- 修改文件：`eiscore-base/src/styles/login-view.scss`、`eiscore-base/src/views/LoginView.vue`、`eiscore-base/src/components/PumpBomViewer.vue`、`eiscore-base/public/config/eiscore-enterprise.json`、伦度 enterprise pack 的运行时配置/站点数据/favicon。
- 完整制品：`output/lundu-blue-theme-release-20261008-v2.tar.gz`，SHA-256 `9AE5DDD150C82F41257DC1B22160EE11A19A5DAB6C80612ABF083DD05A26632A`，40,670,205 bytes。
- 入口：`/assets/index-vEIxUEf3.js`；manifest `cf37ea37ac62ccf1`，561 项，`76,540,865` bytes；静态企业配置 `enterprise.id=lundu`、`themeColor=#1557A6`。
- 远端备份：`/opt/lundu-eiscore/backups/lundu-customer-service-trigger-before-20261008050634.tgz`；实际重建服务为 `lundu-eiscore-web-1`，其他服务未重建。
- 视觉验收：四视口客服/采购流程通过；页面计算主题色为 `#1557A6`，页面背景为白色，客服按钮为蓝色，无“君乐缘”文本，Logo 返回 200。
