# G3.5 后企业资料合并检查点退出审计

## 结论

企业资料与企业站点运营的重复入口已完成合并并通过退出审计。已发布的 `company_site.site_config` 现在是企业公开资料的唯一运行时事实源；企业名称、品牌、Logo、公开联系方式、域名、主题和 SEO 只在“企业站点运营”编辑、保存草稿和发布。“系统设置”只显示已发布摘要并提供前往运营入口，不再保存第二份可编辑企业资料。

本检查点位于 G3.5 之后，目的是收束用户确认的产品信息架构，不代表启动或完成 G4。伦度机电、君乐缘、经纬网厂的同制品配置包、真实数据迁移和生产部署仍未验证，当前明确未进入 G4。

## 单一来源与职责边界

| 信息类别 | 权威来源 | 编辑入口 | 生效方式 |
| --- | --- | --- | --- |
| 企业法定名称、品牌、简称、工厂名、Logo、公开联系方式、公开域名、主题、SEO | 已发布的 `company_site.site_config` | 企业站点运营 | 保存草稿后显式发布 |
| 内部系统标题、内部主题、通知、业务参数和功能展示 | `system_configs.app_settings` | 系统设置 | 保存系统偏好 |
| 企业标识兜底、服务端点、模块与功能开关 | `config/eiscore-enterprise.json` | 部署流程 | 随受控配置/制品发布 |
| 历史 `app_settings.loginBranding` | 兼容读取层 | 无新编辑入口 | 仅在没有已发布档案时兜底 |

统一平台服务把公开站点响应规范化为稳定的 `EnterpriseProfile`。企业资料完成“保存草稿 → 发布 → 公开 API → 基座重新加载”后，系统外壳和独立站消费同一份已发布事实；调用方不得再自行拼接企业名称、Logo 或公开站 URL。详细决策见 ADR-0011。

## 用户可见结果

- “系统设置 → 企业资料”改为只读发布摘要，展示资料状态、名称、Logo、联系方式、官网和版本，并跳转到 `/company-site`。
- “企业站点运营”成为唯一资料编辑入口；草稿不会提前污染公开站或系统外壳，发布后才成为运行时事实。
- 企业站模块禁用、接口不可用或尚无发布档案时，基座保留部署配置和旧 `loginBranding` 兼容兜底，不阻断现有登录与系统设置加载。
- 君乐缘球杆配置器、材料资产与研究成果，以及经纬网厂独立站、研究资产和页面成果均已迁入独立重构仓库并保留。
- 尚无运行时后端支撑的销售草稿、客户匹配、关键词报告和事实治理能力保持显式禁用，不再在首屏自动请求不存在的接口或制造伪故障。

## 实现边界

| 边界 | 主要实现 |
| --- | --- |
| 平台档案规范化与投影 | `packages/eiscore-platform/src/enterprise-profile.mjs` |
| 基座加载、兼容回退与系统设置 | `eiscore-base/src/stores/system.js`、`eiscore-base/src/views/SettingsView.vue` |
| 运营编辑、草稿和发布 | `eiscore-company-site/src/composables/use-company-site-operations.js` |
| 运营能力开关 | `eiscore-company-site/src/domain/company-site-capabilities.js` |
| 企业 HTTP 模块边界 | `realtime/company-http.js`、`realtime/company-site.js` |
| 企业站会话、HTTP 与安全存储 | `eiscore-company-site/src/utils/auth.js`、`eiscore-company-site/src/utils/request.js`、`eiscore-company-site/src/domain/company-site-storage.js` |
| 架构决策 | `docs/engineering/adr/0011-enterprise-profile-single-source.md` |

## 验证证据

