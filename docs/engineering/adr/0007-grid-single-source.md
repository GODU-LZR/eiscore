# ADR-0007：EIS Data Grid v2 迁入单一共享来源

- 状态：接受
- 日期：2026-08-31

## 背景

8 个微应用各自携带 `eis-data-grid-v2` 完整目录，共计 186 个本地实现文件。部分文件逐字节相同，入口、Core、工具栏和若干渲染器又包含真实的应用差异；继续复制会让安全、分页、编辑和交互修复发生漂移，直接选择任一副本覆盖其他副本则会丢失业务能力。

## 决策

- `shared/eis-data-grid-v2/` 是 Grid v2 的唯一可演进实现根；应用目录在迁移期可保留薄兼容入口，但不得新增共享实现的本地副本。
- 逐字节相同的模块先原样移动并由 8 个应用共同导入；存在差异的模块必须先锁定差异，再通过显式配置、组件或服务适配器注入，禁止在共享实现中按应用名写隐式条件分支。
- 每个迁移切片必须更新本地/共享文件库存，运行专项契约、受影响应用构建和完整质量门；只有 8 个应用通过兼容入口消费同一主体后才能关闭 G2。
- 共享前端模块可以解析各应用已经存在的 `@shared` 和第三方依赖；需要应用级 HTTP、会话或 AI 行为时优先显式注入，迁移期保留既有 `@/` 适配器语义并由全部消费者构建验证。

首个迁移模块是 8 份逐字节一致的 `useGridSelection`。共享实现保留拖拽范围、自动滚动、列/行范围、AG Grid 刷新与选择计数契约；8 个入口仅替换导入路径，本地文件库存由 186 降至 178，共享库存变为 1。

第二批迁移 5 个逐字节一致的 Check/File/Lock/Select/Status 基础编辑器与渲染器。共享 SFC 的裸依赖由 8 个消费者通过统一 Vite `resolve.dedupe` 锚定到各自的 Vue、Element Plus、图标和 AG Grid 单例，避免从仓库根错误解析或把第二份运行时打入微应用；本地/共享库存变为 138/6。

第三批迁移逐字节一致的 FileDialog 与 ColumnManagerDialog。FileDialog 仍通过消费者的 `@/utils/request` 解析原应用 HTTP/Profile 适配，上传、下载、删除和消息语义不变；ColumnManagerDialog 当前未被入口直接消费，但只保留共享实现以阻止未来复制。本地/共享库存变为 122/8。

第四批按差异分组迁移 CascaderEditor、CascaderRenderer、GeoDialog、GeoRenderer、CheckRenderer、SelectRenderer 和 StatusRenderer。公共字节一致基线进入共享根；应用中心继续本地提供地图/勾选扩展，材料端继续本地提供级联/下拉/状态扩展，专项契约逐消费者锁定唯一允许的变体。共享 GeoDialog 的 Leaflet 与 html2canvas 由统一 Vite dedupe 契约从消费者依赖解析；本地/共享库存变为 73/15。

第五批把 ConfigDialog 的 8 份副本收敛为共享主体。4 个显式 Props 承载原有 AI app 标识、单元格标签示例和公式示例；应用中心、采购、销售由入口注入差异，其他五端继续使用原有 `hr`/员工/工资默认值。共享主体不识别应用名，继续从消费者解析 AI context 适配器；本地/共享库存变为 65/16。

第六批把 GridToolbar 的三组布局收敛为共享主体。`layout="split"` 保留应用中心左右分栏、按钮组与间距，`full-width-rows` 保留材料端双行 100% 宽度，缺省值保留其他六端标准双行布局；按钮能力、事件、Slot、选择提示和暗色样式不变。共享主体只识别布局语义；本地/共享库存变为 57/17。

第七批把 8 份 `useGridFormula` 收敛为共享主体。共享 composable 通过最后一个 `formulaServices` 参数接收 `evaluateFormulaExpression`，不静态选择任何应用求值器；apps/equipment/hr/quality 注入共享实现，materials/production/purchase/sales 注入原本地实现，保留三类历史求值语义及消费者 Request/Profile 解析。8 个入口的导入与服务注入由专项契约锁定；本地/共享库存变为 49/18。

## 后果

后续 Grid 修复可以逐步进入一个受测试的共享根，但在入口与 Core 完成参数化前，8 个本地目录仍是 G2 阻断项。迁移不改变数据库、API、部署拓扑或页面公开 Props/Events；单提交回退可恢复本地副本。
