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
