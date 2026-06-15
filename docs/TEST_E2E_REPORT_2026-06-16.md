# EISCore 浏览器 E2E 自动化测试报告

报告日期：2026-06-16  
测试对象：远端环境 `https://nanpai.eissys.top`  
测试工具：Playwright Chromium  
测试目标：补齐浏览器级自动化验收，验证页面真实渲染、登录态注入、主站与关键微应用深链无白屏。

## 一、建设内容

| 交付项 | 文件 | 说明 |
|---|---|---|
| Playwright 配置 | `playwright.config.mjs` | 定义测试目录、远端 baseURL、报告路径、失败截图/trace/video。 |
| E2E 用例 | `tests/e2e/nanpai-shell.spec.mjs` | 覆盖登录页、主站 shell、材料/人事/应用中心深链。 |
| 根命令 | `package.json` | 新增 `test:e2e`、`test:e2e:remote`、`e2e:install`、`e2e:install:with-deps`。 |
| 测试说明 | `tests/README.md` | 增加浏览器 E2E 环境变量、执行命令、产物路径和依赖说明。 |

## 二、用例范围

| 用例 | 检查点 |
|---|---|
| `public login page renders employee entry` | `/login` 可打开，登录卡片、用户名输入框、密码输入框、登录按钮可见，页面不是空白。 |
| `home shell renders after API login` | 通过登录接口获取 token 并注入浏览器 localStorage，`/` 可进入主站 shell。 |
| `materials module deep link renders through host shell` | `/materials/apps` 深链可进入宿主 shell，并加载 qiankun 子应用视图。 |
| `hr employee module deep link renders through host shell` | `/hr/employee` 深链可进入宿主 shell，并加载人事子应用视图。 |
| `app center module deep link renders through host shell` | `/apps/` 深链可进入宿主 shell，并加载应用中心子应用视图。 |

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

本机 WSL 当前缺少 Chromium 系统依赖且 sudo 需要密码，因此本次验证临时使用已有本地库路径：

```bash
LD_LIBRARY_PATH=$PWD/output/browser-libs/root/usr/lib/x86_64-linux-gnu npm run test:e2e:remote
```

说明：`output/` 是本地未跟踪产物目录，不进入 GitHub。正式环境应优先使用系统依赖安装方式。

## 四、执行结果

| 指标 | 结果 |
|---|---|
| 总用例 | 5 |
| 通过 | 5 |
| 失败 | 0 |
| 通过率 | 100% |
| 耗时 | 约 42 秒 |

结果产物：

| 产物 | 路径 |
|---|---|
| JSON 结果 | `tests/.artifacts/playwright-result.json` |
| HTML 报告 | `tests/.artifacts/playwright-report/` |
| 失败 trace/截图/video | `tests/.artifacts/playwright-results/` |

`tests/.artifacts/` 已加入 `.gitignore`，测试产物只保留在本地。

## 五、结论

1. 浏览器级 E2E 第一版已完成，远端 `nanpai.eissys.top` 通过 5/5。
2. 当前 E2E 已能捕获登录页白屏、主站 shell 白屏、关键微应用深链加载失败等问题。
3. 本轮不把 E2E 纳入默认 `test:ci`，避免依赖外部远端环境和浏览器系统库影响普通 PR 构建。
4. 下一阶段建议扩展为业务操作级 E2E，例如应用中心列表查询、材料表格加载、人事花名册筛选、流程应用进入详情页。