| 验证 | 结果 |
| --- | --- |
| 企业档案专项 | `npm run test:enterprise-profile` 通过，覆盖规范化、兼容回退、设置页所有权、路由与鉴权 |
| 平台边界 | 企业站 Auth/Session 与管理端 Request 已纳入微应用契约；4 个直接浏览器存储消费者归零，G2 安全存储白名单仍为 11/11 |
| 完整质量门禁 | `npm run test:quality` 通过；70 个变更代码文件 lint、1,368 个文本文件秘密扫描、运行镜像与基础设施契约均通过 |
| 完整生命周期 | 保存草稿 → 发布 → 公开 API → 基座重新加载通过；发布版本由 1 增至 2，未发布草稿不会被公开读取 |
| 合并后浏览器交互 | `npm run test:e2e:enterprise-profile-merge` 1/1 通过；真实 Chromium 加载基座与企业站两个真实 Vite 前端，填写超级管理员登录表单并验证系统设置只读、进入运营台、草稿隔离、显式发布、基座同步和刷新后持久化 |
| 企业站单元与契约 | 25/25 通过，覆盖君乐缘配置器、经纬网厂模型/素材、公开档案优先级、能力开关、运营契约和安全存储 |
| 企业站数据库契约 | 28 张表通过 Schema 静态检查 |
| Realtime | 路由 Manifest 80 条；组合根 796 行、31 个本地模块、28 个传输/配置辅助职责，均在既有上限内 |
| 数据库治理 | 107 份 SQL 被库存门禁识别；Runtime V2 的 10 个迁移继续受顺序、校验和、事务、账本与 postcheck 治理 |
| 前端复杂度 | 148 个 Vue 文件，52 个达到 800 行，巨页债务 83,986/85,045 行；没有扩大巨页白名单或债务基线 |
| Node 语法 | 249 个文件通过语法检查 |
| 生产构建 | 企业站加入后的完整前端 12/12 成功；企业站 1,718 modules、基座 5,901 modules |

合并前 G3.5 已有隔离完整栈 77/77 Playwright 证据。合并后新增 1 条定向浏览器验收：Playwright 启动真实基座和企业站 Vite 服务并由 Chromium 填写登录表单、完成真实 DOM 点击，API 层使用测试内状态化契约模拟，测试产物独立写入 `tests/.artifacts/enterprise-profile-playwright-*`，不覆盖 G3.5 证据。该用例证明合并后的前端集成、交互和发布可见性语义，但不等同于真实 PostgreSQL、PostgREST、Realtime 完整栈证据；Docker Desktop Linux 引擎当前无法持续启动，恢复后仍应在 `eiscore-g35` 隔离栈复跑同一场景。

## 隔离、兼容与回退

- 唯一修改目标是 `C:\Users\Twist\Documents\eiscore\github-eiscore-refactor` 的 `codex/systematic-refactor`；原仓库、原仓库 `main` 和既有 WSL 主环境均未修改，未推送远程。
- 数据库没有删除 `loginBranding` 或客户 seed，现有数据可继续回退读取。
- 若需代码回退，可回退企业资料合并提交并恢复旧设置页；若只需运行时应急，可停止加载公开档案，让基座使用部署配置/旧品牌兜底。两种方式都不要求删除已发布站点内容。

## 已接受限制

- 企业站 Schema 和 seed 目前仍由单租户上线手册显式执行，尚未进入 Runtime V2 的有序迁移链。
- 107 份 SQL 中只有 Runtime V2 的 10 份具备完整 Manifest 治理；其余 97 份不得按文件名猜测顺序或自动执行。
- 部分历史客户页面仍有硬编码展示内容，后续只能在真实业务与视觉证据保护下渐进迁移到公开内容 API。
- 三家企业配置包、客户数据迁移、真实 AI、恢复演练、发布治理和生产可观测性未验证。
- 合并后浏览器专项使用状态化网络契约模拟，尚未在恢复后的 `eiscore-g35` 数据库完整栈复跑；不得把 1/1 结果表述为新的完整栈验收。
- 生产构建仍有非阻断循环 chunk 与体积告警。
- 本检查点在当前本机 Node 26.1.0/npm 11.13.0 下复核，满足仓库 `>=22.12.0` 兼容范围但不是规范发布工具链；Node 20.19.0/npm 10.8.2 的严格证据来自合并前 G3.5，正式发布前仍须在规范工具链重跑完整 CI。

## 退出决定

企业资料合并检查点通过并关闭。后续 CI 必须持续执行企业档案专项、企业站单元测试和本审计门禁；在用户明确确认前保持 G4/G5 未开始。
