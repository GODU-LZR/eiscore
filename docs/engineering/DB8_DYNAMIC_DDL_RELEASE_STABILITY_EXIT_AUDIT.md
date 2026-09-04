# DB8 动态 DDL 与发布稳定性退出审计

## 结论

DB8 已完成。“动态 DDL 安全＋PostgREST 就绪稳定＋发布互斥/超时”已形成代码、不可变迁移、版本化策略、发布制品和真实隔离验证闭环。所有工作仅发生在 `github-eiscore-refactor` 的 `codex/systematic-refactor` 分支和随机命名临时 Docker 栈；原仓库、客户/生产环境、现有容器、镜像、卷与 G4 企业配置在途成果均未被修改或清理。

## 动态 DDL

- 新增不可变迁移 `core-007`，历史 v1 基线和 `core-001`～`core-006` 保持不变。
- `app_center.create_data_app_table(uuid,text,jsonb)` 保持调用签名，只允许 JWT `super_admin` 或专用 `eiscore_agent` 会话执行。
- 应用必须存在且类型为 `data`/`flash`；表名/字段名执行严格小写标识符校验，列数上限 100，类型限于既有白名单；重复字段、保留字段、表绑定冲突及既有列类型冲突均在事务中失败。
- `data_app_table_registry` 固定一应用一物理表、字段快照和实际列目录；存量 10 张 `data_app_<hash>` 表未被删除，因没有权威应用配置而标记 `quarantined`。
- 所有注册动态表撤销 `PUBLIC/web_anon`，启用 RLS；`web_user` 保留既有登录后 CRUD 兼容，Agent 保留 SELECT/INSERT/UPDATE。成功 create/alter/adopt 写 `data_app_ddl_audit`；拒绝事件依靠 PostgreSQL 错误日志，避免失败事务伪造成功审计。

## PostgREST 就绪

- 根路径成功只作为进程就绪信号，并要求连续稳定响应。
- reload 前记录候选容器日志游标，`NOTIFY pgrst, 'reload schema'` 后必须观察到新的 `schema cache loaded`。
- 双角色（`web_anon`/`web_user`）× 七 Schema OpenAPI Catalog 必须连续三次等于契约；每次 HTTP 最长 5 秒、reload 总计 30 秒。
- 超时错误包含 reload 是否确认、稳定样本数、总 SHA、最后错误以及逐角色/Schema 的预期/实际 SHA，不能以瞬态命中写发布成功账本。

## 发布、恢复与超时

- `eiscore-db-v6` 固定同一 64 位 advisory lock key。发布与恢复各自启动持续存活的 `psql` 会话持锁，跨后续独立连接保持互斥。
- 锁等待 30 秒、holder 退出 5 秒、发布总预算 20 分钟、恢复总预算 30 分钟；Docker/备份/恢复/HTTP 仍有更细粒度超时。
- 18 个迁移逐项声明：锁等待 10 秒、语句 5 分钟、空闲事务 1 分钟；运行器在同一迁移事务内用 `SET LOCAL` 强制执行。
- 正常或异常路径都在 `finally` 释放；真实测试终止持锁 PostgreSQL backend 后，服务端自动清除 advisory lock，随后发布锁可重新获取，不存在陈旧租约行。

## 制品指纹

- Release：`eiscore-db-v6`
- Source revision：`b9a3831d08aeb7056ee8a5997ca8b57ae270ca08`
- Release Manifest SHA-256：`58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`
- Database Catalog SHA-256：`c45944529f41b5be49487e637b291676d470a35f02b4423a68372b123fc0afde`
- PostgREST OpenAPI SHA-256：`8deef985f62ad1020b4107dc46e5cec054fe7f1d912b77aaef3c6ad86a720001`
- Catalog：7 个应用 Schema、199 个关系、168 个函数、319 个 Policy、83 个触发器。

## 验证证据

通过：

- `npm run test:database-migrations`
- `node scripts/test-database-contracts.mjs`
- `node scripts/test-database-operation-lock.mjs`
- `node scripts/test-database-release.mjs`
- `node scripts/test-database-recovery.mjs`
- `npm run test:database-roles:docker`
- `npm run test:database-company-site-bff:docker`
- `npm run db:release:check`

动态 DDL 真实 HTTP/SQL 测试覆盖员工拒绝且无半成品、管理员创建、Agent 创建、重复幂等、表碰撞、非法标识符、列类型冲突、匿名拒绝、登录用户写入、RLS/ACL/注册/审计。发布测试覆盖升级、重复发布、备份证据、Schema/public 漂移和迁移账本冲突失败关闭。恢复测试先写数据哨兵并破坏源 Schema，再恢复到全新空栈；首次运行捕获 identity sequence ACL 目录差异并停止，增加恢复规范化后数据、角色、Catalog、稳定 PostgREST 和恢复账本全部通过。

## 保留边界

- RLS 当前保持原产品的“所有登录用户共享动态表”兼容语义；逐应用、逐角色或逐记录授权仍需独立产品设计，不能由数据库迁移猜测。
- 10 张存量孤儿动态表未删除；需要企业/应用权威元数据后才能从 `quarantined` 受控接管。
- 生产备份存储/KMS、生产容器日志读取权限、生产容量与真实恢复时延仍需在目标环境获得授权后验证。本轮结果不是三家企业生产上线批准。
