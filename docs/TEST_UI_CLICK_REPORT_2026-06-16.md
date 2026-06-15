# EISCore UI 点击巡检自动化测试报告

报告日期：2026-06-16
测试对象：远端环境 `https://nanpai.eissys.top`
测试入口：`npm run test:e2e:clicks:remote`
测试目标：模拟普通用户日常点击使用，确认登录、导航、应用卡片、网格工具栏和弹窗入口不会出现前端异常或白屏。

## 一、建设内容

| 交付项 | 文件 | 说明 |
|---|---|---|
| E2E 公共能力 | `tests/e2e/helpers.mjs` | 统一登录态注入、真实登录、空白页检查、子应用就绪检查、前端异常监控和远端导航重试。 |
| UI 点击用例 | `tests/e2e/ui-clicks.spec.mjs` | 模拟用户点击登录表单、侧边导航、用户菜单、引导中心、应用卡片、网格工具栏和应用中心弹窗。 |
| 根命令 | `package.json` | 新增 `test:e2e:clicks` 和 `test:e2e:clicks:remote`。 |
| 测试说明 | `tests/README.md` | 增加 UI 点击巡检入口、范围和执行方式。 |

## 二、点击链路范围

| 链路 | 检查点 |
|---|---|
| 登录表单 | 点击员工通道、用户名、密码、记住我、登录按钮，确认进入主站 shell。 |
| Shell 头部 | 点击侧边栏折叠按钮、全局引导中心、用户菜单，确认弹层可打开且无前端错误。 |
| 侧边导航 | 逐个点击可见业务模块菜单，确认子应用工作区可加载。 |
| 人事应用 | 点击人事应用卡片进入花名册，操作搜索、列管理、导出入口。 |
| 仓储应用 | 点击仓储应用卡片进入物料网格，操作搜索、列管理、导出入口。 |
| 应用中心 | 点击新建应用卡片打开弹窗并取消，点击配置中心卡片确认页面可用。 |
| 异常监控 | 捕获 `pageerror`、关键 `console.error` 和 Element Plus 错误消息。 |

## 三、执行命令

远端 UI 点击巡检：

```bash
EISCORE_E2E_BASE_URL=https://nanpai.eissys.top npm run test:e2e:clicks
```

也可以使用快捷命令：

```bash
npm run test:e2e:clicks:remote
```

完整浏览器 E2E：

```bash
npm run test:e2e:remote
```

## 四、执行结果

| 指标 | UI 点击巡检 | 完整浏览器 E2E |
|---|---:|---:|
| 总用例 | 4 | 9 |
| 通过 | 4 | 9 |
| 失败 | 0 | 0 |
| 通过率 | 100% | 100% |
| 耗时 | 约 55 秒 | 约 1.5 分钟 |

结果产物：

| 产物 | 路径 |
|---|---|
| JSON 结果 | `tests/.artifacts/playwright-result.json` |
| HTML 报告 | `tests/.artifacts/playwright-report/` |
| trace/截图/video | `tests/.artifacts/playwright-results/` |

`tests/.artifacts/` 已加入 `.gitignore`，测试产物只保留在本地。

## 五、说明

1. 本轮刻意避开会直接写入远端业务数据的危险确认操作，例如直接新增行或删除确认。
2. 对列管理、导出、弹窗等日常入口采用“点击后无前端异常”作为验收标准，避免把远端弹层动画或下载时序误判为业务故障。
3. 本机 WSL 缺少 Chromium 系统库且 sudo 需要密码，本次验证临时解包 `libnspr4`、`libnss3`、`libasound2t64` 到 `tests/.artifacts/playwright-libs/` 后执行。正式环境建议使用 `npm run e2e:install:with-deps`。

## 六、结论

UI 点击巡检第一版已完成，远端 `nanpai.eissys.top` 通过 4/4；完整浏览器 E2E 通过 9/9。当前自动化已经从“页面能打开”推进到“普通用户关键点击路径可用”。
