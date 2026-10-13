# 本地启动与伦度数据环境恢复（2026-10-13）

## 用户反馈与结论

用户要求恢复本地人工测试服务，并指出之前已经导入伦度机电真实数据，而页面又出现演示资料。
真实导入确实在北京时间 2026-10-12 23:11 完成；外层工作区 `.tmp/lundu-import-report.json`
记录 `mode=apply`、`applied=true`。本轮最初依据旧启动文档恢复了 Ubuntu Docker 隔离栈，
该库仍保留经纬网业资料，属于恢复目标选错，不是本轮重新导入或覆盖了伦度真实数据。

另一个独立问题是业务 HTTP 路由清单遗漏公司站与会话交接接口，导致公开配置与 Harness
认证交接 404。该问题已作为 EIS-001 最小修复并整合。

## 两套运行环境

| 项目 | 本轮最终恢复的实际验收环境 | 本轮停止的错误环境 |
| --- | --- | --- |
| Docker 引擎 | Windows Docker Desktop，context `desktop-linux` | Ubuntu native Docker，WSL `Ubuntu` |
| Compose 项目 | `github-eiscore-refactor` | `eiscore-codex-local` |
| PostgreSQL 容器 | `eiscore-db`，ID `45b71032540c` | `eiscore-db`，ID `3a47716c34f1` |
| 数据卷 | `github-eiscore-refactor_pgdata` | `eiscore-codex-local_pgdata` |
| 数据内容 | 伦度机电有限公司；15员工、83产品、39物料、39库存 | 经纬网业；JW-P演示产品，与10/12导入结果不符 |

相同容器名称和端口并不意味着同一个数据库。启动前应先核对 Docker context、数据库卷及
`company_site.site_config`；不能单凭旧文档、容器名称或代码分支选择环境。

只读实查 Desktop 结果：

- `company_site.site_config`：`primary`、伦度机电有限公司、伦度机电。
- `company_site.products`：83条。
- `public.raw_materials`：39条，包括原始14条物料与后续25条库存映射物料。
- `scm.inventory_batches`：39条。
- `hr.archives`：15条；`public.users`：16条。
- 公开配置接口返回伦度品牌、`publishedVersion=2`、83个产品。

`.tmp/eiscore-before-lundu-import.dump` 是导入前备份，不能当作伦度导入后的数据备份恢复。
本轮未使用此备份，也未运行 `scripts/import-lundu-excel.mjs --apply`。

## 实际恢复动作与版本

源码：`codex/systematic-refactor`；EIS-001任务提交 `46a9a486810a697ecbab13a88e270ec1e9334103`，
统筹审查后整合为 `5f269a0b`，已推送 `eiscore/codex/systematic-refactor`。
仅业务 HTTP 路由与路由回归发生产品代码变更；业务清单84条，Flash清单保持9条隔离。

本轮停止错误 Ubuntu 栈的8个 EISCore 容器，保留容器和所有卷；随后启动 Docker Desktop，
沿用原 Desktop DB/API/Agent/Bridge/IDE/两个 Harness Web 容器。Docker Desktop 同时按既有
重启策略恢复其他项目，本轮未调整那些项目的代码、配置或数据。

Desktop Nginx 原容器因当前源码引用缺失的 `flash-agent-runtime` 而重启。
统筹仅替换 Nginx 容器，沿用原镜像、端口、网络、完整 `eiscore-base/dist`，将7处Flash上游
在忽略目录的临时配置中改为明确503。产品 Nginx 源码与 dist 未改。
原容器保留为 `eiscore-nginx-before-desktop-startup-1791902781577`，可停掉替代容器后回退，
但原配置依赖未部署的Flash服务，因此回退不能消除原启动故障。

替代 Desktop Nginx ID：`5a48d4d5b3c8`；只重启现有业务 `eiscore-agent-runtime` 使路由修复生效，
没有重新构建 DB、API、Bridge 或前端。运行制品不能据此宣称已完成新的 clean-build provenance。

本轮运行恢复记录位于主树忽略目录 `.codex-tmp/local-startup-20261013/`：
`desktop-recovery-report.json`、`recover-desktop-nginx.mjs`、临时 `default.conf`。
该目录也保留最初 Ubuntu 恢复的 `recovery-report.json`，需根据 `engine` 和记录时间区分。
这些本地制品不提交为产品源码，报告不包含密钥。

没有执行数据库迁移、真实release/recovery、重导数据、替换数据库卷或修改冻结manifest。
Chrome登录和面板交接会触发现有认证/会话请求，不应把页面检查表述为完全没有运行时写入。

## 验证结果

- `npm run test:runtime-router`：14项全部通过。
- `node tests/engineering/company-http-regression.mjs`：42条公司站路由通过。
- `npm run test:harness-runtime-boundaries`：7项全部通过。
- `git diff --check`：通过。
- `nginx -t`：通过，保留既有重复MIME类型警告。
- 登录入口、`/api/`、`/agent/health`、公司站公开配置均HTTP200。
- 基座与11个微应用的显式 `index.html`：12/12 HTTP200。
- 独立站窗口只读交叉复核：12入口与伦度Logo均200；配置和根入口未发现君乐缘品牌。
  `asset-manifest.json` 未提供真实JSON（200但为HTML回退，dist文件不存在），
  因此本轮入口恢复不代表正式静态release完整性验收通过。
- Chrome既有本地验收账号进入首页；数字分身与智能BI的Harness原生面板可加载，
  无认证交接404；未发送真实Provider请求。
- Chrome人事花名册显示15行；库存查询非空且无页面加载失败，虚拟表格可见18行，
  此可见行数不是总库存数，数据库总数另由SQL确认39条。
- Chrome发现既有 `/api/role_data_scopes?on_conflict=role_id,module` 409错误，
  已登记EIS-004，本轮未扩大修复。

两次额外验证命令误用了不存在的测试文件名并返回 `MODULE_NOT_FOUND`，
随后已查package脚本并执行上面正确路径，不将错误命令计为通过。
执行容器内 `wget` 健康检查也因工具不存在失败，HTTP健康与Docker健康状态另已通过。

## 尚未完成的范围

完整Flash隔离拓扑属于后续源码改造，并未在既有Desktop数据库中部署：
没有 `eiscore-flash-agent-runtime`、`eiscore-flash-harness-bridge`，数据库没有 `eiscore_flash_agent`，
当前迁移账本到 `core-024`；对应Flash环境配置缺失。
现有Flash Web仍为旧共享Gateway配置，不能把它误报为已完成彻底隔离。
本轮将Flash入口保持503，而不绕回业务Runtime；没有以创建一个角色代替受控迁移。

前端静态企业配置仍含历史“6000个项目/4500吨装车量/35亿合同额”指标。
这些是企业展示配置，不能当作业务数据库统计；本轮未改其内容或重新构建前端。
恢复真实库不能自动证明所有页面文案已清除演示值，应在人工验收时单独核对并登记。

本轮没有重跑67项或全写入业务链，没有验收真实Provider completion、Flash发布或远端部署。
普通业务可继续从 `http://127.0.0.1:18080/login` 人工验收；Flash尚不能作为完整功能交付。
