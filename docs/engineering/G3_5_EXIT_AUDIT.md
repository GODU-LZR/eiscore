# G3.5 产品级集成与功能验收退出审计

## 结论

G3.5 在 2026-09-02 完成并通过。重构仓库已在独立、可销毁的本地全栈环境中完成标准工具链 CI、真实数据库迁移、API 冒烟、业务闭环、浏览器功能点和运行日志复核；当前结论是“重构后项目可以在代表性本地工程环境中启动、构建并运行，已验证范围内没有未处理的阻断错误”。

本结论不等于生产发布批准：真实 AI 上游、三家企业配置包、客户数据迁移、备份恢复演练和生产发布治理仍未验收。G4、G5 未开始，本轮未进入 G4。

## 隔离与不可变边界

- 唯一写入仓库：`C:\Users\Twist\Documents\eiscore\github-eiscore-refactor`，分支 `codex/systematic-refactor`。
- 原仓库 `C:\Users\Twist\Documents\eiscore\github-eiscore` 保持 `main`、`e5d0b927e493631b0b9f26685ca425428785f26d` 且工作树干净。
- 未向任何远端推送。
- 已存在的 WSL `eiscore-*` 容器和 `eiscore_pgdata` 数据卷未被停止、迁移或写入。
- 验收栈使用 Compose 项目 `eiscore-g35`、`eiscore-g35-*` 容器和 `eiscore-g35_*` 数据卷；验收结束后可独立删除。
- 数据库测试基线经过裁剪和脱敏，只位于 Git 忽略的 `tests/.artifacts/`，不作为生产数据源。

## 工程化修复

| 问题 | 修复与防回归 |
| --- | --- |
| Realtime 镜像使用浮动 Alpine 基础镜像、`npm install`，且只复制旧模块清单 | 固定带摘要的 `node:20.19.0-bookworm-slim`，改为 `npm ci`，复制组合根全部 28 个本地模块，增加健康检查、缓存和有限网络重试；开发、生产 Dockerfile 均有契约测试且真实构建成功 |
| Compose 挂载不存在的 `env/db_schema_and_data.sql`，Docker 会创建同名目录并导致 PostgreSQL 初始化失败 | 开发和生产 Compose 均只读挂载仓库根 `db_schema_and_data.sql`；基础设施门禁验证源必须是普通文件 |
| Vite API、Agent、IDE 代理写死旧端口，隔离测试可能误连另一个环境 | 10 个消费者统一使用 `VITE_DEV_API_PROXY_TARGET`、`VITE_DEV_AGENT_PROXY_TARGET`、`VITE_FLASH_IDE_PROXY_TARGET`；基座遗留 `/rpc` 入口也使用同一 API 目标 |
| Runtime V2 安全补丁撤销原始全图视图权限，但业务测试和本体工作台仍访问旧接口 | API 业务链和本体工作台切换到角色范围 `agent_*` RPC；FP64 同时断言推理、KG、洞察和点击节点后的列语义可用，并监控所有 HTTP/Console/Page errors；旧原始视图 403 被作为安全正向证据 |
| Workflow V2 严格转移策略在基线中未生效 | 在隔离库应用正式策略补丁，业务链验证缺少规则时 403、补齐规则后状态回写和完成事件均正确 |
| 隔离库登录函数中的 JWT 默认密钥与 PostgREST 不一致 | 仅在隔离库使用现有正式补丁从数据库设置读取密钥；未提交或输出本地密钥 |
| 禁用 AI 的冒烟仍要求数据库存在真实 API Key | `EISCORE_SMOKE_SKIP_AI=1` 时只跳过 AI 密钥/上游检查，启用 AI 时仍严格校验 |

## 运行拓扑与健康检查

| 服务 | 验收端口 | 结果 |
| --- | ---: | --- |
| PostgreSQL | 15432 | 可连接，Runtime V2 账本 10 条 |
| PostgREST | 13000 | HTTP 200 |
| Realtime / Agent | 18078 | `/health` 200，容器健康状态 `healthy` |
| Nginx 宿主 | 18080 | `/`、`/api/`、`/agent/health` 均为 200 |
| Swagger UI | 18079 | 设计路径 `/doc/` 200；根路径 404 属于 `BASE_URL=/doc` 预期 |
| Code Server | 18443 | 未认证入口重定向，符合预期 |
| 11 个 Vite 前端 | 8080～8091 | 基座和 10 个产品入口均为 200，深链由 E2E 验证 |

## 数据库迁移证据

- 迁移前备份：`tests/.artifacts/g35-pre-runtime-v2.dump`，1,386,132 字节，SHA-256 `6071E90A59FA754C50C55EDACF348D9A17017BFB259974349417C8193FC09531`。
- 正式执行器按 `database/migrations/runtime-v2.json` 应用 `runtime-v2-001`～`runtime-v2-010`，账本 10/10，postcheck 通过。
- 推理运行状态 `completed`，事实 6,156、推理事实 695、启用规则 16；全局健康检查为 `healthy`，关系和字段语义缺口均为 0。
- Workflow V2 严格策略补丁已应用，并由业务链验证拒绝和成功路径。
- 测试基线：`tests/.artifacts/eiscore-g35-baseline.dump`，1,373,395 字节，SHA-256 `C79E8D8F9640DD07A20FB6F03F4C5D036DBE7B8510C52EAEA9F00CD8B2E9A9E5`。
- 仓库根初始化快照为 1,013,561 字节，SHA-256 `3DBD909A71B56109BC5921A169F86F0E2C62057CA92CB13F6F921777159329C6`，与原仓库相同。

