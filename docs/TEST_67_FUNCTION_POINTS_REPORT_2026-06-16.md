# EISCore 67 个完整功能点自动化测试报告

报告日期：2026-06-16  
测试对象：远端环境 `https://nanpai.eissys.top`  
测试工具：Playwright Chromium  
测试命令：

```bash
LD_LIBRARY_PATH=$PWD/tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu \
npm run test:e2e:functions67:remote
```

## 一、测试结论

| 指标 | 结果 |
|---|---:|
| 功能点总数 | 67 |
| 通过 | 67 |
| 失败 | 0 |
| 通过率 | 100% |
| 耗时 | 约 6.4 分钟 |

本轮已经按照旧版完整 UI 报告中的 67 个桌面/移动功能点重新建设为 Playwright 自动化用例，并在远端环境执行完整验证。67 个功能点均完成页面打开、非白屏、关键文案、基础交互面和前端错误检查。

测试过程中曾发现 `FP20 仓储管理 - 库存查询` 在全表搜索时触发远端 400：页面把前端派生字段 `warehouse_lv1_name`、`warehouse_lv2_name`、`warehouse_lv3_name` 提交给 `/api/v_inventory_current`。源码已在 `eiscore-materials/src/views/InventoryCurrentGrid.vue` 将这 3 个前端派生列标记为 `searchable: false`，本地 `npm --prefix eiscore-materials run build` 通过后，已将仓储前端 dist 同步到远端 `/var/www/nanpai-eiscore/materials/` 并复测通过。

## 二、自动化资产

| 交付项 | 文件 | 说明 |
|---|---|---|
| 67 点清单 | `tests/e2e/function-points-67.mjs` | 固化 67 个功能点的模块、名称、路由、页面类型和关键文案。 |
| 67 点 E2E | `tests/e2e/function-points-67.spec.mjs` | 对 67 个点逐一执行登录态注入、页面访问、非白屏、关键文案、网格/驾驶舱/特殊页面交互面、HTTP 4xx/5xx 和浏览器错误检查。 |
| 根命令 | `package.json` | 新增 `test:e2e:functions67` 与 `test:e2e:functions67:remote`。 |
| 缺陷修复 | `eiscore-materials/src/views/InventoryCurrentGrid.vue` | 修正库存查询全表搜索误带前端派生仓库层级字段的问题。 |

## 三、执行记录

