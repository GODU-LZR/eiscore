# G4.1 企业包校验与打包退出审计

> 审计日期：2026-09-04
> 范围：独立重构仓库 `codex/systematic-refactor`；不代表三家企业资料迁移、同制品三环境运行、客户数据导入或生产发布完成。

## 结论

G4.1 已完成。企业包现在具备确定性 Manifest 生成、离线失败关闭校验、包级与逐文件 SHA-256、独立站初始化草稿契约、素材引用检查以及生产批准门禁。系统部署个性化继续由运行配置 v2 承担，公开企业资料只允许作为 `company_site` 初始化草稿进入；本阶段没有伪造伦度机电、君乐缘或经纬网厂的生产事实，也没有创建三家看似完整的生产包。

## 退出条件

| 条件 | 证据 | 结果 |
| --- | --- | --- |
| Manifest 可确定性重建 | `scripts/enterprise-package.mjs generate` 按 POSIX 路径排序 payload，保留显式 `createdAt`，递归稳定排序 Manifest 对象键 | 通过 |
| 包与文件完整性可验证 | Manifest 同时记录逐文件字节数、SHA-256 与排除自身字段后计算的 `packageSha256` | 通过 |
| 文件与字段边界失败关闭 | 未知文件/字段、遗漏文件、登记不存在文件、重复/未排序路径、路径穿越、超大文件和符号链接均被拒绝 | 通过 |
| 运行配置边界失败关闭 | 只接受企业配置 v2；运行配置、Seed 与 Manifest 企业 ID 必须一致；模块依赖继续复用平台解析器校验 | 通过 |
| 独立站初始化不越权 | `company-site-seed-v1` 固定 `siteKey=primary`、`applyMode=initialize-only`、`initialStatus=draft`，内容记录只能缺省状态或为 `draft` | 通过 |
| 数据与程序代码分离 | 企业包初始化内容只允许 JSON；SQL/PSQL、脚本/源码文件及 JSON 内的 SQL/DDL、客户专属函数、RLS 或授权语句均被拒绝 | 通过 |
| 秘密不进入企业包 | 校验器递归拒绝秘密字段、真实令牌、Data URL、大段 Base64、本机绝对路径和凭据式 URL | 通过 |
| 素材引用闭合 | `assets/...` 与运行配置 `/config/assets/...` 均回查包内文件；缺失素材失败关闭 | 通过 |
| 生产状态不可冒充 | 只有 `approved` 包可进入生产校验；事实须 confirmed、素材须 authorized/not-applicable、批准与确认人/时间须齐备，外部临时素材被拒绝 | 通过 |
| 所有权与发布边界明确 | `ENTERPRISE_SITE_CONFIGURATION.md` 固定实施运营台为设计/审核/交付控制面，EISCore 为校验/导入/运行端，运营人员仍须显式发布 | 通过 |
| 首批三家事实不被猜测 | 仓库只保留中性示例包；三家真实差异矩阵和 draft/candidate 包留到 G4.2，并要求逐项确认事实与素材授权 | 通过 |

## 确定性摘要

中性示例包固定包含：

- `data/company-site.json`
- `runtime/eiscore-enterprise.json`

当前 `packageSha256` 为 `8e6c0d15ac889de3c99209d71e1b1766dd455dd77d65daa3a499ab267fa82e7e`。在不改元数据和 payload 的情况下连续生成，`manifest.json` 文件 SHA-256 均为 `dad015f00a64ca427f0dc5dc22aaff2900bff1223be5a677e035e5cbec2edc3c`。

## 验证

- `npm run test:enterprise-package`：通过；契约测试和 CLI 失败关闭回归均通过。
- `npm run enterprise-pack:validate -- enterprise-packs/example`：通过；2 个 payload 和包级摘要一致。
- 连续执行 `enterprise-pack:generate`：通过；Manifest 字节完全稳定。
- `npm run test:enterprise-config`、`npm run test:g4.0-exit`：通过；G4.0 的 v1/v2 兼容和配置边界未回退。
- `npm run test:syntax`：通过；287 个 Node 文件语法有效。
- `npm run test:secrets`：通过；1,472 个文本文件无新增秘密泄漏。
- `npm run test:quality`：通过；G4.1 退出门禁、企业包契约和 CLI 回归已进入默认质量链。
- 直接调用项目 ESLint 入口：通过；本机 `npx eslint` 在 Node 26.1.0/npm 11.13.0 组合下出现 npm 加载器兼容错误，未将其误记为代码 lint 失败。

## 隔离与未验证项

- 本阶段只修改独立重构仓库；原始 `github-eiscore`、客户生产环境、客户数据、桌面来源资料和既有素材均未修改，未推送远端。
- 企业包生成器和校验器当前是离线交付能力，不会直接连接数据库、调用客户环境、导入 Seed 或生成发布快照。
- `data/company-site.json` 只定义初始化草稿交换契约；受控导入端点、幂等账本、现场已存在数据的拒绝证据属于后续实现。
- 伦度机电、君乐缘、经纬网厂的法定主体、正式域名、产品事实、模块/业务链、角色、迁移范围和素材生产授权仍须逐项确认。
- 三家真实候选包、实施运营台输出映射属于 G4.2；一次构建三环境及核心制品哈希一致性属于 G4.3；逐企业功能验收属于 G4.4。
- 本轮本地验证使用 Node 26.1.0/npm 11.13.0；正式发布证据仍需在规范 Node 20.19.0/npm 10.8.2 工具链复跑。

## 下一步

进入 G4.2 时先建立实施运营台输出到企业包的字段映射和三家真实资料差异矩阵，再按证据逐家形成 `draft`/`candidate`。未知事实保持缺失或 `pending`，未经授权素材不得进入 `approved`，不以占位内容伪造生产就绪。
