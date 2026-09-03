# 数据库后端工程化治理计划

> 状态：进行中。DB0、DB1、DB2 已完成，下一步 DB3；G4.1～G4.4 暂停。本计划只操作独立重构仓库和隔离测试栈，不连接客户生产环境。

## 目标边界

PostgreSQL 表、视图、函数、触发器、RLS、角色与授权是 EISCore 的核心后端代码，PostgREST 是 API 网关。数据库治理完成后，每个核心版本必须能从受控基线重建、从上一版本升级、以非超级用户运行、通过真实 PostgREST/RLS 契约测试，并能定位发布版本和恢复点。

数据库核心发布与企业配置分离。企业资料和业务数据不是 Schema；客户差异不得通过客户专属函数、RLS、DDL 或源码分支表达。

## 当前事实基线

| 项目 | 当前状态 | 目标状态 |
| --- | --- | --- |
| 历史 SQL | 106 份仍在工作树；10 份 Runtime V2 历史补丁受治理，96 份未排序；旧完整转储仅在 Git 历史/隔离证据中 | 全部分类；规范基线与后续迁移具有唯一执行入口 |
| 新迁移 | company-site 1 份受独立 Manifest 治理 | 所有新增变化只进入不可变迁移集合 |
| 空库初始化 | `database/baselines/eiscore-db-v1` + `env/init_roles.sql` + 部署密钥注入 | 去客户数据/秘密的版本化基线 + 迁移器 |
| PostgREST 身份 | `postgres` 超级用户连接 | 专用 authenticator 与最小角色切换 |
| Agent 身份 | `postgres` 超级用户连接 | 专用服务角色和最小权限 |
| 镜像 | `postgres:16`、`postgrest/postgrest` 漂移标签 | 固定版本/摘要并记录兼容矩阵 |
| API/RLS 证据 | 大量模拟契约，少量真实完整栈证据 | 每次发布运行真实角色、RLS、RPC 和 Schema Cache 契约 |
| 恢复 | 有备份证据要求，未完成破坏后恢复演练 | 隔离环境恢复演练和可审计恢复点 |

## 执行阶段

### DB0：决策与现状基线（已完成）

- 接受 ADR-0013，冻结 G4.1。
- 建立机器可读的 SQL、迁移、运行身份、镜像和初始化入口盘点。
- 把已知债务做成只减不增的质量棘轮。
- 输出历史 SQL 分类规则和后续接管优先级。

退出：现状数字可重复生成；新增历史 SQL、超级用户连接或漂移镜像不能静默增加。

### DB1：规范基线与迁移收敛（已完成）

- 从隔离验证数据库建立去客户数据、去秘密的规范基线。
- 分类当前 106 份历史 SQL：基线组成、已被替代、种子/演示、运维、补丁和待确认；旧完整转储已从当前发布树移除。
- 所有新变化统一进入迁移 Manifest；空库与上一版本升级产生相同目录契约。
- 建立迁移依赖、锁风险、事务、postcheck 和回退证据。

退出：空库重建和升级等价，历史 SQL 不再是隐含执行入口。详见 `docs/engineering/DB1_EXIT_AUDIT.md`。

### DB2：运行身份、函数与权限治理（已完成）

- 建立 owner/migrator/authenticator/web_anon/web_user/agent_service 角色边界。
- 迁移 PostgREST 与 Agent Runtime，消除 `postgres` 运行依赖。
- 盘点并治理公开 Schema、函数 Owner、`SECURITY DEFINER`、PUBLIC 权限、默认权限和 RLS。
- 为权限收紧提供兼容迁移和回退路径。

退出：隔离完整栈不以超级用户运行；真实匿名、登录与服务角色正/负向测试通过。

结果：`core-002` 建立 owner/migrator/authenticator/agent 与 Web 角色边界，PostgREST 和 Agent Runtime 均改用独立非超级用户身份；应用对象 owner、PUBLIC 函数权限、默认权限和 `SECURITY DEFINER search_path` 已收敛。隔离 PostgreSQL/PostgREST 的密码认证、角色切换、RLS 差异和越权拒绝已由 `npm run test:database-roles:docker` 验证。详见 `DB2_EXIT_AUDIT.md`。

### DB3：数据库与 PostgREST 契约测试

- 在临时 PostgreSQL/PostgREST 栈执行空库、升级和重复迁移测试。
- 生成并对比 Schema、函数、权限、RLS 与 PostgREST API 目录指纹。
- 覆盖 JWT Claims、RPC 参数/返回/错误、越权拒绝和 Schema Cache 刷新。
- 将最小完整栈门禁接入默认 CI；远程测试继续禁止默认运行。

退出：核心数据库变化无法绕过真实数据库与 HTTP 契约门禁。

### DB4：版本化发布与部署

- 生成数据库 Release Manifest，绑定代码提交、镜像、基线、迁移、目录指纹和 postcheck。
- 建立一次性 migrator、预检、备份、升级、健康检查和发布记录。
- 固定 PostgreSQL/PostgREST 版本或镜像摘要，验证兼容矩阵。
- Schema Drift、账本冲突、缺失备份和 postcheck 失败均停止发布。

退出：同一数据库发布制品可重复部署到隔离环境，失败时不会继续切流量。

### DB5：恢复、运行治理与退出审计

- 在隔离环境执行可逆迁移回退和不可逆迁移的破坏后恢复演练。
- 建立备份保留、恢复验证、RPO/RTO、数据库/PostgREST 健康与慢查询证据。
- 复跑完整质量、单元、构建、业务链和产品级真实栈测试。
- 输出数据库治理退出审计，并把最终证据汇入系统重构报告。

退出：目标逐项有当前状态证据，无未披露的生产阻断项；随后才讨论恢复 G4。

## 不可变约束

- 原仓库、客户环境、客户数据库和既有 WSL 数据卷保持只读。
- 未经明确授权不执行任何 `:remote`、生产迁移、密码变更、备份或恢复操作。
- 不丢弃历史 SQL，不猜测未知依赖，不把演示/客户数据并入核心 Schema。
- 每个切片先有 ADR/测试或可复现证据，小提交、可回退，并记录实际验证与未验证项。
