# 君乐缘素材接入记录

日期：2026-09-02

## 来源与保留范围

最初来源包括 `君乐缘素材.xlsx`、`君乐缘.docx`、项目采集表和企业介绍 PDF。工作簿有 1 个工作表、32 行、68 个唯一嵌入图片引用，原始图片约 603 MB；仓库没有复制这批大体积原图，只保留内部交互验证需要的派生资源。

本次合并又只读核对了企业独立站最新成果中的 `enterprise-site/assets/junleyuan-materials-v2/`。该目录共 42 个 WebP、5,140,758 字节，迁入前后逐文件 SHA-256 和字节数完全一致；以“相对路径 + 字节数 + 文件 SHA-256”生成的目录清单 SHA-256 均为 `9ab4082ff091231f4b000995d93f1b675f5f7970ee438b0a2cde524aa1380673`。源目录没有被改写。

## 版本层次

| 层次 | 文件数 | 仓库路径 | 当前用途 |
| --- | ---: | --- | --- |
| V1 JPEG | 14 | `public/assets/junleyuan-materials/` | 历史兼容和材质卡失败回退 |
| V2 WebP 卡片 | 14 | `public/assets/junleyuan-materials-v2/cards/` | 配置选项主缩略图 |
| V2 WebP 轻纹理 | 14 | `public/assets/junleyuan-materials-v2/textures/*-V002.webp` | 保留独立站最新资源集，供后续受控轻量策略选择 |
| V3 WebP 高质量纹理 | 14 | `public/assets/junleyuan-materials-v2/textures/*-V003.webp` | Three.js 球杆与镶嵌候选纹理 |

14 套材料覆盖紫心木、黑檀、枫木、可可木、孔雀木、海南黄花梨、巴西花梨木、微凹黄檀、黄金樟，以及科技木郁金香、蛇纹木八插、黑白檀高插、龙鳞插片和郁金香高插。

`src/configurator/catalog.js` 继续以 V1 记录作为材料来源身份，同时显式关联 V2 卡片、V3 纹理和 V1 回退路径。`CueStage.vue` 异步加载 V3；加载失败时保留已有的程序化木纹或实体色，不阻断配置、报价和 BOM。球杆重建或组件卸载后，过期异步结果与已加载 GPU 纹理都会释放。`OptionGroup.vue` 使用 V2 卡片，并以 V1 JPEG 作为 CSS 图层回退。

## 可追溯清单

`assets/manifests/asset_manifest.json` 的 v2 格式保留 14 条 V1 来源资产，并增加 42 条派生记录。每条派生记录包含唯一资产 ID、父资产、用途、版本、原独立站相对路径、构建路径和 SHA-256。自动测试同时校验：

- 14 套 V1/V2/V3 文件完整；
- 42 条派生记录、三个角色各 14 条且 ID 唯一；
- 清单引用的实际文件存在并与 SHA-256 一致；
- 配置器引用能够解析到来源资产和派生资产；
- Chromium 能成功解码 V2 卡片、加载 V3 纹理并在切换材料后重建球杆。

## 使用边界

所有君乐缘材料资源仍统一为：

- `status=candidate`
- `approved=false`
- `commercial_use=false`
- `license_id=supplier_authorization_pending`

因此资源虽然随内部 Cue Builder 原型构建，但不能据此用于公开生产站、正式 SKU 图片、正式 PBR、报价或制造 BOM。V3 是候选视觉纹理，不应被解释为经过尺度、色彩或物理参数标定的生产级 PBR。

## 下一闸门

公开上线或正式报价前，企业负责人仍需确认每张图片的提供者及商业展示授权、木材物种/产地/出口合规、尺寸/公差/含水率/可加工区域、标准色卡与色差、价格/库存/MOQ/交期，以及材料到制造 BOM 的映射。只有授权证据和真实参数齐备后，才能把候选资产升级为版本化正式资产并进入服务端 `validate -> quote -> bom` 闸门。
