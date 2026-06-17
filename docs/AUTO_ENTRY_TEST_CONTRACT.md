# 自动入库测试契约

日期：2026-06-18

## 结论

后续每新增一个自动入库类型，必须在同一个改动中同时提供：

1. `realtime/document-*-entry.js` 自动入库实现。
2. `tests/engineering/*-regression.mjs` 离线工程回归，并配置 npm script。
3. `tests/business/full-chain.mjs` 中的业务链闭环测试标记和真实 API 写入验证。

`npm run test:unit` 已接入 `npm run test:auto-entry-coverage`。如果新增自动入库实现但没有登记离线回归和 business-chain marker，单元回归会失败。

## 当前覆盖

| 自动入库类型 | 离线回归 | 业务链覆盖 |
|---|---|---|
| 通用 app-data 文档入库 | `npm run test:document-entry` | `AUTO_ENTRY_CHAIN:generic-app-data-document-entry` |
| 固定采购入库 | `npm run test:document-fixed-entry` | `AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry` |

固定采购入库业务链已在远端 `https://nanpai.eissys.top` 验证：

- 调用 `scm.stock_in`
- 查询 `scm.v_inventory_transactions`
- 校验 transaction/batch/quantity/remark
- 清理生成的库存流水和测试批次

## 本轮验证

| 命令 | 结果 |
|---|---|
| `npm run test:auto-entry-coverage` | PASS，2 types |
| `npm run test:unit` | PASS |
| `npm run test:syntax` | PASS，36 files |
| `npm run test:business-chain:remote` | PASS，32/32 |
| `npm run test:engineering:remote:api` | PASS，smoke 23/23、business-chain 32/32 |

最新远端工程报告：

`tests/.artifacts/nanpai-engineering-suite-2026-06-17T16-33-50-345Z.md`
