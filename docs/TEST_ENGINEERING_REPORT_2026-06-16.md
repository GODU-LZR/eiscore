# EISCore 工程测试报告

报告日期：2026-06-16 / 2026-06-17 续测
测试对象：本地 WSL 工程 `/home/lzr/eiscore` 与远端环境 `https://nanpai.eissys.top`
测试目标：验证工程可构建、核心接口可用、业务写读改删闭环、Workflow V2 策略链路、知识图谱查询、AI 文档采集链路、浏览器 UI 回归和远端发布一致性。

## 一、结论摘要

| 测试层 | 结果 | 说明 |
|---|---:|---|
| Node 脚本语法门禁 | PASS | `npm run test:syntax` 通过，覆盖 tests/scripts/playwright/realtime 的 34 个入口。 |
| 离线单元/回归 | PASS | `npm run test:unit` 通过，包含数字分身成本表、Smart BI、EISGrid agent、共享 grid 工具、工程 HTTP 客户端、AI 文档采集/解析/计划/通用入库/固定入库 worker 回归。 |
| EISGrid agent 语义 | PASS | `npm run test:grid-agent` 通过，覆盖中文分组统计、明细抽样、金额汇总和受控查询 payload。 |
| 共享 grid 工具 | PASS | `npm run test:grid-utils` 通过，覆盖分页、时间过滤、hash URL 拼接、服务端汇总 payload 和全量合计行。 |
| 工程 HTTP 客户端 | PASS | `npm run test:http-client` 通过，覆盖远端重试、非幂等写请求保护、超时归一化和原生 body 透传。 |
| 全前端构建 | PASS | `npm run build:frontends`，11 个前端包全部构建成功。 |
| 远端 smoke | PASS | V2 patch 前后均为 23/23 PASS。 |
| 远端业务闭环 | PASS | V2 + 本体覆盖 + 本体推理 + 推理洞察 + 知识图谱查询后最新为 31/31 PASS，包含角色授权视图、本体投影覆盖审计、推理事实、洞察健康、角色访问解释、KG 节点/邻域/路径、严格策略和显式状态迁移规则。 |
| 远端工程 API 套件 | PASS | `npm run test:engineering:remote:api` 最新 smoke 23/23、business-chain 31/31。 |
| 67 功能点 UI | PASS | `npm run test:e2e:functions67:remote` 最新 67/67 PASS，覆盖完整功能点矩阵。 |
| UI 业务闭环 | PASS | `npm run test:e2e:business-chain:remote` 最新 1/1 PASS。 |
| UI 点击巡检 | PASS | `npm run test:e2e:clicks:remote` 最新 4/4 PASS；已修复直跑 Playwright 时缺少本地 Linux 依赖路径的问题。 |
| 完整 77 浏览器长跑 | PASS | 历史 `npm run test:e2e:remote` 最终 77/77 PASS；本轮拆分 UI 点击、业务闭环和 67 功能点均已通过。 |

总体判断：工程主链路可用，远端业务、语义本体、推理引擎、推理洞察、知识图谱查询、AI 文档采集链路、桌面采集器构建发布链路和 UI 点击功能均已通过自动化验证。当前剩余风险主要是历史观察到的远端长时间回归偶发 DNS/连接抖动、当前本机 WSL 偶发 `E_UNEXPECTED` 运行时中断、静态资源发布时删除旧 hash 资源会影响缓存窗口内的微前端动态加载，以及桌面采集器自动升级仍需在远端容器发布后做端到端实测。

## 二、本地工程基线

| 命令 | 结果 | 备注 |
|---|---|---|
| `npm run test:syntax` | PASS | 34 个 Node 脚本入口语法门禁通过。 |
| `npm run test:unit` | PASS | 数字分身、Smart BI、Grid、HTTP 客户端、AI 文档采集/解析/计划/通用入库/固定入库 worker 回归通过。 |
| `npm run test:smart-bi` | PASS | Smart BI 领域路由、输出章节、指标口径、风险状态、工作台卡片、卡片报告请求和常用问题回归通过。 |
| `npm run test:grid-agent` | PASS | EISGrid agent 中文查询语义、分组推断、PostgREST payload 和 prompt 格式化回归通过。 |
| `npm run test:grid-utils` | PASS | 共享 grid 分页、时间过滤、服务端汇总和 hash URL 边界回归通过。 |
| `npm run test:http-client` | PASS | 工程 HTTP 客户端远端重试、安全方法策略、JSON/text 解析和原生 body 透传回归通过。 |
| `npm run test:document-intake` | PASS | AI 文档采集 handler 设备鉴权、远程配置、采集目录表兜底、心跳配置响应、上传校验、hash mismatch、重复上传、真实文件大小、分片断点续传和环境兜底回归通过。 |
| `npm run test:document-parser` | PASS | AI 文档解析 worker 文本、图片、unsupported、环境兜底回归通过。 |
| `npm run test:document-planner` | PASS | AI 文档入库计划 worker 应用匹配、fallback 计划、字段快照和环境兜底回归通过。 |
| `npm run test:document-entry` | PASS | AI 文档入库 worker 表格/文本转业务记录、未匹配字段补充、标识符净化和环境兜底回归通过。 |
| `npm run test:document-fixed-entry` | PASS | AI 文档固定入库 worker 采购入库单字段识别、主数据校验、stock-in RPC payload、未匹配字段补充和环境兜底回归通过。 |
| `npm run build:frontends` | PASS | 11 个前端包构建成功。 |
| `node --check playwright.config.mjs tests/e2e/helpers.mjs tests/e2e/ui-business-chain.spec.mjs realtime/index.js` | PASS | Playwright 配置、E2E helper、UI 业务链路、realtime 后端语法通过。 |

构建警告记录：

1. 当前本机 Node.js 为 `20.18.1`，项目 CI 配置为 `20.19.0`，Vite 提示建议升级到 `20.19+` 或 `22.12+`。
2. 部分前端包存在大 chunk、manual chunk 循环和 Sass legacy JS API 警告；本轮不阻断构建，但建议后续纳入性能/构建治理。

## 三、远端接口与业务闭环

### 1. Smoke

| 命令 | 结果 |
|---|---|
| `npm run test:smoke` with `EISCORE_BASE_URL=https://nanpai.eissys.top` | 23/23 PASS |
| V2 patch 后再次 `npm run test:smoke` | 23/23 PASS |

覆盖内容包括首页/深链、登录、错误密码拒绝、PostgREST profile、Workflow definitions alias、Agent health、AI config、AI 非流式/流式、WebSocket 鉴权订阅。

### 2. Business Chain

首次远端业务闭环主流程通过，但 cleanup 失败：

| 指标 | 结果 |
|---|---:|
| 总步骤 | 22 |
| 通过 | 21 |
| 失败 | 1 |

失败原因：当前工作区的 Workflow Policy V2 测试和 cleanup 依赖 `app_center.workflow_transition_rules`、`app_center.workflow_permission_policies`，远端当时尚未应用 V2 schema，PostgREST 返回 `PGRST205`。

处理动作：

1. 远端备份：`/root/eiscore_workflow_policy_v2_before_20260616.sql`
2. 应用：`sql/patch_workflow_policy_v2.sql`
3. PostgREST schema reload：patch 内已执行 `pg_notify('pgrst', 'reload schema')`

复测结果：

| 命令 | 结果 |
|---|---|
| `npm run test:business-chain` with `EISCORE_CHAIN_BASE_URL=https://nanpai.eissys.top` | 24/24 PASS |

新增验证点：

1. strict policy 下缺少迁移规则时，Workflow transition 返回 403。
2. 创建显式状态迁移规则后，Workflow 从 `FLOW_REVIEW` 正确流转到 `FLOW_DONE`。
3. Workflow permission policy、transition rules、state mappings、definition、instance、动态数据记录均完成 cleanup。

## 四、浏览器工程回归

执行环境：

```bash
LD_LIBRARY_PATH=$PWD/tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu
EISCORE_E2E_BASE_URL=https://nanpai.eissys.top
```

### 1. 完整套件观察

| 命令 | 结果 | 说明 |
|---|---:|---|
| `npm run test:e2e:remote` | 75/77 PASS | 初次发现 FP39 登录 socket hang up；仓储侧边栏旧 hash 资源 404。 |
| `npx playwright test --workers=1` | 76/77 PASS | 单 worker 后发现 FP28 登录 socket hang up；修复后又遇到连接层错误。 |
| `npx playwright test --workers=1 --retries=1` | 76/77 PASS | FP01 首次 `ERR_CONNECTION_CLOSED`，retry 时 DNS `EAI_AGAIN`。 |
| `npm run test:e2e:remote` | 77/77 PASS | 配置远端默认单 worker、retry、登录/跳转重试与更长 API timeout 后全量通过。 |

### 2. 已修复问题

| 问题 | 处理 | 验证 |
|---|---|---|
| E2E 登录接口偶发 `socket hang up` | `tests/e2e/helpers.mjs` 的 `loginByApi` 增加远端默认 5 次短重试，支持 `EISCORE_E2E_LOGIN_ATTEMPTS` 覆盖。 | FP28/FP39 单点复测通过；最终全量 77/77 PASS。 |
| 仓储侧边栏点击出现旧 hash 资源 404 | 将远端备份中的旧 `materials/assets` 合并回当前目录，保留新旧 hash 资源。 | 旧/新仓储资源均 HTTP 200；侧边栏点击复测通过。 |
| 远端浏览器长跑连接抖动 | `playwright.config.mjs` 对远端目标默认 `workers=1`、`retries=1`，并允许环境变量覆盖；`gotoWithRetry` 远端默认 3 次跳转重试。 | `npm run test:e2e:remote` 全量通过。 |
| Smoke 首页 fetch 偶发失败 | `tests/smoke/business-smoke.mjs` 增加远端默认 3 次请求重试，支持 `EISCORE_SMOKE_REQUEST_ATTEMPTS` 覆盖。 | `npm run test:engineering:remote` 中 smoke 23/23 PASS。 |
| 业务链路 API 偶发慢响应 | `tests/e2e/ui-business-chain.spec.mjs` 默认 API timeout 从 20s 提高到 45s，支持 `EISCORE_E2E_API_TIMEOUT_MS` 覆盖。 | UI 业务闭环和全量 E2E 通过。 |
| 发布脚本可能删除旧 hash | 新增 `scripts/sync-spa-dist-preserve-assets.sh`，发布 SPA root 文件时可删除，发布 `assets/` 时保留历史 hash，并自动备份目标目录。 | `bash -n` 与远端 `--dry-run` 通过。 |

静态资源兼容修复涉及的旧文件：

1. `/materials/assets/index-CNij5kng.js`
2. `/materials/assets/MaterialAppGrid-BHY-6A2n.js`
3. `/materials/assets/MaterialsApps-GQyFIWlm.js`
4. `/materials/assets/MaterialsAppView-VXXDuM3X.js`

### 3. 单点复测结果

| 用例 | 结果 |
|---|---:|
| FP01 工作台首页 | PASS |
| FP28 回款记录 | PASS |
| FP39 生产工单 | PASS |
| UI 业务闭环 | PASS |
| UI 点击：交互登录 | PASS |
| UI 点击：侧边栏导航 | PASS |
| 完整远端浏览器套件 | PASS，77/77 |
| 完整远端工程套件 | PASS，3/3 |

## 五、续测记录

