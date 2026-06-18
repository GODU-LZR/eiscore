# EISCore 工程测试报告 2026-06-19

## 测试目标

本轮测试围绕系统鲁棒性和业务链闭环继续加固，覆盖本地工程回归、远端 API 业务链、远端 UI 业务链、普通用户 UI 点击路径，以及 67 个功能点的分段闭环验证。

远端目标环境：

- Web: https://nanpai.eissys.top
- Agent WS: wss://nanpai.eissys.top/agent/ws

## 本轮修复

1. 67 功能点 E2E 支持按编号筛选和分段执行。
   - 新增 `EISCORE_E2E_FUNCTION_POINTS_ONLY`
   - 新增 `EISCORE_E2E_FUNCTION_POINTS_START`
   - 新增 `EISCORE_E2E_FUNCTION_POINTS_END`
   - 新增远端分段脚本 `test:e2e:functions67:remote:part1` 到 `part4`

2. 加固长链路 UI 测试稳定性。
   - 67 功能点套件关闭 video 录制，避免长链路失败截屏/视频写入导致 `EPIPE`
   - 远端 shell ready 等待时间从默认 15 秒提高到 30 秒，并支持 `EISCORE_E2E_SHELL_READY_TIMEOUT_MS`

3. 修复微前端深链路偶发空白页。
   - sales、purchase、production、quality、equipment、decision、materials、hr 微应用在 qiankun mount 时等待 `router.isReady()`
   - mount 返回异步 render promise，避免主应用认为子应用已挂载但内部路由尚未就绪
   - unmount 后使用当前 app 引用保护，避免异步 ready 回来后挂载已被卸载的实例

4. 加固 ontology agent SQL 补丁兼容性。
   - `ontology_current_permissions()` 改为 plpgsql
   - 仅当旧版 `public.users.permissions text[]` 字段存在时才读取 legacy permissions
   - 避免旧数据库结构执行 agent ontology 上下文补丁时报列不存在

5. 明确 Playwright 执行约束。
   - 当前 Playwright 套件共享 `tests/.artifacts/playwright-results`
   - 业务链、点击测试、67 功能点套件需要顺序执行，除非后续为每个 suite 配置隔离 output directory

## 本地工程回归

| 项目 | 结果 | 备注 |
|---|---:|---|
| `git diff --check` | PASS | 无空白错误 |
| `npm run test:syntax` | PASS | 语法检查通过 |
| `npm run test:unit` | PASS | 单元测试通过 |
| `node --check tests/e2e/function-points-67.spec.mjs` | PASS | 67 功能点脚本语法通过 |
| `node --check tests/e2e/helpers.mjs` | PASS | E2E helper 语法通过 |
| 8 个微前端 `src/main.js` 语法检查 | PASS | sales/purchase/production/quality/equipment/decision/materials/hr |
| `npm run build:frontends` | PASS | 11 个前端包构建通过 |

## 远端 API 与业务链

执行命令：

```bash
npm run test:engineering:remote:api
```

结果：

| 链路 | 结果 | 覆盖 |
|---|---:|---|
| Remote smoke | PASS | 23/23 |
| Remote business chain | PASS | 32/32 |

报告产物：

- `/home/lzr/eiscore/tests/.artifacts/nanpai-engineering-suite-2026-06-18T17-21-58-742Z.md`
- `/home/lzr/eiscore/tests/.artifacts/nanpai-engineering-suite-2026-06-18T17-21-58-742Z.json`

业务链覆盖包含 ontology views、reasoning、App Center 动态应用、workflow 严格流转、HR archive CRUD、SCM warehouse CRUD、stock-in 自动入库链路及清理动作。

## 远端 UI 闭环

顺序执行结果：

