# DB6 数据库结构治理退出审计

> 结论：EISCore 当前数据库结构对“每家企业独立 PostgreSQL/PostgREST/Realtime、共用同一核心制品”的首批落地方式总体合理，已经具备可迁移、可审计、可发布和可恢复的工程基础，但不是完全理想的终态，也不等于三家企业生产上线批准。DB6 只修改独立重构仓库并使用随机命名、结束后销毁的隔离测试栈；原仓库、生产环境和既有 `eiscore-g35-*` 均未修改。G4/G5 继续暂停。

## 结构判断

PostgreSQL 函数与 PostgREST 可以承担当前系统的主要后端职责，不要求为了“工程化”强行增加传统 Web 后端。正确边界是：PostgreSQL 保存领域状态、约束、RLS 和事务函数；PostgREST 提供受角色约束的 CRUD/RPC；Realtime/BFF 承担企业站编排、令牌校验、审批白名单和流式能力；迁移、发布、备份与恢复由运行后退出的控制面作业完成。

当前 `eiscore-db-contract-v2` 固定以下可重复目录：

| 项目 | 当前值 |
| --- | ---: |
| 应用 Schema | 7 |
| 关系 | 196 |
| 函数 | 161 |
| RLS Policy | 297 |
| 触发器 | 82 |
| 数据库目录 SHA-256 | `8774f45d426a0892e8ac9812cd415bf8832a2929053d30768c084c0120e1e740` |
| PostgREST Path / Definition | 292 / 204 |

合理之处是领域 Schema 已覆盖 `company_site`、`hr`、`scm`、`app_center`、`app_data` 与 `workflow`，运行身份不使用超级用户，Schema、函数、角色、RLS、PostgREST OpenAPI 和发布前驱均进入机器契约。仍不理想之处是 `public` 承载较多历史领域对象、HR 缺少用户与员工身份桥接、动态应用表需要额外元数据约束，且 96 份历史 SQL 尚无可信全局顺序。因此本次采用渐进治理，不伪造一次性“清理完成”。

## DB6 已完成的结构收口

`core-003` 为 company-site 28 张表建立同名 `company_site_agent_access` Policy。数据库连接必须是 `eiscore_agent`，有 `site_key` 的表只接受 `primary`；唯一没有 `site_key` 的 `product_locales` 通过父 `products` 记录确认租户。表 ACL 继续禁止 Agent 删除和 DDL，RLS 是 BFF 业务白名单之外的最后一道数据库边界。

HR 的 `archives`、`employee_profiles`、`attendance_records`、`attendance_month_overrides`、`attendance_shifts` 和 `payroll` 全部启用 RLS。普通 HR 表按查看、创建、编辑、删除权限分开；`payroll` 不继承宽泛的 `module:hr` 查看权限，只允许管理员、`hr_admin` 或显式 payroll 权限。`v_attendance_daily` 和 `v_attendance_monthly` 使用 `security_invoker=true`，避免视图 Owner 绕过底层 RLS。

`core-004` 从安装数据库移除 `app_data.eiscore_chain_test_records`。该对象是测试夹具，不是产品领域表；业务链测试需要时只能在隔离环境创建并清理。`data_app_<hash>` 仍是合法的运行时动态表，但只能经 `app_center.create_data_app_table` 和应用元数据/权限矩阵管理；恢复时必须由版本化应用元数据重建，禁止任意 SQL 或名称猜测创建。

## public Schema 渐进拆分规则

1. 新业务表、视图、函数、类型和触发器不得进入 `public`；应进入现有领域 Schema，或经 ADR 批准新增领域 Schema。
2. `public` 只允许保留尚未迁移的兼容对象和 PostgreSQL 扩展依赖；任何例外都必须进入新迁移、对象目录和 PostgREST 契约。
3. 旧对象按“业务域归属—函数/触发器/FK 依赖—PostgREST Profile—前端消费者”的顺序分批迁移；需要兼容期时保留受测 facade，不原地改名破坏客户端。
4. 每批迁移必须具备 fresh/upgrade/repeat、权限正负向、PostgREST Schema Cache、备份恢复和回退证据；不得用一次大爆炸搬迁替代依赖分析。
5. 质量门禁应阻止新的未批准 `public` 对象，并只允许存量持续下降。

## 真实功能与发布证据

`scripts/test-company-site-bff.mjs` 在随机临时 PostgreSQL 中，从规范基线和三个 Manifest 重建数据库，以密码认证的真实 `eiscore_agent` 连接装配现有 HTTP Router、company-site Handler 与 sales-agent Handler。测试通过以下链路：公开站点读取、后台未登录拒绝、后台读取、草稿更新、发布快照与域名切换、公开询盘及幂等、后台询盘列表、Sales Agent 会话/消息/知识引用、Agent 线索、资格判断、商机草稿、普通销售审批拒绝、销售经理审批、报价草稿，以及非 `primary` 租户写入拒绝。

最终数据库制品为 `eiscore-db-v4`，Manifest SHA-256 是 `8113f0325ac11ca5e1fa056f35e1ceaf603b4a3709a9a71493b08f9dc85fcbda`。它绑定 15 个不可变迁移、数据库/PostgREST 契约、备份恢复机制和 `eiscore-db-v1-runtime`、`eiscore-db-v3` 两个合法前驱。专项验证入口为：

```bash
npm run test:database-company-site-bff:docker
npm run test:database-migrations
npm run db:release:check
npm run test:database:docker
node tests/engineering/company-http-regression.mjs
node tests/engineering/company-sales-agent-regression.mjs
npm run test:company-site-runtime
```

这些命令只证明仓库契约和隔离环境；不连接客户或生产环境，不替代真实客户数据迁移、容量和恢复时限验证。

## 明确保留的缺口

- 106 份历史 SQL 中只有 10 份历史 Runtime V2 文件进入可信迁移链；加上新迁移后共有 15 个受治理迁移，但仍有 96 份历史 SQL 只能作为非执行库存。
- HR 没有稳定的“登录用户—员工档案”外键。当前只能安全做到模块/操作级 RLS，不能用姓名、用户名或部门文本猜测本人/部门行级隔离。
- `public` Schema 仍是渐进拆分债务；DB6 只冻结新对象边界，没有冒险搬迁存量对象。
- 动态 `data_app_<hash>` 的可恢复性依赖应用包、元数据和权限矩阵完整；它们不是可以脱离元数据独立维护的手工表。
- 尚未验证伦度机电、君乐缘、经纬网厂的真实配置和数据迁移，也未验证生产备份存储/KMS、保留任务、生产容量、并发、慢查询分位数或真实 AI/OCR/流式上游。

因此当前判断是“结构总体合理，可进入受控企业数据准备和功能验收”，不是“结构完美”或“可以直接切生产”。是否进入 G4 仍由用户另行决定。
