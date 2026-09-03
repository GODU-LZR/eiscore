# DB3 数据库与 PostgREST 契约测试退出审计

> 结论：DB3 已完成。证据只来自独立重构仓库与随机命名的一次性隔离 Docker 栈；没有连接客户或生产环境，没有运行任何 `:remote` 命令，也没有读取、停止或修改既有 `eiscore-g35-*` 容器和数据卷。

## 版本化契约

`database/contracts/eiscore-db-contract-v2.json` 将 PostgreSQL 对象目录、PostgREST OpenAPI、固定镜像、规范基线和三个迁移链的终点绑定为同一份机器可比契约。

| 契约面 | 当前受控结果 |
| --- | ---: |
| 应用 Schema | 7 |
| 关系（表、视图、序列等） | 197 |
| 函数 / 过程 | 161 |
| RLS 策略 | 239 |
| 非内部触发器 | 82 |
| 受控角色 / 成员关系 | 6 / 3 |
| 默认权限记录 | 19 |
| PostgreSQL 扩展 | 2 |
| PostgREST 角色 / Schema Profile | 2 / 14 |
| PostgREST 路径 / RPC 路径（双角色合计） | 294 / 74 |
| OpenAPI Definition（双角色合计） | 206 |

数据库目录不仅统计名称，还规范化比较 Schema 和对象 Owner、ACL、列、默认值、约束、索引、视图定义、函数签名与定义、`SECURITY DEFINER` 配置、RLS 谓词、触发器、角色属性、成员关系、默认权限、扩展和数据库级设置名称。ACL 和策略角色按稳定角色名排序，不依赖实例内部 OID。

PostgREST 分别以 `web_anon` 和携带真实 JWT 的 `web_user` 身份，用 `Accept-Profile` 采集 `app_center`、`app_data`、`company_site`、`hr`、`public`、`scm`、`workflow`。门禁先生成每个角色/Schema 的指纹，再生成角色指纹与 14 个文档的总指纹；因此默认 Schema 之外或只对登录用户开放的表、RPC 和授权变化也会触发漂移失败。

## 隔离完整栈门禁

`npm run test:database-contracts:docker` 使用固定摘要的 PostgreSQL 16.11 与 PostgREST 14.4，随机容器名、随机网络、随机测试密码、tmpfs 数据目录、只读仓库挂载和本机回环随机端口，并在 `finally` 中清理自己创建的容器与网络。测试实际覆盖：

1. `roles-v2` + v1 基线 + 当前迁移的 fresh install；
2. 历史 `env/init_roles.sql` + 同一基线 + 当前迁移的升级路径；
3. fresh 与升级路径的完整数据库目录指纹相等；
4. 在已完成状态重复运行迁移后，目录指纹不变；
5. 带 JWT 的 `web_user` 调用 `public.ontology_current_claims()`，参数与返回 Claims 一致；
6. 向无参数 RPC 发送未知参数时返回 HTTP 404 与 `PGRST202`；
7. 发送 `NOTIFY pgrst, 'reload schema'` 后，七个 OpenAPI 文档总指纹不变。

DB1 历史等价测试另使用 `core-through-001.json` 和不可变的 `core-001.sql` postcheck，把证据固定在 DB1 创建时的迁移边界。新增 `core-002` 不会反向改变旧版本基线的预期，当前 DB3 则明确升级到 `core-002`。

## 默认门禁

- `npm run test:database-migrations` 包含离线契约治理测试，校验版本化契约结构、七 Schema 覆盖、完整栈关键断言以及默认 CI 接线，已经进入 `test:quality`。
- `npm run test:database:docker` 统一执行 DB1 基线等价、DB2 角色隔离和 DB3 数据库/PostgREST 契约测试。
- `.github/workflows/ci.yml` 在质量门禁后显式运行上述数据库 Docker 套件，核心数据库变化不能只靠更新 fixture 绕过真实数据库与 HTTP 验证。

本阶段本地已通过：

```text
npm run test:database-baseline:docker
npm run test:database-contracts:docker
npm run test:database-migrations
npm run test:database-roles:docker
npm run test:quality
```

`test:quality` 仅报告既有环境提示：本机 Node 26.1.0/npm 11.13.0 与规范 Node 20.19.0/npm 10.8.2 不同，以及 checksum 锁定历史 SQL 隔离清单内仍有 5 项秘密扫描命中；两项均未新增，所有门禁退出码为 0。

## 未越界与后续

DB3 没有生成数据库 Release Manifest，没有执行正式部署、客户升级、备份恢复或兼容矩阵演练；这些属于 DB4、DB5。当前指纹 fixture 的变更必须和数据库迁移、审查理由及真实隔离栈结果一起提交，不能把直接重写 fixture 当成迁移手段。

下一阶段是 DB4：把代码提交、镜像摘要、规范基线、迁移终点、数据库/PostgREST 指纹、备份证据和 postcheck 绑定为可重复部署的 Release Manifest 与一次性 migrator。G4.1～G4.4 继续暂停。