| 时间 | 命令 | 结果 | 说明 |
|---|---|---:|---|
| 2026-06-17 | `sql/patch_ai_document_intake_mvp.sql` | PASS | 远端应用 AI 文档采集 MVP schema；采集设备、资产、分片上传会话/片段、解析任务/结果、入库计划、业务链接、未匹配字段和客户端日志均验证 ready。补丁只授权 `web_user` 读写，不向 `web_anon` 暴露采集资产/日志读取。备份：`tests/.artifacts/eiscore_document_intake_mvp_schema_before_20260617_0010.sql`。 |
| 2026-06-17 | `sql/patch_ontology_graph_query_v1.sql` | PASS | 远端应用知识图谱查询层，新增 `v_ontology_kg_nodes`、`search_ontology_kg_nodes(...)`、`query_ontology_kg_neighbors(...)`、`find_ontology_kg_paths(...)`；验证节点 `super_admin` 度数 354、邻域和路径查询均返回数据。 |
| 2026-06-17 | `npm run test:business-chain:remote` | PASS | business-chain 31/31；本体语义覆盖为关系 145/145、字段 1968/1968，推理事实 3052、推理健康 healthy，新增 `02h` KG 节点/邻域/路径 API 检查。 |
| 2026-06-17 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 31/31；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-17T15-43-34-627Z.md`。 |
| 2026-06-17 | `npm run test:document-intake` | PASS | 新增采集端远程配置与分片上传回归：`GET /document-intake/devices/config`、`collector_watch_folders` 表配置兜底、camelCase `false` 布尔值保真、heartbeat 配置响应拉平、设备 token hash 不外泄、分片初始化校验、缺片完成拦截、chunk hash mismatch、重复分片幂等、同索引不同内容冲突、分片大小校验和成功拼装入库。 |
| 2026-06-17 | Collector Desktop 配置兜底静态验证 | PASS | 对本地桌面采集器补充配置加载/保存归一化，防止旧配置或坏配置中的 `watchFolders`、`allowedExtensions`、心跳/上传/日志策略为空或越界时触发运行时异常。 |
| 2026-06-17 | Collector Desktop 鲁棒性静态验证 | PASS | 新增未处理异常 crash dump manifest/minidump 输出，上传队列和日志上传后台循环在单次异常后继续运行；受限于本机缺 .NET SDK，当前完成代码审查与 XML 静态校验。 |
| 2026-06-17 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。 |
| 2026-06-17 | `npm run test:document-intake && npm run test:document-parser && npm run test:unit` | PASS | AI 文档采集/解析/计划/通用入库/固定入库 worker 离线回归全部通过，并已纳入 `test:unit`。 |
| 2026-06-17 | `npm run test:syntax` | PASS | 34 个 Node 脚本入口语法检查通过，覆盖新增 realtime document worker 与工程测试脚本。 |
| 2026-06-17 | `npm --prefix eiscore-base run build` | PASS | 受影响 base 前端构建通过；仍有 Node 20.18.1 低于 Vite 建议 20.19+ 的环境警告。 |
| 2026-06-17 | `npm --prefix eiscore-apps run build` | PASS | 受影响 apps 前端构建通过；仍有 Sass legacy JS API、manual chunk 循环和大 chunk 警告。 |
| 2026-06-17 | Smart BI 行动闭环本地验证 | PASS | 新增 `sql/patch_smart_bi_action_closure.sql`、AI Copilot 行动闭环草案卡片、审批中心行动单视图和流程待办发起逻辑；`npm run test:unit`、`npm run test:syntax`、`npm --prefix eiscore-base run build`、`npm --prefix eiscore-apps run build` 通过。当前本机无 `psql`，该 SQL patch 尚未在远端执行。 |
| 2026-06-17 | Collector Desktop 发布脚本静态验证 | PASS | 新增 `collector-desktop/scripts/publish-collector.ps1` 与 `collector-desktop/installer/EISCore.Collector.iss`，支持 publish/package、Inno Setup 安装器模板、SHA256、update manifest 和安装器参数；PowerShell PSParser 语法检查通过。 |
| 2026-06-17 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。 |
| 2026-06-17 | `npm run test:e2e:business-chain:remote` | PASS | 远端 UI 全业务链路闭环 1/1 PASS。 |
| 2026-06-17 | Collector Desktop XML 静态校验 | PASS | `collector-desktop/EISCore.Collector` 下 `.xaml` 与 `.csproj` XML 均可解析；本机 Windows 仅有 .NET runtime、无 SDK，WPF 实编需在安装 .NET SDK 的机器上继续执行。 |
| 2026-06-17 | Collector Desktop 自动更新静态验证 | PASS | 新增远程 `update` 策略、manifest 下载、SHA256 校验、待安装状态保存和按策略启动安装器；`document-intake-regression` 已覆盖远程配置下发的 update 字段，Node 文档采集链路回归继续通过。 |
| 2026-06-18 | Collector Desktop 发布脚本静态验证 | PASS | 新增 `collector-desktop/scripts/publish-collector.ps1`，支持 .NET publish、zip 打包、SHA256 计算、`update.json` 生成，以及对既有 MSI/EXE 安装包生成自动更新 manifest；本轮完成 PowerShell AST 解析和 manifest-only dry run。 |
| 2026-06-18 | Collector Desktop 安装器模板静态验证 | PASS | 新增 Inno Setup 模板 `collector-desktop/installer/EISCore.Collector.iss`，发布脚本新增 `-BuildInstaller`、`-InnoSetupCompiler`、安装器输出和 manifest 指向 EXE 的分支；本轮完成 PowerShell AST 解析、模板关键段落静态检查和 manifest-only dry run。 |
| 2026-06-18 | Collector Desktop 真实构建与安装器发布 | PASS | Windows 已通过 `winget` 安装 .NET SDK 7.0.410 和 Inno Setup 6.7.3；`dotnet build -c Release` 0 warning / 0 error；`publish-collector.ps1 -BuildInstaller` 成功生成 zip、EXE 安装器和指向 EXE 的 `update.json`。安装器改为当前用户安装到 `%LocalAppData%\Programs\EISCore\Collector`，避免静默更新时需要管理员 UAC。 |
| 2026-06-18 | Collector Desktop release 下载路由 | PASS | `realtime/document-intake.js` 新增 `/document-intake/collector/releases/<file>` 只读下载 handler，拒绝路径穿越并为 `update.json` 使用 `no-store`；compose 将 `collector-desktop/artifacts/release` 只读挂载到 `/app/data/collector-releases`。`publish-collector.ps1 -ReleaseDirectory` 已生成可由 `/agent/document-intake/collector/releases/update.json` 访问的发布目录。 |
| 2026-06-18 | Collector Desktop 静默安装与 AutoInstall 验证 | PASS | 直接运行生成的 Inno 安装包 `/VERYSILENT /NORESTART /CLOSEAPPLICATIONS` 退出码 0，已安装到 `%LocalAppData%\Programs\EISCore\Collector`，`EISCore.Collector.exe` 版本为 `0.2.0`。同时补齐并验证 `publish-collector.ps1 -PackagePath ... -AutoInstall` 分支，脚本会把 WSL/UNC 路径安装包复制到 `%TEMP%` 后执行，结果返回 `autoInstallExecuted=true`、`autoInstallExitCode=0`、`autoInstallPath=<本地临时安装包>`。 |
| 2026-06-18 | Collector Desktop 单实例与升级互斥 | PASS | 采集端新增命名 mutex 与重复启动唤醒信号，避免同一 Windows 用户下启动多个后台采集实例；Inno 模板新增同名 `AppMutex`，配合 `CloseApplications=yes` 和 `/CLOSEAPPLICATIONS` 让静默升级先识别并关闭运行中的采集端。本轮 `dotnet build -c Release`、Inno 编译、`publish-collector.ps1 -BuildInstaller -AutoInstall -ReleaseDirectory` 均通过。 |
| 2026-06-18 | Collector Desktop 开机自启路径校验 | PASS | `StartupService` 统一生成当前用户 Run 注册表命令，并在判断自启状态时解析命令确认其指向当前 `EISCore.Collector.exe`，避免旧安装路径残留被误判为已启用。新增 `npm run test:collector-startup-service` 覆盖带空格路径、启动参数、大小写无关匹配、旧路径不匹配和空命令兜底。 |
| 2026-06-18 | Collector Desktop 升级安装器审计 | PASS | 自动更新启动安装器后会在本地配置写入 `pendingUpdateInstallerProcessId`、`pendingUpdateInstallerStartedAt`，并在 `collector_update_installer_started` 日志元数据中记录安装器 PID、启动时间和实际安装参数，便于排查远端升级是否真正拉起安装器。 |
| 2026-06-18 | Collector Desktop 自动更新 URL/SHA256/包类型校验 | PASS | 新增 `CollectorUpdateUrlPolicy`、`CollectorUpdateVersionPolicy`、`CollectorUpdateHashPolicy`、`CollectorUpdatePackagePolicy` 与 `CollectorUpdateInstallerArgumentsPolicy`，自动更新 `manifest_url` 和 manifest 内 `download_url` 必须是绝对 `http/https` 地址，manifest 响应最大 128KB 且必须是合法 JSON，`version` 必须是 2 到 4 段数字点分版本，`sha256` 必须是 64 位十六进制字符串；下载包只允许 `.exe`、`.msi`、`.zip`，自动安装只允许 `.exe` / `.msi`，自动安装参数会 trim、最长 512 字符且禁止控制字符。空值、相对路径、`ftp://`、`file://`、HTML/坏 JSON/超大 manifest、非法版本号、缺失/格式错误 SHA256、不支持扩展名、ZIP 自动安装或非法安装参数会记录 `collector_update_manifest_invalid` 并跳过下载/安装；若本地日志 SQLite 短暂不可写，更新检查诊断日志会 best-effort 跳过且检查仍标记为已处理，避免远程坏配置触发后台异常、绕过校验、执行脚本文件、污染日志或使用本地文件 URL。`npm run test:collector-update-download` 覆盖非法 manifest URL、日志不可写软降级、非法 download URL、非法 manifest JSON、超大 manifest、非法版本号、非法 SHA256、包类型策略、安装参数策略、结构化日志原因和 SHA256 原子保存。 |
| 2026-06-19 | Collector Desktop 版本号一致性 | PASS | `EISCore.Collector.csproj` 固定 `Version=0.2.0`、`AssemblyVersion=0.2.0.0`、`FileVersion=0.2.0.0`；客户端启动时从程序集同步 `clientVersion` 到本地配置，避免旧配置 `0.1.0` 导致同版本 manifest 反复触发升级。已验证不传 `-Version` 的 `publish-collector.ps1 -BuildInstaller -AutoInstall -ReleaseDirectory` 会生成 `EISCore.Collector-0.2.0-win-x64-setup.exe`。 |
| 2026-06-19 | Collector Desktop 本地 WSL release 安装 | PASS | 本地 Docker/WSL 已运行 `db`、`api`、`nginx`、`agent-runtime`，`collector-desktop/artifacts/release` 只读挂载到 `/app/data/collector-releases`。使用 `-DownloadBaseUrl http://localhost/agent/document-intake/collector/releases` 重新生成本地 manifest；`GET /agent/document-intake/collector/releases/update.json` 返回 200，安装包 `GET` 下载 3152533 bytes 且 SHA256 与 manifest `1e15456bde40845bf5c7af365a053e7795b182b57cc8aeff5fe92a2003185904` 一致，安装包 `HEAD` 返回 200 和正确 `Content-Length`。 |
| 2026-06-19 | Collector Desktop 本地 WSL 一键脚本 | PASS | 新增 `collector-desktop/scripts/setup-local-wsl-release.ps1`，可发布采集端 release、启动/重启本地 Docker 服务、验证 manifest/安装包 HEAD/下载 SHA256，并可通过 `-SeedDevice` 预置本地设备 `enterprise=local`、`deviceCode=local-collector-01`、绑定码 `local-bind-code` 及本地自动更新配置。已验证 `-SkipPublish -SeedDevice` 输出 manifest URL、download URL、版本、SHA256、下载大小、seed 状态和 `deviceApi` 验收摘要。 |
| 2026-06-19 | Collector Desktop WSL Docker 挂载兜底 | PASS | `setup-local-wsl-release.ps1` 检测到 `\\wsl.localhost\<发行版>\...` 路径时自动在对应 WSL 内执行 Docker Compose / `docker exec psql`，并 `--force-recreate agent-runtime`，避免 Windows Docker CLI 对 WSL bind mount 生成不可用 `/app`。复跑 `-SkipPublish -SeedDevice` 成功，容器内 `/app/index.js` 可读。 |
| 2026-06-19 | Collector Desktop 本地设备 API 验收 | PASS | 修复已有设备绑定时 `update public.collector_devices` 多传未使用参数导致 PostgreSQL 无法推断 `$2` 类型的问题；`document-intake-regression` 新增已有设备绑定回归，断言 update 参数为 `$1..$8`。本地 `POST /agent/document-intake/devices/bind` 返回 64 位 token，`GET /devices/config` 返回本地 manifest URL 和 `autoInstall=true`，`POST /devices/heartbeat` 返回 `ok=true`。 |
| 2026-06-19 | Collector Desktop WSL .NET SDK 与构建 | PASS | 已在本地 WSL 用户目录 `/home/lzr/.dotnet` 安装 .NET SDK 7.0.410，并写入 `.profile` / `.bashrc`；`dotnet restore collector-desktop/EISCore.Collector/EISCore.Collector.csproj -p:EnableWindowsTargeting=true` 与 `dotnet build -c Release -p:EnableWindowsTargeting=true --no-restore` 在 WSL 中通过，0 warning / 0 error。 |
| 2026-06-19 | AI 入库业务修正审计接口 | PASS | `realtime/document-intake.js` 新增 `POST /document-intake/business-corrections`，设备 token 鉴权后写入 `ai_business_corrections`，支持按 `businessLinkId` 或目标业务记录定位，影响类字段默认进入待重算状态，并把 `document_business_links.metadata.ai_review_status` 标记为 `corrected`。`document-intake-regression` 覆盖缺字段拦截、修正审计插入和业务链接 metadata 更新。 |
| 2026-06-19 | Collector Desktop 监听目录归属 | PASS | 桌面端上传队列新增 `source_folder`、`uploaded_by_username`、`uploaded_by_role`、`operator_source` 字段并兼容旧 SQLite 自动补列；`WatchFolderService` 按触发目录匹配 `WatchFolderConfig`，上传 metadata 使用目录默认用户、用户名和岗位并标记 `folder_binding_user`。服务端上传 handler 将 `source_folder` 写入 `document_assets.source_folder`，`document-intake-regression` 覆盖来源目录落库。 |
| 2026-06-19 | Collector Desktop 本地日志保留 | PASS | `ClientLogStore` 新增按 cutoff 删除已上传日志，`LogUploadProcessor` 按远程 `logs.retention_days` 清理 `uploaded=1` 的过期日志；该策略后续已扩展为同时裁剪超期 pending 日志并上报摘要。`dotnet build -c Release -p:EnableWindowsTargeting=true --no-restore` 通过。 |
| 2026-06-23 | Collector Desktop 日志脱敏加固 | PASS | `ClientLogService.Sanitize` 覆盖 JSON 字段、URL query、普通键值片段、`Bearer`/`Basic` 授权头、手机号、身份证号和单条文本截断；日志在写入本地 SQLite 队列前完成脱敏，降低断网缓存期间 token/Cookie/授权码留存风险。`npm run test:collector-log-sanitize` 与 `dotnet build -c Release -p:EnableWindowsTargeting=true --no-restore` 通过。 |
| 2026-06-23 | Collector Desktop 设备 token 本地保护 | PASS | 新增 `DeviceTokenProtector`，Windows 运行时继续使用当前用户 DPAPI 保存 `encryptedDeviceToken`，工程测试环境使用本地 AES-GCM key 验证配置文件不落明文；`ConfigurationService.LoadAsync()` 会把旧配置中的明文 `deviceToken` 迁移为受保护 token，并净化主配置和历史 `.bak`。`npm run test:collector-config-persistence` 覆盖 token round-trip、主配置无明文、旧明文字段迁移和 stale backup 净化。 |
| 2026-06-23 | Collector Desktop 设备认证失效收敛 | PASS | `CollectorApiClient` 将已绑定设备接口 401/403 转为 `CollectorDeviceAuthException`；主窗口心跳、远程配置同步、上传队列或日志上传遇到认证失败时会记录 `collector_device_auth_failed`、清空本地 `encryptedDeviceToken`、把设备状态置为 `pending` 并停止监听；若 pending 状态保存失败，当前进程仍清空内存 token、刷新界面、停止采集，并 best-effort 记录 `collector_device_auth_state_save_failed`。绑定接口 `BIND_CODE_INVALID` 单独转为 `CollectorDeviceBindException`，提示授权码无效或已过期，不会误触发 token 清空；重新绑定成功会保存新 token 并把本地 `DeviceStatus` 恢复为 `active`，避免成功绑定后仍被 pending 停采策略拦截。`CollectorDeviceAccessPolicy` 现在同时拦截 `disabled` 和 `pending`；文件上传认证失败会把当前行退回 `queued` 且不增加 `retry_count`，额外记录带 queue id、文件名、hash 和重试次数的 `file_upload_auth_failed`，也不会误记为 `upload_connectivity_offline`。新增 `npm run test:collector-device-auth` 覆盖绑定码错误分类、重新绑定 active 恢复、401 异常、token 清理、认证失效状态保存失败软降级、pending 停采、`binding_required` 日志、上传认证失败不消耗重试、带/不带主窗口回调的上传上下文日志，以及日志上传认证失败时 pending 日志留存。 |
| 2026-06-23 | Collector Desktop 日志 metadata 安全序列化 | PASS | 新增 `ClientLogMetadata.Serialize(...)`，替换采集端手写 JSON metadata 字符串，统一输出 snake_case 字段并正确处理路径、版本号、asset id 中的引号、反斜杠和换行。`npm run test:collector-log-sanitize` 已覆盖 metadata 可解析性与字段恢复。 |
| 2026-06-23 | Collector Desktop 日志凭据脱敏补强 | PASS | `ClientLogService.Sanitize(...)` 扩展覆盖 camelCase 凭据字段（`accessToken`、`refreshToken`、`apiKey` 等）、查询参数 camelCase token、裸 JWT 和 URL userinfo 账号密码，避免 WebView/前端 SDK 日志把 token、Cookie、Authorization 或 URL 凭据写入本地 SQLite 并批量上报。`npm run test:collector-log-sanitize` 覆盖 snake_case/camelCase JSON、查询参数、Bearer/Basic、裸 JWT、URL userinfo、手机号、身份证和超长文本截断。 |
| 2026-06-23 | Collector Desktop 绑定码日志脱敏 | PASS | 日志脱敏规则继续扩展 `authorizationCode`、`authCode`、`bindCode`、`bindingCode`、`deviceBindCode` 及 snake_case 变体，覆盖 JSON 字段、query string 和普通 assignment 文本，避免一次性设备授权码被前端 SDK、异常堆栈或 metadata 写入本地日志。`npm run test:collector-log-sanitize` 覆盖绑定码 JSON、查询参数和赋值格式。 |
| 2026-06-23 | Collector Desktop WebView 原生日志 | PASS | `WebViewLogBridge` 初始化时使用主窗口内存中的当前配置上下文，不再重新从磁盘加载旧配置；新增 `WebResourceResponseReceived` 原生响应监听，HTTP 4xx 记为 `warn`、5xx 记为 `error`，日志包含 request URL、method、reason phrase 和 status code，用于补齐静态资源/API 响应异常采集。新增 `WebViewLogPolicy` / `WebViewMessagePolicy` 与 `npm run test:collector-webview-log-policy` 覆盖状态码采集、日志等级规则、数字/布尔上下文字段保留、对象/数组消息保留和字符串 `statusCode` 解析，WPF Release 构建通过。 |
| 2026-06-23 | Collector Desktop 后台事件日志异常隔离 | PASS | 新增 `CollectorBackgroundTask`，WebView 事件、文件夹监听事件、设备禁用/待绑定运行态切换等 fire-and-forget 日志写入统一观察并吞掉非取消异常；主窗口初始化、绑定、保存配置、手动上传、开机自启、心跳、远程配置、健康快照和设备认证失效等 catch 分支的兜底日志也改为 best-effort，启动成功、绑定成功、上传队列中断恢复、已上报崩溃报告清理、WebView 初始化降级和托盘初始化降级等审计日志也不会因本地 SQLite 短暂不可写反向影响成功状态或后台循环。新增 `npm run test:collector-background-task` 覆盖成功、失败、取消、延迟失败任务的安全观察，并用源码守卫检查主窗口关键审计日志走 `LogBestEffortAsync`；WPF Release 构建覆盖主窗口接入。 |
| 2026-06-24 | Collector Desktop 心跳 Tick 不重入 | PASS | 新增 `CollectorReentrancyGate` 并接入主窗口心跳定时器；如果上一轮心跳、远程配置同步、更新检查或日志 flush 尚未完成，下一次 Tick 会直接跳过，避免慢网络或服务端卡顿时并发执行多轮后台同步、重复保存配置或堆叠日志补传。`npm run test:collector-background-task` 覆盖 gate 首次进入、重入拒绝、释放后再次进入和 dispose 后拒绝，WPF Release 构建覆盖主窗口接入。 |
| 2026-06-24 | Collector Desktop UI 投递入口异常隔离 | PASS | 手动选择文件、窗口拖拽文件和上传队列刷新等 WPF `async void` 入口增加兜底异常处理；本地文件系统、SQLite 或队列格式化短暂异常时会在状态栏提示并 best-effort 写入 `manual_file_select_failed`、`manual_drag_drop_failed`、`file_enqueue_batch_failed` 或 `upload_queue_refresh_failed`，避免异常冒出 UI 事件处理器导致主窗口崩溃。WPF Release 构建覆盖主窗口接入。 |
| 2026-06-24 | Collector Desktop WebView 启动降级 | PASS | 新增 `CollectorWebViewStartupPolicy`，主窗口启动时 WebView2 runtime 缺失、损坏或初始化失败会记录 `webview_initialization_failed`，但不再中断心跳、远程配置、监听目录、上传队列和日志后台循环启动，避免浏览器壳异常导致无人值守本地采集停摆。WebView2 用户数据目录固定为 `%AppData%\EISCore\Collector\webview-user-data`，避免从 WSL/UNC 开发路径启动时默认目录不可写触发 `E_ACCESSDENIED` 并造成右侧空白。新增 `npm run test:collector-webview-startup-policy` 覆盖成功初始化、普通异常降级和取消异常继续抛出。 |
| 2026-06-23 | Collector Desktop 前端 SDK 日志上下文 | PASS | 注入脚本暴露 `window.eiscoreCollectorLog`，支持前端设置上下文并主动上报 Vue/axios/路由/用户操作等 SDK 日志；`WebViewLogBridge` 会解析 `appModule`、`traceId`、`aiImportBatchId`、`sourceFileHash`、`userId`、`username`、`role`，`ClientLogService` 将其写入 `client_log_events` 独立列，未传用户字段时回退设备默认用户；前端将上下文字段传成数字/布尔、将 message/stack 传成对象/数组或将 `statusCode` 传成数字字符串时，桥接层会保留可读文本或解析为状态码，避免埋点字段类型不稳定导致上下文静默丢失。新增 `npm run test:collector-log-context` 覆盖追溯字段落库和默认用户回退，`npm run test:collector-webview-log-policy` 覆盖消息字段读取容错。 |
| 2026-06-23 | Collector Desktop 日志表升级迁移 | PASS | `ClientLogStore.EnsureCreatedAsync()` 会对已存在的旧版 `client_log_events` SQLite 表自动补齐日志上下文列、`created_at`、`metadata`、`uploaded` 和索引依赖列，再创建 pending 查询索引；旧客户端升级后无需清空本地日志队列，历史未上传日志会带安全默认值继续可读可补传。若旧库存在非法 `created_at` 文本，单条日志读取回退 Unix epoch，水位读取回退 null；异常 `uploaded` 标记归一化为 pending/已上传布尔值，非法 `status_code` 置空，空 metadata 恢复为 `{}`，避免一条坏旧日志阻塞整批补传或日志健康水位。新增 `npm run test:collector-log-schema-migration` 覆盖极简旧表迁移、旧行读取、新字段写入、非法 `created_at`、坏 `uploaded/status_code/metadata` 兜底和 `MarkUploadedAsync`。 |
| 2026-06-23 | Collector Desktop 日志上传恢复 | PASS | `LogUploadProcessor.FlushAsync()` 在日志批量接口临时失败时会保留本地 pending 日志，恢复后按批次补传并标记 uploaded；`ClientLogService.HighPriorityLogWritten` 只在 error/failed 等高优先级日志写入后触发；已上传日志在无 pending 上传时也会按 `logs.retention_days` 清理。新增 `StopAndFlushAsync()` 供退出路径先停止后台循环再执行最终 flush，避免显式 flush 被后台锁占用而跳过。`npm run test:collector-log-upload` 用本地 HTTP stub 覆盖 503 后重试、设备请求头、日志 payload、pending 保留、恢复标记、retention prune 和 `collector_stop` 最终 flush。 |
| 2026-06-23 | Collector Desktop 崩溃 dump 保留清理 | PASS | `CrashDumpService` 新增已上报崩溃报告清理策略，采集端启动补报未上报 manifest 后，会按 `logs.retention_days` 删除超过保留期且已有 `.reported` 标记的 manifest、marker 和同名 `.dmp`；未上报 manifest 和孤立 dump 不会被误删，断网或日志上传失败后仍可等待后续补报。crash dump 写入、`.reported` 标记写入、目录枚举和清理遇到权限或文件系统瞬时异常时都会 best-effort 降级，不让全局异常处理器或采集端启动再次失败。新增 `npm run test:collector-crash-dump-retention` 覆盖正常 manifest 写入与脱敏、老已上报报告清理、老未上报报告保留、近期已上报报告保留、坏 manifest fallback、幂等二次清理、不可访问目录软降级和不可写目录写报告不抛。 |
| 2026-06-23 | Collector Desktop 日志补传预检一致性 | PASS | 新增 `CollectorLogUploadPolicy`，日志补传在设备待绑定、后台禁用、服务器地址缺失/非法或 token 缺失时直接保留 pending 日志并记录一次 `log_upload_unavailable` 本地告警，避免旧配置非法地址导致后台循环持续异常且不可见。`npm run test:collector-log-upload` 覆盖非法服务器地址不外发、不标记 uploaded、告警去重和恢复后继续补传。 |
| 2026-06-23 | Collector Desktop 分片上传客户端续传 | PASS | `CollectorApiClient` 在大文件分片初始化后会校验服务端返回的 `chunkSize` / `totalChunks` 与本地计划一致，并只信任合法范围内的 `missingChunks` / `uploadedChunks` 编号；客户端优先按 `missingChunks` 补传，未返回缺失列表时再按 `uploadedChunks` 推导，且每片上传后校验服务端确认的 `sessionId`、`chunkIndex`、`totalChunks` 和 `ok` 状态；普通上传、分片初始化重复命中和分片完成响应都必须返回可识别的 `uploaded` / `duplicate` 状态和非空 `assetId`，客户端会 trim 并清理 `assetId` / `batchId` / `message` 中的控制字符，超长 `assetId` / `batchId` 会被拒绝而不是截断，并以 `status` 归一化 duplicate 标志，避免重复上传服务端已确认的分片、在确认错片后继续 complete、把不可追溯的空资产响应写成本地上传成功，或因 duplicate 布尔字段缺失/不一致把重复文件写成普通上传。`npm run test:collector-chunk-upload-client` 通过本地 HTTP stub 覆盖 init/upload/complete、设备请求头、上传 metadata、缺片计划、非法索引过滤、末片大小、错片确认拦截、分片完成空 assetId 拦截、分片完成响应清理和分片初始化 duplicate 空 assetId 拦截；`npm run test:collector-upload-connectivity` 覆盖普通小文件上传空 assetId 拦截、上传成功响应清理、超长 assetId 拦截和 `status=duplicate` 归一化。 |
| 2026-06-23 | Collector Desktop 上传中断恢复 | PASS | `UploadQueueStore.ResetInterruptedUploadsAsync()` 在采集端启动时将上次遗留的 `uploading` 记录恢复为 `queued`，避免进程崩溃、Windows 重启或自动更新关闭采集端后文件永久卡在上传中。新增 `EISCORE_COLLECTOR_DATA_DIR` 便于隔离本地测试数据目录；`npm run test:collector-upload-recovery` 覆盖 SQLite 队列恢复、可重试和幂等行为。 |
| 2026-06-23 | Collector Desktop 上传队列表升级迁移 | PASS | `UploadQueueStore.EnsureCreatedAsync()` 现在会对已存在的旧版 `upload_queue` SQLite 表自动补齐当前上传链路读写需要的来源目录、上传归属、重试、错误、上传完成时间和服务端 asset id 等列，再创建状态/时间与非空未忽略文件 hash 唯一索引；若旧库已有同名完整唯一索引，会替换为 partial unique index。旧客户端升级后无需清空本地上传队列。重复 `file_hash` 旧记录会保留一条优先记录，其余标记为 `ignored`；缺少 `file_hash` 的旧记录也会标记为 `ignored`，避免坏旧数据阻塞启动。`npm run test:collector-upload-schema-migration` 覆盖旧行读取、重复 hash 迁移、缺 hash 忽略、旧完整索引替换、中断恢复、上传结果写入和新行插入。 |
| 2026-06-23 | Collector Desktop 上传队列本地保留 | PASS | 新增远程 `upload.queue_retention_days` 策略，采集端只清理超过保留期的 `uploaded`、`duplicate` 和 `ignored` 本地 SQLite 队列记录；`queued`、`uploading`、`failed`、`pending` 和缺少 `uploaded_at` 的完成记录继续保留，且不会删除用户原始文件。新增 `npm run test:collector-upload-queue-retention` 覆盖清理边界和文件保留，`document-intake-regression` 覆盖远程配置下发。 |
| 2026-06-23 | Collector Desktop 手动选择归属 | PASS | 原生“选择文件”路径在没有 Web 登录用户快照时会使用当前配置默认上传人并写入 `operator_source=manual_selected_user`，窗口拖拽无登录快照时仍回退 `device_default_user`，有登录快照时两者都优先 `web_login_user`；监听目录继续优先 `folder_binding_user`，避免无人值守目录受前台页面用户影响。`npm run test:collector-upload-ownership` 覆盖四类来源归属。 |
| 2026-06-23 | Collector Desktop 失败文件重新入队 | PASS | 同一文件 hash 如果此前处于 `failed` 且 `retry_count` 已达到远程 `upload.maxRetryCount`，再次拖入或监听目录再次投递时会复用原队列记录，刷新文件路径/上传来源/归属信息并重置为 `queued`、`retry_count=0`。`npm run test:collector-upload-recovery` 覆盖失败耗尽记录重新入队，已上传/重复文件仍保持去重跳过策略。 |
| 2026-06-23 | Collector Desktop 后台禁用设备停采 | PASS | 采集端同步服务端 `device.status` 到本地 `DeviceStatus`；状态为 `disabled` 时停止监听目录、阻止手动文件入队、让上传队列跳过文件上传、让日志上传循环跳过远端上报并保留本地 pending 日志，同时跳过显式远程配置拉取；心跳保留为最小恢复通道，后台重新启用后可通过心跳响应恢复配置。`npm run test:collector-device-disabled` 覆盖禁用态不入队、启用后同文件可入队、禁用日志记录、禁用态日志不外发和禁用态不拉远程配置。 |
| 2026-06-23 | Collector Desktop 心跳/配置同步预检 | PASS | 新增 `CollectorDeviceRemoteCallPolicy`，心跳和远程配置同步在服务器地址缺失/非法或 token 缺失时会先暂停远程调用；非空非法地址会记录一次 `collector_remote_call_unavailable` 本地告警。策略保留禁用态心跳作为后台重新启用的恢复通道，但远程配置同步在禁用或待绑定状态下暂停。远程配置已应用到当前进程后，若本地配置保存失败，会记录 `collector_config_sync_state_save_failed`，但仍刷新日志上下文、界面、心跳间隔和监听运行态，避免后台禁用/启用或目录变更卡在半应用状态。`npm run test:collector-device-auth` 覆盖心跳、配置同步、非法地址、空地址和 token 缺失分支；`npm run test:collector-background-task` 用源码守卫检查配置同步保存失败告警走 best-effort 日志。 |
| 2026-06-23 | Collector Desktop 绑定响应完整性 | PASS | 采集端校验绑定成功响应必须包含非空 `deviceId` 与 `deviceToken`；若后台 2xx 响应缺字段或 token 为空，客户端会抛出错误且不保存 `collector-config.json`，不会把本地设备误置为 `active`。`npm run test:collector-device-auth` 覆盖坏成功响应不变更 pending 配置、有效重新绑定恢复 active 和设备认证失效回 pending。 |
| 2026-06-23 | Collector Desktop 绑定失败提示分类 | PASS | 新增 `CollectorBindFailurePolicy`，主窗口绑定失败时不再直接拼接底层 HTTP/异常文本，而是按授权码无效、后台拒绝、绑定响应异常、超时、网络失败和服务端错误生成现场可读提示；`collector_bind_failed` 日志写入 `failure_kind`、HTTP 状态码、设备编号和服务器地址。若绑定前设备身份已变更，当前进程会先清空内存 token 并切到待绑定运行态；该状态保存失败时记录 `collector_bind_invalidated_state_save_failed`，但不会盖掉原始绑定失败提示。`npm run test:collector-device-auth` 覆盖授权码错误提示不暴露 403、坏成功响应提示后台契约、超时和网络失败提示；`npm run test:collector-config-persistence` 覆盖身份变更待绑定状态保存失败软降级。 |
| 2026-06-23 | Collector Desktop 授权码输入清理 | PASS | 新增 `CollectorAuthorizationCodePolicy`，绑定前统一 trim 授权码；非空授权码发起绑定尝试后，主窗口会在成功、失败或异常返回时清空 `AuthorizationCodeBox`，避免一次性绑定码留在共用采集电脑界面中。`npm run test:collector-device-auth` 覆盖授权码归一化和清空判定。 |
| 2026-06-23 | Collector Desktop 绑定身份变更保护 | PASS | 新增 `CollectorBindingIdentityPolicy`，已绑定设备修改服务器地址、企业编号或设备编号后会清空本地设备 token、设备 id、远程配置版本和绑定时间，并把状态置为 `pending`；主窗口保存配置或重新绑定尝试失败时都会持久化该待绑定状态，避免新设备信息继续复用旧 token 上传。`npm run test:collector-config-persistence` 覆盖身份字段变更、尾部斜杠归一化、展示字段不触发失效和未绑定 pending 配置不重复失效。 |
| 2026-06-23 | Collector Desktop 服务器地址归一化 | PASS | 新增 `CollectorServerAddressPolicy`，服务器地址保存和 API URL 构造统一校验：生产域名漏写协议默认补 `https://`，`localhost` / `127.*` 默认补 `http://`，末尾 `/` 会归一化，非 `http/https` 地址会返回现场可读提示，避免底层 URI 异常暴露给用户或后台循环。`npm run test:collector-config-persistence` 覆盖地址归一化和非法协议，`npm run test:collector-upload-queue-display` 覆盖手动上传预检提示。 |
| 2026-06-23 | Collector Desktop 本机 IPv6 地址归一化 | PASS | `CollectorServerAddressPolicy` 支持 `::1`、`::1:5173/agent/...`、`http://::1:5173/...` 和 `[::1]:5173/...` 等本地调试地址，统一归一化为合法的 `[::1]` authority；主窗口“启动监听”“立即上传”和手动投递文件前会先执行服务器地址保存预检，非法地址只提示、不写入运行配置。`npm run test:collector-config-persistence` 覆盖 IPv6 loopback 与保存预检。 |
| 2026-06-23 | Collector Desktop API 前缀地址纠偏 | PASS | `CollectorServerAddressPolicy` 会从服务器地址中剥离 `/agent` 及其后续 API/release 路径，保留 `/agent` 前面的站点子路径，避免现场复制 `/agent/document-intake/...` 后 API URL 被拼成 `/agent/agent/...`。`npm run test:collector-config-persistence` 覆盖根路径、完整 release URL、子路径部署和非 API 子路径保留。 |
| 2026-06-23 | Collector Desktop 旧配置地址归一化 | PASS | `ConfigurationService.Normalize(...)` 接入 `CollectorServerAddressPolicy`，旧 `collector-config.json` 加载到内存时即归一化服务器地址；明文 token 迁移等重写配置路径会把规范地址一并写回主配置，避免历史配置继续携带裸域名或 `/agent/...` API 前缀。`npm run test:collector-config-persistence` 覆盖旧明文 token 配置迁移写回和干净加密配置加载归一化。 |
| 2026-06-23 | Collector Desktop 保存配置地址预检 | PASS | 新增 `CollectorConfigSavePolicy`，点击“仅保存配置”前允许空服务器地址草稿和可归一化的裸域名，但会阻止 `ftp://...` 等非 `http/https` 地址写入运行配置，并直接在状态栏提示原因。`npm run test:collector-config-persistence` 覆盖空地址、裸域名和非法协议保存预检。 |
| 2026-06-23 | Collector Desktop 绑定前地址预检 | PASS | 新增 `CollectorBindPreflightPolicy`，点击“保存并绑定”前先校验服务器地址必须非空且为可归一化的 `http/https` 地址，再校验授权码；非法地址会在 `UpdateConfigFromUi()` 前被拦截，不会污染运行配置，也不会清空授权码。`npm run test:collector-device-auth` 覆盖空服务器地址、非法协议、空授权码和有效授权码 trim。 |
| 2026-06-23 | Collector Desktop 设备版本追踪 | PASS | WebView2 初始化后会缓存 runtime 版本，客户端日志、设备绑定和心跳统一携带 `webview_version`；服务端绑定接口写入/更新 `collector_devices.webview_version`，心跳继续刷新该字段，便于后台设备列表和日志中心按客户端环境排障。新增 `npm run test:collector-device-version` 覆盖本地日志落列、绑定请求 `webViewVersion` 和心跳请求 `webview_version`，`document-intake-regression` 覆盖服务端绑定/心跳写入。 |
| 2026-06-23 | Collector Desktop 心跳/远程配置响应确认 | PASS | 心跳和远程配置接口在 HTTP 2xx 后会继续校验响应体 `ok=true`；空响应、坏结构或 `ok=false` 会抛出异常并阻止默认空配置参与本地同步，避免服务端业务拒绝时误清空远程配置或改变运行态。`npm run test:collector-device-version` 覆盖心跳 `ok=true` 成功、心跳 `ok=false` 拒绝和远程配置 `ok=false` 拒绝。 |
| 2026-06-23 | Collector Desktop 心跳健康快照 | PASS | 新增 `CollectorHealthSnapshotService`，心跳随 `health` 上报本地上传队列各状态数量、最近入队时间、最近上传完成时间、最早未完成上传时间、待上传日志数量、本地 SQLite 数据库大小、采集数据目录所在磁盘剩余/总空间、监听目录启用/停用/缺失数量、设备状态和开机自启状态；服务端既有 `heartbeat_payload` metadata 会保留完整快照，便于排查某台电脑长期未上传、队列堆积、磁盘不足或监听目录丢失。新增 `npm run test:collector-heartbeat-health` 覆盖快照统计、时间水位、容量指标和心跳 JSON，`document-intake-regression` 覆盖服务端 metadata 保留。 |
| 2026-06-23 | Collector Desktop 临时文件健康统计 | PASS | 心跳 `health` 新增 `temporaryFileIgnoredLast24HoursCount` 与 `temporaryFileIgnoredSince`，从本地 `file_ignored` 日志中统计最近 24 小时 Office 锁文件和下载中扩展名被忽略次数，帮助后台排查监听目录是否长期存在半成品文件。`npm run test:collector-heartbeat-health` 覆盖近期/过期/非临时忽略日志的统计口径和心跳 JSON。 |
| 2026-06-23 | Collector Desktop 日志补传水位 | PASS | 心跳 `health` 新增 `lastLogCreatedAt`、`oldestPendingLogCreatedAt` 与 `lastUploadedLogCreatedAt`，基于本地 `client_log_events.created_at` 和 `uploaded` 标记上报日志队列水位，帮助后台判断日志是否只是临时 pending，还是已经长时间无法补传。`npm run test:collector-heartbeat-health` 覆盖 pending 日志、已上传日志和 heartbeat JSON。 |
| 2026-06-23 | Collector Desktop 崩溃报告健康快照 | PASS | 心跳 `health` 新增 `pendingCrashDumpReportCount`、`reportedCrashDumpReportCount`、`oldestPendingCrashDumpReportCreatedAt`、`lastCrashDumpReportCreatedAt` 与 `crashDumpDirectoryBytes`，让后台不用进入采集电脑也能看到是否仍有未补报 crash manifest、已上报 dump 是否占用磁盘。`npm run test:collector-heartbeat-health` 覆盖未上报/已上报 manifest、孤立 dump、目录大小和心跳 JSON。 |
| 2026-06-23 | Collector Desktop 上传连通性健康快照 | PASS | 心跳 `health` 新增 `uploadConnectivityStatus`、`lastUploadConnectivityOfflineAt` 与 `lastUploadConnectivityOnlineAt`，根据本地 `upload_connectivity_offline/online` 日志的最新事件推导上传通道最近状态，帮助后台不用翻日志也能看到断网和恢复时间点。`npm run test:collector-heartbeat-health` 覆盖离线、恢复、再次离线后的状态推导和心跳 JSON。 |
| 2026-06-23 | Collector Desktop 远程监听目录接管 | PASS | 采集端将服务端 `config.watchFolders` 视为后台权威配置，远程返回空数组时会清空本地旧监听目录并停止监听，避免后台删除目录后客户端继续采集。新增 `CollectorRemoteWatchFolderPolicy` 并用 `npm run test:collector-remote-watch-folders` 覆盖空目录清除、默认上传人/岗位回退、Windows 路径显示名和大小写无关比较。 |
| 2026-06-23 | Collector Desktop 文件快照一致性 | PASS | `CollectorFileService` 在文件稳定等待后、写入上传队列前会跳过空文件，并在 SHA256 计算前后比对文件大小和最后修改时间；如果文件在 hash 过程中继续变化，记录 `file_upload_failed` 且暂不入队。入队方法现在保留兼容的 `UploadQueueItem?` 返回，同时提供 outcome 原因供监听服务区分可恢复失败。`npm run test:collector-file-snapshot` 覆盖 hash 期间变动、空文件跳过和稳定文件正常入队。 |
| 2026-06-23 | Collector Desktop 临时文件过滤 | PASS | `CollectorFileService` 在等待文件稳定前跳过 Office `~$*` 锁文件以及 `.tmp`、`.temp`、`.part`、`.partial`、`.download`、`.crdownload` 等临时/下载中扩展名，并记录带 `ignore_reason` 的 `file_ignored` 日志，避免半成品文件进入上传队列。`npm run test:collector-file-snapshot` 覆盖 Office 锁文件、浏览器下载中文件、日志原因和队列不落库。 |
| 2026-06-23 | Collector Desktop 批量入队状态反馈 | PASS | 主窗口手动选择/拖拽文件后会根据 `CollectorFileService.EnqueueFileAsync(...)` 的实际返回结果显示已入队/已存在队列数量和未入队数量；设备待绑定、禁用、空文件、临时文件、类型不允许或大小超限时，不再误提示全部文件已入队。新增 `CollectorFileBatchStatusPolicy`，`npm run test:collector-file-snapshot` 覆盖全成功、全跳过、部分跳过和计数越界归一化。 |
| 2026-06-23 | Collector Desktop 压缩包采集策略 | PASS | 服务端默认远程配置显式下发常见业务文档、图片、文本和 `.zip`/`.rar`/`.7z` 压缩包扩展名；后台显式 `allowed_extensions` 仍可覆盖默认值。`collector-file-snapshot` 追加 `.zip` 入队回归，断言压缩包按 `application/zip` MIME 和 `manual_selected_user` 归属写入本地上传队列。 |
| 2026-06-23 | Collector Desktop Windows 用户快照追溯 | PASS | `upload_queue` 新增 `windows_username` 本地持久化字段并兼容旧 SQLite 自动补列；文件入队时记录触发时的 `Environment.UserDomainName\\Environment.UserName`，普通上传和分片上传优先使用队列快照，避免断网补传或换用户后丢失原始本机用户追溯。`collector-file-snapshot`、`collector-upload-schema-migration` 和 `collector-chunk-upload-client` 覆盖入队、迁移默认值和上传 metadata。 |
| 2026-06-24 | Collector Desktop 上传队列本地字段容错 | PASS | `UploadQueueStore` 读取旧队列行时，对非法 `created_at` 回退 Unix epoch，对非法 `uploaded_at` / `next_retry_at` 回退空值；启动迁移会归一化状态大小写，把未知 `status` 恢复为 `failed`，并把非法 `retry_count`、`file_size` 恢复为 0 且保留错误摘要，避免旧库坏字段阻塞队列显示、健康快照或上传循环。`npm run test:collector-upload-schema-migration` 覆盖坏时间、坏状态、坏重试次数和坏文件大小行可读。 |
| 2026-06-23 | Collector Desktop 上传失败退避调度 | PASS | `upload_queue` 新增 `next_retry_at` 本地持久化字段并兼容旧 SQLite 自动补列；上传失败时按远程 `upload.retry_interval_seconds` 写入下一次可重试时间，未到期的 `failed` 记录不会被后台队列取出，避免断网期间快速消耗 `retry_count`。新增 `npm run test:collector-upload-retry-schedule` 覆盖失败调度、到期后选择和进入 `uploading` 后清空。 |
| 2026-06-23 | Collector Desktop 失败重试健康分桶 | PASS | 心跳 `health` 新增 `failedRetryReadyCount`、`failedRetryWaitingCount`、`failedRetryExhaustedCount` 与 `nextFailedRetryAt`，按 `GetNextPendingAsync` 同口径区分失败队列中可立即重试、等待退避和达到最大重试次数的文件，帮助后台判断队列积压是否需要人工介入。`npm run test:collector-heartbeat-health` 覆盖三类失败行、下一次退避到期时间和心跳 JSON。 |
| 2026-06-23 | Collector Desktop 失败错误健康摘要 | PASS | 心跳 `health` 新增 `failedUploadErrorSummaries` 与 `failedUploadErrorSummaryTruncated`，按归一化后的失败错误文本聚合最多 5 条摘要，包含错误、次数、最早和最近队列创建时间；换行、制表符等控制/空白字符会合并，避免后台只看到失败数量却不知道是否集中在同一类网络、文件或服务端响应问题。`npm run test:collector-heartbeat-health` 覆盖本地快照和心跳 JSON。 |
| 2026-06-23 | Collector Desktop 日志批量上报确认 | PASS | 客户端日志批量上报现在会在 HTTP 2xx 后继续校验服务端响应体 `ok=true`，否则抛出异常并保留本地 pending 日志，避免服务端业务拒绝、兜底错误 JSON 或响应结构异常时误把日志标记为已上传。`npm run test:collector-log-upload` 覆盖 HTTP 503 重试、HTTP 200 但 `ok=false` 保留 pending、后续 `ok=true` 后再标记 uploaded，以及退出前最终 flush。 |
| 2026-06-23 | Collector Desktop 日志补传失败可观测性 | PASS | 日志批量上报发生 HTTP 失败、服务端业务拒绝或响应结构异常时，`LogUploadProcessor` 会保留原 pending 日志并额外记录一次 `log_upload_failed` 本地事件，metadata 包含本批大小、异常类型、失败签名和服务器地址；同一失败签名连续出现只记录一次，补传成功后再允许记录新的失败原因，避免后台循环静默吞错或断网期间重复刷屏。`npm run test:collector-log-upload` 覆盖 503 后本地失败事件、恢复后一并补传、`ok=false` 后保留原日志并记录失败事件。 |
| 2026-06-23 | Collector Desktop pending 日志保留裁剪 | PASS | `LogUploadProcessor` 执行 `logs.retention_days` 时现在同时清理已上传和超期未上传日志；如果 pending 日志被裁剪，会写入 `client_log_retention_pruned` 摘要并在同轮或后续 flush 上报，避免长期离线采集端本地 SQLite 无限增长且后台无法知道发生过日志裁剪。`npm run test:collector-log-upload` 覆盖 old pending 删除、摘要 metadata 和恢复上传。 |
| 2026-06-23 | Collector Desktop 本地原文件缺失健康统计 | PASS | 心跳 `health` 新增 `missingLocalUploadFileCount` 与 `oldestMissingLocalUploadFileCreatedAt`，仅扫描 `queued`、`pending`、`failed`、`uploading` 等未完成上传队列，统计本地 `file_path` 已不存在的记录数量和最早创建时间，帮助后台区分网络失败和用户移动/删除原始文件造成的失败。`npm run test:collector-heartbeat-health` 覆盖缺失文件统计和心跳 JSON。 |
| 2026-06-23 | Collector Desktop 上传连通性日志 | PASS | 上传队列处理器会把 `HttpRequestException`、超时和非停止态 `TaskCanceledException` 归类为上传通道异常，首次失败记录 `upload_connectivity_offline`，后续任一文件上传成功时记录 `upload_connectivity_online`，同时仍按 `next_retry_at` 退避调度失败文件，避免超时后队列永久卡在 `uploading`。新增 `npm run test:collector-upload-connectivity` 覆盖 503 临时失败、恢复上传、离线/在线事件去重和异常分类。 |
| 2026-06-23 | Collector Desktop 上传取消恢复 | PASS | 上传队列当前行进入 `uploading` 后，如果采集端正常退出、自动更新退出、Windows 注销/关机或后台循环停止导致上传取消，处理器会立刻把当前行退回 `queued`、不增加 `retry_count`、清空 `next_retry_at`，并记录 `file_upload_cancelled_requeued`；下次启动或下一轮上传可继续处理，服务端 hash 去重避免重复入库。`npm run test:collector-upload-connectivity` 覆盖本地 HTTP stub 挂起响应、取消 token、队列回退和取消恢复日志。 |
| 2026-06-23 | Collector Desktop 上传队列状态可见性 | PASS | 新增 `UploadQueueDisplayPolicy`，主窗口左侧上传队列从本地 SQLite 行生成中文可读状态，包含来源、重试次数、`next_retry_at`、上传完成时间、服务端 asset id 和最近错误，方便现场判断失败文件是否正在等待退避。新增 `npm run test:collector-upload-queue-display` 覆盖失败待重试、已到重试时间、已上传和未知状态格式。 |
| 2026-06-23 | Collector Desktop 手动上传结果反馈 | PASS | `UploadQueueProcessor.ProcessOnceAsync()` 现在返回处理结果，主窗口“立即上传”会按真实结果提示队列忙碌、暂无待上传、失败项等待退避、失败项达到最大重试次数、上传/重复/本地缺失数量、上传失败暂停和设备认证失效，不再把所有可处理/不可处理分支都归为“上传队列处理完成”。`npm run test:collector-upload-queue-display` 覆盖结果文案。 |
| 2026-06-23 | Collector Desktop 后台上传预检一致性 | PASS | 后台 `UploadQueueProcessor` 复用 `CollectorManualUploadPolicy`，设备待绑定、后台禁用、服务器地址缺失/非法或 token 缺失时直接返回不可处理状态，不再进入上传分支把队列行标记失败或消耗 `retry_count`。`npm run test:collector-upload-retry-schedule` 覆盖旧配置非法服务器地址不改队列状态、不写 `next_retry_at`。 |
| 2026-06-23 | Collector Desktop 手动上传预检提示 | PASS | 点击“立即上传”前新增 `CollectorManualUploadPolicy`，按设备待绑定、后台禁用、服务器地址缺失、设备 token 缺失和可上传状态生成状态栏提示；上传队列处理器因状态不满足而静默返回时，UI 不再误提示“上传队列处理完成”。`npm run test:collector-upload-queue-display` 覆盖五类预检结果。 |
| 2026-06-23 | Collector Desktop 本地原文件缺失日志/显示 | PASS | 上传队列处理器发现本地 `file_path` 已不存在时，会把队列行标记为 `failed`、按退避策略写入 `next_retry_at`、记录带队列 metadata 的 `file_upload_failed` 日志；主窗口左侧上传队列会对未完成记录显示“本地文件缺失”，已上传历史行不会误报。`npm run test:collector-upload-retry-schedule` 覆盖缺失文件日志和重试调度，`npm run test:collector-upload-queue-display` 覆盖错误文本识别、文件存在性探测和已上传行排除。 |
| 2026-06-23 | Collector Desktop 监听目录缺失可见性 | PASS | 新增 `WatchFolderDisplayPolicy`，主窗口左侧监听目录列表可区分 `[启用]`、`[停用]` 和 `[缺失]`；启用但本机不存在的目录会标记为缺失，停用目录即使路径不存在仍显示停用，便于发现移动盘未挂载或后台下发不可访问路径。新增 `npm run test:collector-watch-folder-display` 覆盖存在、缺失、停用缺失和空路径显示。 |
| 2026-06-23 | Collector Desktop 监听目录可访问性 | PASS | 新增 `WatchFolderHealthPolicy`，左侧监听目录列表可显示 `[不可访问]`，心跳 `health` 新增 `accessibleWatchFolderCount` 与 `inaccessibleWatchFolderCount`，用于区分目录不存在和目录存在但无法枚举的权限/挂载异常。`npm run test:collector-watch-folder-display` 覆盖 UI 状态，`npm run test:collector-heartbeat-health` 覆盖心跳 JSON。 |
| 2026-06-23 | Collector Desktop 启动监听状态反馈 | PASS | 点击“启动监听”时新增 `CollectorWatchFolderRestartPolicy`，按后台禁用、待重新绑定、无启用目录和正常重启生成状态栏提示；主窗口不再在 pending 设备上先暂停监听又误提示“监听目录已重新启动”。`npm run test:collector-watch-folder-display` 覆盖四类状态。 |
| 2026-06-23 | Collector Desktop 不可访问目录跳过 | PASS | `WatchFolderService.Restart(...)` 启动监听前会检查目录存在性和可访问性，不可访问目录记录 `file_watch_error` 并跳过，后续正常目录仍会启动 watcher 并执行初始扫描；监听异常恢复扫描也只在目录仍可访问时触发。`npm run test:collector-watch-folder-initial-scan` 覆盖不可访问目录不阻塞正常目录启动。 |
| 2026-06-23 | Collector Desktop 自动更新退出 | PASS | 自动更新检查新启动安装器后，主窗口会走统一优雅关闭路径，停止心跳、监听、上传循环，停止日志后台循环后做最终 flush 并退出，避免托盘常驻隐藏窗口阻塞静默升级；若更新检查已改变本地状态但 `collector-config.json` 保存失败，会记录 `collector_update_state_save_failed`，并继续按当前进程内存状态运行，已新启动安装器时仍会进入退出流程。新增 `UpdateShutdownPolicy` 与 `npm run test:collector-update-shutdown`，覆盖新 PID、旧 PID、缺失字段、过期和未来时间戳判断；`npm run test:collector-background-task` 用源码守卫检查更新状态保存失败告警走 best-effort 日志；WPF Release 构建通过。 |
| 2026-06-24 | Collector Desktop 开机自启托盘启动 | PASS | `StartupService` 写入 Run 启动项时默认追加 `--minimized --from-startup`，主窗口加载后识别该参数并隐藏到托盘，避免 Windows 登录时采集端抢占前台；`IsRunCommandForExecutable` 继续只按可执行文件路径判断已启用状态，升级后带参数命令仍能匹配。新增 `CollectorAutoStartPolicy`，手动勾选或远程配置下发自启策略时，只有注册表写入成功才更新本地 `autoStartEnabled`，失败时记录 `collector_autostart_apply_failed` 并保留上一版状态，不阻断其他远程配置落地；启动加载 UI 读取 Run 状态失败时记录 `collector_autostart_read_failed` 并按本地配置显示，不中断采集端启动。`npm run test:collector-startup-service` 覆盖默认启动命令、参数识别、路径匹配、空远程值、无变化请求、成功写入、注册表写入失败软失败、注册表读取成功/失败和配置优先短路。 |
| 2026-06-24 | Collector Desktop 托盘初始化降级 | PASS | 主窗口启动时托盘图标初始化失败会记录 `collector_tray_initialization_failed`，但不会中断本地监听、上传队列、心跳和日志后台循环；`CollectorWindowClosePolicy` 新增托盘不可用分支，普通关闭按钮改为最小化到任务栏，避免无托盘时隐藏窗口导致用户找不回采集端。`npm run test:collector-window-close-policy` 覆盖托盘可用隐藏、托盘不可用最小化、显式退出和 Windows 会话结束放行关闭。 |
| 2026-06-23 | Collector Desktop 自动更新下载可靠性 | PASS | 新增 `UpdatePackageStore.SaveAtomicallyAsync(...)`，更新包先写入唯一 `.download` 临时文件，完整下载并完成 SHA256 校验后再替换最终安装包；下载中断或 hash mismatch 只清理临时文件，不覆盖已有可用安装包。新增 `npm run test:collector-update-download` 覆盖好包保存、坏 hash 不替换旧包和临时文件清理。 |
| 2026-06-23 | Collector Desktop 自动更新安装器启动失败恢复 | PASS | 自动更新包下载成功后会先清空旧的安装器 PID/启动时间审计字段；自动安装启动失败时保留新的 `pendingUpdateVersion`/`pendingUpdateInstallerPath` 供人工排查或重试，记录 `collector_update_installer_start_failed`，但不会保留旧 PID 或误写启动时间，避免主窗口把陈旧状态误判为本轮已启动安装器并自动退出。`npm run test:collector-update-download` 覆盖 manifest/包下载、SHA256 校验、注入式安装器启动失败、配置状态和结构化日志。 |
| 2026-06-23 | Collector Desktop 自动更新陈旧待安装状态清理 | PASS | manifest 版本不高于本地 `clientVersion` 时，客户端会记录 `collector_update_not_required` 并清空旧的 `pendingUpdateVersion`、`pendingUpdateInstallerPath`、安装器 PID 和启动时间，避免升级成功后配置文件长期保留旧待安装包或旧安装器审计字段。`npm run test:collector-update-download` 覆盖 up-to-date manifest 不下载包、不启动安装器、清理 pending 状态和日志元数据。 |
| 2026-06-23 | Collector Desktop 更新配置净化 | PASS | 新增 `CollectorRemoteUpdatePolicy`，远程 `update` 配置和本地 `collector-config.json` 加载/保存/`.bak` 备份写入都会校验 manifest URL、检查周期和安装参数；非法 manifest URL 会关闭本地自动更新并清空 URL/安装参数，非法安装参数会关闭自动安装但保留有效 manifest 下载检查，避免后台坏配置、旧配置、备份回退或手改 JSON 长期污染配置文件并导致采集端反复尝试坏更新。`npm run test:collector-config-persistence` 覆盖有效更新策略、非法 manifest URL、非法安装参数、disabled 策略清空旧值、保存后不落盘坏 URL/参数，以及旧主配置生成备份前的 update 净化。 |
| 2026-06-23 | Collector Desktop 配置文本字段净化 | PASS | `ConfigurationService.Normalize(...)` 对设备/企业/默认用户/岗位、客户端/WebView 版本、远程配置版本、待安装更新路径和监听目录路径/展示/责任人字段执行 trim、控制字符移除和长度限制；`WatchFolders` 中的空项会被过滤，重复路径会按大小写无关且忽略尾斜杠的 key 去重并保留第一条。配置加载/保存、启动监听/立即上传前的运行时动作和远程配置同步比较都会复用同一套净化；`WatchFolderService.Restart(...)` 启动 watcher 前也会按同一 key 去重，避免后台坏配置、旧 JSON 或手工编辑把超长/换行文本带入本地配置、日志上下文、心跳和上传 metadata，也避免远程持续返回带控制字符文本或重复目录时反复写入配置同步日志/启动重复 watcher。`npm run test:collector-config-persistence` 覆盖控制字符清理、字段长度上限、监听目录文本净化和本地目录去重，`npm run test:collector-remote-watch-folders` 覆盖远程监听目录字段净化和重复路径去重，`npm run test:collector-watch-folder-initial-scan` 覆盖运行态重复 watcher 去重。 |
| 2026-06-23 | Collector Desktop 扩展名白名单净化 | PASS | 新增 `CollectorAllowedExtensionsPolicy`，本地配置加载/保存、远程配置同步和文件入队过滤共用同一套 `allowedExtensions` 规则：trim、控制字符移除、自动补点、小写、去重排序和数量上限，且只保留 1 到 31 位字母数字扩展名；通配符、路径片段、多段扩展名和超长项会被丢弃，避免后台坏白名单或手改 JSON 扩大采集范围、污染本地配置、造成重复配置同步或拖慢文件入队过滤。`npm run test:collector-config-persistence` 覆盖大小写归一、去重、危险项过滤和 128 项上限。 |
| 2026-06-23 | Collector Desktop 上传数值配置限幅 | PASS | `ConfigurationService.Normalize(...)` 将本地 `maxUploadBytes` 与 `chunkSizeBytes` 对齐远程配置口径：单文件上限默认 256MB，限制 1MB 到 1GB；分片大小默认 8MB，限制 256KB 到 64MB。旧配置或手工 JSON 写入 0、负数或超大值会恢复到安全范围，避免大文件上传分片异常或内存占用失控。`npm run test:collector-config-persistence` 覆盖默认值、最小/最大限幅和保存后持久化限幅值。 |
| 2026-06-23 | Collector Desktop 递归监听目录可靠性 | PASS | `WatchFolderService.Restart(...)` 启动每个目录监听后会递归扫描目录及子目录既有文件并复用统一入队路径，避免采集端未运行期间用户按日期、供应商等子目录先放入资料导致漏采；监听器现在先绑定事件再启用，覆盖根目录和子目录内的 Created/Changed/Renamed，缓冲区提升到 64KB，Error/溢出后会记录异常并触发递归恢复扫描；收到新增/重命名目录事件时，会递归扫描该目录内文件，避免现场把整包资料夹拖入监听目录时只触发目录事件而漏采内部文件；文件暂未稳定或 hash 过程中变化时，会记录 `file_watch_retry_scheduled` 并最多重试 3 次，降低大文件拷贝、网络盘落盘或杀毒扫描造成的一次性漏采；延迟入队前会再次校验监听目录仍处于启用状态，远程停用/清空目录后旧任务不会继续采集；停止/重启监听会切换内部 generation 并清理去重缓存，长期运行时事件缓存按上限淘汰。`npm run test:collector-watch-folder-initial-scan` 覆盖根目录和子目录既有文件入队、子目录新增事件、整包子目录事件补扫、可恢复未稳定文件重试、同名文件修改后按新 hash 再入队、递归错误恢复扫描、远程停用目录后的延迟任务跳过、停止后的旧任务退出、来源目录和目录默认责任人。 |
| 2026-06-23 | Collector Desktop 配置持久化恢复 | PASS | `ConfigurationService.SaveAsync(...)` 改为先写临时文件再替换主配置，并在主配置有效时 best-effort 保留上一版 `collector-config.json.bak`；`LoadAsync(...)` 在主配置为空、半截写入或 JSON 损坏时会回退读取 `.bak` 并继续归一化，避免断电/崩溃导致设备绑定、监听目录和远程策略不可恢复。新增 `npm run test:collector-config-persistence` 覆盖原子保存、备份保留、损坏主配置回退、恢复保存不覆盖好备份、备份路径被占用时主配置仍能保存和临时文件清理。 |
| 2026-06-23 | Collector Desktop 配置备份原子写入 | PASS | `ConfigurationService` 内部备份写入和 `.bak` 净化改为先写同目录唯一 `.tmp`，flush 完成后再替换目标备份文件，失败时清理临时文件；备份写入或 stale backup 净化遇到权限/路径占用/瞬时 I/O 失败时会降级跳过，不阻断主配置原子替换，避免备份文件半截覆盖或备份异常导致本次有效配置无法落盘。`npm run test:collector-config-persistence` 覆盖备份替换后 `.tmp` 清理、备份 JSON 可解析、不复制危险 update 设置和备份路径占用软降级。 |
| 2026-06-23 | Collector Desktop 配置保存串行化 | PASS | `ConfigurationService` 对同一实例内的 `LoadAsync`/`SaveAsync` 增加串行闸门，旧明文 token 迁移在锁内复用内部保存路径，避免心跳同步、手动保存、认证失效处理或更新状态保存同时写入主配置和 `.bak` 时互相覆盖中间状态。`npm run test:collector-config-persistence` 覆盖 12 次并发保存后主配置和备份仍为完整 JSON、服务器地址来自并发保存集合且无 `.tmp` 遗留。 |
| 2026-06-23 | Collector Desktop SQLite 可靠性 | PASS | 新增 `CollectorSqlite` 统一本地 SQLite 连接初始化，上传队列和客户端日志库启用 `journal_mode=WAL`，并为连接设置 `busy_timeout=5000ms`，降低监听入队、上传循环、日志 flush 并发写库时出现 `database is locked` 的概率。新增 `npm run test:collector-sqlite-resilience` 覆盖 WAL/busy_timeout PRAGMA 和队列/日志并发写入持久化。 |
| 2026-06-19 | 智能收单中心后台 API | PASS | `realtime/document-intake.js` 新增 `GET /document-intake/admin/overview`、`GET /document-intake/admin/assets`、`GET /document-intake/admin/assets/:id`，覆盖总览指标、文件列表和入库详情链路；`realtime/index.js` 新增独立 JWT 后台权限校验，允许 admin/super_admin 或 document_intake 读/管权限访问。`document-intake-regression` 覆盖三类响应结构，Node 语法检查通过。 |
| 2026-06-19 | 智能收单中心设备与日志后台 API | PASS | `realtime/document-intake.js` 新增 `GET/POST /document-intake/admin/devices`、`GET/PATCH /document-intake/admin/devices/:id`、`POST /document-intake/admin/devices/:id/reset-bind-code` 和 `GET /document-intake/admin/logs`，支持设备新增、禁用/启用、默认上传人、监听目录配置、授权码重置和日志中心筛选；写操作使用独立 manage 权限。`document-intake-regression` 覆盖设备列表/详情/新增/更新/重置和日志列表。 |
| 2026-06-19 | 智能收单中心前端页面 | PASS | `eiscore-apps/src/views/DocumentIntakeCenter.vue` 新增管理后台页面，应用中心新增系统入口卡片和 `/document-intake-center` 路由；页面覆盖总览指标、文件列表/详情抽屉、设备管理/授权码重置、日志中心筛选。`npm --prefix eiscore-apps run build` 通过，Playwright 在 mock `/agent/document-intake/admin/*` 后完成页面渲染、文件/设备/日志标签切换烟测。 |
| 2026-06-21 | 智能收单中心 UI 自动化烟测 | PASS | 新增 `tests/engineering/document-intake-center-ui-smoke.mjs` 和 `npm run test:document-intake-ui`，自动启动或复用本地 `eiscore-apps` Vite 服务，mock `/agent/document-intake/admin/*` 后验证管理页加载、文件列表、设备管理和日志中心标签页。 |
| 2026-06-17 | `git diff --check` | PASS | 当前工程改动无空白错误。 |
| 2026-06-16 | `sql/patch_ontology_reasoning_insights_v1.sql` | PASS | 远端应用知识图谱推理洞察补丁；schema 执行前备份到 `tests/.artifacts/eiscore_ontology_reasoning_insights_v1_schema_before_20260616_2328.sql`。补丁新增规则统计、角色访问洞察、敏感路径、表依赖路径、表影响面、推理健康视图和 `explain_role_ontology_access(...)`。 |
| 2026-06-16 | `npm run test:business-chain:remote` | PASS | business-chain 30/30；新增 `02f` 洞察健康/影响面检查与 `02g` 角色访问解释 RPC 检查。测试从实际洞察数据动态选择候选角色，避免固定演示角色不存在导致误报。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 30/30；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T15-32-59-513Z.md`。 |
| 2026-06-16 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。 |
| 2026-06-16 | `npm run test:syntax && npm run test:unit` | PASS | Node 语法门禁 24 个入口通过；离线单元/回归全绿。期间观察到一次 WSL `E_UNEXPECTED` 后单测重跑通过。 |
| 2026-06-16 | `npm --prefix eiscore-base run build && npm --prefix eiscore-apps run build` | PASS | 受影响前端包构建通过，覆盖 AI Copilot/首页历史联动、本体工作台洞察面板和 qiankun 生命周期保护。 |
| 2026-06-16 | `sql/patch_ontology_reasoning_engine_v1.sql` | PASS | 远端应用知识图谱推理引擎补丁；schema 执行前备份到 `tests/.artifacts/eiscore_ontology_reasoning_engine_v1_schema_before_20260616_2235.sql`。最新摘要：facts 3052、seed 2990、inferred 62、active rules 16、角色访问应用 3、角色访问业务表 2、传递依赖 37。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 28/28；新增 `02e ontology reasoning engine exposes inferred facts`，最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T14-43-32-197Z.md`。 |
| 2026-06-16 | `npm --prefix eiscore-apps run build && npm --prefix eiscore-base run build` | PASS | 受影响前端包构建通过，覆盖本体工作台推理面板和 AI Copilot 历史侧栏改动。 |
| 2026-06-16 | `npm run test:e2e:clicks:remote` | PASS | 远端普通用户 UI 点击巡检 4/4 PASS。首次直跑因 Chromium 缺 `libnspr4.so` 等共享库失败，已在 `playwright.config.mjs` 自动加载缓存依赖后复测通过。 |
| 2026-06-16 | `npm run test:e2e:business-chain:remote` | PASS | 远端 UI 全业务链路闭环 1/1 PASS，覆盖应用中心、工作流状态写回、HR、仓库。 |
| 2026-06-16 | `npm run test:e2e:functions67:remote` | PASS | 远端 67 个功能点全量 UI 验收 67/67 PASS，用时约 9.2 分钟。 |
| 2026-06-16 | `npm run test:engineering:remote` | PASS | smoke 23/23、business-chain 24/24、browser E2E 77/77，用时约 11.9 分钟。 |
| 2026-06-16 | `npm run test:engineering:remote:api` | PASS | smoke 23/23、business-chain 27/27；最新报告：`tests/.artifacts/nanpai-engineering-suite-2026-06-16T14-24-56-371Z.md`。 |
| 2026-06-16 | `npm run test:ci` | PASS | 语法门禁、单元回归、Smart BI、EISGrid agent 语义、共享 grid 工具和工程 HTTP 客户端回归通过，11 个前端包全部构建成功。 |
| 2026-06-16 | `npm run test:syntax` | PASS | 24 个 Node 脚本入口语法检查通过；同步修复 `scripts/windows-lan-relay.cjs` shebang 位置。 |
| 2026-06-16 | `npm run test:smart-bi` | PASS | Smart BI 领域路由、指标口径、图表模板、风险规则、风险状态、卡片报告请求、概览卡片和常用问题提示均通过。 |
| 2026-06-16 | `npm run test:grid-agent` | PASS | 新增 EISGrid agent 中文语义回归，验证“每个部门多少人/状态统计/最近明细/金额汇总”等查询意图。 |
| 2026-06-16 | `npm run test:grid-utils` | PASS | 新增共享 grid 工具鲁棒性回归，验证非法日期、hash URL、分页钳制、服务端汇总 payload 和合计行。 |
| 2026-06-16 | `npm run test:http-client` | PASS | 新增工程 HTTP 客户端回归，验证远端请求重试、安全方法策略、POST 默认不重试和原生 body 透传。 |
| 2026-06-16 | 远端 DB 最小授权修复 | PASS | 对 `public.v_role_permissions` 执行 `GRANT SELECT ... TO web_user` 并触发 PostgREST schema reload；business-chain 前置检查返回 4 个角色授权行。 |
| 2026-06-16 | `sql/patch_ontology_semantic_coverage_v2.sql` | PASS | 远端应用本体覆盖补丁；语义覆盖审计为关系 119/119、字段 1590/1590，业务链路中 PostgREST 审计视图返回 119/119、1561/1561。 |
| 2026-06-16 | `node --check tests/engineering/run-remote-suite.mjs tests/smoke/business-smoke.mjs` | PASS | 新增工程套件与 smoke 重试逻辑语法通过。 |