| 功能点 | 模块 | 名称 | 路由 | 结果 |
|---|---|---|---|---|
| FP01 | 基座门户 | 工作台首页 | `/` | PASS |
| FP02 | 基座门户 | 系统设置 | `/settings` | PASS |
| FP03 | 基座门户 | 企业 AI | `/ai/enterprise` | PASS |
| FP04 | 基座门户 | 产品介绍页 | `/eiscore` | PASS |
| FP05 | 人事管理 | 人事花名册 | `/hr/employee` | PASS |
| FP06 | 人事管理 | 部门架构图 | `/hr/org` | PASS |
| FP07 | 人事管理 | 权限管理 | `/hr/acl` | PASS |
| FP08 | 人事管理 | 用户管理 | `/hr/users` | PASS |
| FP09 | 人事管理 | 调岗记录 | `/hr/app/b` | PASS |
| FP10 | 人事管理 | 考勤管理 | `/hr/app/c` | PASS |
| FP11 | 仓储管理 | 物料 | `/materials/app/a` | PASS |
| FP12 | 仓储管理 | 批次号规则 | `/materials/batch-rules` | PASS |
| FP13 | 仓储管理 | 仓库管理 | `/materials/warehouses` | PASS |
| FP14 | 仓储管理 | 库存台账 | `/materials/inventory-ledger` | PASS |
| FP15 | 仓储管理 | 入库 | `/materials/inventory-stock-in` | PASS |
| FP16 | 仓储管理 | 生产入库单 | `/materials/inventory-stock-in?ioType=生产入库` | PASS |
| FP17 | 仓储管理 | 出库 | `/materials/inventory-stock-out` | PASS |
| FP18 | 仓储管理 | 生产领料单 | `/materials/inventory-stock-out?ioType=生产领料` | PASS |
| FP19 | 仓储管理 | 销售出库单 | `/materials/inventory-stock-out?ioType=销售出库` | PASS |
| FP20 | 仓储管理 | 库存查询 | `/materials/inventory-current` | PASS |
| FP21 | 仓储管理 | 库存大屏 | `/materials/inventory-dashboard` | PASS |
| FP22 | 销售管理 | 销售驾驶舱 | `/sales/cockpit` | PASS |
| FP23 | 销售管理 | 客户档案 | `/sales/app/customers` | PASS |
| FP24 | 销售管理 | 客户跟进 | `/sales/app/follow_ups` | PASS |
| FP25 | 销售管理 | 销售商机 | `/sales/app/opportunities` | PASS |
| FP26 | 销售管理 | 销售订单 | `/sales/app/orders` | PASS |
| FP27 | 销售管理 | 销售出货申请 | `/sales/app/shipment_requests` | PASS |
| FP28 | 销售管理 | 回款记录 | `/sales/app/payments` | PASS |
| FP29 | 采购管理 | 采购驾驶舱 | `/purchase/dashboard` | PASS |
| FP30 | 采购管理 | 供应商档案 | `/purchase/app/suppliers` | PASS |
| FP31 | 采购管理 | 采购需求 | `/purchase/app/demands` | PASS |
| FP32 | 采购管理 | 采购订单 | `/purchase/app/orders` | PASS |
| FP33 | 采购管理 | 到货跟踪 | `/purchase/app/arrivals` | PASS |
| FP34 | 生产管理 | 生产总览 | `/production/overview` | PASS |
| FP35 | 生产管理 | 产品配方 | `/production/bom` | PASS |
| FP36 | 生产管理 | 工艺模板 | `/production/bom` | PASS |
| FP37 | 生产管理 | 配方清单 | `/production/app/bom_list` | PASS |
| FP38 | 生产管理 | 生产建议 | `/production/app/plans` | PASS |
| FP39 | 生产管理 | 生产工单 | `/production/app/work_orders` | PASS |
| FP40 | 生产管理 | 订单/工单报工 | `/production/app/work_reports` | PASS |
| FP41 | 生产管理 | 生产领料单 | `/production/app/picking_orders` | PASS |
| FP42 | 生产管理 | 领料跟进 | `/production/app/work_order_items` | PASS |
| FP43 | 质量管理 | 质量总览 | `/quality/dashboard` | PASS |
| FP44 | 质量管理 | 检验台账 | `/quality/app/inspections` | PASS |
| FP45 | 质量管理 | 检验单 | `/quality/app/inspection_orders` | PASS |
| FP46 | 质量管理 | 生产检验 | `/quality/app/production_inspections` | PASS |
| FP47 | 质量管理 | 质量异常 | `/quality/app/ncr` | PASS |
| FP48 | 质量管理 | 整改任务 | `/quality/app/actions` | PASS |
| FP49 | 质量管理 | 质量审核 | `/quality/app/audits` | PASS |
| FP50 | 质量管理 | 检验标准 | `/quality/app/standards` | PASS |
| FP51 | 设备管理 | 设备总览 | `/equipment/dashboard` | PASS |
| FP52 | 设备管理 | 设备台账 | `/equipment/app/assets` | PASS |
| FP53 | 设备管理 | 点检记录 | `/equipment/app/checks` | PASS |
| FP54 | 设备管理 | 设备巡检 | `/equipment/app/equipment_patrols` | PASS |
| FP55 | 设备管理 | 设备异常 | `/equipment/app/issues` | PASS |
| FP56 | 设备管理 | 维保工单 | `/equipment/app/work_orders` | PASS |
| FP57 | 设备管理 | 巡检计划 | `/equipment/app/plans` | PASS |
| FP58 | 设备管理 | 保养标准 | `/equipment/app/standards` | PASS |
| FP59 | 应用中心 | 应用中心首页 | `/apps` | PASS |
| FP60 | 应用中心 | Flash 应用构建器 | `/apps/flash-builder` | PASS |
| FP61 | 应用中心 | 工作流设计器 | `/apps/workflow-designer` | PASS |
| FP62 | 应用中心 | 数据应用配置 | `/apps/data-app` | PASS |
| FP63 | 应用中心 | 应用配置中心 | `/apps/config-center` | PASS |
| FP64 | 应用中心 | 本体关系工作台 | `/apps/ontology-relations` | PASS |
| FP65 | 应用中心 | 审批中心 | `/apps/workflow-approval-center` | PASS |
| FP66 | 决策支持 | 决策支持首页 | `/decision` | PASS |
| FP67 | 移动端/PDA | 移动端入口 | `/mobile/` | PASS |

