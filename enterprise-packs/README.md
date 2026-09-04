# EISCore 企业包

企业包是在核心制品之外挂载的版本化部署输入。伦度机电、君乐缘和经纬网厂分别部署独立数据库与运行环境，但必须使用同一核心制品；不得为客户复制源码分支或重新构建客户专属 JS/CSS。

## 目录契约

```text
enterprise-packs/<enterprise-id>/
├── manifest.json
├── runtime/
│   └── eiscore-enterprise.json
├── data/
│   └── company-site.json
├── assets/
│   └── ...
└── evidence/
    └── ...
```

- `manifest.json` 遵循 `config/enterprise-package.schema.json`，列出除自身外的全部文件、字节数和 SHA-256。
- `runtime/eiscore-enterprise.json` 必须使用企业运行配置 v2，并只承担内部身份、产品外观、端点、模块和功能开关。
- `data/company-site.json` 遵循 `config/company-site-seed.schema.json`，只保存独立站初始化草稿。它固定为 `siteKey=primary`、`applyMode=initialize-only` 和 `initialStatus=draft`，不得直接发布站点或覆盖运营人员已有内容。
- `assets/` 只保存 Manifest 已登记且授权状态明确的素材。
- `evidence/` 保存非秘密的来源、确认和授权证据；不得把合同原件、个人敏感信息或密钥直接提交到产品仓库。

目录可以省略没有文件的 `data/`、`assets/` 或 `evidence/`。Manifest 中的路径必须是包根相对 POSIX 路径，禁止绝对路径、反斜杠和 `..`。历史包不可覆盖；新版本使用新的 `packageVersion` 和校验和。

企业包不得携带 `.sql`/`.psql`、DDL、函数、触发器、RLS、授权语句或客户专属程序代码。PostgreSQL 表、函数、触发器、RLS 与 PostgREST 契约全部属于同一核心数据库制品；企业包只能提供经过 Schema 校验的 JSON 初始化数据。未来的导入器只能通过核心制品提供的受控初始化接口事务化写入。

## 独立站与系统配置所有权

| 载荷 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| `runtime/eiscore-enterprise.json` | 企业内部标识、系统标题、Logo/主题、API 路径、模块与功能开关 | 企业介绍、产品、页面、SEO 正文、联系方式等公开运营内容 |
| `data/company-site.json` | 新环境的独立站身份、域名、模板、语言、内容草稿与素材引用 | 自动发布、日常编辑、现场配置覆盖、数据库结构或秘密 |
| `company_site.site_config` | 由“企业站点运营”维护并显式发布的运行时公开事实 | 部署端点、密钥和核心数据库结构 |

企业包 Seed 应用完成后，独立站继续只读取 `company_site.site_config` 的已发布快照。实施运营台负责形成、审批和交付企业包，EISCore 负责校验、导入和运行；两边不得各自维护一份公开企业资料。

## 确定性生成与校验

```powershell
npm run enterprise-pack:generate -- enterprise-packs/example
npm run enterprise-pack:validate -- enterprise-packs/example
npm run enterprise-pack:validate -- enterprise-packs/<enterprise-id> --production
```

生成器按 POSIX 路径排序 payload，记录每个文件的原始字节数和 SHA-256，再对“除 `packageSha256` 自身外、递归按键排序后的完整 Manifest”计算包级 SHA-256。`createdAt` 是显式输入，生成时不会使用当前时间，因此相同元数据和相同 payload 总会得到相同 Manifest 与包级哈希。

校验器失败关闭并阻止：未知文件、路径穿越、符号链接、重复路径、遗漏文件、字节/哈希漂移、包级哈希漂移、秘密值、企业 ID 不一致、v1 运行配置、模块依赖错误、SQL/DDL、缺失素材引用，以及未批准包进入生产。带素材的 `approved` 包还必须声明 `assetStatus=authorized`。

## 状态边界

- `template`：纯中性示例，不代表客户事实。
- `draft`：正在采集，不得部署生产。
- `candidate`：可进入隔离验收，但事实或授权仍可能待确认。
- `approved`：事实已确认、审批信息齐备且 `productionApproved=true`；仍需通过发布门禁。

已发布 `company_site.site_config` 始终是公开企业档案唯一运行时事实源。企业包 Seed 只负责新环境初始化或显式升级，不能成为系统设置之外的新编辑器，也不能覆盖运营人员尚未发布的草稿。

`example/` 是不含真实客户信息的模板包。三家企业的候选包只能从权威资料逐字段生成；未知内容保持缺失或 `pending`，不得猜测。