## 验证矩阵

| 层级 | 命令或证据 | 结果 |
| --- | --- | --- |
| 标准工具链 | `npm run toolchain:check -- --strict` | Node 20.19.0 / npm 10.8.2，通过 |
| 完整 CI | `npm run test:ci` | 质量门禁、单元测试、秘密扫描、变更 lint、基础设施契约、11/11 前端生产构建全部通过 |
| Runtime 镜像 | 开发 Compose 构建；`docker build -f realtime/Dockerfile.prod ...` | 两条真实构建路径均成功，生产镜像摘要 `sha256:458db0009e4af48d682c2f603aefb8d2a87691151aed2ea8e08bdb1516b0a22d` |
| API 冒烟 | `npm run test:smoke`，`EISCORE_SMOKE_SKIP_AI=1` | 20/20；登录、错误密码、深链、PostgREST、Realtime WebSocket、宿主反代通过 |
| API 业务链 | `npm run test:business-chain` | 32/32；应用发布、动态表、库存自动入库、Workflow 严格策略、HR、仓储闭环通过，`cleanupErrors=[]` |
| 浏览器 E2E | `npm run test:e2e`，Chromium 1.61.0，单 worker | 77/77，0 unexpected、0 flaky、0 skipped，约 9.8 分钟 |
| 功能点 | 合并 E2E 中 FP01～FP67 | 67/67；覆盖基座、人事、仓储、销售、采购、生产、质量、设备、应用中心、决策和移动端 |
| 壳与交互 | 合并 E2E 中 5 个壳层、4 个点击巡检 | 9/9；登录、深链、导航、Grid 控件和应用中心安全取消通过 |
| 浏览器业务链 | 合并 E2E 中 UI business chain | 1/1；应用中心、Workflow、HR、仓储闭环并清理 |
| 数据清理 | API 和 UI 清理断言，加数据库残留复核 | 动态记录、HR、仓库、应用、Workflow 定义残留均为 0 |
| 运行日志 | PostgreSQL、PostgREST、Realtime、Nginx 复核 | 无持续错误；错误密码、原始视图 403 和严格策略 403 均为测试预期 |

浏览器测试同时监听 `pageerror`、`console.error` 和 HTTP 4xx/5xx。内置浏览器连接在本机因 `failed to write kernel assets` 未能启动，因此没有把它计入通过证据；最终可视化证据来自仓库 Playwright CLI、截图/trace 失败留存策略和统一 JSON 报告。

## 可追溯产物

以下产物位于 Git 忽略目录，保留在本机用于审计，不含提交到仓库的客户数据或密钥。

| 产物 | SHA-256 |
| --- | --- |
| `tests/.artifacts/g35-business-smoke-result.json` | `09B06BD5D56AE8BED34507B84A235F5CC133B6F693AF65A241C93280474D503C` |
| `tests/.artifacts/g35-full-chain-result.json` | `74160C1287E0B90DE8A721710405073743B9C46D9F314B3B923F6EEF902193EE` |
| `tests/.artifacts/playwright-result.json` | `557E77328523FA1302AEEF4103186E8A5FA82353C8B6F47D7BBB95D75B1DE57D` |
| `tests/.artifacts/g35-pre-runtime-v2.dump` | `6071E90A59FA754C50C55EDACF348D9A17017BFB259974349417C8193FC09531` |
| `tests/.artifacts/eiscore-g35-baseline.dump` | `C79E8D8F9640DD07A20FB6F03F4C5D036DBE7B8510C52EAEA9F00CD8B2E9A9E5` |

## 已接受限制与后续阻断项

- 真实 AI 上游未测试。`EISCORE_SMOKE_SKIP_AI=1` 明确跳过密钥与外部模型调用，但 AI 页面可加载、非 AI Runtime 和 WebSocket 已验证；上线前必须在受控环境注入企业密钥并补做模型、OCR、流式响应和费用/限流测试。
- 其余 92 份历史 SQL 仍缺少可信全局顺序。当前只有 Runtime V2 的 10 个补丁具备 Manifest、SHA-256、事务、账本和 postcheck；脱敏 dump 只解决本轮可重复验收，不能替代受治理的全新环境零到当前版本初始化链。
- 已创建迁移前备份，但没有完成“破坏后从该备份恢复”的演练；恢复时长、数据点目标和操作手册仍属于 G5。
- 未向伦度机电、君乐缘或经纬网厂环境部署，也未写入客户数据；三家企业同制品配置和差异验证属于 G4。
- 生产构建仍有既有循环 chunk、大体积 BPMN/Element Plus 和第三方弃用告警，不阻断本轮正确性，但需在后续性能与依赖治理中量化。

## 退出决定

G3.5 通过并关闭。后续默认只维护现有 G1～G3.5 门禁；是否进入 G4 由用户另行决定。
