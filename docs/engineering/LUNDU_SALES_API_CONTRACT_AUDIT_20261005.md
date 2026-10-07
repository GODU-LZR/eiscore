# 伦度独立站销售 API 契约审计（2026-10-05）

## 范围

本审计针对伦度独立站的产品展示、询单 Agent、询价线索、报价确认、订单草稿和支付预留。结论基于当前 `codex/systematic-refactor` 工作树中的 `realtime/company-http.js`、`realtime/company-sales-agent.js`、`realtime/company-site.js` 和 `sql/company_site_platform_v1.sql`。

## 已有公开接口

表格中的路径是 Agent 服务相对路径；浏览器实际请求需要加 `/agent` 前缀，例如 `/agent/company-site/public/products`。公开接口不需要员工 JWT。

| 方法 | 路径 | 请求 | 成功响应 | 用途 |
| --- | --- | --- | --- | --- |
| GET | `/company-site/public/products` | `locale` 可选 | 已发布产品列表 | 产品目录 |
| GET | `/company-site/public/products/:slug` | `locale` 可选 | 单个产品详情 | 产品详情页 |
| POST | `/sales/sessions` | `channel`、`locale`、`visitorId`、`consent.accepted` | `201 { session: { id, locale, status, consentRequired } }` | 创建或恢复访客 Agent 会话 |
| POST | `/sales/sessions/:sessionId/messages` | `message` | `200 { answer, citations, needsHuman, session }` | 公开知识问答；未知问题转人工 |
| POST | `/sales/sessions/:sessionId/leads` | 公司、联系人、联系方式、`productSlugs`、数量、目标日期、留言、`idempotencyKey` | `201 { lead }`；重复请求 `200 deduplicated` | 将购物清单/询价信息落成线索 |

产品响应字段来自 `company_site.products` 与 `company_site.product_locales`：`productCode`、`slug`、`category`、`applications`、`specifications`、`delivery`、`name`、`summary`、`description`、`imageUrls`、`seo`、`faq`。只有 `status = published` 的记录进入公开 API。

## 已有内部销售链路

以下接口属于员工操作，均需要对应角色或权限，不能从未登录的独立站直接调用：

1. `POST /sales/leads/:leadId/qualify`：更新线索评分。
2. `POST /sales/leads/:leadId/opportunity-draft`：创建商机草稿，必须提供 `idempotencyKey`。
3. `POST /sales/opportunities/:opportunityId/quote-draft`：创建报价草稿，商机必须为 `approved` 或 `synced`。
4. `POST /sales/quotes/:quoteId/order-draft`：创建订单草稿，报价必须为 `approved` 或 `synced`；服务端会记录库存、BOM 和产能检查结果。
5. `POST /sales/drafts/:objectType/:objectId/approval`：人工批准或拒绝草稿。
6. `POST /sales/sync/:objectType/:objectId`（body 可含 `targetSystem`、`idempotencyKey`、`confirm: true`）：将批准草稿加入同步队列。

数据库草稿表为 `company_site.leads`、`opportunity_drafts`、`quote_drafts`、`sales_order_drafts`、`production_work_order_drafts` 和 `sync_jobs`。销售 Agent 会话与消息分别写入 `agent_sessions`、`agent_messages`，并写入 `agent_audit_events`。

## 当前缺口

- 没有公开购物车或采购清单 API。
- 没有公开报价确认 API；报价草稿属于员工审批域。
- 没有公开订单确认 API。
- 没有支付订单、支付意向、支付回调或支付状态表/路由。
- Agent 当前基于已发布知识文档匹配回答，不会直接承诺价格、库存、产能或交期；无匹配时返回 `needsHuman = true`。

## 前端联调边界

伦度独立站首期可在浏览器端维护临时采购清单（产品 slug、名称、数量、规格备注），打开 Agent 会话后将清单摘要一并提交到 `/sales/sessions/:sessionId/leads`。必须生成稳定的 `idempotencyKey`，避免重复创建线索。

询价提交成功后，页面应显示线索编号和“等待人工报价”，不要把内部 `quote-draft`、`order-draft` 或审批路由暴露给访客。支付页只能作为预留界面，显示“支付接口待接入”，直到后端提供支付意向、签名和回调契约。

## 验证

```text
node tests/engineering/company-sales-agent-regression.mjs
```

当前结果：`company-sales-agent-regression: PASS`。

本审计未修改销售后端实现，也未新增数据库迁移。
