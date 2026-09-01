# G3 OntologyWorkbench 阶段退出审计

## 结论

`eiscore-apps/src/views/OntologyWorkbench.vue` 的纯策略拆分阶段通过退出审计。页面从 G3 起点的 2,772 行降至 2,184 行，减少 588 行（21.2%）；关系、KG 图和查询协议已进入 3 个无 Vue、Element Plus、实际 Request、ECharts、浏览器、Storage 或隐式时间依赖的纯模块，共 54 个具名导出。

该结论关闭的是 OntologyWorkbench 当前纯策略子目标，不等于把页面降到普通组件规模。页面仍有 736 行模板、660 行组合脚本和 785 行局部样式；实际 Request、ECharts 实例、ResizeObserver、交互状态和视觉区块的后续拆分必须由真实本体数据、权限角色、图交互和截图基线驱动。G3 转向当前更大的未退出高风险巨页。

## 接受门槛

| 门槛 | 结果 | 持续证据 |
| --- | --- | --- |
| 页面不得超过退出基线 | 通过：2,184 行 | 组合退出门禁与 Vue 复杂度棘轮 |
| 模板、脚本、样式不得反弹 | 通过：736 / 660 / 785 行 | SFC 分区上限门禁 |
| 核心决策离开组合页 | 通过：3 个纯策略模块、54 个导出 | 精确 Domain Import 与依赖门禁 |
| 协议与 UI 副作用不再增长 | 通过：11 个 Request、16 个消息、1 个 Router、4 个 Watch、2 个 ResizeObserver | 逐类上限门禁 |
| 不重新引入不受控平台旁路 | 通过：无 Axios、直接 Fetch/Storage、EventSource、WebSocket、XMLHttpRequest 或 `window.location` 导航 | 禁止访问门禁 |
| 页面局部可调用职责不增长 | 通过：35 个组合/展示 Callable | 声明数量上限门禁 |
| 生命周期与 DOM 调度保持稳定 | 通过：各 1 个 Mounted/BeforeUnmount、1 个 ECharts 动态加载、4 个 NextTick | 生命周期与调度门禁 |
| 离线完整验证 | 通过 | `test:quality`、`test:unit` 与应用中心生产构建 |

## 已退出页面的职责

| 边界 | 迁出职责 |
| --- | --- |
| 关系 | 关系/表筛选、稳定集合、指标、事实搜索、表标签、显示清洗、Table Key 与 Semantics Tag |
| KG 图 | 谓词/节点标签、分类/颜色、节点合并、边去重、Graph Payload、视图状态、证据与 Tooltip |
| 查询协议 | Public/App Data Profile、12 类 URL/RPC Payload、响应规范化、当前节点与邻域目标回退 |

## 页面保留职责

- 维护 Vue Ref/Computed/Watch，以及关系、推理、KG、洞察四个视图和选择/加载/错误状态。
- 通过应用中心 Request 适配器执行 11 个真实读取或 RPC，保留错误提示、并发装配和刷新时序。
- 动态加载并维护 ECharts 实例、点击选中、Graph Option、ResizeObserver、NextTick 与卸载释放。
- 装配表关系图、列语义、推理事实、角色访问、敏感路径、KG 节点/邻域/路径和业务路径展示。
- 保留 736 行现有模板和 785 行 Scoped CSS，避免无真实数据和截图证据的四视图布局、表格、图面板和响应式漂移。

这些职责是当前 OntologyWorkbench 的组合、网络、图形和展示边界。继续拆分需要获授权数据库中的真实本体/推理数据、不同角色访问路径、ECharts 点击/缩放/重排与多分辨率截图证据；只按物理行数拆模板或样式会扩大跨区状态和视觉回归风险。

## 非阻断项

- 页面仍显著高于 800 行审查阈值，逐文件与总债务棘轮继续禁止增长。
- 11 个 Request 全部通过既有应用中心适配器；新增协议不得继续内联，查询配置门禁会阻止已迁出 URL/Payload 回流。
- ECharts 动态块和 BPMN 主块仍触发既有应用中心 Chunk 体积告警，不能与页面业务重构混合处理。
- 当前只验证离线策略和生产构建，未访问数据库、RPC、企业环境或真实本体数据。
- 当前验证机为 Node 26.1.0 / npm 11.13.0；发布证据仍要求 Node 20.19.0 / npm 10.8.2。

## 回退与下一目标

三个抽取切片均为独立提交，不包含数据、接口或部署变更，可按职责单独回退；回退会恢复页面内联实现并失去对应专项门禁。退出审计本身只增加离线门禁和文档。

G3 下一目标为 2,585 行的 `eiscore-production/src/components/ProductionAppGrid.vue`。它是当前最大的未退出 Vue 巨页，直接承载生产 Grid 数据、业务动作和专用交互；应先盘点请求、表格、表单、业务链和 DOM 边界，再选择无视觉变化的纯策略切片。
