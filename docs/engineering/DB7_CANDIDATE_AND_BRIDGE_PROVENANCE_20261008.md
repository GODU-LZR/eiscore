# DB7 候选与 Harness Bridge provenance 验收记录

日期：2026-10-08，Asia/Shanghai。源码仓库：`C:/Users/Twist/Documents/eiscore/github-eiscore-refactor`，分支 `codex/systematic-refactor`。

本记录只证明明确提交及制品的本地隔离验收。没有正式批准数据库发布，没有替换既有 Compose，没有连接远端或生产，没有写入业务数据库卷。

## 2026-10-08 当前提交 Bridge clean-build 复核

基于 `codex/systematic-refactor@7e0774aa9e0770ecd6c097c59d6c3350ee9b9222`，从 Git archive（不是工作树、旧 tarball 或运行中容器）构建了无缓存镜像 `eiscore-harness-bridge:clean-build-20261008-7e0774aa`。镜像 ID 为 `sha256:539ce844874c9755bf5475048a5d98ce017db6941ff0fe7202045e8fd3d81373`，标签 `org.opencontainers.image.revision=7e0774aa9e0770ecd6c097c59d6c3350ee9b9222`、`org.opencontainers.image.source=github-eiscore-refactor`；基础镜像为 `node@sha256:d2166de198f26e17e5a442f537754dd616ab069c47cc57b889310a717e0abbf9`。镜像内 Node `22.19.0`、DSH `0.1.2-rc.1`，Harness tree 为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`，8 个 Bridge/tool/profile/contract 文件与 archive 字节一致。

真实 Provider 隔离容器使用随机名称、独立 Docker 网络、只读根文件系统、非 root 用户、无宿主挂载/发布端口和 tmpfs 状态目录，已清理。使用现有本地 Bridge 环境中的 Provider 配置在内存中注入一次真实 `deepseek-official` / `deepseek-chat` completion，未记录密钥或响应正文：`/healthz=200`、`/readyz=200`（runtime/plugins/sessions 全部 true）、插件数 `9`、错误 Bridge secret `401`、completion `200` 且 choices 存在/内容长度 `2`；同一请求重放返回 `409 HARNESS_REQUEST_REPLAY`，同一会话跨租户返回 `403 HARNESS_SESSION_OWNERSHIP_DENIED`。另一 `--network=none` 容器内的 Bridge/SDK 错误、Gateway、Runtime 边界及 loopback 工具回归也全部退出 `0`（proxyCalls=1、modelRequests=2）；该工具回归不是额外真实 Provider 调用。证据目录为 `.codex-tmp/bridge-provenance-20261008-7e0774aa/`，其中 `report.json`、`loopback-report.json`、`reconciliation.json` 保存摘要和 SHA-256。

该镜像没有替换当前 Compose。运行中的 `eiscore-harness-bridge` 仍为容器 `e084cfc64b6ff26b5a9964ebef176885369e6d4decdef9771a778ddfa75bf140`、image `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，状态 `running`；隔离前后其容器 ID、image ID、挂载集合未改变。测试容器从未挂载业务数据库卷，本任务未向既有数据库发送请求。隔离期间既有 `deepseek-web` 的启动时间发生变化，但容器身份/image/mount 没有替换，该变化不归因于本任务，也不作为稳定性证据。

失败也保留：首次脚本因伦度交接文档较旧备份已变化而在预检查处停止；WSL legacy builder 拒绝 `--progress` 后移除该显示选项；默认网络的首次无缓存 `npm ci` 因 `ECONNRESET` 失败，host 网络重试以同一提交/锁文件安装 524 个包并完成构建，未更换 registry 或绕过 integrity。成功隔离探测的原始 `report.json` 仍为 `ok=false`/退出 `1`，因为整体保护检查使用未排序的 mount 数组和所有服务启动时间逐字比较；事后 `reconciliation.json` 用原始快照确认 8 个既有服务 ID/image/mount 集合不变，只有既有 `deepseek-web` 启动时间变化。没有覆写失败报告或重跑收费 completion 来包装总体成功。

