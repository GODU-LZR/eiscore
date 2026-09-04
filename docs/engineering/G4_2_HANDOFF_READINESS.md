# G4.2 企业包交接与首批资料就绪基线

> 基线日期：2026-09-04
> 状态：G4.2 进行中；字段映射、来源边界和首批差异矩阵已建立，三家企业包尚未创建。
> 范围：独立重构仓库 `codex/systematic-refactor`；不代表企业确认、生产素材授权、客户数据导入或上线批准。

## 结论

实施运营台到企业包的交接现在有机器可验证的边界：33 组字段分别映射到运行配置、独立站初始化 Seed、Manifest 治理或非敏感交付证据；8 个来源记录明确区分候选、确认和治理证据；首批三家企业均有完整字段覆盖的 readiness 快照。该快照又确定性生成 99 个字段决策和 4 个素材决策的确认请求，供企业、部署、实施和权利人按职责回填。

本基线没有把历史 SQL、公开网络研究或采集工作簿改写成已确认事实。三家 `packageStatus` 均为 `not-created`，`productionEligible` 均为 `false`，没有生成看似完整的 `draft`/`candidate`，也没有恢复用户删除的经纬图库文件。

## 机器契约

| 制品 | 职责 |
| --- | --- |
| `config/enterprise-package-handoff.schema.json` | 同时约束字段目录和 readiness 快照，禁止未知结构 |
| `config/enterprise-package-handoff-fields.json` | 固定 33 组运营台字段到企业包路径的映射、范围、责任人和生产规则 |
| `enterprise-handoffs/first-wave-readiness.json` | 记录三家字段状态、8 个来源、素材库存、审批和阻断项，不保存待确认值 |
| `scripts/validate-enterprise-handoff.mjs` | 核对目录哈希、来源路径、完整字段覆盖、状态语义、素材实际数量及生产批准条件 |
| `enterprise-handoffs/first-wave-confirmation-request.json` | 从 readiness 确定生成 99 个字段与 4 个素材决策，不携带待确认值或批准结果 |
| `scripts/enterprise-confirmation-request.mjs` | 生成/校验确认请求，绑定 readiness、字段目录及请求自身 SHA-256，拒绝手工删项和来源漂移 |

字段目录按目标分为：

- `runtime/eiscore-enterprise.json`：内部企业身份、系统品牌、隔离环境端点、模块和功能开关。
- `data/company-site.json`：公开身份、域名、语言、模板、主题、联系/社交/商标/SEO，以及页面、产品、方案、案例、知识和证据草稿。
- `manifest.json`：事实状态、素材状态和显式生产批准。
- `evidence/handoff.json`：角色权限、必需业务链和迁移范围等非秘密交付证据；该目标只有在未来正式进入包时才作为 Manifest `evidence` 文件登记。

## 失败关闭语义

校验器要求：

1. 每家 readiness 必须逐项覆盖字段目录，数组按 ID 排序且不重复。
2. `candidate` 必须有候选来源和阻断项；`missing` 不能伪装来源。
3. `confirmed` 与 `not-applicable` 必须引用企业确认、部署确认或素材授权来源，历史 SQL、公开研究和实施审计不能完成确认。
4. 敏感外部来源不得绑定仓库副本或本机路径；交接记录递归拒绝秘密字段、凭据 URL、Data URL 和嵌入 Base64。
5. 素材 `presentFileCount` 必须与当前工作树实际文件数一致；`authorized` 还要求文件完整、`commercialUse=true` 和权利人授权来源。
6. `productionEligible=true` 只有在包、三类审批、全部必需字段和全部素材同时满足生产规则且没有阻断项时才成立。
7. 交接策略继续固定 `siteKey=primary`、`applyMode=initialize-only`、`initialStatus=draft`；交接或导入不能自动发布。

## 首批三家差异矩阵

| 企业 | 字段状态 | 素材状态 | 当前结论 |
| --- | --- | --- | --- |
| 经纬网厂 | 23 组 candidate、10 组 missing | 研究图库 28/31，`incomplete`，商用授权 pending | 页面、产品、SEO、名称和域名有历史候选；模块、联系、角色、业务链与迁移范围未确认，旧 `published` 必须转为 draft |
| 君乐缘 | 25 组 candidate、8 组 missing | V1 14/14、V2/V3 42/42，均为 `candidate`，商用授权 pending | 内容和素材迁移输入较完整；正式主体/域名/产品范围仍需复核，模块、角色、业务链和迁移范围缺失 |
| 伦度机电 | 5 组 candidate、28 组 missing | 0 个可迁移素材，`absent` | 18 表工作簿只能支持内部身份、需求开关和迁移范围的部分候选；独立站品牌、域名、产品、文案、联系、语言及素材仍未提供 |

### 经纬网厂

现有 SQL Seed、管理品牌配置、页面/模型、研究文档和图库是候选输入，不是企业批准事实。历史名称、品牌和域名只能保持 `candidate`；公开网络图片不能直接成为商用素材。研究图库原登记 31 个文件，当前工作树保留 28 个，缺少的 3 个文件属于用户已有删除，本阶段不恢复、不复制、不批准。

### 君乐缘

现有 SQL Seed、独立站、球杆配置器和素材清单可支持内容迁移设计。14 个 V1 来源素材和 42 个 V2/V3 派生素材文件完整，但资产清单仍明确为 `supplier_authorization_pending`、`approved=false`、`commercial_use=false`。历史域名、主体、产品和文案仍需企业确认，任何候选转换后只能以 draft 进入。

### 伦度机电

外部采集工作簿有 18 个工作表和 18 张表；“项目总览”和“企业与独立站”存在部分合同来源候选，13 个业务工作表尚无可迁移记录。工作簿中的信用代码、法定代表人、完整地址等敏感字段不复制到本快照或一般工程文档。范围、产品、BOM、工艺和质量资料仍是 P0，品牌、正式域名、市场语言、公开产品、联系与素材授权仍需采集。

## 历史输入转换规则

旧 `company_site_*_seed.sql` 只作为来源证据，不能成为企业包 payload。形成 JSON Seed 时必须：

1. 逐条提取并保留来源引用，不执行 SQL，不复制 DDL 或授权语句。
2. 删除数据库控制字段、执行时间和 `published_at/published_by/published_snapshot` 语义。
3. 将站点固定为 `initialStatus=draft`，所有内容记录缺省或显式设为 `status=draft`。
4. 将素材路径改为包内 `assets/...`，逐文件登记 SHA-256，并在授权未关闭时保持候选、禁止生产批准。
5. 只有运行身份、端点、模块和功能开关也获得确认后，才生成可校验的 `draft`/`candidate` 企业包；初始化仍不得覆盖现场数据。

## 验证与当前停点

已建立以下离线验证：

```powershell
npm run test:enterprise-handoff
npm run enterprise-handoff:validate -- enterprise-handoffs/first-wave-readiness.json
npm run test:enterprise-confirmation
npm run enterprise-confirmation:validate -- enterprise-handoffs/first-wave-confirmation-request.json
```

下一步不是继续猜字段，而是按已生成的确认请求取得三家企业对以下内容的权威确认：公开主体/品牌/域名和控制权、市场语言、公开产品及文案、公开联系与隐私要求、内部系统标题、模块/功能开关、角色权限、至少一条上线业务链、迁移范围，以及 Logo/图片/商标的商用授权。确认响应仍须经过后续受控回填，不能直接编辑请求文件；确认来源进入 readiness 后，才能逐家生成新的 `draft`/`candidate` 包并继续 G4.2。
