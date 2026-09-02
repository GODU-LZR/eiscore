# G3 SalesCockpit 阶段退出审计

## 结论

SalesCockpit.vue 的当前纯策略拆分阶段通过退出审计。页面锁定为 1,753 行，模板/组合脚本/样式分别为 316 / 247 / 1,187 行；11 个无 Vue、Element Plus、网络、浏览器、Storage 或隐式时间依赖的纯策略模块共导出 37 项规则。

该结论关闭的是本页当前纯策略子目标，不代表销售驾驶舱已完成组件化。页面继续持有五路请求、AI Context、Router、Fullscreen、ResizeObserver、时钟/刷新 Timer、窗口事件和生命周期编排；这些边界由组合门禁锁定，后续拆分必须以真实销售数据和截图/交互证据驱动。

## 接受门槛

| 门槛 | 结果 | 持续证据 |
| --- | --- | --- |
| 页面不得超过退出基线 | 通过：1,753 行 | sales-cockpit-composition-exit-regression.mjs 与 Vue 复杂度棘轮 |
| 模板、脚本、样式不得反弹 | 通过：316 / 247 / 1,187 行 | SFC 分区上限断言 |
| 核心决策离开组合页 | 通过：11 个纯策略模块、37 个导出 | 精确 Domain Import 与无运行时依赖断言 |
| 请求、AI、路由、Timer、Fullscreen、ResizeObserver 和事件不增长 | 通过：既有调用数量精确锁定 | 组合副作用库存断言 |
| 不重新引入平台旁路 | 通过：无 Axios、直接 Fetch/Storage、EventSource、WebSocket、XHR 或 location 导航 | 禁止访问断言 |

## 已退出职责

展示基础、经营摘要、排行、风险/行动、销售动态、AI Context、查询、壳层、时钟/刷新倒计时、响应归一化和全屏进入/退出判定已迁入纯模块。策略不依赖浏览器 API，保留显式时间、非数组空数组回退和全屏判定语义。

## 保留边界

- 维护 Vue 响应式数据、五路 Request 的 Promise.all 顺序、加载/时间戳和 AI Context 推送。
- 保留 Router、Fullscreen API、ResizeObserver、窗口 resize/fullscreenchange、1 秒时钟和刷新 Timer 生命周期。
- 保留 316 行模板与 1,187 行 Scoped CSS，避免无真实经营数据和截图基线的机械模板迁移导致视觉/交互回归。

## 非阻断项与回退

页面仍高于 800 行阈值，复杂度门禁只允许下降；当前仅验证离线策略与组合门禁，未访问数据库、远程 API 或企业环境。各抽取切片不含数据迁移，可按职责回退并同步移除对应专项门禁。