新增工程化能力：

1. `tests/engineering/run-remote-suite.mjs` 将远端 smoke、业务闭环、浏览器 E2E 串成一个可重复执行的工程验收套件。
2. `npm run test:engineering:remote:api` 支持只跑远端 smoke + business-chain，适合接口侧快速验证。
3. `.nvmrc` 固定为 `20.19.0`，与 GitHub Actions Node 版本一致。
4. `tests/smart-bi/config-regression.mjs` 将 Smart BI 的六大领域路由、输出章节、工作台卡片、卡片报告请求和常用问题纳入离线单元回归。
5. `tests/grid-agent/query-regression.mjs` 将 EISGrid agent 中文数据查询语义和受控查询 payload 纳入离线单元回归。
6. `tests/grid-utils/shared-regression.mjs` 将共享 grid 分页、时间过滤和服务端汇总边界纳入离线单元回归。
7. `tests/engineering/http-client.mjs` 统一远端 smoke/business-chain 的超时、重试和 JSON/text 解析；business-chain 默认只重试安全方法，避免重复写入。
8. `sql/patch_ontology_semantic_coverage_v2.sql` 将业务表单、角色、角色授权和本体覆盖审计视图纳入 PostgREST 可读语义投影；`test:business-chain` 增加 `02c/02d` 前置检查，防止语义层缺口静默回归。
9. `sql/patch_ontology_reasoning_engine_v1.sql` 将本体推理规则、推理事实、推理运行批次、推理摘要和路径解释纳入数据库侧工程能力；`test:business-chain` 增加 `02e` 前置检查，防止推理层不可读或无推理事实。
10. `playwright.config.mjs` 自动加载 `tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu` 下的缓存 Linux 共享库，使 `test:e2e:*:remote` 单独直跑时也能稳定启动 Chromium。
11. `sql/patch_ontology_reasoning_insights_v1.sql` 将推理规则统计、角色访问洞察、敏感字段路径、表依赖路径、表影响面和推理健康纳入 PostgREST 可读洞察层；`test:business-chain` 增加 `02f/02g`，并动态选择实际存在的角色验证解释函数，避免硬编码角色码造成误报。
12. `sql/patch_ontology_graph_query_v1.sql` 将知识图谱节点检索、邻域展开和路径查询纳入 PostgREST 可读 RPC；`test:business-chain` 增加 `02h`，防止图查询层不可读或无路径数据。
13. `sql/patch_ai_document_intake_mvp.sql` 将 AI 文档采集、解析任务、入库计划、业务链接、未匹配字段和客户端日志纳入数据库侧 MVP，并补齐 13 张表与 192 个字段的本体语义。
14. `realtime/document-intake.js`、`document-parser.js`、`document-planner.js`、`document-entry.js`、`document-fixed-entry.js` 形成 AI 文档采集到业务入库的后端 worker 链路，并通过离线 mock 回归覆盖鉴权、上传、解析、计划、字段映射、通用入库、采购入库和错误兜底。
15. `collector-desktop/EISCore.Collector` 提供本地桌面采集器 MVP，已完成真实 WPF Release 构建、per-user 安装、托盘常驻、单实例互斥、自动更新和本地队列主链路验证。
16. `tests/business/full-chain.mjs` 对远端登录获取 JWT 增加独立短重试，避免偶发 `fetch failed` 造成空 token 连锁失败；业务写入请求仍保持默认不重试，避免重复写入。
17. `realtime/document-intake.js` 新增采集设备远程配置接口与 heartbeat 配置响应，支持从 `collector_watch_folders` 表下发默认采集目录，并通过回归测试防止布尔值 `false` 被默认值覆盖。
18. `collector-desktop` 对远程配置同步、多监听目录、上传大小/扩展名过滤、日志刷新策略和本地配置空值做兜底，降低老配置文件、坏配置文件和远程空配置导致采集端崩溃的风险。
19. `realtime/document-intake.js` 增加大文件分片/断点续传接口，回归覆盖缺片、hash mismatch、重复分片、同索引冲突、大小校验和最终拼装入库，降低采集端大文件上传中断后的数据错配风险。
20. `collector-desktop` 增加 crash dump manifest/minidump 输出和后台上传循环异常隔离，降低未处理异常与单次网络/本地日志异常造成采集端不可观测或后台任务退出的风险。
21. `sql/patch_smart_bi_action_closure.sql` 与 `AiCopilot.vue` 增加 Smart BI 行动建议到流程待办的闭环草案能力，包含业务 action 表、内置 BPMN、状态映射、workflow 同步触发器和前端一键发起。
22. `collector-desktop` 增加自动更新策略消费与 manifest 下载校验骨架，支持远程控制检查周期、manifest 地址、manifest 响应大小/JSON 校验、静默安装参数、自动安装开关、安装器启动审计和运行时 clientVersion 同步。
23. `collector-desktop/scripts/publish-collector.ps1` 增加桌面采集端发布与更新 manifest 生成脚本，支持 zip 发布包、外部 MSI/EXE 安装包和构建机本地 `-AutoInstall` 静默安装验收。
24. `collector-desktop/installer/EISCore.Collector.iss` 增加 Inno Setup 安装器模板，发布脚本可在 Windows 构建机上通过 `-BuildInstaller` 产出 EXE 安装包并生成自动更新 manifest。
25. Windows 本机已补齐 .NET SDK 与 Inno Setup 构建依赖，桌面采集端完成真实 WPF Release 构建、zip 发布包、EXE 安装器、自动更新 manifest、版本号一致性、per-user 静默安装和 AppMutex 升级互斥验证。
26. `realtime/document-intake.js` 增加采集端 release 下载路由，支持 `GET/HEAD`，`docker-compose*.yml` 只读挂载 `collector-desktop/artifacts/release`，`setup-local-wsl-release.ps1` 提供本地发布/验证/设备预置/绑定配置心跳验收一键链路，使桌面端自动更新 manifest 和安装包具备本地 WSL 与远端容器托管路径。
27. `realtime/document-intake.js` 增加 AI 入库业务修正审计接口，衔接 `ai_business_corrections` 和 `document_business_links`，让“人工修改后保留修正痕迹、标记 corrected、记录待重算状态”具备后端收口。
28. `collector-desktop` 将监听目录的默认用户、用户名和岗位写入本地上传队列和上传 metadata，服务端同步落 `document_assets.source_folder`，使 `folder_binding_user` 归属策略和来源目录追溯闭环。
29. `collector-desktop` 执行远程日志保留策略，会清理超过保留期的已上传日志和长期未补传日志；pending 日志被裁剪时补写摘要上报，兼顾磁盘占用、断网补传和可观测性。
30. `realtime/document-intake.js` 增加智能收单中心后台只读 API，总览今日采集/入库/低置信度/失败/设备在线指标，列表返回来源设备、上传人、目标业务类型、生成单据数量和置信度，详情聚合 OCR、AI 分类理由、入库计划、业务链接、未匹配字段、修正记录和客户端日志。
31. `realtime/document-intake.js` 增加智能收单中心设备管理和日志中心 API，设备侧支持新增、状态变更、默认上传人/远程配置/监听目录更新、绑定授权码重置，日志侧支持按设备、用户、模块、页面、等级、事件类型、文件 hash、批次和 trace 过滤。
32. `eiscore-apps` 增加智能收单中心前端页面和应用中心入口卡片，形成“总览 -> 文件追溯 -> 设备管理 -> 日志排查”的管理后台闭环。
33. `tests/engineering/document-intake-center-ui-smoke.mjs` 固化智能收单中心 UI 冒烟流程，可在本地自动拉起 Vite 并用 mock 管理后台接口验证文件、设备、日志三类关键视图。
34. `collector-desktop` 增强本地客户端日志脱敏，覆盖 JSON/key-value/query/header 等常见敏感信息形态，并限制单条日志文本长度，降低离线缓存泄露风险。
35. `collector-desktop` 启动时自动恢复上次中断的 `uploading` 队列记录，确保崩溃、重启或升级关闭后文件继续进入断点/去重重试链路。
36. `collector-desktop` 统一日志 metadata JSON 序列化，避免路径、版本号、服务端 id 等动态字段破坏本地日志 JSON 结构。
37. `collector-desktop` 支持失败耗尽文件再次投递后重新入队，避免网络/服务端故障后的同 hash 文件被永久按重复文件跳过。
38. `collector-desktop` 尊重后台设备禁用状态，禁用时暂停监听和上传、保留心跳同步，重新启用后恢复采集能力。
39. `collector-desktop` 将远程监听目录列表作为权威配置，支持后台清空目录后客户端同步停止所有旧目录监听。
40. `collector-desktop` 补齐窗口关闭策略：普通关闭继续隐藏到托盘，托盘退出、自动更新退出和 Windows 注销/关机会放行关闭并执行最终日志 flush。
41. `collector-desktop` 与 WebView 日志 SDK 共享网页登录用户上下文，手动选择/拖拽入队优先写入 `web_login_user` 归属；原生选择文件无网页登录快照时标记为 `manual_selected_user`，监听目录仍保持目录绑定用户或设备默认用户；前端埋点字段类型不稳定时也会保留数字/布尔/对象/数组上下文，避免无人值守目录受前台页面用户影响并减少日志上下文丢失。
42. `collector-desktop` 按远程 `upload.queue_retention_days` 清理已完成的本地上传队列审计记录，同时保留未完成/失败任务和用户原始文件，兼顾长期运行磁盘占用与断网恢复能力。
43. `collector-desktop` 在日志、设备绑定和心跳中统一上报 WebView2 runtime 版本，让后台设备排障能同时看到客户端版本与 WebView 运行环境。
44. `collector-desktop` 通过设备心跳上报本地健康快照，让后台能看到上传队列积压、最近入队/上传时间、待传日志、crash dump 补报/占用、数据库大小、磁盘剩余空间和监听目录缺失等无人值守采集状态。
45. `collector-desktop` 按日志保留周期清理已上报崩溃 dump，本地未上报报告继续保留等待补传，且崩溃报告写入/标记/清理全程 best-effort，降低长期无人值守采集电脑的磁盘压力和异常处理器二次失败风险。
46. `collector-desktop` 监听目录支持递归子目录扫描、事件监听、整包目录拖入补扫和可恢复未稳定文件重试，现场按日期、供应商或业务临时分类建立子目录、拷贝大文件或网络盘延迟落盘时仍可自动入队并保留根监听目录归属。
47. `collector-desktop` 上传取消时会立即把当前 `uploading` 行退回 `queued` 且不消耗重试，避免自动更新、关机或后台停止时文件长期卡在上传中。
48. `collector-desktop` 对旧版或手工损坏的本地上传队列字段做容错读取和启动归一化，坏时间、坏状态、坏重试次数或坏文件大小不会阻塞队列显示、健康快照和后台上传循环。
49. `collector-desktop` 对旧版或手工损坏的客户端日志字段做容错读取和启动归一化，坏创建时间、上传标记、HTTP 状态码或空 metadata 不会阻塞日志补传和日志健康水位。
50. `collector-desktop` 对 WebView、监听目录、设备运行态切换和主窗口后台 catch 分支中的日志任务做异常隔离，避免日志落库短暂失败形成未观察任务异常或二次异常并反向影响事件处理。
51. `collector-desktop` 对心跳定时器增加不重入保护，慢网络或服务端卡顿时不会并发叠加心跳、远程配置、更新检查和日志 flush。
52. `collector-desktop` 对手动选择、拖拽投递和队列刷新等 UI 事件入口增加异常隔离，避免本地 I/O 或 SQLite 短暂异常从 WPF `async void` 冒出导致主窗口崩溃。