## 四、缺陷修复记录

| 项 | 内容 |
|---|---|
| 功能点 | `FP20 仓储管理 - 库存查询` |
| 用户动作 | 打开库存查询页后，在网格全局搜索框输入 `EISCORE_67_PROBE`。 |
| 初始表现 | 页面可渲染，但浏览器控制台出现 400 资源加载错误。 |
| 根因判断 | 全局搜索把前端 `valueGetter` 派生列作为服务端查询字段提交，远端视图不支持这些字段过滤。 |
| 本地修复 | `warehouse_lv1_name`、`warehouse_lv2_name`、`warehouse_lv3_name` 增加 `searchable: false`。 |
| 远端部署 | 备份 `/var/www/nanpai-eiscore/materials` 后，使用 `rsync --delete` 同步 `eiscore-materials/dist/` 到 `/var/www/nanpai-eiscore/materials/`。 |
| 复测状态 | FP20 定向复测 PASS；完整 67 点远端复测 67/67 PASS。 |

初始失败产物保存在本地，用于缺陷追溯：

| 产物 | 路径 |
|---|---|
| 截图 | `tests/.artifacts/playwright-results/function-points-67-67-comp-24f6b-ion-points-FP20-仓储管理---库存查询-chromium/test-failed-1.png` |
| 视频 | `tests/.artifacts/playwright-results/function-points-67-67-comp-24f6b-ion-points-FP20-仓储管理---库存查询-chromium/video.webm` |
| Trace | `tests/.artifacts/playwright-results/function-points-67-67-comp-24f6b-ion-points-FP20-仓储管理---库存查询-chromium/trace.zip` |

## 五、补充验证

| 检查 | 结果 |
|---|---|
| `node --check tests/e2e/function-points-67.mjs` | PASS |
| `node --check tests/e2e/function-points-67.spec.mjs` | PASS |
| `python3 -m json.tool package.json` | PASS |
| `git diff --check` 相关文件 | PASS |
| `npm --prefix eiscore-materials run build` | PASS，Vite 提示 Node 20.18.1 低于建议的 20.19+，但构建成功。 |
| FP08 定向远端复测 | PASS，早先白屏为偶发加载问题。 |
| FP20 定向远端复测 | PASS，部署仓储前端修复后通过。 |
| FP36 定向远端复测 | PASS |
| FP61 定向远端复测 | PASS |
| FP67 定向远端复测 | PASS |
| 完整 67 点远端复测 | PASS，67/67，耗时约 6.4 分钟。 |

## 六、后续建议

1. 将 `npm run test:e2e:functions67:remote` 作为全功能点上线验收入口。
2. 当前 67 点套件单线程执行约 6.4 分钟，可后续按模块拆分并行，但上线验收建议保留单线程版本以降低远端微前端加载波动。
3. 默认浏览器 E2E 可按需要继续拆分为快速冒烟与全量验收两类，避免每次普通回归都运行完整 67 点。
