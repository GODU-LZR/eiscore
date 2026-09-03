# DB0 决策与现状基线退出审计

> 审计日期：2026-09-03
> 范围：独立重构仓库的离线源代码与部署契约；未连接或修改任何数据库、客户环境和既有 WSL 数据卷。

## 结论

DB0 已完成。ADR-0013 已将 PostgreSQL Schema、函数、触发器、RLS、角色、授权和 PostgREST API 定义为核心后端发布单元；G4.1～G4.4 已暂停。107 份历史 SQL、11 份受治理迁移、生产初始化入口、公开 Schema、镜像和两个超级用户运行连接均可由单一命令重复盘点并进入默认质量门禁。

## 退出条件

| 条件 | 证据 | 结果 |
| --- | --- | --- |
| 后端边界和最终验收可执行 | ADR-0013、DB0～DB5 计划及回退边界 | 通过 |
| 现状数字可重复生成 | `npm run db:backend:audit` 直接读取文件、Manifest 与生产 Compose | 通过 |
| 107 份历史 SQL 逐文件可审计 | 每项输出路径、字节、SHA-256、类别、处置和文本信号 | 通过 |
| 未知历史文件不被猜顺序 | 9 类完整覆盖；分类文档明确不是执行清单 | 通过 |
| 迁移期债务不能静默扩大 | 默认数据库质量门锁定库存、重复、运行身份、镜像和初始化入口 | 通过 |
| G4 状态不被误报 | G4.0 保持完成，G4.1～G4.4 显式暂停 | 通过 |

## 事实基线

- 历史 SQL：107 份；10 份受 Runtime V2 Manifest 治理，97 份尚未进入可信迁移链。
- 新迁移：company-site 1 份，独立于 107 份历史库存。
- 分类：基线快照 1、环境 Bootstrap 4、受治理迁移 10、Schema 片段 34、历史补丁 39、postcheck 1、参考 Seed 3、演示/测试 9、客户 Seed 6。
- 重复内容：`init_roles.sql`/`env/init_roles.sql` 和 `insert_ai_config.sql`/`env/insert_ai_config.sql` 两组。
- SQL 文本信号：152 处建表、172 处函数、219 处 Policy、73 处启用 RLS、80 处 `SECURITY DEFINER`、302 处 Grant、312 处 Insert。
- 生产运行债务：PostgREST 和 Agent Runtime 各有 1 个 `postgres` 超级用户连接；PostgREST 暴露 6 个 Schema；空库依赖两个 Docker 初始化输入；PostgreSQL 与 PostgREST 镜像尚未固定可发布摘要。

## 验证

- `npm run db:backend:audit`：通过，输出上述实时基线。
- `npm run test:database-backend-governance`：通过，覆盖盘点、分类、重复、迁移期债务、ADR 与计划。
- `npm run test:database-migrations`：通过，保留 11 个迁移、事务、校验和、账本、备份证据和 postcheck 契约。
- `npm run test:g4.0-exit`：通过，证明暂停后未否定 G4.0 已完成事实。
- `npm run test:quality`：通过；数据库治理门禁已从既有 `test:database-migrations` 进入默认质量链。

本检查点使用 Node 26.1.0/npm 11.13.0；正式数据库发布证据仍需在规范 Node 20.19.0/npm 10.8.2 重跑。

## 提交与隔离

- `9bf35e1`：接受数据库后端发布边界、建立 DB0～DB5 计划和首个债务门禁。
- `658255a`：完成 107 份历史 SQL 的逐文件分类、哈希和文本信号盘点。
- 本切片没有执行 SQL、启动 Compose、连接数据库或写入原仓库。
- 审计期间工作区外部删除了一份论文文档和三份经纬素材；这些删除不属于数据库治理提交，Git HEAD 仍保存其完整内容。未擅自恢复或提交外部删除，因此不能把当前双仓库工作树描述为完全干净。

## 剩余风险与下一步

DB0 只证明债务已知且不可静默扩大，不证明数据库可以从空库可靠重建。DB1 必须在隔离栈建立去客户数据与秘密的规范基线，逐步建立 34 份 Schema 片段和 39 份历史补丁的对象覆盖关系，并证明空库路径与升级路径的数据库目录契约一致。
