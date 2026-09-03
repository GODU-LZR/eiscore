# 历史 SQL 分类基线

> 日期：2026-09-03
> 性质：迁移期只读库存，不是执行清单；分类不构成生产执行授权。

## 可复现入口

```bash
npm run db:backend:audit
npm run db:backend:audit -- --format=json
```

JSON 输出逐文件包含仓库相对路径、字节数、SHA-256、是否已受迁移 Manifest 治理、类别、处置方向，以及建表、函数、Policy、RLS、`SECURITY DEFINER`、Grant 和 Insert 的文本信号。文本信号用于确定审计范围，不等于 PostgreSQL 解析或真实数据库目录结果。

## 106 份仍在工作树中的历史 SQL 分类

| 类别 | 数量 | 当前处置 |
| --- | ---: | --- |
| `environment-bootstrap` | 4 | 拆分角色、环境配置和秘密注入；其中两组内容完全重复 |
| `governed-migration` | 10 | 保持 Runtime V2 不可变迁移、校验和与原顺序 |
| `schema-fragment` | 34 | 对照真实目录后决定纳入规范基线或由新迁移取代 |
| `legacy-patch` | 39 | 建立对象/版本依赖和 superseded 关系；未知顺序前禁止自动执行 |
| `postcheck` | 1 | 保留为 Runtime V2 执行后校验，后续纳入发布目录契约 |
| `reference-seed` | 3 | 从 Schema 分离为可重复的权限/模板参考数据 |
| `demo-or-test` | 9 | 只进入演示或测试数据通道，不进入生产核心基线 |
| `customer-seed` | 6 | 只进入受控客户数据迁移，不进入数据库核心制品 |

所有仍在工作树中的文件均已分类，没有以“未知”为由猜测执行顺序。旧的 `db_schema_and_data.sql` 已在 DB1 基线验证后从当前版本移除；它仍存在于 Git 历史和隔离审计转储中，但不再是发布输入。当前有 10 份历史 SQL 已受 Runtime V2 Manifest 治理；company-site 与 core 迁移位于新迁移目录，不计入上述历史库存。因此仍有 96 份历史 SQL 未被迁移链接管。

## 重复与规模信号

内容完全一致的历史文件有两组：

- `init_roles.sql` 与 `env/init_roles.sql`
- `insert_ai_config.sql` 与 `env/insert_ai_config.sql`

当前工作树文本信号为：127 处建表、141 处函数、215 处 Policy、72 处启用 RLS、73 处 `SECURITY DEFINER`、250 处 Grant、293 处 Insert。旧完整转储的历史信号不再计入当前库存；数字仍受 SQL 注释影响，只用于只减不增盘点，真实对象、权限和函数体由隔离 PostgreSQL 目录审计确认。

## 接管优先级

1. 已固定 `database/baselines/eiscore-db-v1` 规范空库基线；旧完整转储只保留为隔离审计证据，不再作为初始化输入。
2. 再建立 owner、migrator、authenticator 和 agent_service 角色迁移，消除两个超级用户运行连接。
3. 对 34 份 Schema 片段和 39 份历史补丁建立“基线已包含/后续仍需要/已被取代”对象映射。
4. 将参考 Seed、演示/测试 Seed 和客户 Seed 从核心 Schema 发布中物理分离。
5. 使用真实数据库目录和 PostgREST OpenAPI/RPC 目录替代文本信号，形成可比较的发布指纹。

历史 SQL 仍不删除、重命名、合并或批量执行；唯一例外是已由规范基线重建并验证后的旧完整转储，它已从当前发布树移除，Git 历史泄漏必须在任何远端推送前清理。
