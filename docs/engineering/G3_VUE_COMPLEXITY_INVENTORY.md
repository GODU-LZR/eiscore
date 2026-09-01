# G3 巨型 Vue 页面库存与治理门禁

## 结论

2026-09-01 对全部 `eiscore-*/src/**/*.vue` 做物理行审计，排除构建产物、依赖、覆盖率目录和 Flash 运行期 `.app-drafts`。有效库存为 139 个 Vue 文件、115,805 行；其中 52 个文件达到 800 行，占文件数 37.4%，初始承载 90,948 行、占 Vue 总行数 78.5%。十三个 AppRuntime、四个 SalesAppGrid、七个 AiCopilot、四个 FlashBuilder、四个基座布局、三个 OntologyWorkbench、四个 ProductionAppGrid、四个 PurchaseAppGrid、七个 DocumentIntakeCenter、十四个 PurchaseDocumentDetail 纯策略切片及四个 EquipmentHome 驾驶舱策略切片后，当前库存为 109,347 行，巨页债务已降至 84,384 行，≥2,000 行极端页降至 7 个。

该结果证明巨页是系统性维护风险，不能靠一次整体重写解决。基线已进入 `config/engineering/vue-complexity-baseline.json`，质量门禁禁止既有巨页增长、禁止新增巨页，并要求总债务、极端页和关键页数量只降不增。

## 风险分层

| 等级 | 物理行 | 数量 | 处理原则 |
| --- | ---: | ---: | --- |
| 极端 | ≥ 2,000 | 10 | 优先建立特征测试，抽离纯策略、协议和领域服务 |
| 关键 | 1,200–1,999 | 21 | 在相关业务变更前先建立可替换边界 |
| 受控 | 800–1,199 | 20 | 禁止增长，随功能切片渐进拆分 |
| 正常 | < 800 | 87 | 禁止跨过 800 行阈值 |

物理行不是代码质量结论，只是进入架构审查的稳定触发器。拆分的目标是缩小理解、修改和验证范围，而不是把同一逻辑机械搬到更多文件。

## 领域分布

| 产品 | 巨页数 | 巨页行数 | 最大文件行数 |
| --- | ---: | ---: | ---: |
| 应用中心 | 8 | 15,538 | 3,741 |
| 基座 | 8 | 15,994 | 3,535 |
| 物料/仓储 | 12 | 14,945 | 1,828 |
| 移动端 | 7 | 8,632 | 1,893 |
| 销售 | 2 | 5,792 | 3,822 |
| 生产 | 3 | 5,791 | 2,077 |
| 人力 | 5 | 6,071 | 1,518 |
| 采购 | 3 | 5,868 | 1,970 |
| 设备 | 2 | 3,082 | 2,072 |
| 质量 | 2 | 2,757 | 1,767 |

完整逐文件路径和行数以机器可读基线为准，避免在多份文档中维护易漂移的重复清单。

## 极端页优先队列

| 文件 | 行数 | 首选拆分方向 |
| --- | ---: | --- |
| `eiscore-sales/src/components/SalesAppGrid.vue` | 3,822 | 数据、详情、订单链路和快速录单策略已迁出，阶段退出门禁已建立 |
| `eiscore-base/src/components/AiCopilot.vue` | 3,522 | 7 类纯策略已迁出，阶段退出门禁已建立 |
| `eiscore-apps/src/views/FlashBuilder.vue` | 3,741 | 4 类纯策略已迁出，阶段退出门禁已建立 |
| `eiscore-apps/src/views/AppRuntime.vue` | 3,725 | Runtime 协议、生命周期组合；BPMN、Workflow、自动推进、导航、Flash 来源、配置/选项、规则、就绪、授权与任务路由策略已迁出 |
| `eiscore-base/src/layout/index.vue` | 3,535 | 4 类纯策略已迁出，阶段退出门禁已建立 |
| `eiscore-apps/src/views/OntologyWorkbench.vue` | 2,184 | 3 类纯策略已迁出，阶段退出门禁已建立 |
| `eiscore-production/src/components/ProductionAppGrid.vue` | 2,077 | 4 类纯策略已迁出，阶段退出门禁已建立 |
| `eiscore-purchase/src/components/PurchaseAppGrid.vue` | 1,970 | 4 类纯策略已迁出，阶段退出门禁已建立 |
| `eiscore-base/src/views/DocumentIntakeCenter.vue` | 1,973 | 6 个纯模块/54 个导出已迁出，阶段退出门禁已建立 |
| `eiscore-purchase/src/views/PurchaseDocumentDetail.vue` | 1,916 | 11 个纯策略模块/54 个导出已迁出，阶段退出门禁已建立 |
| `eiscore-equipment/src/views/EquipmentHome.vue` | 1,820 | 4 个纯策略模块/32 个导出已迁出；继续拆分查询契约与 fallback 快照策略 |

## 持续门禁

- 扫描范围内新 Vue 文件不得达到 800 行。
- 52 个基线文件逐文件不得超过各自基线行数；文件删除或降到阈值以下视为债务下降。
- 巨页总行数的初始基线为 90,948，当前值为 84,384；≥1,200 行当前为 32 个，≥2,000 行当前为 7 个。质量门禁继续执行逐文件上限和总量只降不增，EquipmentHome 专项门禁另锁定其 1,820 行上限。
- 不允许通过重命名、移动目录、生成文件或扩充排除项规避门禁。
- 基线扩张不是普通维护动作；确有必要时必须记录 ADR、替代方案和回收计划。

## 渐进拆分规则

1. 先锁定可观察行为、公开 Props/Emits、请求契约、路由和关键状态转换。
2. 优先抽离无 Vue 依赖的纯策略、协议客户端和领域服务，再抽 Composable，最后拆视觉组件。
3. 每个切片只处理一个可命名职责，保留原页面作为组合入口，不同时改业务规则、接口和依赖版本。
4. 每次提交必须让逐文件或总债务下降，并运行专项回归、完整质量门禁、离线单元套件及所属前端生产构建。
5. CSS/模板拆分必须验证实际渲染和交互；纯行数搬运不计作完成。

## 下一切片

继续 `eiscore-equipment/src/views/EquipmentHome.vue`：展示投影、KPI/风险摘要、日期趋势/告警和数据同步策略边界已锁定并迁出，下一步评估六路查询描述与 fallback 快照策略，继续保持 Request 执行、订阅调度、路由和视觉布局不变。