本轮未改产品代码。主目录新鲜通过 runtime-image、production-config、harness-production-path、database-release-drift，以及 Harness plugin/gateway/tool/runtime/write/twin/document/sales/query/read/output/migration-switch 各组回归；独立干净 clone 的正式候选路径 dry-run 再次退出 `0`，canonical SHA 不变。数据库 release/recovery 的 Docker 证据仍为上节列出的上一阶段结果，本轮未重复。

伦度交接文档和样式在本轮被其他任务继续更新，旧备份不能代表其最新版本；本任务未覆盖这些文件，另存最新副本于 `.codex-tmp/protected-changes-20261008-7e0774aa/`。本轮核对时文档 SHA 为 `3224c73973fdc291b8cce002b5c769c9d39c1806e335debafc0320412cc1ac69`，样式为 `6673c1eb596c94fb82374ce9ee5ea73f8796f3be180fa793a7328148de4489db`；五份 manifest 与原备份仍一致。备份不是回退授权，之后的新修改仍需重新核实。

本证据不证明整个本地栈已用新制品运行。七项保留修改尚未由所有者处置，v7 仍 candidate only，默认 v6 不变，既有 Compose 未发布更新；本任务不会代替正式审批或覆盖其他任务变更。全局目标保持 active。

## 四项问题的实际状态

| 问题 | 已完成 | 尚未完成 |
| --- | --- | --- |
| 主工作树未干净 | 本任务实现已按范围提交；七项其他任务修改逐文件备份；使用独立干净 clone 验收 | 七项修改仍保留在主工作树，需要明确归属和处置，不能声明主仓库 clean |
| candidate 与正式 v6 混淆 | 恢复不可变历史；准备独立 v7；原 v6 → v7 release 和破坏后 recovery 真实通过 | v7 仅待评审，不是正式 release approval；默认 v6 面对当前源码仍 fail-closed |
| 真实 Provider 曾经 502 | DSH_CWD 解析链接及 Node engine 修复；当前提交的 Node 22 clean image 已在隔离 Bridge 取得真实 completion 200，并验证 401/409/403 边界 | 未把一次真实 completion 扩大为所有业务场景上线保证 |
| Bridge clean-build 来源不完整 | 当前提交的 Git archive、镜像 label、Harness tree、8 个文件 SHA 和真实 completion 已关联 | 当前 Compose 仍使用旧镜像；新镜像尚未发布替换 |

## 实现提交与兼容边界

- `f9aa189eb88833e496b5ab9d2257063ba05df195`：恢复原 `core-002`、`runtime-v2-003` 及 v1 baseline manifest/register；新增 `core-010-harness-tenant-auth-boundaries.sql`；补齐 tenant login、raw ontology 拒绝及原 v6 升级测试；移除 Compose 无账本 initdb 的 `core-002` 挂载。
- `49cb07d2920aea68cffa2be220740556aa584a16`：release/recovery 测试自行创建 `tests/.artifacts`，修复首次干净 checkout 的 ENOENT。
- `c9cf266281872a01d82d22ade24f7efcd5691983`：Git 保存 SQL 原始字节，修复 Linux 干净 checkout 的 raw checksum 与实际函数 definition 漂移。

`core-010` 包含租户登录重载、用户 tenant 回填、RLS helper 授权及原始本体接口撤权。它不替代执行账本，也不应单独挂载到 initdb。空库先初始化批准基线/角色/秘密，再执行批准 release，最后开放业务流量。

升级证据的前提是原冻结 v6 的真实 SQL 和账本状态。曾执行后来改写的 `core-002` 或 `runtime-v2-003`、账本中记录不同 checksum 的库不在本证据范围内，必须拒绝并保留现场。不得直接修改账本 checksum、重登记 baseline 或删除业务卷。涉及结构与权限的回退使用发布前备份恢复。

## 干净检出暴露的根因

早期 candidate dry-run 能通过，但干净 Docker 验收失败：原 v6 重建 catalog 为 `88fcc39c20d064f8e81116df3895bc9e62329167994569796b24ce98f5d9b1de`，与冻结 `c45944529f41b5be49487e637b291676d470a35f02b4423a68372b123fc0afde` 不符；新空库 catalog 也无法匹配批准 predecessor。离线审计同时出现 79 项 legacy SQL raw checksum 不一致。