## 六、当前风险

| 风险 | 级别 | 说明 | 建议 |
|---|---|---|---|
| 远端 DNS/连接偶发中断 | P2 | 长时间 Playwright 全量回归中曾出现 `EAI_AGAIN`、`ERR_CONNECTION_CLOSED`、`socket hang up`。E2E、smoke 和 business-chain 安全读请求均加入远端重试后已通过，但仍建议持续观察。 | 保持远端 E2E 默认单 worker 和 retry；必要时检查本地代理/DNS 与服务器连接稳定性。 |
| 静态资源发布删除旧 hash | P1 | 微前端动态 import 可能在缓存窗口请求旧 chunk。 | 使用 `scripts/sync-spa-dist-preserve-assets.sh` 发布，或采用整站原子发布；定期清理超过保留窗口的旧 hash。 |
| 本地 Node 版本低于 CI | P2 | 本机 Node 20.18.1，CI 为 20.19.0。 | WSL Node 升级到 20.19+，减少 Vite 环境差异。 |
| 前端大 chunk / manual chunk 循环 | P2 | 不阻断构建，但影响性能和缓存效率。 | 后续建立 bundle size 基线，优化 chunk 策略。 |
| 本机 WSL 偶发 `E_UNEXPECTED` | P2 | 本轮在并发 WSL 命令和一次远端 API 套件启动时观察到 WSL 运行时中断，重试后测试通过。 | 工程测试尽量串行跑 WSL 重负载命令；若复现频繁，重启 WSL 服务或迁移到 CI/Linux runner 执行长回归。 |
| 桌面采集器自动升级待远端实测 | P2 | 本机已完成 WPF build、zip、EXE 安装器、manifest 生成、per-user 静默安装、本地 WSL release 路由和下载 SHA256 验收，但远端容器仍需发布新镜像/compose 并挂载 release 目录。 | 远端发布 realtime 后，把 `collector_devices.metadata.remote_config.update.manifest_url` 指向 `https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json` 并做端到端升级验收。 |
| realtime 文档 worker 需要发布 | P2 | 远端数据库 patch 已应用并验收，但新增 realtime worker 代码需随容器重建/发布后才会在远端实际运行。 | 发布 realtime 镜像后复跑文档采集端到端用例。 |
| Docker 本地构建未完成长跑 | P3 | 本机 Docker/WSL 组合存在超时风险，本轮以 Dockerfile 静态 packaging 检查确认新增 worker 文件已 COPY。 | 后续在 CI 或稳定 Linux runner 做镜像构建验收。 |

## 七、建议的工程门禁

短回归：

```bash
npm run test:unit
npm run test:grid-agent
npm run test:grid-utils
npm run test:http-client
npm run test:syntax
npm run build:frontends
EISCORE_BASE_URL=https://nanpai.eissys.top \
EISCORE_AGENT_WS_URL=wss://nanpai.eissys.top/agent/ws \
npm run test:smoke
```

上线验收：

```bash
npm run test:engineering:remote
```

发布要求：

1. 数据库 patch 先备份再执行。
2. 前端静态资源发布使用 `scripts/sync-spa-dist-preserve-assets.sh` 或等价原子发布方案，保留旧 hash 兼容窗口。
3. 远端浏览器长跑的失败需要按“业务失败”和“连接层失败”分开判定；连接层失败必须单点复测确认。
