# 小型企业部门账号与角色种子

`eiscore-hr/sql/hr_small_enterprise_users_roles_seed.sql` 是本地/演示环境的显式初始化脚本，与生产迁移分开。它要求先执行 `hr_small_enterprise_org_seed.sql`，并为组织树中的 18 个部门各创建一组账号：

- 一个绑定该部门的角色，角色编码使用稳定的 ASCII code，角色名称和说明均使用中文。
- 一个使用常见中文姓名的用户，`users.dept_id` 与角色的 `dept_id` 指向同一部门。
- 用户密码统一为 `123456`，仅用于本地演示；脚本不会覆盖同名的非本脚本账号。
- 账号通过 `user_roles` 关联到对应角色，权限为工作台、人事模块、花名册和部门架构的查看权限。
- `role_data_scopes.hr_employee` 按部门绑定数据范围：总部和中心节点使用 `dept_tree`，叶子部门使用 `dept`。

脚本使用事务、稳定的角色编码和本地标记，可重复执行。执行前确保 `public.permissions` 已由当前权限种子/迁移建立；脚本会在目录或部门数量不完整时回滚。

示例执行方式（UTF-8，避免 PowerShell 管道破坏中文）：

```powershell
docker cp eiscore-hr/sql/hr_small_enterprise_users_roles_seed.sql eiscore-db:/tmp/hr_small_enterprise_users_roles_seed.sql
docker exec eiscore-db psql -U postgres -d eiscore -v ON_ERROR_STOP=1 -f /tmp/hr_small_enterprise_users_roles_seed.sql
```

该演示种子不改变已有 `hr_admin`、`hr_clerk`、`dept_manager`、`employee`、`admin` 账号，也不替代生产环境的密码策略、RLS 或服务端权限校验。