主目录的 baseline `schema.sql` 原来有 759924 bytes、288 个 CRLF，raw SHA-256 为 `dbcd35e8cc93254dd285a89a9fa210151a9490a60fa55cc287b2f566a7874a28`，与原 manifest 一致。Git text conversion 将它变成 759636 bytes 的 LF 文件。虽然 portable 内容一致，dollar-quoted 函数体的换行会进入 `pg_get_functiondef`，因此实际 PostgreSQL catalog 不一致。

修复采用 Git 原生 `*.sql -text`，保存当前已核实的历史字节。提交涉及 91 份 SQL blob 的换行差异；`git diff --ignore-space-at-eol c9cf2662^ c9cf2662 -- '*.sql'` 为空，没有 SQL 内容变更。96 项 legacy 原 raw checksum 均一致，混合换行的 `sql/company_site_platform_v1.sql` 也原样保存。没有修改历史审计 ledger 或重算冻结 catalog 来绕过失败。

## 待批准 v7 制品

评审文件：[manifest.json](../../database/release-candidates/eiscore-db-v7/manifest.json)。它与隔离验收中的 candidate 完全相同，只改变保存路径。

| 字段 | 值 |
| --- | --- |
| release ID | `eiscore-db-v7` |
| source revision | `c9cf266281872a01d82d22ade24f7efcd5691983` |
| canonical manifest SHA-256 | `088aee81f4289a20f56d39a32b0e94ae2631d8ec6c75423573e6a51fb630b486` |
| artifact 数量 | 57 |
| core terminal | `core-010` |
| core-010 checksum | `5818fa75d521e4f1b3aa84f0cc933944fee6097da28abe958d8aa00506bf3055` |
| database catalog | `a473c2d932a046c6df278acff03c97ed4afeb919762ea6bdebbb88c7b1e28ff8` |
| PostgREST contract | `cb5c41defeac0c36e307b06a538d50c3abe60b17c9dcbaac25b4ae63cdbe1cd1` |
| 审批状态 | candidate only，未批准、未发布 |

源码锚点是实现提交；后续保存候选和验收文档的提交不会改变其 57 个绑定 artifact。默认 `verifySourceRevision=true`，未关闭来源验证。

