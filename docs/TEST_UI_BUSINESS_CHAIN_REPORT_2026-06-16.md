# EISCore UI 全业务链路闭环自动化测试报告

报告日期：2026-06-16
测试对象：远端环境 `https://nanpai.eissys.top`
测试入口：`npm run test:e2e:business-chain:remote`
测试目标：按普通用户浏览器视角核验全业务链路闭环，确认写入业务数据后，应用中心、动态数据应用、Workflow 状态回写、HR 档案和 SCM 仓库页面都能通过 UI 搜索、点击、刷新完成验证。

## 一、建设内容

| 交付项 | 文件 | 说明 |
|---|---|---|
| UI 全链路用例 | `tests/e2e/ui-business-chain.spec.mjs` | API 隔离准备/清理测试数据，UI 负责真实导航、搜索、点击树节点、刷新并核验业务状态。 |
| 根命令 | `package.json` | 新增 `test:e2e:business-chain` 和 `test:e2e:business-chain:remote`。 |
| 测试说明 | `tests/README.md` | 增加 UI 全业务链路闭环入口、环境变量和清理策略。 |
| 测试索引 | `docs/TESTING_INDEX.md` | 将 UI 全业务链路闭环纳入当前自动化资产。 |

## 二、闭环范围

| 链路 | UI 核验点 |
|---|---|
| 应用中心 | 创建隔离数据应用后，进入应用配置中心，搜索并点击生成应用，确认应用名称和业务表配置。 |
| 动态数据应用 | 进入生成的数据应用，搜索唯一 `runId`，确认记录状态为 `READY`、金额为 `128`。 |
| Workflow 状态回写 | API 启动并推进流程后，UI 刷新数据应用并确认状态从 `FLOW_REVIEW` 到 `FLOW_DONE`。 |
| HR 档案 | 创建员工档案后，UI 搜索工号；API 更新部门后，UI 刷新确认 `QA-Updated`；删除后 UI 确认记录消失。 |
| SCM 仓库 | 创建仓库后，UI 在仓库树点击节点；更新名称后再次点击核验；删除后 UI 确认树节点消失。 |
| 异常监控 | 捕获 `pageerror`、关键 `console.error` 和 Element Plus 错误消息。 |
| 数据清理 | 每轮生成唯一 `runId`，结束后删除流程实例、定义、状态映射、发布路由、应用、动态数据、HR 档案和仓库。 |

## 三、执行命令

远端 UI 全业务链路闭环：

```bash
npm run test:e2e:business-chain:remote
```

完整远端浏览器 E2E：

```bash
npm run test:e2e:remote
```

本机 WSL 当前缺少 Chromium 系统依赖，本次仍使用本地临时库路径：

```bash
LD_LIBRARY_PATH=$PWD/tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu npm run test:e2e:business-chain:remote
```

## 四、执行结果

| 指标 | UI 全业务链路闭环 | 完整浏览器 E2E |
|---|---:|---:|
| 总用例 | 1 | 10 |
| 通过 | 1 | 10 |
| 失败 | 0 | 0 |
| 通过率 | 100% | 100% |
| 耗时 | 约 1.6 分钟 | 约 2.6 分钟 |
| 清理结果 | 本轮生成业务数据已清理 | 本轮生成业务数据已清理 |

结果产物：

| 产物 | 路径 |
|---|---|
| JSON 结果 | `tests/.artifacts/playwright-result.json` |
| HTML 报告 | `tests/.artifacts/playwright-report/` |
| trace/截图/video | `tests/.artifacts/playwright-results/` |

`tests/.artifacts/` 已加入 `.gitignore`，测试产物只保留在本地。

## 五、说明

1. UI 闭环采用“API 准备/清理 + UI 核验”的方式，避免远端残留测试数据，同时保证每个业务节点都能在用户页面上被搜索、点击或刷新验证。
2. 动态数据应用的测试配置关闭前端自动建表，由测试准备阶段显式调用 `create_data_app_table`。这样避免已存在表被前端重复建表时触发非幂等 500 噪声。
3. Workflow 运行页当前没有稳定的“选择指定业务记录发起流程”入口，因此流程推进由 API 执行，UI 验证状态回写结果。这是当前最稳定、最贴近业务闭环的浏览器验收方式。

## 六、结论

UI 全业务链路闭环测试已完成，远端 `nanpai.eissys.top` 通过 1/1；完整浏览器 E2E 通过 10/10。当前 UI 自动化已经从“日常点击不报错”升级到“核心业务写入、流转、更新、删除均可在浏览器页面闭环核验”。
