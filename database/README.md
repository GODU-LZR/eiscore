# 数据库迁移治理

## 当前边界

当前工作树有 106 份历史 SQL：根目录 2、`env/` 2、`sql/` 70、HR 30、材料 2。它们混合了模块 schema、演示数据、修复补丁和运维脚本，不能按文件名安全推断统一执行顺序。旧的 `db_schema_and_data.sql` 已由 DB1 规范基线替代并从发布树移除，只保留在 Git 历史和隔离审计证据中。

当前已有明确顺序的集合包括 Runtime V2 的 10 个历史补丁，以及 company-site 1 个、core 7 个迁移，共 18 个不可变迁移。`migrations/runtime-v2.json` 在不修改历史 SQL 的前提下为 Runtime V2 补充不可变 ID、SHA-256、事务所有权、执行超时和备份回退策略，并与原 `sql/runtime_v2_patch_manifest.txt` 双向校验；`company-site-001` 为企业站发布快照字段提供 SQL 回滚和 postcheck；`core-001`～`core-006` 分别治理凭据、运行角色/RLS、测试对象、HR 身份范围和调试端点，`core-007` 将动态 `app_data` DDL 收敛到应用—表一对一注册、管理员/Agent 授权、严格标识符、登录用户 RLS、匿名撤权及成功操作审计。`migration-ledger.sql` 定义数据库执行账本、基线身份和迁移覆盖账本；账本只允许数据库管理员访问。

规范空库基线位于 `database/baselines/eiscore-db-v1/`，由 `manifest.json`、`schema.sql`、`object-catalog.json` 和 `register.sql` 组成。基线固定覆盖创建时的 12 个迁移；后续新增迁移可以继续追加到来源 Manifest，基线校验只验证自己声明的不可变子集。覆盖项只写入 `baseline_migration_coverage`，不会伪写入 `schema_migrations`；迁移运行器据此区分“结构已覆盖”和“迁移已实际执行”。DB2 的新装角色引导位于 `database/bootstrap/roles-v2.sql`，运行密码由 `configure-database-runtime-secrets-v2.sh` 注入。

## 规则

1. 已登记迁移禁止原地修改；校验和变化会使质量门失败。修复必须追加新迁移。
2. 新迁移使用下一个连续 ID，SQL 与回退 SQL 放在 `database/migrations/sql/`，并登记 SHA-256。
3. 历史 10 个补丁只能以“执行前备份、失败或回退时恢复备份”的策略治理；新迁移可以提供经过校验和登记的 SQL 回滚文件，不能伪造未经验证的反向 SQL。
4. 新迁移默认由运行器包裹事务；确实不能在事务中运行时必须显式记录原因和恢复步骤。
5. 执行前校验 Manifest 和目标账本；相同 ID/校验和跳过，不同校验和立即失败；成功后记录提交、操作者、耗时和回退策略。
6. 每个 Manifest 的 postcheck 是对应集合的执行后验证；没有通过 postcheck 的运行不得作为发布证据。
7. 106 份历史 SQL 不得继续接收新补丁；10 份受 Runtime V2 Manifest 管理，其余 96 份由 `legacy-sql-resolution.json` 固定最终处置且默认禁止执行。后续变化一律进入受治理迁移目录。
8. `public-schema-ratchet.json` 固定存量允许集；新应用对象不得进入 `public`，例外必须同时绑定新迁移和接受 ADR。删除或迁出不会扩大允许集。
9. 每个迁移必须声明 `lockTimeoutMs`、`statementTimeoutMs` 和 `idleTransactionTimeoutMs`；运行器以事务内 `SET LOCAL` 强制执行，禁止继承集群的无限超时默认值。
10. 动态表只允许 `super_admin` 或 `eiscore_agent` 通过 `app_center.create_data_app_table` 创建或加列。存量孤儿表只隔离、不删除；不得直接绕过注册表执行产品 DDL。

本地只读校验：

