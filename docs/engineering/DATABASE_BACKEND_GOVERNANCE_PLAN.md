# 数据库后端工程化治理计划

> 状态：已完成。DB0～DB6 全部退出；G4.1～G4.4 暂停并继续保持，是否恢复由用户另行决定。本计划只操作独立重构仓库和隔离测试栈，不连接客户生产环境。

## 目标边界

PostgreSQL 表、视图、函数、触发器、RLS、角色与授权是 EISCore 的核心后端代码，PostgREST 是 API 网关。数据库治理完成后，每个核心版本必须能从受控基线重建、从上一版本升级、以非超级用户运行、通过真实 PostgREST/RLS 契约测试，并能定位发布版本和恢复点。

数据库核心发布与企业配置分离。企业资料和业务数据不是 Schema；客户差异不得通过客户专属函数、RLS、DDL 或源码分支表达。

## 当前事实基线

| 项目 | 当前状态 | 目标状态 |
| --- | --- | --- |
| 历史 SQL | 106 份仍在工作树；15 个迁移受三个 Manifest 治理，96 份历史 SQL 尚未纳入迁移链；旧完整转储仅在 Git 历史/隔离证据中 | 全部分类；规范基线与后续迁移具有唯一执行入口 |
| 新迁移 | Runtime V2、company-site、core 共 15 个不可变迁移受 Manifest 与 checksum 治理 | 所有新增变化只进入不可变迁移集合 |
| 空库初始化 | `database/baselines/eiscore-db-v1` + `roles-v2.sql` + 后续迁移 + 部署密钥注入；fresh/upgrade 目录等价 | 去客户数据/秘密的版本化基线 + 迁移器 |
| PostgREST 身份 | 专用非超级用户 `eiscore_authenticator`，只切换 Web 角色 | 在发布门禁持续验证最小角色切换 |
| Agent 身份 | 专用非超级用户 `eiscore_agent`，无 DELETE、DDL、owner 提权或 BYPASSRLS | 在发布门禁持续验证最小权限 |
| 镜像 | PostgreSQL、PostgREST、Swagger、code-server 均固定摘要 | 固定版本/摘要并记录兼容矩阵 |
| API/RLS 证据 | 隔离栈已覆盖真实角色、RLS、RPC、七 Schema OpenAPI 与 Schema Cache reload | 每次发布运行相同真实契约门禁 |
| 恢复 | v4 继承环境与加密存储证据要求；已完成事务回退验证、源 Schema 破坏和空栈恢复 | 生产发布时落实真实存储/KMS、保留任务与恢复演练 |

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

### DB3：数据库与 PostgREST 契约测试（已完成）

- 在临时 PostgreSQL/PostgREST 栈执行空库、升级和重复迁移测试。
- 生成并对比 Schema、函数、权限、RLS 与 PostgREST API 目录指纹。
- 覆盖 JWT Claims、RPC 参数/返回/错误、越权拒绝和 Schema Cache 刷新。
- 将最小完整栈门禁接入默认 CI；远程测试继续禁止默认运行。

退出：核心数据库变化无法绕过真实数据库与 HTTP 契约门禁。

结果：`eiscore-db-contract-v2` 已固定数据库目录和七个 PostgREST Schema 的 OpenAPI 指纹；隔离测试同时验证 fresh install、旧角色路径升级、重复迁移、JWT Claims、RPC 正/负参数以及 Schema Cache reload。离线结构棘轮进入 `test:quality`，真实数据库完整套件进入默认 CI。详见 `DB3_EXIT_AUDIT.md`。

### DB4：版本化发布与部署（已完成）

- 生成数据库 Release Manifest，绑定代码提交、镜像、基线、迁移、目录指纹和 postcheck。
- 建立一次性 migrator、预检、备份、升级、健康检查和发布记录。
- 固定 PostgreSQL/PostgREST 版本或镜像摘要，验证兼容矩阵。
- Schema Drift、账本冲突、缺失备份和 postcheck 失败均停止发布。

退出：同一数据库发布制品可重复部署到隔离环境，失败时不会继续切流量。

结果：`eiscore-db-v2` Release Manifest 精确绑定 Git 提交、39 个执行/验证输入、固定镜像、规范基线、13 个迁移、postcheck 和 DB/PostgREST 指纹。一次性发布作业按离线验签、漂移/账本预检、可验证备份、迁移、密钥注入、候选 API 契约和成功账本执行；隔离演练证明升级与重复部署通过，Schema Drift 和账本冲突均在新增备份与成功记录前失败。详见 `DB4_EXIT_AUDIT.md`。

### DB5：恢复、运行治理与退出审计（已完成）

