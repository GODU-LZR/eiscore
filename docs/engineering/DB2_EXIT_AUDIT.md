# DB2 运行身份、函数与权限治理退出审计

> 结论：DB2 已完成。证据只来自独立重构仓库与一次性隔离测试栈；没有连接客户环境，没有运行 `:remote` 命令，也没有读取或修改既有 `eiscore-g35-*` 容器和数据卷。

## 已落地边界

| 身份 | 登录 | 继承 | 超级用户 / BYPASSRLS | 权限边界 |
| --- | --- | --- | --- | --- |
| `eiscore_owner` | 否 | 否 | 否 / 否 | 统一拥有应用 Schema、表、序列、视图和函数，不承担运行连接 |
| `eiscore_migrator` | 否 | 否 | 否 / 否 | 具有显式 `SET ROLE eiscore_owner` 路径；正式一次性迁移入口由 DB4 发布流程启用 |
| `eiscore_authenticator` | 是 | 否 | 否 / 否 | PostgREST 连接身份，只能切换为 `web_anon`、`web_user` |
| `eiscore_agent` | 是 | 否 | 否 / 否 | Realtime 直连身份；应用表仅 SELECT/INSERT/UPDATE、序列使用和少量明确函数；没有 DELETE、DDL、owner 或角色提权 |
| `web_anon` | 否 | 否 | 否 / 否 | PostgREST 匿名角色，保留基线中显式登记的公开读取/RPC 契约 |
| `web_user` | 否 | 否 | 否 / 否 | JWT 登录角色，继续受现有 RLS 与 Claims 判定约束 |

PostgREST 使用独立 `POSTGREST_DB_PASSWORD`，Agent Runtime 使用独立 `AGENT_DB_PASSWORD`；两者和管理员密码禁止复用、禁止默认值、禁止写入 SQL。六个运行相关角色的超级用户和 `BYPASSRLS` 数均为 0，生产 Compose 中超级用户运行连接由 2 个降为 0。

## 函数、Owner 与 RLS

- `core-002` 把 7 个应用 Schema 内的数据库对象统一归属非登录 `eiscore_owner`。
- 7 个应用 Schema 均撤销 PUBLIC CREATE；应用函数与默认函数权限均撤销 PUBLIC EXECUTE。
- 73 个既有 `SECURITY DEFINER` 函数全部要求固定 `search_path`；已有安全路径保持不变，历史遗漏采用明确且把 `pg_temp` 放在末尾的受控路径。
- Agent 没有使用 `BYPASSRLS`。已有明确指向 `web_user` 的策略只追加 `eiscore_agent`，文档采集策略通过 `session_user` 识别服务身份；Workflow/App Center 的管理员谓词保留原逻辑并增加服务身份分支。
- Realtime 六个直接建池入口和通知/Workflow 链统一使用 `realtime/database-config.js`，固定 `postgres/postgres` 与 `localhost` 回退已清零。

## 可重复证据

已通过：

```text
npm run db:baseline:check
npm run test:database-migrations
npm run test:database-roles
npm run test:database-roles:docker
npm run test:production-config
npm run test:infrastructure
npm run test:runtime-router
npm run test:document-intake
npm run test:document-parser
npm run test:document-planner
npm run test:document-entry
npm run test:document-fixed-entry
```

Docker 门禁使用随机名称、tmpfs 数据目录、随机测试密码和本机回环端口，并在 `finally` 中删除容器与网络。它实际验证：

1. 基线 + `core-002` 初始化及迁移器幂等登记；
2. Agent 与 authenticator 的密码认证和 Web 角色切换；
3. 匿名公开读取成功，匿名受保护读取和写入被拒绝；
4. 普通 JWT 用户看不到受 RLS 保护的文档行，管理员 Claims 可以看到；
5. Agent SELECT/UPDATE 成功，DELETE、PUBLIC DDL 和 owner 提权被拒绝；
6. PostgREST 活跃连接使用 `eiscore_authenticator`，运行服务超级用户连接为 0。

## 升级与回退

已有数据库先通过受治理的 `core-002` 迁移建立角色/权限，再注入两个新的独立服务密码，最后切换 PostgREST 和 Agent Runtime；不可颠倒为先切调用方。迁移涉及 owner、默认权限和 RLS，回退策略是经过 DB5 演练的备份恢复，不提供未经验证的反向授权脚本。

当前 v1 基线仍是不可变历史基线，只声明其创建时覆盖的 12 个迁移。新装 Compose 在 v1 后应用 `core-002`；DB4 会把迁移账本、一次性 migrator 和正式发布 Manifest 收敛为唯一发布入口。客户环境尚未执行角色创建、密码轮换或连接切换。
