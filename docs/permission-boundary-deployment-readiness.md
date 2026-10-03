# EISCore 权限边界与经营助手部署前检查

检查日期：2026-09-30（Harness 迁移复核）

## 结论

本地权限边界与经营助手业务快照已迁移到 Harness Gateway/Tool Gateway，并完成离线回归验证。本次复核没有连接远端、没有写入业务数据库卷、没有部署线上服务；真实 Provider、外部 client-plugin 制品和双租户线上验收仍未完成。

## 已验证范围

- 本体语义上下文通过 `agent_ontology_context` 获取，并要求有效的角色范围上下文。
- 上下文来源必须是 `agent_ontology_context_v1`；来源不明或非角色范围上下文会被拒绝。
- 经营助手快照按模块 capability 过滤业务域；无权限域不会发起 PostgREST 查询。
- 业务快照查询字段经过字段 ACL 过滤，返回结果再次脱敏。
- 数字分身工具每次调用刷新权限上下文，未授权能力和字段越权会被拒绝。
- 数字分身的员工、组织、物料、库存、仓库和应用查询还要求对应模块 ACL 非空；缺失或撤销时工具隐藏或在查询前拒绝。
- AI Chat 复用同一权限上下文，避免快照请求绕过授权边界。

## 回归命令

以下命令在 `github-eiscore-refactor` 本地执行并通过：

```text
npm run test:harness
npm run test:database-backend-governance
npm run test:database-roles
npm run test:production-config
npm run test:harness-production-path
npm run test:runtime-image
npm run test:syntax
npm run lint:changed
git diff --check
```

## 部署前人工确认

1. 在隔离环境用至少一个低权限角色验证左侧模块、数字分身和智能 BI 的可见范围。
2. 用一个字段 `can_view=false` 的角色确认网络请求的 `select` 和响应都不包含该字段。
3. 确认远端备份、数据库卷和回滚点后，再进行部署演练。
4. 线上验证只允许使用现有域名和现有数据卷；不得把开发数据库或测试凭据带入生产配置。

## 已知部署前置条件

非超级用户的业务域读取还要求对应 `acl_module` 已有 `sys_field_acl` 记录。销售、采购、质量、设备、生产等模块若尚未完成字段 ACL 初始化，会按设计被拒绝读取并记录到 `deniedDomains`，不会回退为公开读取。

## Harness 外部前置条件

- 部署前必须设置 `LUNDU_HARNESS_ROOT`，并通过 `node scripts/validate-lundu-harness-artifacts.mjs` 检查 `eiscore-auth`、`digital-twin`、`enterprise-bi` 三组编译入口。
- 当前重构分支和可追溯远端重构提交均不包含这些 client-plugin 制品；未获得同源制品前，不能宣称 Web 插件或完整 Compose 验收通过，也不得复制 WSL/外部未跟踪目录。
- 真实 DeepSeek Provider 行为、Smart BI 业务回答等价、双租户 RLS 和远端验收必须在对应隔离环境完成后单独记录。