- 在隔离环境执行可逆迁移回退和不可逆迁移的破坏后恢复演练。
- 建立备份保留、恢复验证、RPO/RTO、数据库/PostgREST 健康与慢查询证据。
- 复跑完整质量、单元、构建、业务链和产品级真实栈测试。
- 输出数据库治理退出审计，并把最终证据汇入系统重构报告。

退出：目标逐项有当前状态证据，无未披露的生产阻断项；随后才讨论恢复 G4。

结果：`eiscore-db-v3` 将 DB5 运维与恢复输入并入不可变发布制品；发布必须声明隔离/生产环境和备份存储证据，生产拒绝隔离证明。策略固定 RPO 24 小时、RTO 2 小时及每日 14/每周 8/每月 12 的保留下限。真实隔离演练在事务内验证 SQL 回退后，写入数据哨兵、删除源 Schema，并把备份恢复至全新空栈；角色、数据、数据库目录、七 Schema PostgREST 契约和运行审计全部通过。运行证据为 0 超级用户连接、0 角色越界、0 阻塞、0 超时长事务，慢查询不记录 SQL 正文；`pg_stat_statements` 未安装仅作为提示。详见 `DB5_EXIT_AUDIT.md`。

### DB6：数据库结构与领域权限收口（已完成）

- 让 company-site 的真实 Realtime/BFF 链以专用 `eiscore_agent` 身份通过 RLS，不为兼容而恢复 Owner 或超级用户连接。
- 为 company-site 28 张表固定 `primary` 单租户边界；`product_locales` 通过父产品校验归属。
- 为 HR 六张基础表建立逐表、逐操作 RLS；薪资访问独立收紧，考勤视图继承调用者权限。
- 从安装数据库退出固定业务链测试表；动态 `data_app_<hash>` 只允许由受控函数、应用元数据和权限矩阵创建及重建。
- 冻结 public Schema 渐进拆分规则：新领域对象禁止进入 `public`，旧对象按依赖和 API 契约逐批迁移，不做大爆炸搬迁。
- 生成 `eiscore-db-v4`，并以 fresh/upgrade/repeat、数据库/PostgREST 契约、发布/恢复及真实企业站 BFF 链验证结构结果。

退出：结构对当前单企业隔离部署是合理且可治理的，但不宣称完全理想或生产批准；HR 本人/部门隔离必须等待稳定的登录用户—员工档案身份桥接，96 份历史 SQL、public Schema 存量债务及三家真实数据/生产容量继续显式保留。详见 `DB6_DATABASE_STRUCTURE_GOVERNANCE_EXIT_AUDIT.md`。

结果：`core-003` 新增 company-site/HR 的最小 RLS 和考勤视图调用者安全，`core-004` 退出固定测试表；数据库契约固定为 196 个关系、161 个函数、297 个 Policy、82 个触发器和 292 个 PostgREST Path。真实 HTTP 回归使用 `eiscore_agent` 覆盖公开读取、后台鉴权、草稿、发布、询盘、销售 Agent、资格判断、审批和报价；v4 Manifest SHA-256 为 `8113f0325ac11ca5e1fa056f35e1ceaf603b4a3709a9a71493b08f9dc85fcbda`。

### DB7：主要剩余数据库债务收口（已完成）

- 为 96 份非迁移历史 SQL 建立逐文件最终处置账本和默认拒绝执行门禁。
- 以一对一外键桥接登录用户与员工档案，把 `self/dept/dept_tree/all` 应用于 HR 员工行。
- 以规范对象目录建立 `public` Schema 静态、真实 Catalog 和发布前后三层新增对象棘轮。
- 删除无消费者且暴露 JWT/数据库角色的 `public.debug_me`，启动 public 存量只减不增。
- 生成 `eiscore-db-v5` 并复验迁移、权限、数据库/PostgREST、发布、恢复和企业站 BFF。

退出：96/96 文件有可验证最终处置；HR 不使用姓名/工号/部门文本推断身份；新增 `public` 对象必须绑定迁移与 ADR；主要仓库债务不再作为未决项。三家客户数据、生产 KMS/备份和容量仍等待外部环境授权。详见 ADR-0015 与 `DATABASE_MAJOR_DEBT_EXIT_AUDIT.md`。

## 不可变约束

- 原仓库、客户环境、客户数据库和既有 WSL 数据卷保持只读。
- 未经明确授权不执行任何 `:remote`、生产迁移、密码变更、备份或恢复操作。
- 不丢弃历史 SQL，不猜测未知依赖，不把演示/客户数据并入核心 Schema。
- 每个切片先有 ADR/测试或可复现证据，小提交、可回退，并记录实际验证与未验证项。
