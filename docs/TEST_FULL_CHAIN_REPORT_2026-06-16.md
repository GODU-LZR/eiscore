# EISCore 全业务链路闭环自动化测试报告

报告日期：2026-06-16
测试对象：远端环境 `https://nanpai.eissys.top`
测试入口：`npm run test:business-chain:remote`
测试目标：补齐写操作级业务闭环，验证核心业务对象从创建、读取、更新、流程状态回写到清理的完整链路。

## 一、建设内容

| 交付项 | 文件 | 说明 |
|---|---|---|
| 全链路脚本 | `tests/business/full-chain.mjs` | 接口级闭环测试，自动生成 runId，执行后反向清理测试数据。 |
| 根命令 | `package.json` | 新增 `test:business-chain` 和 `test:business-chain:remote`。 |
| 测试说明 | `tests/README.md` | 增加全业务链路测试的命令、环境变量和清理策略。 |
| 测试索引 | `docs/TESTING_INDEX.md` | 将全业务链路闭环纳入当前自动化资产。 |

## 二、链路范围

| 链路 | 检查点 |
|---|---|
| 登录鉴权 | `/api/rpc/login` 返回 JWT，后续请求携带 Bearer token。 |
| 基线读取 | 应用中心、HR 档案、SCM 仓库、物料主数据可读。 |
| 应用中心 | 创建数据应用、发布应用、创建发布路由。 |
| 动态数据应用 | 通过 `create_data_app_table` 确保 `app_data.eiscore_chain_test_records` 存在，创建并更新测试业务记录。 |
| Workflow | 创建流程定义、任务分派、状态映射，启动流程并推进到完成。 |
| 状态回写 | Workflow 将动态数据记录状态从 `READY` 回写为 `FLOW_REVIEW`，再推进为 `FLOW_DONE`。 |
| 审计事件 | 读取 `INSTANCE_STARTED`、`TASK_TRANSITION`、`INSTANCE_COMPLETED` 事件。 |
| HR | 员工档案创建、更新、删除、删除后确认。 |
| SCM | 仓库创建、更新、删除、删除后确认。 |
| 清理 | 删除本轮生成的流程实例、定义、映射、路由、应用和动态数据记录。 |

## 三、执行命令

远端执行：

```bash
EISCORE_CHAIN_BASE_URL=https://nanpai.eissys.top \
EISCORE_CHAIN_RESULT=tests/.artifacts/nanpai-full-chain-result.json \
npm run test:business-chain
```

也可以使用快捷命令：

```bash
npm run test:business-chain:remote
```

## 四、执行结果

| 指标 | 结果 |
|---|---|
| 总用例 | 22 |
| 通过 | 22 |
| 失败 | 0 |
| 通过率 | 100% |
| 清理结果 | 本轮生成业务数据已清理 |

结果产物：

| 产物 | 路径 |
|---|---|
| JSON 结果 | `tests/.artifacts/nanpai-full-chain-result.json` |

`tests/.artifacts/` 已加入 `.gitignore`，测试产物只保留在本地。

## 五、说明

1. 远端 `public.raw_materials` 当前允许读，但 Web 角色直接新增会被 RLS 拦截，因此本轮物料主数据只纳入基线读取。
2. 写操作闭环使用系统已有的动态数据表能力，并固定复用 `app_data.eiscore_chain_test_records`，避免每次运行创建新的表。
3. 每次运行只插入带唯一 `runId` 的记录，并在结束时删除记录、流程实例、流程定义、状态映射、发布路由、应用、HR 档案和 SCM 仓库。
4. 若需调试失败现场，可设置 `EISCORE_CHAIN_KEEP_DATA=1` 临时保留测试数据，调试后应手动清理。

## 六、结论

全业务链路闭环测试第一版已完成，远端 `nanpai.eissys.top` 通过 22/22。当前自动化已覆盖只读冒烟、浏览器渲染 E2E，以及写操作闭环三层验证。
