# G4.0 配置边界退出审计

> 审计日期：2026-09-03
> 范围：独立重构仓库 `codex/systematic-refactor`；不代表三家企业包、数据迁移、同制品运行或生产发布完成。

## 结论

G4.0 已完成。用户确认伦度机电、君乐缘和经纬网厂采用独立数据库与运行环境并共用同一核心制品；ADR-0012 已固定该拓扑。企业运行配置新增 v2 最小契约，旧 v1 登录成果继续兼容；企业包新增 Manifest Schema、目录规范、中性示例和默认质量门禁。

## 退出条件

| 条件 | 证据 | 结果 |
| --- | --- | --- |
| 部署拓扑有明确决策 | ADR-0012，用户选择隔离单租户/同制品 | 通过 |
| 新配置不重复公开企业资料 | `enterprise.v2.schema.json` 禁止 `branding.login`；登录层只生成中性兜底 | 通过 |
| 旧配置不被破坏 | 运行时显式支持 `[1, 2]`；现有南派 v1 登录品牌专项通过 | 通过 |
| 企业包边界版本化 | `enterprise-package.schema.json`、`enterprise-packs/README.md`、中性示例 Manifest | 通过 |
| 文件完整性可审计 | 示例包 Manifest 完整枚举 payload，并锁定字节数和 SHA-256 | 通过 |
| 数据与结构迁移分离 | 目录契约区分 runtime、data、assets、evidence；ADR 禁止客户源码分支 | 通过 |
| 状态与授权显式 | `template/draft/candidate/approved`、事实/素材状态和生产批准字段 | 通过 |
| 升级与回退明确 | v1 先发布档案再切 v2；回退重新挂载旧配置，不删除数据库档案 | 通过 |

## 验证

- `npm run test:enterprise-config`：通过；v1/v2、未知版本、v2 禁止旧登录字段、模块依赖和秘密字段边界均受保护。
- `npm run test:enterprise-branding`：通过；v1 完整成果保持，v2 只使用企业内部名称、Logo 和中性文案。
- `npm run test:enterprise-package`：通过；示例包 1 个 payload 文件逐项字节数和 SHA-256 一致。
- `npm run test:quality`：通过；G4.0 退出审计与企业包测试已进入默认质量门禁，Node 语法库存为 254 个文件，秘密扫描为 1,391 个文本文件。
- `npm --prefix eiscore-base run build`、`npm --prefix eiscore-mobile run build`：通过。

## 隔离与未验证项

- 本阶段只修改独立重构仓库；原始仓库、客户生产环境、客户数据和既有素材均未修改，未推送远端。
- 当前只有中性模板包，没有伪造伦度机电、君乐缘或经纬网厂的生产配置。
- 尚未实现可复用 CLI 校验器、自动生成 Manifest、资产引用检查、三家候选包、一次构建三环境运行和核心制品哈希一致性；这些进入 G4.1～G4.4。
- 本轮使用 Node 26.1.0/npm 11.13.0；正式发布证据仍需在 Node 20.19.0/npm 10.8.2 重跑。

## 下一步

进入 G4.1：实现离线企业包校验器与确定性 Manifest 生成，覆盖未知文件、路径穿越、重复路径、哈希/字节漂移、秘密值、运行配置/企业 ID 不一致、模块依赖和生产批准失败关闭。
