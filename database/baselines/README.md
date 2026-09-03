# 规范数据库基线

每个目录是一个不可变数据库基线发布单元。安装顺序、文件 SHA-256、PostgreSQL 工具版本、来源证据、历史 Schema 接管项和已覆盖迁移均由目录内 `manifest.json` 固定。

基线的 `schema.sql` 只包含 PostgreSQL 结构，不包含客户、演示或业务数据、Owner 或凭据。为避免 PostgreSQL 默认的函数 `PUBLIC EXECUTE` 在恢复时重新生效，当前已验证的 Grant/Revoke 会随结构保留，并在 DB2 收敛为最小角色权限。`register.sql` 只写入基线身份与迁移覆盖元数据，用于让迁移器区分“迁移已执行”和“迁移已由基线结构覆盖”；不得把覆盖项伪写成已执行迁移。

历史来源转储只是本地审计/重建证据，不是发布输入。生产安装只允许使用 Manifest 中的 `installOrder`，后续结构变化必须追加受治理迁移，禁止修改已发布基线。
