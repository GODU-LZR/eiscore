# 企业包交接记录

本目录保存实施运营台到企业包之间的非运行时交接记录。交接记录用于说明字段是否缺失、仅为候选或已获确认，以及来源、素材库存、授权、审批和阻断项；它不是企业包 payload，不会被挂载到运行环境，也不会自动写入数据库。

`first-wave-readiness.json` 是首批三家企业的基线快照，遵循 `config/enterprise-package-handoff.schema.json`，并通过 SHA-256 固定 `config/enterprise-package-handoff-fields.json` 的 33 组字段映射。快照刻意不保存采集表中的敏感值、个人联系方式、合同原件、秘密、本机路径或待确认的完整企业配置。

验证命令：

```powershell
npm run enterprise-handoff:validate -- enterprise-handoffs/first-wave-readiness.json
```

状态边界：

- `missing`：没有可用于该字段的候选来源。
- `candidate`：存在迁移输入，但不能作为企业确认或生产事实。
- `confirmed`：必须引用 `enterprise-confirmation`、`deployment-confirmation` 或 `asset-authorization` 类型的权威确认来源。
- `not-applicable`：也必须有权威来源明确确认不适用，不能由实施方自行猜测。

交接快照中的 `trackingId` 只是资料追踪键，不自动成为运行配置的企业 ID。只有事实、部署端点、模块、业务链、素材授权和审批达到契约要求后，才创建新的 `draft` 或 `candidate` 企业包版本。
