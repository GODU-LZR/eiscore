# DB4 版本化数据库发布与部署退出审计

> 结论：DB4 已完成。`eiscore-db-v2` 已成为可验签、可重复执行、失败关闭的数据库发布制品。验证仅使用随机命名的本机隔离 Docker 栈；没有连接客户/生产环境，没有运行 `:remote` 命令，没有读取、停止或修改既有 `eiscore-g35-*` 容器和数据卷。

## Release Manifest

`database/releases/eiscore-db-v2/manifest.json` 的规范 JSON SHA-256 为 `aed30ee9d2a55c615974e4cfa782acebcbc93ae3748e9f8e9f79ac9979bd7074`，精确引用源码提交 `0ae0c946f0747f15041d5cf6ba6e1fe2f3251ca3`。该提交先于 Manifest 自身提交，避免了“文件内容必须包含自身提交 SHA”的循环引用。

Manifest 固定：

- PostgreSQL 16.11 与 PostgREST 14.4 镜像摘要；
- `eiscore-db-v1` 基线身份、Schema 与对象目录校验和；
- Runtime V2、company-site、core 三条迁移链的 13 个 ID/校验和、终点和 postcheck；
- DB3 数据库目录与 PostgREST 双角色/七 Schema 契约指纹；
- 39 个执行或验证输入的 LF-portable SHA-256，并逐项从引用 Git 提交读取 blob 复核；
- DB1 前驱运行目录指纹 `13a49b00a78cfd67b6195f129b01dfe18e0fb92f74bdc8e5e1d57a9aab85e025`；
- 备份必需、backup-restore 回退、Schema Drift/账本/postcheck 失败关闭和外部成功后切流量策略。

`npm run db:release:check` 只做离线验签；它不会检查 Docker、连接数据库、生成备份、轮换密钥、请求 API 或切换流量。

## 一次性发布作业

`scripts/deploy-database-release.mjs` 是运行后退出的发布控制面作业，不是常驻后端服务。数据库运行服务仍只使用 DB2 的非超级用户；发布作业以明确提供的数据库管理身份执行角色/Owner 等控制面变更。

固定顺序为：

1. 离线校验 Release Manifest、Git blob、基线、迁移和契约；
2. 校验目标 PostgreSQL/PostgREST 镜像、PostgreSQL major、数据库身份；
3. 比较完整数据库目录，只接受已登记前驱或目标指纹；
4. 校验已安装基线、迁移账本与基线覆盖，不接受未知 ID 或 checksum 冲突；
5. 输出 custom-format 全库备份和不含密码的 globals，使用 `pg_restore --list` 验证后写备份证据；
6. 依次执行三个 Manifest；相同 checksum 或基线已覆盖项幂等跳过，每条链强制 postcheck；
7. 注入彼此独立的 PostgREST/Agent 密码和 JWT secret，并实际验证密码登录与角色切换；
8. 比较最终数据库目录，启动或复用候选 PostgREST，reload Schema Cache，验证匿名/登录 OpenAPI 总指纹和 JWT RPC；
9. 最后才向 `eiscore_meta.database_releases` 写唯一成功记录；该表归属非登录 `eiscore_owner`；
10. 流量切换不由数据库作业执行，只有外部部署编排看到成功记录后才可继续。

任何步骤失败都会退出非零，不写成功记录，也不产生切流量信号。迁移后失败不会自动编造反向 SQL；DB5 使用本阶段备份格式执行恢复演练。

## 真实隔离演练

`npm run test:database-release:docker` 从旧 `env/init_roles.sql` + v1 基线建立 DB1 前驱，候选 PostgREST 初始为 stopped，然后执行：

- 首次发布：Runtime/company-site 由基线覆盖，core 为 1 applied / 1 skipped；备份、三个 postcheck、密钥、最终数据库指纹、PostgREST 契约和发布记录全部通过；
- 重复发布：core 为 0 applied / 2 skipped；生成新的可验证恢复点，但发布成功记录仍只有 1 条；
- 创建未知表模拟 Schema Drift：发布在新增备份前失败；
- 篡改 `core-002` 账本 checksum：发布在新增备份前失败；
- 断言 `database_releases` Owner 为 `eiscore_owner`，Manifest/source revision/契约/备份证据均与制品一致。

门禁已接入 `npm run test:database:docker`，默认 CI 会在离线质量门后运行 DB1～DB4 的真实数据库套件。

## 尚属 DB5

DB4 证明备份可读取，但没有把备份恢复到被破坏的新数据库、比较恢复前后数据/Schema，也没有形成 RPO/RTO 与慢查询/保留策略证据。这些项目属于 DB5。G4.1～G4.4 继续暂停。
