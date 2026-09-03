# DB1 规范基线与迁移收敛退出审计

> 审计日期：2026-09-03
> 范围：独立重构仓库与无网络隔离 PostgreSQL 16.11 栈；未连接客户环境、原仓库或既有 G3.5 数据卷。

## 结论

DB1 已完成。旧的结构+业务数据混合转储不再是 Compose 初始化输入；`database/baselines/eiscore-db-v1/` 成为唯一规范空库结构输入。基线包含 1,792 个 PostgreSQL 目录对象，去除了业务行、客户绑定、Owner 和凭据，保留必要的当前 ACL 以避免函数 `PUBLIC EXECUTE` 权限回退。12 个已被基线结构覆盖的迁移写入独立覆盖账本，不伪写为已执行迁移。

## 版本化制品

| 制品 | SHA-256/事实 |
| --- | --- |
| 基线 Manifest | `eiscore-db-v1`；指纹见 `database/baselines/eiscore-db-v1/manifest.json` |
| Schema | `dbcd35e8cc93254dd285a89a9fa210151a9490a60fa55cc287b2f566a7874a28` |
| 对象目录 | `596e8a54406314001a8788bb0f006da48f014d7e9c057aaa0ac19aa535d59265`；1,792 个对象 |
| PostgreSQL | 16.11；镜像 digest 固定为 `sha256:f992505e18f114c1e5102ac4dcf00f791b44462f6a423d899320f0bbf80e386f` |
| 来源证据 | 隔离 G3.5 dump SHA-256 `C79E8D8F9640DD07A20FB6F03F4C5D036DBE7B8510C52EAEA9F00CD8B2E9A9E5`；不属于发布输入 |

## 关键证据

- `npm run db:baseline:check`：通过；验证 Manifest、Schema、对象目录、注册脚本、覆盖迁移、确定性 `pg_dump` restrict key、无业务数据/客户绑定/Owner/凭据。
- `npm run test:database-baseline:docker`：通过；fresh-install 与 G3.5 predecessor upgrade 最终 Schema SHA-256 完全相同，均为 `dbcd35e8cc93254dd285a89a9fa210151a9490a60fa55cc287b2f566a7874a28`。
- fresh-install：`schema_migrations=0`、`baseline_migration_coverage=12`、业务表全为 0 行。
- predecessor upgrade：只执行 company-site/core 两个实际待执行迁移；重复运行保持 `schema_migrations=2`，不会重放已覆盖迁移。
- `npm run test:secrets`：通过；6 项旧转储命中已因文件从当前版本移除而消失，5 项历史 SQL 命中由 SHA-256 锁定隔离清单保留，日志不输出值。
- 两次失败尝试均在临时无网络容器内自动清理；现有 `eiscore-g35-*` 栈未被写入或重建。

## 初始化顺序

1. `env/init_roles.sql`
2. `database/baselines/eiscore-db-v1/schema.sql`
3. `database/baselines/eiscore-db-v1/register.sql`
4. `scripts/configure-database-runtime-secret.sh`（只在新数据库首次初始化时，把部署提供的 JWT 密钥写入 `app.jwt_secret`；不包含默认密钥）

升级已有数据库时必须使用受治理迁移运行器和可审计备份证据，不能重新挂载旧完整转储。

## 未完成与风险

- DB2 仍未完成：PostgREST 和 Agent Runtime 目前仍以 `postgres` 运行；角色 owner/migrator/authenticator/agent_service 及最小权限尚未收敛。
- 旧完整转储仍存在于本地 Git 历史和隔离审计证据；任何远端推送前必须清理历史泄漏并轮换曾暴露的凭据。本任务未替用户执行撤销/轮换。
- 基线保留了现行 ACL 作为安全下限；DB2 将把它们转换为明确的角色与默认权限契约。