| Suite | 命令 | 结果 |
|---|---|---:|
| UI 业务链闭环 | `npm run test:e2e:business-chain:remote` | PASS 1/1 |
| UI 普通用户点击 | `npm run test:e2e:clicks:remote` | PASS 4/4 |
| 67 功能点 part1 | `npm run test:e2e:functions67:remote:part1` | PASS 20/20 |
| 67 功能点 part2 | `npm run test:e2e:functions67:remote:part2` | PASS 13/13 |
| 67 功能点 part3 | `npm run test:e2e:functions67:remote:part3` | PASS 17/17 |
| 67 功能点 part4 | `npm run test:e2e:functions67:remote:part4` | PASS 17/17 |

67 功能点总计：

- 通过：67/67
- 失败：0
- flaky：0

## 已知非阻塞告警

1. 当前 Node.js 为 20.18.1，Vite 构建提示建议使用 20.19+ 或 22.12+。
2. Sass legacy JS API 有弃用告警，暂不影响构建结果。
3. 部分前端包存在 chunk size、circular dependency、Rollup PURE comment 告警，暂未阻断业务链测试。
4. WSL 在并行运行多个 Vite build 或 Playwright suite 时可能出现资源压力；本轮采用顺序执行完成稳定验证。

## 2026-06-19 增量加固

### Grid 搜索竞态修复

远端 UI 业务链复测时，HR 档案搜索链路首跑出现一次 flaky：测试数据已通过 API 创建，搜索框也已填入目标工号，但表格停留在“暂无数据”，重试后通过。定位后发现共享分页加载器在旧请求等待 `loadFieldAcl()` 之后，仍可能无条件清空 `gridData`，导致旧请求晚回来覆盖或清空新搜索结果。

本轮修复：

- `shared/eis-data-grid-paging.js` 在 `loadFieldAcl()` 返回后立即检查 `loadSeq`
- 旧请求不再允许执行 `resetLoadedRows()`
- 旧请求错误不再弹出过期错误提示或触发 `data-load-error`
- 新增 `tests/engineering/grid-paging-regression.mjs`，模拟旧请求晚于新搜索请求返回的竞态
- 新增 `test:grid-paging` 并纳入 `test:unit`

### 增量验证结果

| 项目 | 结果 | 备注 |
|---|---:|---|
| `npm run test:grid-paging` | PASS | 旧请求晚返回不能清空最新搜索结果 |
| `npm run test:unit` | PASS | 包含 grid paging、auto-entry、文档入库等回归 |
| `npm run test:syntax` | PASS | Node 脚本语法检查 38 个文件 |
| `git diff --check` | PASS | 无空白错误 |
| `npm run build:frontends` | PASS | 11 个前端包构建通过 |
| `npm run test:engineering:remote:api` | PASS | smoke 23/23，business-chain 32/32 |
| `npm run test:e2e:clicks:remote` | PASS | 4/4 |
| `npm run test:e2e:business-chain:remote` | PASS | 1/1，复跑无 flaky |
| `npm run test:e2e:functions67:remote:part1` | PASS | FP01-FP20，20/20 |
| `npm run test:e2e:functions67:remote:part2` | PASS | FP21-FP33，13/13 |
| `npm run test:e2e:functions67:remote:part3` | PASS | FP34-FP50，17/17 |
| `npm run test:e2e:functions67:remote:part4` | PASS | FP51-FP67，17/17 |

`npm run test:runtime-v2` 本轮未形成有效业务失败，原因是本地 `eiscore-db` 容器未运行；该项属于环境前置不满足，需要先启动本地数据库后再执行 runtime-v2 postcheck。

## 结论

本轮工程测试已形成 API 业务链、UI 业务链、UI 点击测试、67 功能点闭环和前端构建验证的组合覆盖。远端 `nanpai.eissys.top` 当前闭环测试结果全部通过，且本地已针对微前端深链路空白页、长链路 E2E 超时/产物冲突、ontology SQL 结构兼容性进行了鲁棒性修复。

后续新增自动入库类型时，应同步新增对应 business-chain 测试步骤，并将 67 功能点分段套件继续作为发布前回归门禁。
