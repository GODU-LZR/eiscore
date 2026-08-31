# 数据库迁移治理

## 当前边界

仓库共有 102 份历史 SQL：根目录 3、`env/` 2、`sql/` 65、HR 30、材料 2。它们混合了初始化快照、模块 schema、演示数据、修复补丁和运维脚本，不能按文件名安全推断统一执行顺序。

当前唯一已有明确顺序的集合是 Runtime V2 的 10 个补丁。`migrations/runtime-v2.json` 在不修改历史 SQL 的前提下为它们补充不可变 ID、SHA-256、事务所有权和回退策略，并与原 `sql/runtime_v2_patch_manifest.txt` 双向校验。`migration-ledger.sql` 定义数据库执行账本；账本只允许数据库管理员访问。

## 规则

1. 已登记迁移禁止原地修改；校验和变化会使质量门失败。修复必须追加新迁移。
2. 新迁移使用下一个连续 ID，SQL 与回退 SQL 放在 `database/migrations/sql/`，并登记 SHA-256。
3. 历史 10 个补丁只能以“执行前备份、失败或回退时恢复备份”的策略治理；不能伪造未经验证的反向 SQL。
4. 新迁移默认由运行器包裹事务；确实不能在事务中运行时必须显式记录原因和恢复步骤。
5. 执行前校验 Manifest 和目标账本；相同 ID/校验和跳过，不同校验和立即失败；成功后记录提交、操作者、耗时和回退策略。
6. `runtime_v2_postcheck.sql` 是当前集合的执行后验证。没有通过 postcheck 的运行不得作为发布证据。
7. 102 份历史 SQL 是接受库存，不得继续向旧目录投放新补丁；后续数据库变化一律进入受治理迁移目录。

本地只读校验：

```bash
npm run db:migrations:check
node scripts/check-database-migrations.mjs --format=tsv
npm run db:runtime-patches:dry-run
pwsh -File scripts/apply-runtime-patches.ps1 -DryRun
```

上述命令不会要求 Docker，也不会连接或修改数据库。Bash 与 PowerShell 入口共用 `apply-runtime-migrations.mjs`，避免两套执行语义漂移。

获得目标环境授权后，实际执行还必须提供可审计的备份证据；提交号与操作者会连同证据写入账本：

```bash
./scripts/apply-runtime-patches.sh \
  --backup-evidence "backup://<artifact-id>" \
  --release-revision "<git-commit>" \
  --operator "<operator>"
```

PowerShell 使用同名参数 `-BackupEvidence`、`-ReleaseRevision` 与 `-Operator`。执行器先完成离线 Manifest 校验，随后才检查 Docker 和数据库；相同 ID/校验和跳过，相同 ID/不同校验和失败。runner-managed SQL 和历史文件自带事务都会把账本写入同一事务，所有迁移结束后强制运行 postcheck。当前重构过程只验证 dry-run 和模拟适配器，没有执行真实迁移；备份恢复仍必须在获授权的发布演练中验证。
