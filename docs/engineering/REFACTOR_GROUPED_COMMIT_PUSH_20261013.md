# 重构分支分组整理与推送记录（2026-10-13）

## 交付范围

仓库为 `github-eiscore-refactor`，分支为 `codex/systematic-refactor`。本任务只整理源码、审查、离线验证、隔离构建及 Git 推送；没有启动或重建业务服务，没有执行数据库迁移、真实 release/recovery、远端部署或写入业务数据库。本地点击验收使用的制品保持原样。

远端核验基线为 `GODU-LZR/eiscore` 的 `codex/systematic-refactor`，提交 `9d4fb782911397a36ff2e2c862af342aedcc8ecf`。实际读取远端 refs 并 fetch 后，确认它是本地提交的祖先，适合普通非强制推送。现有 `origin` 指向 DeepSeek Harness、`upstream` 的 push URL 是占位地址，两者均不是本轮推送目标。

## 已整理提交

以下为远端核验基线之后的全部 25 个源码/历史记录提交。实现按业务边界提交，跨组依赖在最终组合回归中验证；不声称每个中间提交都已完成独立整站验收。

| 提交 | 范围 |
| --- | --- |
| `161663a6` | 伦度移动轮播标题覆盖层 |
| `330d5edc` | 伦度公开站跟随系统配色 |
| `4fd0546d` | 伦度客户验收用户初始化及记录 |
| `2bcaf3df` | 保留系统管理员账号 |
| `ebfc9273` | ACL 生命周期、动态应用权限、用户状态、Flash 独立数据库角色及 ADR |
| `1530e17f` | Flash/业务 Harness Runtime、Bridge、会话、工具与前端 iframe 隔离 |
| `c56d1570` | Grid 中文导出、用户/权限状态保护、查询字段类型及表头 |
| `2ea7908e` | 本地/生产/伦度 Compose 的 Flash 独立服务、网络、卷与路由 |
| `dff2174c` | 忽略新生成草稿，修复 Grid 导出回归的正则语法 |
| `18af0970` | 企业站运营模块入口和返回导航 |
| `39ffefca` | 伦度 Harness 登录 302 的 Location、可移植 Compose 回归、网络访问库存 |
| `99c6b68a` | 显式本地/演示组织树、部门账号与角色种子 |
| `c3a6bf05` | 删除后读回验证、库存补偿、点击导航断言 |
| `412a655d` | 公开页资源加载环、favicon、减少动态效果偏好、Flash 登录回跳；PayPal 仅展示预留接口 |
| `7cfb2f3b` | 助手 UUID 会话、稳定 session_id、查询上下文、SSE DONE 与断线处理 |
| `eebf2731` | 网站运营、操作指引岗位文案及历史修复证据 |
| `d234fd0a` | 应用中心增删权限由数据库同步，移除重复前端副作用 |
| `d2112c74` | 六份文档引擎的类型字段及五个详情页实时值打印、共享消毒 |
| `0010f8dc` | 包内资源、移动深链接、预览入口、WebSocket 代理及完整制品旧目录替换 |
| `e8a5e98f` | 本地完整站恢复和历史 67 项验收记录、移除旧服务说明 |
| `e51a5db7` | 公开客服接 Harness、JSON/SSE 错误闭合与最近 24 条历史 |
| `69e59c1a` | Flash 独立密码及 release/recovery 工具参数、避免配置密码输出 |
| `01c2de29` | 种子非执行分类、现行治理清单校正、新 `core-027` 缺失管理员角色拒绝 |
| `a4005180` | npm 回归入口与 Grid/组合根契约集成 |
| `7330d6ae` | Harness 插件按业务/Flash 服务核验、内部会话路由目录、移除旧 Flash 缓存消费者断言 |

`c56d1570` 的导出测试曾有正则语法错误，修复在 `dff2174c`，当前版本通过；不将中间提交单独描述成通过。旧验收文档保留其日期、运行态及未完成事实，不作为本轮重新执行线上验收的证据。

## 本轮审查中修复的实际问题

- 伦度 Web runner 返回 302 却没有 Location；补地址并验证允许来源、拒绝外域。
- 助手以 `Date.now()` 创建会话，同毫秒可能串用后端会话；改原生 UUID/安全随机数，固定时钟与 HTTP fallback 回归通过。
- 公开客服历史原为最早 24 条；改为最近 24 条并恢复用户/助手顺序，30 条历史夹具验证通过。
- 数据库配置中的 `set_config` 会返回密码；使用 psql `\gset` 接收并清除变量，不输出原文。
- 文档 popup 通过 outerHTML 丢失实时 input 值，且打印 CSS 隐藏输入；共享克隆转换保留日期、数值、文本和选项标签，去掉脚本与事件属性。
- 静态服务器的 `/mobile/login` 等路径落回基座入口；按移动端独立入口回退。
- `core-025` 中 SQL NULL 比较可能绕过管理员判断；新增 `core-027` 使用 `IS DISTINCT FROM`。没有改写原迁移 SQL，真实授权 postcheck 已编写但本轮未在 PostgreSQL 执行。

