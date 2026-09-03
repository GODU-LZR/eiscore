# EISCore 企业包

企业包是在核心制品之外挂载的版本化部署输入。伦度机电、君乐缘和经纬网厂分别部署独立数据库与运行环境，但必须使用同一核心制品；不得为客户复制源码分支或重新构建客户专属 JS/CSS。

## 目录契约

```text
enterprise-packs/<enterprise-id>/
├── manifest.json
├── runtime/
│   └── eiscore-enterprise.json
├── data/
│   └── *.sql
├── assets/
│   └── ...
└── evidence/
    └── ...
```

- `manifest.json` 遵循 `config/enterprise-package.schema.json`，列出除自身外的全部文件、字节数和 SHA-256。
- `runtime/eiscore-enterprise.json` 必须使用企业运行配置 v2，并只承担内部身份、产品外观、端点、模块和功能开关。
- `data/` 只保存与结构迁移分离的幂等初始化或显式迁移输入；执行顺序和回退将在 G4.1 校验器中约束。
- `assets/` 只保存 Manifest 已登记且授权状态明确的素材。
- `evidence/` 保存非秘密的来源、确认和授权证据；不得把合同原件、个人敏感信息或密钥直接提交到产品仓库。

目录可以省略没有文件的 `data/`、`assets/` 或 `evidence/`。Manifest 中的路径必须是包根相对 POSIX 路径，禁止绝对路径、反斜杠和 `..`。历史包不可覆盖；新版本使用新的 `packageVersion` 和校验和。

## 状态边界

- `template`：纯中性示例，不代表客户事实。
- `draft`：正在采集，不得部署生产。
- `candidate`：可进入隔离验收，但事实或授权仍可能待确认。
- `approved`：事实已确认、审批信息齐备且 `productionApproved=true`；仍需通过发布门禁。

已发布 `company_site.site_config` 始终是公开企业档案唯一运行时事实源。企业包 Seed 只负责新环境初始化或显式升级，不能成为系统设置之外的新编辑器，也不能覆盖运营人员尚未发布的草稿。

`example/` 是不含真实客户信息的模板包。三家企业的候选包只能从权威资料逐字段生成；未知内容保持缺失或 `pending`，不得猜测。
