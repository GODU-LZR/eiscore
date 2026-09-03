# 历史 SQL 分类基线

> 日期：2026-09-03
> 性质：迁移期只读库存，不是执行清单；分类不构成生产执行授权。

## 可复现入口

```bash
npm run db:backend:audit
npm run db:backend:audit -- --format=json
```

JSON 输出逐文件包含仓库相对路径、字节数、SHA-256、是否已受迁移 Manifest 治理、类别、处置方向，以及建表、函数、Policy、RLS、`SECURITY DEFINER`、Grant 和 Insert 的文本信号。文本信号用于确定审计范围，不等于 PostgreSQL 解析或真实数据库目录结果。

## 107 份历史 SQL 分类

| 类别 | 数量 | 当前处置 |
| --- | ---: | --- |
| `baseline-snapshot` | 1 | 仅作为规范基线候选来源；必须去客户数据/秘密并由隔离重建验证 |
| `environment-bootstrap` | 4 | 拆分角色、环境配置和秘密注入；其中两组内容完全重复 |
| `governed-migration` | 10 | 保持 Runtime V2 不可变迁移、校验和与原顺序 |
| `schema-fragment` | 34 | 对照真实目录后决定纳入规范基线或由新迁移取代 |
| `legacy-patch` | 39 | 建立对象/版本依赖和 superseded 关系；未知顺序前禁止自动执行 |
| `postcheck` | 1 | 保留为 Runtime V2 执行后校验，后续纳入发布目录契约 |
| `reference-seed` | 3 | 从 Schema 分离为可重复的权限/模板参考数据 |
| `demo-or-test` | 9 | 只进入演示或测试数据通道，不进入生产核心基线 |
| `customer-seed` | 6 | 只进入受控客户数据迁移，不进入数据库核心制品 |

所有文件均已分类，没有以“未知”为由猜测执行顺序。当前只有 10 份历史 SQL 已受治理；company-site 的 1 份新迁移位于新迁移目录，不计入上述 107 份历史库存。因此仍有 97 份历史 SQL 未被迁移链接管。

## 重复与规模信号

内容完全一致的历史文件有两组：

- `init_roles.sql` 与 `env/init_roles.sql`
- `insert_ai_config.sql` 与 `env/insert_ai_config.sql`

全库存文本信号为：152 处建表、172 处函数、219 处 Policy、73 处启用 RLS、80 处 `SECURITY DEFINER`、302 处 Grant、312 处 Insert。该数字受 SQL 注释和历史快照影响，只用于只减不增盘点；真实对象、权限和函数体必须由隔离 PostgreSQL 目录审计确认。

## 接管优先级

1. 先固定规范空库基线，证明它能替代 `db_schema_and_data.sql`，同时保留历史快照作对照。
2. 再建立 owner、migrator、authenticator 和 agent_service 角色迁移，消除两个超级用户运行连接。
3. 对 34 份 Schema 片段和 39 份历史补丁建立“基线已包含/后续仍需要/已被取代”对象映射。
4. 将参考 Seed、演示/测试 Seed 和客户 Seed 从核心 Schema 发布中物理分离。
5. 使用真实数据库目录和 PostgREST OpenAPI/RPC 目录替代文本信号，形成可比较的发布指纹。

在对象映射和隔离重建证据完成前，不删除、重命名、合并或批量执行任何历史 SQL。
