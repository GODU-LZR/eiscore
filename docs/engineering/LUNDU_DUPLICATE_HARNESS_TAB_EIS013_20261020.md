# EIS-013：移除重复的 Harness 顶栏标签

用户要求移除顶栏中打开独立 Harness 页面的标签，保留工作台现有 iframe 与业务流程切换。本次不改变工作台默认业务流程、普通用户权限、认证回跳或独立嵌入路由。

## 原因与修复

顶栏从 `eis_host_nav_tabs_v1` 恢复历史标签时没有排除 `/harness`；接收 `eis:open-host-tab` 事件或消息时也接受该路径。点击后调用 `router.push('/harness')`，离开 Layout 进入独立 HarnessView。专用 Chrome 注入旧历史项后已复现，实际浏览器页面数量始终为 1，并非新建浏览器窗口。首次干净登录只有首页，未确认历史项最初的写入者，不能归因当前登录自动新增。

在既有 host-tab policy 增加业务 Harness 独立路径判定，由历史恢复、路由同步、事件新增三个入口共同使用。过滤 `/harness`、`/harness-embed`、数字分身/BI独立 embed 页与旧 `/ai/enterprise` 标签，按路径处理，不按标题误删同名业务应用。正常业务标签、闪念及其隔离路径保留。

## 源码与测试

- 干净任务树：`.codex-tmp/eis013-harness-tab-20261020`，分支 `codex/fix-eis013-harness-tab-20261020`，实现提交 `6a1d1df79a45ce33c06a8f4c5af04b1014e67f98`；主分支已串行整合为 `58819503`，两分支均已推送到 `eiscore`。
- 既有主树脏修改、平台包删除以及本地共享测试服务保持原状。使用干净任务树构建，没有把主树既有未提交 LoginView/auth-client 改动混入制品。
- 真实 layout handlers 的 VM 回归修复前失败：历史重复标签全部被恢复；修复后通过。覆盖恢复与持久化清理、event/message 阻止新增、旧路由同步、业务/闪念保留和普通标签导航。
- `test:base-layout`、`test:eiscore-embed`、host-tabs-store 回归、`lint:changed -- --base 7f3748ff`、`git diff --check` 通过。composition export 数量 41→42 对应新增纯 policy 函数，布局仍为 3527 行。
- `test:lundu-web-release` 全部通过，含18项发布器检查；锁文件安装及宿主实际构建通过。构建仍有既有 Sass import 弃用和大 chunk 提示。

## 完整 Web 发布

通过 `release:lundu:prepare`、四视口真实公开 API 候选验收、发布器离线校验及远端 `--check-only` 后，使用 `publish-lundu-web-release.py` 持共享锁发布。仅重建 `lundu-eiscore-web-1`，未迁移、回退或写业务数据。

| 项目 | 实际值 |
| --- | --- |
| 线上版本 / manifest | `2c5954211072811e` / 609唯一资源 |
| 完整制品 | 12入口、615文件（含provenance），531保护文件与线上旧版逐字节一致 |
| 宿主主包 | `/assets/index-IaB-ZCdK.js` |
| 来源提交 | `6a1d1df79a45ce33c06a8f4c5af04b1014e67f98` |
| tree SHA-256 | `239fcc88d00cf23fd3a9d19223d00e97dc03fdab97db2a9ab2f94d294d8d9817` |
| 归档 SHA-256 | `b706b8a5db862d1965eaa1e78cf2898953fdac3eff72ce79059473c91b22e1fc` |
| 候选验收 JSON SHA-256 | `b37527ea2dbba7476cc8715c6b53923feb0f4f9b0febad38599937a0a29bf855` |
| 新 Web 容器 | `e6af266b1c51e1ddbcced43a88a9fa3e80f420b089095887b93723c2f09ac383` |
| 整站回退目录 | `/opt/lundu-eiscore/backups/web-before-bffb63a78c4e3e81-20261019T214701Z-d9973da0` |

构建使用的完整快照与本轮从远端新下载的完整 release 已逐文件重算确认一致，旧版为 `bffb63a78c4e3e81`、tree `4601c61b46fa76d3b71d973e92c93d52dfa7c010df277134b25a01eaf211828b`。不从其他企业或不明历史包猜基线。

发布锁内所有非 Web 容器不变。跨整个任务时间另项目 `/yayulink-api` 容器发生变化，首轮全局比较失败日志保留；最终报告明确 `otherContainersUnchangedSinceInitial=false`，但伦度非 Web 与惠众容器从任务初始均未改变。不能把发布锁内保护与整个时间段所有项目不变混报。

## 浏览器验收与限制

候选和线上真实 Chrome 均通过：六类历史独立标签清理、事件/消息不重建、正常业务与闪念标签保留、普通设置标签可用、默认业务流程不变、单 iframe、切换文档与未发送草稿保留、刷新不复现、无额外浏览器页面、pageErrors=[]。未发送模型消息或执行业务写操作，本轮不重跑全部业务/Provider/租户 ACL 验收。

候选独立站四视口 `1440/390/414/768` 通过真实 published-site GET：6轮播、13零件拆解/组装、12产品图片及其详情/采购图、Logo/favicon，无横向溢出、错误品牌或控制台异常。

线上同项公开站四视口已独立复验通过：真实 HTTPS，无响应拦截或 SW/cache 绕过，四视口各12图片、13零件拆组，errors=[]。

首轮候选标签检查实际仍加载旧 `index-DKDgtxGL.js`，失败保留。仅在专用候选浏览器启用 CDP Network 并绕过自身 SW/cache 后，确认新 `index-IaB-ZCdK.js` 再重跑通过。线上复验已移除所有响应拦截并恢复正常 SW/cache，真实加载新主包及标签回归通过，没有要求用户清缓存。期间本机 CLI 启动曾内存分配失败，关闭本轮多余浏览器并限制启动器堆后恢复；失败记录保留，未改产品或其他人的浏览器。

证据目录：`output/lundu-harness-tab-eis013-20261020/`，包括原始失败日志、`baseline-comparison.json`、`candidate-tabs-retry.json`、`candidate-site-final.json`、`deployment.log`、`online-tabs.json`、`online-site.json`、`remote-final-retry.log`、`final-verification.json`。线上自动验收完成；用户人工验收待进行。
