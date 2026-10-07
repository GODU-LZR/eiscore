# 伦度独立站顶部绿条移除记录（2026-10-07）

## 目标与范围

本轮移除伦度独立站页面中产品卡、制造服务卡、无图能力卡和采购/客服/支付弹窗顶部的绿色装饰条，保留绿色按钮、客服消息气泡、采购状态色和必要的中性分隔线。目标服务为远端开发/验收 Compose 环境的 `web`，不重建后端服务。

## 源码与制品

- 工作区：`github-eiscore-refactor`。
- 分支：`codex/systematic-refactor`。基线提交：`561f3d83c760c7c0511a460b567af4eeced95359`。工作树包含其他 Agent 的未提交改动，本轮未回退或覆盖这些改动。
- 修改范围：`eiscore-base/src/styles/login-view.scss` 最终级联规则。
- 关键规则：`.capability-card:not(:has(img))`、`.public-product-card`、`.manufacturing-series-card`、`.commerce-modal` 的 `border-top: 0 !important`；`.commerce-modal::before` 使用 `display: none !important` 和 `content: none !important`。
- 构建：`npm --prefix eiscore-base run build` 已通过，既有 Sass `@import` 弃用、circular chunk 和大 chunk 警告不影响构建。
- 完整 12 入口 staging：`output/lundu-greenbar-staging`。共享 dist 会被并发 Agent 清理，因此使用上一份完整制品作为基底，再覆盖当前根站 dist，保留 `agent`、`apps`、`company-site`、`decision`、`equipment`、`hr`、`materials`、`mobile`、`production`、`purchase`、`quality`、`sales` 等微应用目录。
- 发布归档：`output/lundu-greenbar-removal-release-20261007.tar.gz`。SHA-256：`F64CA44D3EB3903F2FF36E8B0D9B3B0EE3DA7691402ACB24C4AB48CA34F54DB1`；大小：`40,830,346` bytes。
- 归档 manifest：`cd8240bf580762fd`，`576` 项，`77,142,156` bytes；入口 `index.html` 为 `6258` bytes。

## 远端发布

发布前声明：目标服务为 `web`；制品来自当前 `github-eiscore-refactor` 工作区 staging；影响范围为完整伦度静态资源和页面样式，DeepSeek/Harness 后端 Agent 的服务不受影响。发布使用 `/opt/lundu-eiscore/.lundu-web-publish.lock` 独占锁，先备份再原子替换。

远端校验与发布结果：

- 归档远端 SHA-256 与本地一致，大小 `40,830,346` bytes。
- 发布前备份：`/opt/lundu-eiscore/backups/lundu-greenbar-before-20261007025720.tgz`。
- 实际重建服务：`lundu-eiscore-web-1`，状态 `Up`。只执行 web-only Compose 重建；`db`、`api`、`agent`、`deepseek-web` 和 Harness 未重建。Compose 仅提示既有 `lundu-eiscore-deepseek-web-1` orphan，未清理它。
- 远端入口：`6258` bytes；主包：`/assets/index-D1sba2dO.js`。
- 远端 manifest：`cd8240bf580762fd` / `576` 项 / `77,142,156` bytes。
- 远端 `enterprise.id`：`lundu`。入口、配置、主资源和公开页面没有君乐缘/junleyuan。

## HTTP 门禁

以下地址均返回 HTTP 200：

- `https://lundu.eiscore.top/login`：`text/html`，6258 bytes，登录 HTML 无君乐缘文本。
- `https://lundu.eiscore.top/asset-manifest.json`：`application/json`，manifest 与归档一致。
- `https://lundu.eiscore.top/config/eiscore-enterprise.json`：`application/json`，`enterprise.id=lundu`。
- `https://lundu.eiscore.top/enterprise-assets/site/lundu-logo.png`：`image/png`，Logo 可访问。

## 四视口验收

验收脚本：`output/playwright/lundu-procurement-customer-service-qa.cjs` 和 `output/playwright/lundu-greenbar-remote-qa.cjs`。真实线上四视口为 `390×844`、`414×896`、`768×1024`、`1440×900`。

- 页面运行时标题均为“伦度机电｜电机与水泵制造”，Logo 可见，正文无君乐缘品牌。
- 四个视口 `scrollWidth` 均等于视口宽度，页面错误和控制台错误均为 0。
- 5 个 `.public-product-card` 与 3 个 `.manufacturing-series-card` 的计算样式均为 `border-top: 0px none`。无图能力卡在当前公开配置中数量为 0；规则仍保留并覆盖该选择器。
- 产品详情、采购单、客服智能体和支付弹窗的 `.commerce-modal` 均为 `border-top: 0px none`，`::before` 均为 `display: none`。
- 采购单文案、客服智能体固定悬浮/展开收缩和流式对话回归均通过；绿色按钮及状态色仍可见。
- 首次验收脚本误将产品图片渐变伪元素当成绿条，修正为仅检查卡片 border、弹窗伪元素后，四视口全量通过。

## 协作交接

