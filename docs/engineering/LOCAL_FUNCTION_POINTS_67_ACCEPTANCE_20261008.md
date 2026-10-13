# 本地 67 项功能点测试与点击验收记录

## 目标与边界

用户要求先完成本地 67 项功能测试，处理发现的问题，再进入点击验收。

- 工作区：`github-eiscore-refactor`；分支：`codex/systematic-refactor`。
- 本轮开始时 HEAD 为 `2cd5076cd94e6bbcfd478ef9fa682581f0c391ca`。独立站 Agent 后续推进至 `3d0ed2d26e8a51d94fc2ee0f55fbdfb156b748ab`，收尾时为 `20573070d11adbd8c636862f755c00c8b6fa4f5d`；本轮不覆盖其公开服务页面改动，也未将本轮测试修改提交或推送。
- 测试栈为 Ubuntu native Docker 上的 `eiscore-codex-local`，不是 Windows Docker Desktop。
- 数据库使用已有本地隔离卷 `eiscore-codex-local_pgdata`。未连接远端，未删除卷，未替换数据库，未运行数据库 release/recovery。
- 前期自动化使用过 WSL 内 `http://127.0.0.1`；最终验收统一使用 Windows 可直接访问的 `http://127.0.0.1:18080`，手动登录入口为 `http://127.0.0.1:18080/login`。
- 测试不严格只读：基座会补齐 `role_data_scopes`，FP08 用户管理会补字段 ACL/标签元数据。67 项套件没有显式创建或修改业务单据，但不能声称数据库零写入。

## 已执行与问题处理

1. 首轮 `npm run test:e2e:functions67` 为 65/67；FP12、FP67 失败。
2. FP12 的两个 CSS 请求在同一时刻发生 `net::ERR_NETWORK_CHANGED`；入口、JS、API 和随后请求的 CSS 均为 200。未修改业务代码，未放宽错误监控。
3. FP67 入口、JS 与企业配置均为 200，但旧移动端 bundle 的配置校验器引起 bootstrap 失败。采用已有 `npm run build:frontends`，在 Windows Node 26.1.0 重建全部 12 个前端包并聚合 11 个微前端。
4. 构建于 2026-10-08 21:44 完成；移动端新入口为 `index-DNpfwUEn.js`。重建后 FP67 单独复测为 1/1 通过。
5. 稳定运行栈下 FP12 使用 `--repeat-each 3` 连续复测，结果为 3/3 通过。
6. WSL 内完整重跑结果为 65/67（7.3 分钟）：FP31 的权限查询、FP61 的流程设计器依赖 JS 遭遇 `ERR_NETWORK_CHANGED`。依赖文件存在；FP31 页面正常，FP61 动态导入失败导致只有页面外壳。失败截图与 trace 保存在 `-final`，HTML 全量报告在 `-final-report`。
7. Windows `:18080` 对 FP31、FP61 的第一组测试均通过，但 WSL 测试进程退出后 Ubuntu 停止，后续 Windows 请求出现连接重置/拒绝。该定点轮为 2/6，不算通过；报告在 `-windows-focus-report`，JSON 为 `-windows-focus-result.json`。
8. 为本地持续验收保留隐藏的 WSL 后台会话（`wsl.exe -d Ubuntu --exec /usr/bin/tail -f /dev/null`，本轮 Windows PID `13672`），服务恢复后两项各连续测试 3 次为 6/6，报告为 `-windows-focus-stable.json` 和 `-windows-focus-stable-report`。此做法无需改 WSL 或 Docker 的全局配置；结束本次手动验收后可以停止该专用会话。
9. 对已完整构建的 dist 执行已有缓存 manifest 生成器，得到 `asset-manifest.json` version `06231c2740972a8f`、564 URL、78,045,538 bytes。所有 12 个前端入口均为真实 HTTP 200，非主站 SPA fallback。
10. Windows 实际手动入口完整重跑为 66/67（6.2 分钟），唯一失败项为 FP03 企业 AI；JSON 为 `output/playwright/function-points-67-local-20261008-windows-full.json`，HTML 为 `-windows-full-report`。先前的 FP12、FP31、FP61、FP67 全部通过。
11. FP03 `auth/start` 返回 200，但返回的登录/回调 origin 固定为 `http://127.0.0.1`，与浏览器 `http://127.0.0.1:18080` 不同。前端同源保护正常拒绝该回调，不能通过放宽同源校验解决。
12. 当前临时 auth 插件实际编译入口仅读取 `EISCORE_AUTH_URL`，没有实现配置中的 `EISCORE_AUTH_ORIGINS`；因此本轮把本地 Compose 覆盖文件的 `EISCORE_AUTH_URL` 与唯一指定验收入口统一为 `http://127.0.0.1:18080`，只重建 `deepseek-web`。产品源码、前端校验、正式部署配置未修改；双入口 Origin 选择不作为本轮已修复功能。
13. 配置应用后 FP03 定点复测为 1/1 通过；随后从指定入口完整复跑 67 项，结果为 67/67，0 失败、0 跳过、0 flaky，耗时 348.15 秒。该结果来自独立最终 JSON，不是定点复测累计。

