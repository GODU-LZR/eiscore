# 企业包交接记录

本目录保存实施运营台到企业包之间的非运行时交接记录。交接记录用于说明字段是否缺失、仅为候选或已获确认，以及来源、素材库存、授权、审批和阻断项；它不是企业包 payload，不会被挂载到运行环境，也不会自动写入数据库。

`first-wave-readiness.json` 是首批三家企业的基线快照，遵循 `config/enterprise-package-handoff.schema.json`，并通过 SHA-256 固定 `config/enterprise-package-handoff-fields.json` 的 33 组字段映射。快照刻意不保存采集表中的敏感值、个人联系方式、合同原件、秘密、本机路径或待确认的完整企业配置。

`first-wave-confirmation-request.json` 是从该快照确定性生成的确认请求，当前包含 99 个字段决策和 4 个素材决策。它同时绑定 readiness 与字段目录的 SHA-256；来源或缺口变化后必须重新生成，不能手工删除问题来制造就绪状态。请求只描述当前状态、责任人、可选决策和阻断项，不包含待确认字段值，也不表示任何事实、授权或生产批准已经获得。

验证命令：

```powershell
npm run enterprise-handoff:validate -- enterprise-handoffs/first-wave-readiness.json
npm run enterprise-confirmation:generate -- enterprise-handoffs/first-wave-readiness.json enterprise-handoffs/first-wave-confirmation-request.json
npm run enterprise-confirmation:validate -- enterprise-handoffs/first-wave-confirmation-request.json
```

确认请求的决策含义：

- `provide-and-confirm`：补充缺失值并由责任方确认。
- `confirm`：确认现有候选值；候选来源自身不能执行这个决策。
- `confirm-not-applicable`：由责任方明确确认该条件字段或素材集不适用。
- `authorize`：权利人确认素材完整、允许商用；不等于批准企业包生产部署。
- `review-and-confirm`：实施或产品工程根据前置确认执行派生审查。
- `approve`：只处理独立的包生产批准；字段和素材门禁仍须分别满足。
- `reject/replace/complete-inventory/provide-inventory`：驳回、替换或补齐当前候选输入。

## 确认响应与受控回填

确认结果使用同一 Schema 中的 `enterprise-package-confirmation-response` 文档类型。响应可以只覆盖本次实际完成的决策，但每条决策都必须：

- 引用原确认请求的 `requestId` 和 `requestSha256`，且只能选择该请求为对应字段或素材列出的决策。
- 绑定与 `confirmationOwner` 一致的确认来源；素材 `authorize` 只能绑定 `asset-authorization/rights-holder`。
- 通过 `externalReference` 保存受控系统中的非敏感证据编号；响应文件不保存字段值、个人信息、秘密、凭据、授权原件或本机路径。
- 以 `responseSha256` 固定完整响应；删项、改项、请求漂移、来源冲突和责任方错配都会失败关闭。

```powershell
npm run enterprise-response:validate -- path/to/confirmation-response.json
npm run enterprise-response:plan -- path/to/confirmation-response.json
npm run enterprise-response:apply -- path/to/confirmation-response.json enterprise-handoffs/new-readiness.json
```

`applyMode=new-snapshot-only`：`apply` 要求一个仓库内且尚不存在的输出路径，只写新的 readiness，并在 `appliedResponses` 中登记响应哈希；不会原地覆盖来源快照。`confirm`、`provide-and-confirm`、`confirm-not-applicable` 和已满足前置门禁的治理复核可以更新字段状态，`authorize` 可以更新完整素材集的授权状态。`provide-inventory`、`complete-inventory`、`replace` 与一般驳回只登记为 `record-only-refresh-required`，必须先由实施人员重建素材库存或 readiness，再生成下一轮请求。

受控回填不会创建企业包、写入数据库、发布站点、覆盖现场数据或把 `productionEligible` 自动改为 `true`。事实、素材和生产批准仍是相互独立的门禁；`governance.factStatus`、`governance.assetStatus` 与 `governance.productionApproval` 的响应在前置项未满足时会被拒绝。

状态边界：

- `missing`：没有可用于该字段的候选来源。
- `candidate`：存在迁移输入，但不能作为企业确认或生产事实。
- `confirmed`：必须引用 `enterprise-confirmation`、`deployment-confirmation` 或 `asset-authorization` 类型的权威确认来源。
- `not-applicable`：也必须有权威来源明确确认不适用，不能由实施方自行猜测。

交接快照中的 `trackingId` 只是资料追踪键，不自动成为运行配置的企业 ID。只有事实、部署端点、模块、业务链、素材授权和审批达到契约要求后，才创建新的 `draft` 或 `candidate` 企业包版本。
