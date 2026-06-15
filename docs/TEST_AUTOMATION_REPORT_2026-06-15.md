# EISCore 自动化测试工程启动报告

报告日期：2026-06-15  
测试对象：EISCore 本地代码库与远端环境 `https://nanpai.eissys.top`  
执行范围：离线回归、前端构建、远端业务冒烟、历史测试资料整理

## 一、建设内容

本轮已经把测试入口从零散脚本整理为工程化入口：

| 模块 | 交付内容 | 说明 |
|---|---|---|
| 根命令 | `package.json` | 新增 `ci:install`、`build:frontends`、`test:unit`、`test:smoke`、`test:ci`。 |
| 子项目编排 | `scripts/eiscore-packages.mjs` | 统一维护 11 个前端微应用和 `realtime` 运行时包。 |
| 批量执行 | `scripts/run-package-script.mjs` | 按分组运行子项目 npm script，任一失败即中断。 |
| CI 安装 | `scripts/install-packages.mjs` | 按 lockfile 自动选择 `npm ci` 或 `npm install`。 |
| 业务冒烟 | `tests/smoke/business-smoke.mjs` | 覆盖主站路由、登录鉴权、PostgREST 多 schema、AI、SSE、WebSocket。 |
| CI 流水线 | `.github/workflows/ci.yml` | push、PR、手动触发时安装依赖、跑离线回归、构建全部前端。 |
| 测试说明 | `tests/README.md` | 汇总命令、环境变量、结果文件和后续扩展方向。 |
| 资料索引 | `docs/TESTING_INDEX.md` | 整理历史测试报告、模板和自动化资产。 |

## 二、执行结果总览

| 测试项 | 命令/对象 | 结果 | 备注 |
|---|---|---|---|
| 语义/运行时单元回归 | `npm run test:unit` | PASS | `realtime` 中 `test:twin-knowledge` 通过。 |
| 前端批量构建 | `npm run build:frontends` | PASS | 11 个 Vue/Vite 微应用全部构建成功。 |
| 脚本语法检查 | `node --check` | PASS | 新增 Node 脚本与 smoke 脚本语法通过。 |
| Diff 空白检查 | `git diff --check` | PASS | 未发现尾随空格等补丁格式问题。 |
| 本地业务冒烟 | `npm run test:smoke` | NOT RUN | 本地 `http://localhost:8080` 未启动。 |
| 远端业务冒烟 | `https://nanpai.eissys.top` | 22/23 PASS | 仅 workflow definitions 别名接口失败。 |

前端构建期间存在非阻断警告：

| 类型 | 说明 | 建议 |
|---|---|---|
| Node 版本警告 | 当前本地 Node 为 `20.18.1`，部分 Vite 版本提示需要 `20.19+` 或 `22.12+`。 | 本地升级到 `20.19.0+`；CI 已配置 `20.19.0`。 |
| 构建体积/Sass 警告 | Vite chunk 和 Sass deprecation 警告未导致失败。 | 后续作为前端优化任务处理，不阻断自动化工程启动。 |

## 三、远端业务冒烟详情

执行命令：

```bash
EISCORE_BASE_URL=https://nanpai.eissys.top \
EISCORE_AGENT_WS_URL=wss://nanpai.eissys.top/agent/ws \
EISCORE_SMOKE_RESULT=tests/.artifacts/nanpai-smoke-result.json \
npm run test:smoke
```

结果文件：`tests/.artifacts/nanpai-smoke-result.json`