初轮与复测证据在 `output/playwright/function-points-67-local-20261008-full`、`-rerun`、`-fp67-rebuilt`、`-fp12-stability`。不得引用 10 月 6 日旧报告作为本轮通过证据。前几轮设置的 `PLAYWRIGHT_JSON_OUTPUT_NAME` 不覆盖仓库配置中的 `outputFile`；后续改用 `PLAYWRIGHT_JSON_OUTPUT_FILE` 保存独立 JSON，先前全量仍有独立 HTML/trace 证据。

## 本地环境诊断说明

Windows Docker Desktop 确有独立启动故障：Inference socket 初始化失败；其 `desktop-linux` pipe 不可用不代表 Ubuntu native Docker 不可用。诊断期间误向 Desktop 排查，之后已纠正，原 Ubuntu 引擎和 8 个 Compose 服务恢复运行，Bridge/Agent Runtime healthy。

Desktop 的两个功能开关曾被本轮暂时关闭，已根据本轮备份恢复。子 Agent 在诊断时清理了两个失效运行时 socket（非数据文件，Desktop 会重新生成），没有触碰 Docker 数据盘、镜像或数据库卷。未重置 Docker Desktop，未注销 WSL。

## 测试覆盖

仓库现有 67 项套件覆盖页面加载、关键文案、表格/图表/部分搜索和图谱交互、控制台/页面异常及 HTTP 错误；不是每个业务的完整 CRUD、审批、设备集成和真实 Provider completion 测试。

| 模块 | 功能点 | 数量 |
| --- | --- | ---: |
| 基座门户 | FP01-FP04 | 4 |
| 人事 | FP05-FP10 | 6 |
| 仓储 | FP11-FP21 | 11 |
| 销售 | FP22-FP28 | 7 |
| 采购 | FP29-FP33 | 5 |
| 生产 | FP34-FP42 | 9 |
| 质量 | FP43-FP50 | 8 |
| 设备 | FP51-FP58 | 8 |
| 应用中心 | FP59-FP65 | 7 |
| 决策 | FP66 | 1 |
| 移动端/PDA | FP67 | 1 |

## 最终结果

完整 67 项已通过。最终 Chromium JSON 为 `output/playwright/function-points-67-local-20261008-accepted.json`，HTML 为 `output/playwright/function-points-67-local-20261008-accepted-report/index.html`。报告开始时间为 `2026-10-08T14:49:19.327Z`（北京时间 22:49:19）。

点击验收在 67 项完整通过后启动，日常点击套件 4/4 通过，耗时 37.27 秒、0 失败、0 跳过、0 flaky。接口业务链在修复清理假阳性后重新完整执行，32/32 通过、`keepData=false`、`cleanupErrors=[]`。UI 业务链在补充删除后读回检查后复测为 1/1，含 5 个步骤，耗时 30.15 秒、0 失败、0 跳过、0 flaky。本轮本地验收目标已达到；未宣布全部业务无缺陷、长期重构完成或上线就绪。

| 验证 | 结果 | 独立证据 |
| --- | --- | --- |
| 67 项页面功能点 | 67/67 | `output/playwright/function-points-67-local-20261008-accepted.json` |
| 日常真实点击 | 4/4 | `output/playwright/local-ui-clicks-20261008.json` |
| 接口业务链（清理增强后） | 32/32，普通记录清理、库存补偿通过 | `output/playwright/local-business-chain-20261008-cleanup-v2.json` |
| UI 业务链（清理增强后） | 1/1，5 步及清理通过 | `output/playwright/local-ui-business-chain-20261008-cleanup-v2.json` |
| 库存清理回归 | 通过 | `node tests/engineering/inventory-cleanup-regression.mjs` |
| 自动入账覆盖契约 | 通过，2 种类型 | `npm run test:auto-entry-coverage` |

