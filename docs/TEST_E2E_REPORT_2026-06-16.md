# EISCore 浏览器 E2E 自动化测试报告

报告日期：2026-06-16  
测试对象：远端环境 `https://nanpai.eissys.top`  
测试工具：Playwright Chromium  
测试目标：补齐浏览器级自动化验收，验证页面真实渲染、登录态注入、主站与关键微应用深链无白屏，并覆盖普通用户日常 UI 点击链路和 UI 全业务链路闭环。

## 一、建设内容

| 交付项 | 文件 | 说明 |
|---|---|---|
| Playwright 配置 | `playwright.config.mjs` | 定义测试目录、远端 baseURL、报告路径、失败截图/trace/video。 |
| E2E 用例 | `tests/e2e/nanpai-shell.spec.mjs` | 覆盖登录页、主站 shell、材料/人事/应用中心深链。 |
| UI 点击用例 | `tests/e2e/ui-clicks.spec.mjs` | 覆盖表单登录、侧边菜单、应用卡片、网格搜索/列管理/导出、应用中心弹窗。 |
| UI 全业务链路用例 | `tests/e2e/ui-business-chain.spec.mjs` | 覆盖应用中心、动态数据、Workflow 状态回写、HR 档案、SCM 仓库的浏览器 UI 闭环核验。 |
| 根命令 | `package.json` | 新增 `test:e2e`、`test:e2e:remote`、`test:e2e:clicks`、`test:e2e:clicks:remote`、`test:e2e:business-chain`、`test:e2e:business-chain:remote`、`e2e:install`、`e2e:install:with-deps`。 |
| 测试说明 | `tests/README.md` | 增加浏览器 E2E 环境变量、执行命令、产物路径和依赖说明。 |

## 二、用例范围

| 用例 | 检查点 |
|---|---|
| `public login page renders employee entry` | `/login` 可打开，登录卡片、用户名输入框、密码输入框、登录按钮可见，页面不是空白。 |
| `home shell renders after API login` | 通过登录接口获取 token 并注入浏览器 localStorage，`/` 可进入主站 shell。 |
| `materials module deep link renders through host shell` | `/materials/apps` 深链可进入宿主 shell，并加载 qiankun 子应用视图。 |
| `hr employee module deep link renders through host shell` | `/hr/employee` 深链可进入宿主 shell，并加载人事子应用视图。 |
| `app center module deep link renders through host shell` | `/apps/` 深链可进入宿主 shell，并加载应用中心子应用视图。 |
| `user can log in by clicking the public form controls` | 真实点击用户名、密码、记住我、登录按钮，确认进入主站 shell。 |
| `shell header and side navigation clicks stay stable` | 点击折叠按钮、引导中心、用户菜单，以及所有可见侧边业务模块入口。 |
| `HR and materials app card clicks expose usable grid controls` | 点击人事/仓储应用卡片，验证网格搜索、列管理、导出等工具栏点击无前端错误。 |
| `app center common entry cards can be clicked and safely cancelled` | 点击应用中心新建应用弹窗并取消，点击配置中心卡片并确认页面可用。 |
| `UI closes the full business chain across app center, workflow, HR, and warehouse` | 隔离创建测试数据，通过 UI 搜索/点击核验应用配置、动态数据状态、流程回写、HR 档案 CRUD 和仓库树 CRUD。 |

## 三、执行命令

安装浏览器：

```bash
npm run e2e:install
```

具备 apt/sudo 权限的 Linux 环境建议安装浏览器及系统依赖：

```bash
npm run e2e:install:with-deps
```

远端 E2E：

```bash
EISCORE_E2E_BASE_URL=https://nanpai.eissys.top npm run test:e2e
```

或：

```bash
npm run test:e2e:remote
```

只跑 UI 点击巡检：

```bash
npm run test:e2e:clicks:remote
```

只跑 UI 全业务链路闭环：

```bash
npm run test:e2e:business-chain:remote
```

本机 WSL 当前缺少 Chromium 系统依赖且 sudo 需要密码，因此本次验证临时使用已有本地库路径：

```bash
LD_LIBRARY_PATH=$PWD/tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu npm run test:e2e:remote
```

说明：`tests/.artifacts/` 已加入 `.gitignore`，本地临时依赖不进入 GitHub。正式环境应优先使用系统依赖安装方式。

## 四、执行结果

| 指标 | 结果 |
|---|---|
| 总用例 | 10 |
| 通过 | 10 |
| 失败 | 0 |
| 通过率 | 100% |
| 耗时 | 约 2.6 分钟 |

结果产物：

| 产物 | 路径 |
|---|---|
| JSON 结果 | `tests/.artifacts/playwright-result.json` |
| HTML 报告 | `tests/.artifacts/playwright-report/` |
| 失败 trace/截图/video | `tests/.artifacts/playwright-results/` |

`tests/.artifacts/` 已加入 `.gitignore`，测试产物只保留在本地。

## 五、结论

1. 浏览器级 E2E 第一版已完成并扩展 UI 业务闭环，远端 `nanpai.eissys.top` 通过 10/10。
2. 当前 E2E 已能捕获登录页白屏、主站 shell 白屏、关键微应用深链加载失败等问题。
3. UI 点击巡检已覆盖普通用户日常点击入口，可捕获登录按钮、侧边导航、应用卡片、网格工具栏、应用中心弹窗点击异常。
4. UI 全业务链路闭环已覆盖应用中心、动态数据、流程状态回写、HR 档案和 SCM 仓库的浏览器核验路径。
5. 本轮不把 E2E 纳入默认 `test:ci`，避免依赖外部远端环境和浏览器系统库影响普通 PR 构建。
6. 下一阶段建议扩展为带测试数据隔离的真实表单提交 E2E，例如在 UI 中直接创建后清理 HR 档案、仓库、流程审批记录。
