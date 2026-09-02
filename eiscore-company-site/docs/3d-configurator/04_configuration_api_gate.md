# Configuration API / P04 服务端事实源

## 目标

Cue Builder 的视觉交互只产生候选 Design JSON。服务端负责保存不可变 revision、重算校验、报价和 Visual / Manufacturing BOM，并为后续 RFQ 和 EISCore 同步保留明确边界。

## 接口

| Method | Path | 作用 |
| --- | --- | --- |
| POST | `/agent/company-site/public/configurations` | 创建配置；必须带 `Idempotency-Key`，返回 `configurationToken` |
| GET | `/agent/company-site/public/configurations/:id` | 用 configuration token 恢复服务端快照 |
| PATCH | `/agent/company-site/public/configurations/:id` | 以 token 更新配置并生成下一 revision |
| POST | `/agent/company-site/public/configurations/:id/validate` | 重算兼容规则和素材生产闸门 |
| POST | `/agent/company-site/public/configurations/:id/quote` | 返回 indicative quote；未完成资产/工厂确认时为 `rfq_required` |
| POST | `/agent/company-site/public/configurations/:id/bom` | 返回 Visual BOM 和 Manufacturing BOM |
| POST | `/agent/company-site/public/configurations/:id/share` | 返回有期限的 share token |
| POST | `/agent/company-site/public/configurations/:id/rfq` | 将当前 revision 作为 RFQ 上下文提交到线索/人工跟进链 |
| GET | `/agent/company-site/public/configurations/shared/:token` | 读取不暴露内部素材来源的公开预览 |

## 闸门

- `valid` 只表示 Design JSON 通过当前 prototype 兼容规则，不表示可以生产。
- `productionGate.status=prototype_only` 表示仍有未批准或未完成商业授权的素材。
- `quote.commercialStatus=rfq_required` 表示价格仅用于交互和询价引导，不能作为正式报价。
- 只有素材同时满足 `approved=true`、`commercialUse=true`、`assetStatus=approved`，并补齐许可证、hash、SKU、尺寸、公差、成本、MOQ、库存和交期，才允许进入后续生产/订单流程。
- 分享快照保留设计、规则结果和 BOM 结构，但清除未批准素材的 `materialAssetId`、来源和工作簿单元格。
- RFQ 只保存 `configurationId/designId/revision/snapshotHash` 和报价状态引用；联系方式进入既有 lead 记录，遵守同意、去重、幂等和人工跟进规则。
- PostgreSQL 草案将运行时 JSON 记录映射为 `configuration_records`、`configuration_revisions`、`configuration_access_tokens`、`configuration_shares`、`configuration_rfqs`；所有表使用 `(tenant_key, site_key)` 复合隔离，RFQ 通过同一复合作用域关联 `leads`。当前仍使用本地 JSON adapter，正式切换需 DBA 与 Runtime BFF 联调。
- `validate`、`quote`、`bom` 的公开返回也必须执行候选素材脱敏，不能仅依赖 share 接口脱敏；候选素材的 `materialAssetId`、`sourceId`、`sourceCell` 和未批准 asset id 不得出现在公开响应。

## 验证记录

2026-08-13：platform `npm test` 10/10，`npm run check` 通过；Cue Builder `npm test` 7/7，`npm run build` 通过。使用 Chromium 在 1440x1000 和 390x844 验证创建、validate、quote、bom、share 请求，全部返回预期状态；补充验证刷新仅 GET 恢复同一 revision、Review RFQ 进入人工审核、运营台可见 RFQ；两端无横向溢出，桌面布局高度 760px。

当前 Node 为 20.18.1，Vite 提示正式环境应升级到 `20.19+` 或 `22.12+`。
