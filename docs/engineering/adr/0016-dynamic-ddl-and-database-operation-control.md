# ADR-0016：动态 DDL 与数据库发布操作控制

## 状态

已接受，2026-09-05。

## 背景

EISCore 没有传统应用后端，PostgreSQL 函数与 PostgREST 共同承担服务端边界。历史 `app_center.create_data_app_table` 是 `SECURITY DEFINER`，允许所有登录用户传入表名、执行 DDL，并自动授予匿名读取；存量 `data_app_<hash>` 表没有统一注册和 RLS。另一方面，发布和恢复由多个独立 `psql` 连接组成，没有跨进程互斥，迁移继承集群的无限超时，PostgREST 仅凭根路径和一次 OpenAPI 命中判断就绪，曾出现 Schema Cache 启动瞬态指纹漂移。

## 决策

1. 历史基线与既有迁移保持不可变，所有结构修复进入 `core-007`。
2. 动态 DDL 仍通过兼容签名 `create_data_app_table(uuid,text,jsonb)` 提供，但只有 JWT `app_role=super_admin` 或专用 `eiscore_agent` 会话可以执行。表名和字段名必须是小写安全标识符，字段类型限于既有白名单，应用类型限于 `data`/`flash`。
3. `data_app_table_registry` 建立一个应用到一个物理表的恢复级绑定；已存在且能够唯一匹配应用配置/确定性名称的表被接管，其余表标记为 `quarantined`，不猜测归属、不删除数据。成功 DDL 写入独立审计表。
4. 所有受治理动态表撤销 `web_anon`，启用 RLS，并为 `web_user` 保留现有登录后数据兼容访问；Agent 继续只有 SELECT/INSERT/UPDATE 表级权限。更细的逐应用数据授权属于后续产品权限模型，不能由本迁移猜测。
5. 发布和恢复通过持续存活的 `psql` 会话获取同一个 64 位 PostgreSQL advisory lock。锁等待有上限；正常退出在 `finally` 中释放，进程或后端崩溃由 PostgreSQL 会话生命周期自动清理，不引入可能陈旧的应用锁行。
6. 每个迁移 Manifest 必须声明锁、语句和空闲事务超时，运行器在迁移事务中使用 `SET LOCAL`。备份、恢复、Docker 命令、HTTP 请求、Schema Cache reload 和整体作业使用版本化操作策略中的时间预算。
7. PostgREST reload 必须观察到候选容器新增的 `schema cache loaded` 日志事件；随后双角色、七 Schema OpenAPI 总指纹必须连续三次与发布契约一致。超时报告总指纹和逐角色/Schema 差异并失败关闭。

## 后果

普通员工不再能通过 RPC 改变 Schema，匿名访问不再看到动态表；已有登录用户数据表访问保持。旧孤儿表仍占用 Schema，但变成显式隔离资产，可由权威应用配置在后续受控调用中接管。发布/恢复不能在同一目标数据库并发执行，也不会无限等待数据库锁或 PostgREST 缓存。候选容器日志成为就绪证据的一部分，因此部署身份必须具有读取该容器日志的权限；权限缺失会按失败关闭处理。

## 回退

`core-007` 涉及权限收紧、注册数据与函数替换，只支持发布前备份恢复。不得用反向 SQL 重新开放普通用户 DDL 或匿名动态表访问。发布执行器可回退到上一版本源码和 `eiscore-db-v5`，但数据库结构回退仍必须恢复对应备份。