```bash
npm run db:migrations:check
npm run db:baseline:check
node scripts/check-database-migrations.mjs --format=tsv
npm run db:runtime-patches:dry-run
pwsh -File scripts/apply-runtime-patches.ps1 -DryRun
npm run db:company-site-patches:dry-run
npm run db:core-patches:dry-run
npm run test:database-baseline:docker
```

上述命令不会要求 Docker，也不会连接或修改数据库。Bash 与 PowerShell 入口共用 `apply-runtime-migrations.mjs`，避免两套执行语义漂移；company-site 迁移使用同一 Node 执行核心和独立 Manifest。

获得目标环境授权后，实际执行还必须提供可审计的备份证据；提交号与操作者会连同证据写入账本：

```bash
./scripts/apply-runtime-patches.sh \
  --backup-evidence "backup://<artifact-id>" \
  --release-revision "<git-commit>" \
  --operator "<operator>"
```

PowerShell 使用同名参数 `-BackupEvidence`、`-ReleaseRevision` 与 `-Operator`。执行器先完成离线 Manifest 校验，随后才检查 Docker 和数据库；相同 ID/校验和跳过，相同 ID/不同校验和失败。runner-managed SQL 和历史文件自带事务都会把账本写入同一事务，所有迁移结束后强制运行 postcheck。`company-site-001` 已在隔离 `eiscore-g35` 数据库真实执行并通过 postcheck；生产环境仍必须在获授权的发布演练中验证备份恢复。

## 版本化数据库发布

`releases/eiscore-db-v6/manifest.json` 将源码提交、固定镜像、规范基线、三个迁移 Manifest、动态 DDL 边界、数据库/PostgREST 契约、统一操作锁及时间预算绑定为同一发布制品。源码锚点为 `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08`，规范 Manifest SHA-256 为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`。发布和恢复在目标数据库使用同一会话级 PostgreSQL advisory lock；等待锁、迁移语句、备份/恢复命令、PostgREST HTTP、reload 和总作业均有上限。PostgREST 只有在日志确认一次新的 `schema cache loaded` 且完整双角色/七 Schema 指纹连续稳定三次后才算就绪；失败会报告具体角色/Schema 指纹差异。离线验证：

```bash
npm run db:release:check
```

获得明确目标环境授权后，一次性发布作业还必须提供备份目录、候选 PostgREST、三个独立秘密、`--environment=isolated|production` 和 `--backup-storage-evidence=<evidence-uri>`；生产环境只接受 `kms://`、`vault://` 或 `volume://` 证明，不接受 `isolated://`。示意参数见 `docs/engineering/DB4_EXIT_AUDIT.md`、`docs/engineering/DB5_EXIT_AUDIT.md` 和 `docs/engineering/DB6_DATABASE_STRUCTURE_GOVERNANCE_EXIT_AUDIT.md`。作业不负责流量切换，只有最终数据库/API 契约通过并写入 `eiscore_meta.database_releases` 后，外部部署编排才可继续。当前禁止对客户或生产环境执行该命令。

## 备份、恢复与运行审计

`database/operations/policy.json` 固定 RPO 24 小时、RTO 2 小时、每日 14/每周 8/每月 12 的保留下限、统一发布/恢复锁和所有操作时间预算，以及 0 运行时超级用户、0 角色越界和 0 阻塞查询阈值。对应入口为：

```bash
npm run db:backup:check -- --backup-root=<backup-root> --environment=isolated
npm run db:recovery -- --evidence=<backup-evidence.json> --confirm-empty-target=eiscore-db-v6 --dry-run
npm run db:runtime:audit -- --api-url=<candidate-postgrest-url>
node scripts/test-database-operation-lock.mjs
```

实际恢复还必须指定空目标 PostgreSQL/PostgREST 容器、操作者和三个独立运行秘密；它会重新校验备份、恢复角色/Schema/数据、比较 DB/PostgREST 契约并写恢复账本，但不会切换流量。`npm run test:database-recovery:docker` 只创建随机命名的临时隔离栈，并在结束时销毁。生产命令必须先取得目标环境授权。
