# DB5 恢复、运行治理与数据库工程化退出审计

> 结论：DB5 已完成，DB0～DB5 数据库后端工程化治理闭环成立。验证只使用随机命名、运行后销毁的本机隔离 PostgreSQL/PostgREST 栈；没有连接客户或生产环境，没有运行 `:remote` 命令，也没有读取、停止或修改既有 `eiscore-g35-*` 容器及数据卷。G4.1～G4.4 继续暂停，是否恢复由用户另行决定。

## 发布与备份边界

最终数据库发布制品为 `eiscore-db-v3`，规范 Manifest SHA-256 为 `bcb594fa44b66363509a0a0415f3da3ede7dd35064a7835bbd5bcc30ca592e20`，源码锚点为 `59f84149752e8e9b3f9da61ec275b0195bb0e3a3`。它在 DB4 v2 的基线、13 个迁移和 DB/PostgREST 契约之上，继续绑定 DB5 运维策略、备份审计、恢复账本、恢复后目录归一化、恢复执行器和运行审计，共 45 个执行或验证输入。

每次非 dry-run 发布现在必须显式声明 `isolated` 或 `production` 环境，并提供备份存储证据。允许的证据 URI 为 `isolated://`、`kms://`、`vault://` 或 `volume://`；生产环境拒绝 `isolated://`。备份使用 PostgreSQL custom-format 全库转储和不含角色密码的 globals，记录两个文件的 SHA-256、字节数、发布 Manifest、源码提交、操作者、环境、存储加密证据和 `pg_restore --list` 校验结果。该 URI 是发布编排提供的可审计证明，不替代生产存储系统自身的 KMS、不可变保留或访问日志审计。

`eiscore-database-operations-v1` 固定以下策略：

- RPO：24 小时；最新一个通过完整性校验的备份超过该时限即失败。
- RTO：2 小时；每次恢复记录实际 `recovery_ms`，演练断言不超过 7,200,000 ms。
- 保留：每日 14 份、每周 8 份、每月 12 份；生产备份生命周期配置必须以此为下限。
- 角色 globals 禁止包含密码；生产备份必须带非隔离的加密存储证据。

仓库只提供可重放机制和证据验证，没有伪造三家企业或生产存储证明；首次生产发布前仍须把上述保留规则落实到获授权的实际存储，并保留提供方侧证据。

## 恢复安全与真实演练

恢复执行器失败关闭：备份证据必须与当前发布 ID、Manifest SHA、源码提交及相邻转储文件精确匹配；两个文件重新计算 SHA-256；目标数据库必须为空；操作者必须显式输入与发布 ID 完全相同的 `--confirm-empty-target`；恢复后重新注入独立运行秘密、比较完整数据库目录、启动候选 PostgREST、验证七个 Schema 的 OpenAPI/JWT 契约，最后才写入归属 `eiscore_owner` 的恢复账本。恢复作业不切换流量。

`npm run test:database-recovery:docker` 已完成以下真实演练：

1. 从 v1 前驱发布 v3，在事务中执行 `company-site-001` 的 SQL 回退，并确认 `published_snapshot` 确实消失；随后回滚该验证事务，保持原目录与数据不变。直接物理删列后再重加会改变列序并触发严格 Schema Drift，因此生产级数据库回退仍统一采用已验证备份恢复，不把这份删列脚本宣传为无损回退。
2. 写入唯一 `document_assets` 数据哨兵，再执行第二次发布并生成最新可验证备份。
3. 停止源 PostgREST，删除源库 `public.document_assets`，确认破坏已经发生。
4. 启动全新的空 PostgreSQL/PostgREST 栈，从备份重建六个应用角色、全部 Schema 与数据，并执行扩展函数 Owner 归一化。
5. 确认数据哨兵为 1 条、发布账本为 1 条、恢复账本为 1 条，数据库规范目录与 DB3 指纹完全一致，匿名/登录角色下七个 PostgREST Schema 契约通过。

这同时证明 `pg_dump/pg_restore` 不会保留 `pgcrypto` 扩展函数 Owner 的差异已由专用 `database/recovery/post-restore-v2.sql` 收敛；恢复过程不会重放 `core-002` 或篡改历史迁移账本。

## 运行治理证据

恢复后的运行审计状态为 `healthy`：运行时超级用户连接 0、角色边界越界 0、阻塞查询 0、超过 5 分钟的活动查询 0、超过 5 分钟的 idle transaction 0，PostgREST 七个 Schema Profile 均返回健康状态，数据库中的发布 ID/Manifest 与 v3 制品一致。审计还记录连接利用率、提交/回滚事务、死锁、临时字节、缓存命中率、数据库大小和统计重置时间。

慢查询证据明确不采集 SQL 正文，只记录 PID、用户、状态、持续秒数和等待事件，避免业务数据或秘密进入审计制品。隔离镜像没有安装 `pg_stat_statements`，因此当前只使用实时 `pg_stat_activity`，并产生非阻断提示；生产性能基线需要在获授权环境启用并治理 `pg_stat_statements` 后补充聚合指纹、调用次数和耗时分位数，仍不得记录原始 SQL 文本。

## 验证与剩余边界

专项门禁已通过：v3 离线验签、数据库迁移/发布/恢复/运维契约，以及连续覆盖 DB1 fresh/upgrade、DB2 角色/RLS、DB3 目录/API、DB4 发布和 DB5 事务回退/破坏恢复的 `npm run test:database:docker`。完整质量门禁通过；12/12 前端生产构建通过；企业资料合并与君乐缘材质两个自启、Mock/静态浏览器验收各 1/1 通过。

完整 `test:unit` 未宣称全绿：企业站 26 项中 24 项通过，2 项因工作区已有且必须保留的经纬图库删除（`gallery-003.png`、`gallery-021.jpeg`）失败；跳过该企业站集合后，其余单元总集全部通过。这四个外部删除不属于 DB5，未恢复、未暂存、未提交。`test:smoke`、`test:business-chain` 和完整产品 E2E 本轮没有运行，因为默认 localhost 指向既有 `/home/lzr/eiscore` WSL 数据栈，而完整栈配置又明确依赖禁止触碰的 `eiscore-g35-*`；继续执行会违反隔离边界。此前 G3.5 的 20/20 冒烟、32/32 业务链和 77/77 浏览器 E2E 仍作为历史基线，但不冒充本轮复验。结果同步写入 `REFACTOR_PROGRESS.md` 和 `REFACTOR_FINAL_REPORT.md`。

数据库工程化完成不等于生产发布批准。尚未验证的外部事项是：三家企业真实配置包和客户数据迁移、生产备份存储/KMS 与保留任务、生产容量及性能基线、真实 AI/OCR/流式上游。它们不能通过本地证据推断；也不阻断 DB0～DB5 的仓库与隔离栈治理退出。