三份新增/既有 HR 种子已准确区分为客户验收或演示数据，登记路径、SHA 和默认禁止自动执行。现行 core 清单的 `core-015`、`core-025` SHA 与已提交 LF 源码不一致，核对 Git 内容和冻结版本覆盖范围后校正；没有更改两份历史 SQL。DB2–DB6 五份冻结 manifest 对远端核验基线原始字节及规范哈希均一致，DB6 哈希仍为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`。

## 验证结果和限制

已通过：平台 HTTP/Auth/Storage、Grid 导出及单一来源、HR 用户修复、Flash Builder 与权限边界、基座布局、公开档案/首屏/品牌/移动登录、Runtime Router、生产配置及 Web smoke、文档打印/移动深链接/库存补偿/演示种子、数据库治理组合、Node/Bash 语法、相关 ESLint 和 diff 检查。文档打印使用真实 Chromium 空白 DOM，未连接本地业务服务。

数据库离线验证通过 `db:migrations:check`（Runtime 10 + Company Site 1 + Core 27）和 `db:backend:audit`（109 份历史 SQL，99/99 非迁移登记，38 个受治理迁移，未决 0）。`test:database-migrations` 全组合通过，包括临时 loopback HTTP 夹具；不等于正式数据库发布已批准。`test:database-release-drift` 通过表示它正确检测并拒绝冻结 DB6 与当前候选的差异，不表示差异消失。

Harness 组合首次发现两个过期门禁：业务服务被要求加载 Flash、迁移目录缺少内部会话注册/注销路由。已按现有隔离实现补齐目录，并精确检查两个服务各自的插件；没有放宽工具权限。最终组合结果见下面的集成证据。

`npm run test:unit` 实际失败：企业站测试 28 通过、2 失败，仍缺少 `research-gallery/gallery-001.png` 和 `research-gallery/gallery-021.jpeg`。素材不在原 Git 基线及当前目录，没有伪造资源或跳过断言。该组合在此处停止，不能报告整套 unit/CI 全绿。

本轮未重新运行 67 项点击、真实业务写入链、真实 Provider completion、真实 SQL/RLS 或 Docker release/recovery。没有验证 HomeView 切模式保持对话；它仍可能重挂 iframe，单次 feature 事件的晚注册风险保留。独立站支付仍为预留展示，未接真实 PayPal Checkout。

## 临时文件与集成证据

`.codex-tmp`、`.playwright-cli`、输出/构建目录及新生成 Flash 草稿继续忽略。新草稿文件保留在磁盘，没有删除或提交；六份历史已跟踪草稿保留。Flash iframe 回归改读版本管理的 `deploy/lundu/compose.harness-web.yml`，不再依赖本机临时 Compose。

- 离线前端与文档回归日志：`output/offline-audit-a4005180-20261013/`。
- Harness 最终组合日志：`output/refactor-grouped-20261013/harness-final.log`；最终 `npm run test:harness` 整套退出码 0，包含官方 SDK 到模拟 Provider/受控工具回环，不证明真实 Provider 已验收。
- 隔离构建源码提交：`a40051808d3292b8455fafa1123a508ad90ba762`；后续提交只修改门禁/目录/记录，没有修改前端源码。
- 完整前端隔离构建：12/12 构建成功，汇总 11 个子应用 mount，12 个入口齐全；独立 checkout 构建后工作树干净。报告为 `output/commit-clean-20261013/run-064b1d0a-d51e-40b3-837f-d934cbdc5cf0/verification-report.json`，详细日志为同目录 `frontend-build.log`。已有依赖复用，但平台源码解析到独立 checkout，未使用主仓库未提交源码。构建约 4 分 43 秒，保留 Sass 弃用、循环 chunk 和大包警告，未将其解释为构建失败。
- 主仓库 12 份 dist 共 1,039 个文件，构建前后摘要逐份相同；基座目录摘要仍为 `f72c1d3a6bfb78d91f4f90c4921b619a5b19831140c5b33fffdf6a51a2487cd7`。没有切换本地验收制品。
- Git 推送：新增专用 remote `eiscore=https://github.com/GODU-LZR/eiscore.git`，保留原有 origin/upstream 配置。普通非强制推送已成功，将远端从 `9d4fb782` 推进到包含本记录的 `79f10acc68fa5018a8c847f213c233e0bade8ed2`；随后 `git ls-remote` 返回相同提交，工作树干净，分支已跟踪 `eiscore/codex/systematic-refactor`。本次证据补记也会独立提交并推送；没有向 DeepSeek Harness 或占位地址推送，没有执行伦度部署。

这些输出仅为本机验收证据，不作为产品源码提交。完成源码整理和推送不能替代后续运行态切换与人工验收。
