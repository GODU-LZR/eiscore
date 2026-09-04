# EISCore 数据库授权矩阵（core-003）

## 目的

本矩阵记录数据库治理副本中 `company_site` 与 `hr` 的运行时权限边界。它不是客户初始化数据，也不改变原始仓库和生产数据库。

## 角色边界

| 角色 | 访问方式 | 允许范围 |
|---|---|---|
| `eiscore_owner` | 非登录 Owner | 仅对象所有权和受控维护，不作为应用连接身份 |
| `eiscore_migrator` | 一次性迁移 | 通过 `SET ROLE` 执行已审核迁移 |
| `eiscore_authenticator` | PostgREST | 只切换到 `web_anon` 或 `web_user` |
| `eiscore_agent` | Realtime/BFF 直连 | 受表 ACL 与 RLS 约束；不得删除业务表数据，不得 DDL |
| `web_anon` | 匿名 API | `company_site` 不直接暴露；HR 无表权限 |
| `web_user` | 登录 API | 由 JWT、角色矩阵和逐表 RLS 决定 |

## company_site

企业站通过 Realtime BFF 访问，不通过 PostgREST 暴露表。28 张表统一使用 `company_site_agent_access`：

- 连接身份必须是 `eiscore_agent`；
- 所有行必须属于单租户 `site_key = 'primary'`；
- `product_locales` 没有 `site_key`，通过父表 `products` 的 `site_key` 校验租户；
- BFF 保留现有业务白名单和审批逻辑，RLS 只负责数据库最后一道边界。

## hr

| 表 | `web_user` 查询 | `web_user` 写入 | 删除 | Agent |
|---|---|---|---|---|
| `archives` | HR 查看权限 + `hr_employee` 数据范围 | HR 写权限 + 同一数据范围 | 管理权限 + 同一数据范围 | 直连读写 |
| `employee_profiles` | 同上 | 同上 | 同上 | 直连读写 |
| `attendance_records` | HR 查看权限 + `hr_attendance` 数据范围 | HR 写权限 + 同一数据范围 | 管理权限 + 同一数据范围 | 直连读写 |
| `attendance_month_overrides` | 同上 | 同上 | 同上 | 直连读写 |
| `attendance_shifts` | 同上 | 同上 | 同上 | 直连读写 |
| `payroll` | 薪资专项授权 + `hr_payroll` 数据范围 | 薪资写授权 + 同一数据范围 | 同写入边界 | 直连读写 |
| `user_employee_links` | 仅管理员或具备 HR 用户/员工管理权限的 `hr_admin` | 同查询；触发器固定审计时间和操作者 | 同查询 | 直连读写，不可 DELETE |
| `v_attendance_daily/monthly` | 继承底层考勤 RLS | 只读 | 不适用 | 不作为 Agent 写入口 |

两个考勤视图设置 `security_invoker = true`，避免视图 Owner 绕过底层 RLS。

## 身份与数据范围

`core-005` 建立 `public.users.id` 到 `hr.archives.id` 的一对一稳定桥接。`self` 是无显式范围时的失败关闭默认；`dept`、`dept_tree` 只使用目标用户的部门 UUID 和 `public.dept_tree_ids`；`all` 可访问未桥接员工与临时工。姓名、工号、部门文本和考勤快照字段都不参与身份推断。JWT 可通过 `username`、数字 `sub` 或兼容用户名式 `sub` 定位稳定用户 ID。

未建立桥接的普通登录用户看不到员工明细；部署企业数据时必须把桥接数据作为显式、可审计的客户初始化步骤。薪资在数据范围之外继续要求薪资专项权限，不能由宽泛 `module:hr` 获取。

## 动态表和测试表

- `data_app_<hash>` 是运行时动态应用表，不在核心领域中声明；创建必须经过 `app_center.create_data_app_table`，并由应用元数据和权限矩阵管理。
- `eiscore_chain_test_records` 是测试夹具，`core-004` 从安装数据库中退出；业务链测试会在隔离运行时重新创建并清理。

## 后续 Schema 边界

新对象不得继续进入 `public`。优先在对应领域 Schema 建立新表和函数；旧 `public` 对象按业务域、依赖图和 API 契约逐批迁移，不做一次性搬迁。