冻结 v6 正式路径及默认命令保持不变。主工作树既有未提交 v6 canonical SHA 为 `4d5b2c1dbfd3d436262771ad76a0b385447325edd3f906e55ff0a6c3adea324f`；干净历史描述符为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`。当前 `loadAndValidateDatabaseRelease` 分别报告 17 与 14 项错误。这是版本不匹配的正确拒绝，不应把当前源码强行包装成 v6。

## 实际验收

独立 clone：`.codex-tmp/db7-source-20261008-f9aa189e`。目录名是首次创建时的提交名，实际执行 Docker 测试时的 detached HEAD 为 `c9cf2662`，测试前后 `git status --porcelain` 为空。交付时又检出保存候选和文档的 `958e81cb`，正式评审路径的 candidate dry-run 再次通过；源码锚点和 manifest SHA 未变化。没有 stash 或覆盖主工作树。

以下测试均取得最终退出码 0：

| 执行位置与命令 | 覆盖范围 |
| --- | --- |
| 主目录及 WSL 干净 clone：`npm run test:database-migrations` | 迁移、baseline、发布/恢复 fail-closed、治理边界、角色与结构门禁 |
| 主目录：`npm run db:release:check -- --release database/release-candidates/eiscore-db-v7/manifest.json`；clone 使用对应临时候选路径 | 实际提交来源、57 个 artifact、契约和候选 dry-run |
| clone：`DB_RELEASE_PATH=.codex-tmp/db7-candidate-20261008/manifest.json DB_RELEASE_PREDECESSOR=eiscore-db-v6 npm run test:database-release:docker` | 原冻结 v6 重建、真实升级、tenant 回填、锁、可核对备份、稳定 DB/API、重复执行、drift/conflict 拒绝 |
| clone：`DB_RELEASE_PATH=.codex-tmp/db7-candidate-20261008/manifest.json npm run test:database-recovery:docker` | 空库 release、事务回滚、备份校验、破坏源表、空目标恢复角色/测试数据/目录/API、恢复账本和运行健康审计 |
| clone：`npm run test:database-contracts:docker` | fresh/原 v6 upgrade/repeat 一致；tenant login 两个 HTTP 重载；raw ontology HTTP/RPC 拒绝 |
| clone：`npm run test:database-roles:docker` | 非超级用户角色、company-site Agent RLS、HR payroll RLS 和拒绝契约 |

历史 v6 从 Git 源码 `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08` 与冻结描述符 `09c2f2018daf45d20cd85e4907fdbf2315dbeb6e` 重建。测试执行真实迁移器与 release/recovery 工具，没有伪造历史发布行或备份记录。

Docker 测试使用随机命名临时容器、独立网络和 tmpfs，结束后清理；测试 canary 只进入这些临时数据库。没有使用现有业务卷。

## Bridge 与真实 Provider 上一阶段证据

构建修复为 `6795249b` 的 DSH_CWD 依赖链接和 `0e955b9e` 的 Node `22.19.0`。Node 20 的 `HARNESS_RUNTIME_EXIT` 与 SDK 依赖要求 Node >=22.19.0 一致；历史 `HARNESS_RUNTIME_PROVIDER_ERROR` 不能被直连 API 200 或 mock 成功覆盖。

此前已验证镜像：`eiscore-harness-bridge:clean-build-20261007-node22`，本地 image ID `sha256:9d13895208906a56a0efd0c6ad7be4dd4454ae550c2daf0eff4e5cfd707c7114`。它由该构建提交的干净 Git archive 生成，安装锁定的 524 个生产包；revision label 是 `0e955b9e`，source label 是 `github-eiscore-refactor`。实现提交与构建提交的 Harness tree 同为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`，该组件源码没有变化。上一阶段只读 inspect 核对上述 ID、labels 和 tree；本轮重新构建及调用的新证据见文首。

上一阶段同一 Node 22 镜像的隔离只读容器已经取得 `/readyz` HTTP 200（runtime/plugins/sessions 均为 true）和真实 Bridge Provider completion HTTP 200、choices 存在、内容长度 2。没有输出或保存密钥和响应正文；这是一条实际 completion 证据，不是全部业务场景或稳定性测试结论。

当前 Compose `eiscore-harness-bridge` 的 image ID 仍为 `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，核对时 running/healthy。没有将新镜像称为已部署版本，也没有把本地 image ID 称为 registry manifest digest。

## 主工作树保留项与下一步

| 保留文件 | 差异与建议 |
| --- | --- |
| `database/releases/eiscore-db-v2/manifest.json`、`eiscore-db-v3/manifest.json` | 各 4 处历史 checksum 替换，应保留证据后由所有者确认撤回 |
| `database/releases/eiscore-db-v4/manifest.json`、`eiscore-db-v5/manifest.json`、`eiscore-db-v6/manifest.json` | 各 3 处历史 checksum 替换；与已恢复不可变 SQL 冲突，不应提交为历史 release 修复 |
| `docs/engineering/LUNDU_CUSTOMER_SERVICE_TRIGGER_RESTORE_20261007.md` | 其他任务新增客服按钮构建/远端验收记录，由对应任务提交 |
| `eiscore-base/src/styles/login-view.scss` | 其他任务的客服触发器规则调整，本任务未修改或验收前端视觉，由对应任务提交 |

七个当前文件已复制到忽略的 `.codex-tmp/protected-changes-20261008-c9cf2662/`，`checksums.json` 记录逐文件原始 SHA-256 和字节数。副本与主文件核对一致；备份不等于已经授权回退原文件，也不包含后续其他任务继续修改的内容。

推荐保持 v6 历史冻结，把本次通过的 v7 作为待批准新版本。批准前不要移动候选到正式 releases、修改默认 release 或执行目标环境 release/recovery。清理七项其他任务修改需要先明确处置，不能由本任务擅自 stage、提交或回退。全局目标继续 active，不能声明主工作树干净或系统正式上线就绪。
