# 经纬网厂独立站与制造系统信息架构

## 1. 公开站与正式系统边界

经纬项目现在将公开获客路径与正式 EISCore 系统分开。公开站只承担产品展示、方案介绍和规格询盘；制造协同演示页面已下线，正式生产业务通过管理员入口访问。

```text
/company-site/jinwei                 公开独立站
  首屏现场影像 → 产品族 → 制造能力 → 流程说明 → 规格询盘
                                          │
                                          └─ POST /agent/company-site/public/leads

https://jwwc-admin.eiscore.top       正式 EISCore 管理端（需登录）
```

生产环境公开站以 qiankun 的 `/company-site` 基路径为准。历史地址 `/company-site/jinwei/manufacturing` 由网关重定向到公开独立站首页。

## 2. 公开独立站

页面文件：[JinweiSite.vue](../../src/views/JinweiSite.vue)

### 首屏与导航

- 使用现场网片图片作为第一视口信号，标题直接写工厂名称。
- 导航只保留产品、制造、流程和规格询盘四个任务入口。
- EISCore 链接指向独立的管理员域名，不在公开站展示演示数据。

### 产品与能力

四个产品族来自调研资料：有结网、无结网、绳索、养殖网箱。每个产品族展示路线摘要和现场图片，点击后会把产品选择带入询盘表单。

### 规格询盘

询盘按业务顺序分为三组：

1. 产品与规格：材质、网结、D 数/PLY、网眼/目数、尺寸、颜色、重量、后处理、包装与唛头。
2. 采购需求：数量、目标日期、交付地区、用途和补充要求。
3. 联系信息：企业、联系人、邮箱、电话/WhatsApp 和跟进授权。

提交行为：

- 客户端先校验关键字段和跟进授权。
- 使用 `Idempotency-Key` 调用现有 `/agent/company-site/public/leads` 接口。
- 只提交规格文本和必要联系信息；页面不在浏览器保存联系人数据。
- 服务失败时显示可读错误，不伪造询盘编号。

## 3. 建议的正式领域对象

首批数据库设计可按下列关系拆分，避免把所有内容重新塞回一个 Excel：

```text
customer
  └─ sales_contract
       └─ contract_line (product + specification_version)
            ├─ delivery_batch
            ├─ material_reservation / purchase_requirement
            ├─ production_order → operation → machine_report
            ├─ outsource_order → issue_receipt_pair
            ├─ quality_inspection
            ├─ package_unit (barcode + label + net_weight)
            └─ inventory_lot (contract ownership + location)
```

关键约束：

- `specification_version` 一旦被生产任务引用，不允许无审计地覆盖。
- 每次领用、移交、发出、交回和接收都带合同、规格版本、批次、数量和操作者。
- `package_unit` 是成品库存和分批交付的最小扫描单元。
- 库存可用量按合同归属计算，不能用一个公共库存数字覆盖不同合同。
- 质量不放行时，包装入库和发货动作必须被阻止。

## 4. 权限与设备边界

第一阶段按角色提供最小操作面：

| 角色 | 主要动作 | 不应默认开放 |
| --- | --- | --- |
| 销售 | 录入/确认客户规格、分批交付、查看发货状态 | 修改机台报工和库存调整 |
| 计划员 | 锁定规格、齐套、排程、委外计划 | 修改客户原始需求 |
| 车间 | 扫码领用/接收、报工、异常上报 | 修改合同归属和质检放行 |
| 仓库 | 批次、库位、包装码、出入库交接 | 修改生产工艺参数 |
| 质检 | 来料/过程/成品检验与放行 | 删除追溯记录 |
| 经营者 | 查看跨模块阻塞和交期风险 | 绕过审计直接改库存 |

移动/PDA 页面应只保留“任务卡 → 扫码 → 数量/位置 → 确认 → 异常”这条路径，桌面分析、历史表和配置项不放在现场操作首页。
