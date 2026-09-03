# ADR 0014：数据库 RLS 与 Agent/HR 授权边界

## 状态

已接受，随 `core-003` 和 `core-004` 进入工程化副本；G4/G5 仍未启动。

## 背景

`company_site` 的 28 张表已经启用 RLS，但没有任何策略。DB2 将 Realtime BFF 切换到非 Owner 的 `eiscore_agent` 后，PostgreSQL 的默认拒绝行为会阻断企业站读取、发布、询盘和销售草稿链路。与此同时，HR 表直接通过 PostgREST 暴露，历史 ACL 允许登录用户访问薪资和考勤，却没有统一的 RLS 边界。

## 决策

1. 保留 `company_site` 不直接进入 PostgREST 的部署设计；为 `eiscore_agent` 增加单租户、连接身份和父表约束策略。
2. 为 HR 六张基础表启用 RLS；普通 HR 表按查看/创建/编辑/删除权限分开，`payroll` 只允许管理员、HR 管理员或显式 payroll 权限。
3. 将考勤视图改为 `security_invoker`，使底层 RLS 对 PostgREST 查询生效。
4. 不在没有身份桥接字段的情况下猜测“本人”行级策略；该能力留到单独的身份模型迁移。
5. 从安装数据库退出固定的全链路测试表，保留动态应用表创建函数，并要求动态表由应用包/元数据重建。
6. 所有变更使用有序迁移、postcheck、备份回退和隔离 Docker 验证；不修改历史基线文件。

## 后果

- Realtime 企业站在非超级用户连接模式下可继续工作，且只能操作 `primary` 单租户数据。
- 普通登录用户不能读取 HR 薪资；管理员和 Agent 的既有业务路径保留。
- 数据库目录和 PostgREST 契约发生可审计变化，必须随新发布制品绑定；原 `eiscore-db-v3` 作为历史制品保留。
- HR 的本人/部门行级隔离仍需要稳定的员工身份关联，不能由本 ADR 自动推断。