| 分组 | 用例 | 结果 |
|---|---|---|
| 主站路由 | 首页 `/`、`/materials/apps`、`/hr/employee`、`/apps/` 深链 | PASS |
| 登录鉴权 | 管理员登录、错误密码拒绝 | PASS |
| 公共配置 | `roles`、`system_configs`、`ai_glm_config`、`sys_field_acl` | PASS |
| 业务数据 | `raw_materials`、`hr.archives`、`app_center.apps` | PASS |
| 工作流数据 | `/api/definitions`、`workflow_state_mappings` | PASS |
| 工作流别名 | `/api/workflow.definitions` | FAIL |
| 智能体 | `/agent/health`、AI config 鉴权、非流式 AI、SSE 流式 AI | PASS |
| 实时通道 | `wss://nanpai.eissys.top/agent/ws` 鉴权订阅 | PASS |
| 主站代理 | `/agent/health` 经主站代理访问 | PASS |

失败项：

| 缺陷编号 | 用例 | 现象 | 判断 |
|---|---|---|---|
| WF-ALIAS-001 | `14 workflow.definitions alias is readable` | `/api/workflow.definitions` 返回 404。错误来自 PostgREST schema cache，表现为查找 `workflow.workflow.definitions`。 | 远端别名 rewrite 未生效或与本地 Nginx 配置不一致。 |

佐证：

| 接口 | 结果 |
|---|---|
| `/api/workflow.definitions?select=id,name&order=id.desc&limit=3` | FAIL，404 |
| `/api/definitions?select=id,name&order=id.desc&limit=3`，`Accept-Profile: workflow` | PASS，返回 2 行 |

结论：工作流真实表与 canonical API 可用，问题集中在远端兼容别名 `/api/workflow.definitions`。建议修复远端 Nginx/API rewrite，或统一前端与脚本改用 canonical `/api/definitions`。

## 四、历史测试资料整理结论

| 历史资料 | 整理结果 |
|---|---|
| `docs/BUSINESS_TEST_REPORT_2026-02-09.md` | 已归为历史业务冒烟基线，当前 smoke 脚本延续其 23 项业务链路口径。 |
| `docs/PROJECT_COMPLETION_INTEGRATED_2026-02-27.md` | 已归为自动化建设背景，里面提到的测试/CI 薄弱项本轮开始补齐。 |
| `docs/WORKFLOW_ROLE_SMOKE_TEST_CHECKLIST.md` | 已归为高风险流程/权限手工清单，适合后续拆为 E2E。 |
| `docs/ROLE_TEST_RECORD_TEMPLATE.md` | 已归为人工验收记录模板。 |
| `docs/第八章_系统测试初稿_2026-03-14.md` | 已归为交付/论文型测试说明，可引用当前自动化结果更新。 |
| `docs/agent/zh-query-testset.v1.json` | 已归为智能体语义回归用例池，后续可建设自动 runner。 |

详细索引见：`docs/TESTING_INDEX.md`。

## 五、测试结论

1. EISCore 已具备第一层自动化测试工程入口：统一命令、批量构建、离线回归、远端业务冒烟、CI 工作流。
2. 当前远端核心链路整体可用，业务冒烟通过率为 22/23。
3. 唯一失败项是兼容 API 别名 `/api/workflow.definitions`，不影响 canonical `/api/definitions`，但会影响依赖别名的旧调用。
4. 本地完整业务冒烟需要先启动本地 host、PostgREST、agent、WebSocket 服务。
5. 下一阶段重点应从“能跑”推进到“能持续守住关键业务”：浏览器 E2E、智能体语义回归、共享组件单测、性能基线。

## 六、下一步建议

| 优先级 | 任务 | 验收标准 |
|---|---|---|
| P0 | 修复远端 workflow definitions 别名 | `npm run test:smoke` 在远端达到 23/23 PASS。 |
| P1 | 增加 Playwright E2E | 登录、主应用、关键子应用首屏无白屏，CI 可运行。 |
| P1 | 增加智能体语义回归 | `docs/agent/zh-query-testset.v1.json` 中查询可批量校验意图、对象、工具。 |
| P2 | 增加共享前端单测 | grid runtime、状态字段、权限按钮至少有核心用例。 |
| P2 | 建立性能基线 | 首页、子应用首屏、AI 接口响应时间进入报告。 |
