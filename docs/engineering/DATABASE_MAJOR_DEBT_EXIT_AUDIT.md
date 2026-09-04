# 数据库主要剩余债务退出审计

> 日期：2026-09-04  
> 结论：仓库内可关闭的三项主要数据库债务已形成代码、迁移、机器门禁和隔离实库证据；G4/G5 未启动，客户/生产外部事项仍明确保留。

## 已关闭债务

### 1. 历史 SQL 最终处置

106 份历史 SQL 中，10 份 Runtime V2 文件继续由不可变迁移 Manifest 管理，其余 96 份全部进入 `database/legacy-sql-resolution.json`。每项包含路径、SHA-256、原类别和最终处置，默认执行策略为 `deny`：73 份由规范基线吸收或以基线终态取代，6 份客户数据、9 份演示/测试、3 份参考数据、2 份重复、1 份被 `core-001` 取代；仅 1 份隔离升级角色夹具和 1 份迁移 postcheck 可在受限上下文执行。

审计器逐次重新枚举真实文件并比对路径、校验和、类别、处置契约和计数。新增、删除、改写、重复登记、未知处置或扩大可执行上下文都会失败。历史文件没有删除、改名或批量执行。

### 2. HR 稳定身份与数据范围

`core-005` 新增 `hr.user_employee_links`，以三个外键约束登录用户、员工档案和操作人，一名用户只绑定一份档案，一份档案也只能绑定一个用户。`hr.current_user_id()` 同时兼容 JWT `username`、数字 `sub` 和旧用户名式 `sub`；后续数据范围只使用稳定 ID。

`self/dept/dept_tree/all` 已落到档案、员工 Profile、考勤记录、考勤月覆盖和薪资 RLS。本人是失败关闭默认；部门和部门树只识别 `public.departments.id`；无桥接用户、无桥接目标和临时工不会被姓名、工号或部门文本猜中。班次作为全局参考数据继续按操作权限管理。薪资需要行范围和薪资专项授权同时成立。

隔离 PostgreSQL/PostgREST 回归已经验证本人、同部门、子部门、无关部门、全量、临时工、薪资双重授权、身份表枚举拒绝、越权更新无影响、本人更新成功、管理员审计，以及数字 `sub` 的身份解析。Agent 仍受非 Owner、无 DELETE/DDL 和 RLS 边界约束。

### 3. public Schema 只减不增

`database/public-schema-ratchet.json` 固定规范基线中的 253 个 `public` 对象身份，当前批准新增例外为 0。门禁覆盖表、视图、物化视图、外部表、序列、函数、过程、类型和触发器：迁移源码静态检查新增声明，真实数据库测试比较 Catalog，发布作业在备份前和迁移后各检查一次。扩展拥有对象不冒充应用对象；未来例外必须同时声明连续 core 迁移与 ADR。

`core-006` 已完成第一个安全下降：删除无产品消费者、曾向 `web_user` 开放的 `public.debug_me` JWT 调试视图，并清理其过期本体语义。没有搬迁高依赖对象，也没有伪造一次性 public 清空。

## 当前数据库契约

三个 Manifest 共 17 个不可变迁移。目标 Catalog 为 7 个应用 Schema、196 个关系、166 个函数、1 个显式应用类型、299 个 Policy、83 个触发器；PostgREST 双角色七 Profile 合计 296 个 Path、78 个 RPC Path 和 204 个 Definition。最终数字和 SHA 以 `database/contracts/eiscore-db-contract-v2.json` 与 `eiscore-db-v5` Release Manifest 为准。

## 验证与边界

仓库验收入口：

```bash
npm run db:migrations:check
npm run db:backend:audit
npm run test:database-migrations
npm run db:release:check
npm run test:database:docker
npm run test:syntax
npm run test:secrets
```

测试只创建随机命名、完成后销毁的临时容器和测试备份目录。没有连接原仓库数据库、三家客户数据库或生产环境，也没有清理 Docker 镜像、卷或 VHDX。

## 仍保留但不属于仓库内可关闭债务

- 伦度机电、君乐缘、经纬网厂真实用户—员工映射、客户参考数据和历史数据转换；
- 生产备份存储、KMS/Vault、保留任务、恢复时限和发布窗口；
- 生产并发、容量、慢查询分位数以及真实 AI/OCR/流式上游；
- 其余高依赖 `public` 对象的逐域迁移；每批仍需消费者、依赖、兼容 facade、PostgREST 和回退证据。

因此本轮退出语义是“主要仓库债务已关闭并可持续防回归”，不是“三家企业已完成数据迁移或获准生产上线”。