点击套件实际覆盖登录输入与提交、侧栏折叠、引导中心、用户菜单、可见模块切换、HR/物料搜索以及列管理/导出入口、应用中心创建弹窗取消与配置入口。套件仅要求至少 3 个可见侧栏菜单可点击，列管理/导出为条件执行；67 项另行覆盖各模块页面，不能把 4 项统计解释成全部按钮逐个验证。

接口链验证权限与本体查询、受保护原始审计视图返回 403、知识图谱查询、入库自动记账、应用创建与发布、动态数据增改、工作流启动/流转/完成及审计事件、严格规则缺失时拒绝流转、人事/仓库 CRUD。最终 API runId 为 `chain_1791472085737_68ee84`。动态测试表保留，普通临时数据删除；库存按下面的账本边界补偿，不硬删审计。

UI 业务链通过 API 准备和变更临时数据，再在真实浏览器检查应用配置、动态数据和流程状态回写、人事与仓库增改删后的展示。该套件不能解释成所有 CRUD 都在界面点击完成，也不覆盖真实 DeepSeek Provider completion。

### 清理假阳性及修复

首轮接口链 `local-business-chain-20261008.json` 虽报告 32/32、清理成功，但只读数据库核验发现该 run 的库存批次和入库流水各 1 条仍在。原因是两表启用 RLS，`web_user` 没有 DELETE policy；请求返回成功但删除 0 行。旧清理逻辑仅判断 HTTP 成功，不能作为零残留证据。

- `tests/business/full-chain.mjs` 和 `tests/e2e/ui-business-chain.spec.mjs` 的普通记录清理增加 DELETE 后 GET 确认，无匹配记录才能通过。
- 新增 `tests/business/inventory-cleanup.mjs`：严格验证本轮 runId、批次、原入库标记、物料/仓库/单位/操作者/数量以及无关联草稿，再用现有 `scm.stock_out` 出库 1kg。校验余额、锁定量与实时视图总量均为 0，两条流水数量为 +1/-1、合计 0；已有补偿时只验证，不重复写入。未放宽权限、未新增数据库函数或迁移。
- `tests/engineering/inventory-cleanup-regression.mjs` 覆盖正常补偿、重复清理、库存数量变化、额外流水、草稿关联以及请求超时后不盲重试。`auto-entry-types.mjs` 同步修正覆盖说明。
- 首轮 `chain_1791471417071_a490f0` 使用同一现有出库 RPC 精确补偿，保留其原报告作为诊断证据。最终修复轮 `chain_1791472085737_68ee84` 使用修复后套件自动补偿成功。
- 独立只读核验两 run 的 App、路由、数据、流程/任务/事件、状态规则/策略、人事及仓库等普通数据均无残留；共享动态测试表 0 行；历史 published App 保留。两个测试库存批次各保留 2 条审计流水，余额为 0、关联草稿为 0。
- 库中另有 22 个历史 `AUTO-BATCH-chain_*` 批次各余额 1kg，以及历史 UI 测试对象。本轮未改动这些既有记录，不能宣称整个本地库所有历史测试数据已清理。

### 手动验收与制品

登录入口：`http://127.0.0.1:18080/login`；本地隔离测试账号 `admin / 123456`。请使用这一入口，当前临时 Harness auth 插件只配置这个 Origin。

验收制品为本轮全量前端构建所得 dist，manifest `06231c2740972a8f`、564 URL。其他 Agent 随后提交公开详情页面并执行其独立远端发布；本轮没有刷新本地 dist、连接远端或发布服务，因此本结果不覆盖其新远端制品。收尾检查 8 个本地服务运行，Bridge/Agent Runtime healthy，Windows 登录入口 HTTP 200，WSL keepalive 会话保留供手动验收。

建议手动依次登录、展开侧栏并进入各模块、检查表格/图表、数字分身及经营助手面板，再按隔离测试数据验证实际新增/编辑/审批。67 项与现有点击套件不涵盖所有控件、所有角色、全部审批分支或真实模型回复。

### 当前数据库覆盖边界

只读检查确认本轮本地数据库没有 core-007 的动态表 registry/audit 治理表，当前 `create_data_app_table` 不含该版本的单 App 绑定保护。因此现有业务链套件可在当前本地库执行，但结果不证明 core-007 冻结发布制品的兼容性。既有测试表 `app_data.eiscore_chain_test_records` 有 8 列、执行前 0 行；一个历史 published 测试 App 引用该表，本轮保留，不纳入新建数据清理。
