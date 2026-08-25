# Cue Builder / P01 首轮执行记录

## 已交付

- 在 `eiscore-company-site` qiankun 子应用中新增 `/company-site/cue-builder` 路由。
- 在企业站点运营首页增加 `3D 定制器 / BOM` 入口，保持子应用内部的 Element Plus 与 EISCore 主题变量体系。
- 使用 Vue 3 + Three.js 实现程序化球杆原型：整杆/细节视图、旋转缩放、焦点定位、拆解/装配、WebGL 失败提示。
- 使用统一 `designId` / `revision` 生成 Design JSON、Visual BOM、Manufacturing BOM 和可解释报价。
- 建立前节—皮头—接牙、延长接口—胶塞、重量范围等首轮规则；不相容选项在 UI 中禁用，前节切换会同步相容的皮头和接牙。
- 设计草稿同时保存到浏览器 `localStorage` 和 platform configuration API；浏览器缓存只作为离线回退，服务端保存才生成正式 revision、snapshot hash、校验结果和 BOM 快照。
- 服务端提供 `POST/PATCH /agent/company-site/public/configurations*`、`validate`、`quote`、`bom`、`share` 和限时 shared preview；每个配置 token 仅能访问自己的配置。
- 建立许可证台账、资产清单和 BOM 映射；当前所有程序化材质与几何均标记为 prototype，未宣称正式商用资产已获批。

## 验证记录

在 2026-08-13 执行：

```text
platform npm test  10 passed
platform npm run check  passed
Cue Builder npm test  7 passed
Cue Builder npm run build  passed
```

使用本地 Vite preview + Chromium 对 `/company-site/cue-builder` 做桌面 1440×1000 与移动 390×844 验收：

- 两个视口均返回 HTTP 200，页面标题、3D Canvas 和路由正常。
- 两个视口均无横向溢出；桌面配置舞台固定高度 760px，内容区在面板内部滚动。
- 移动端按 `Open options` 展开配置面板；桌面端配置栏默认可见。
- 11.75 mm 皮头在默认 JF01 前节下被禁用；切换 JF02 前节后自动同步 JF02 接牙；设计草稿可保存到浏览器。
- 浏览器控制台无页面异常；Chromium 的 Three.js WebGL 驱动只报告 GPU/弃用提示，不影响交互。

2026-08-14 Round 10 继续验收：

- 3D 舞台继续使用程序化几何作为未获生产授权的原型几何；君乐缘木料候选图已接入前把/后把/高插选项卡，默认整杆显示可辨识木纹和连续缠把。
- 视觉层级补足皮头、先角、接牙与接环、前把、握把、后把、尾板、胶塞和尾端端面；选择高插后前把出现八点装饰，且 BOM/Design JSON 仍保留同一 variant ID。
- Round 10 截图：`output/playwright/round10-default-desktop.png`、`round10-default-mobile.png`、`round10-inlay-desktop.png`；桌面与移动均无横向溢出、杆尖和尾端完整可见、控制台无错误。
- 候选木料照片只作为内部 prototype/candidate 选材预览，未宣称物种、库存、价格、授权或生产可用性；公开服务端响应继续执行素材来源脱敏。

2026-08-13 P04 联合回归（隔离 platform 状态文件、Vite production preview、Chromium）：

- 首次保存创建 1 个配置（HTTP 201），随后 `validate` / `quote` / `bom` 均返回 200，页面显示 `SYNCED`。
- 刷新页面只通过 `GET /configurations/:id` 恢复同一配置；没有重复 POST/PATCH，revision 保持 `R1`，页面显示 `Restored from server`。
- Review 表单提交 RFQ 返回 201，状态为 `pending_human_review`，复用同一 revision 和 snapshot hash；运营台能看到 1 条定制询价和 1 条关联线索。
- 公开 quote / BOM 响应和分享快照不包含 `JLY-MAT-*` 或工作簿来源字段，候选资产仍为 `prototype_only` / `rfq_required`。
- 390x844 测量：`scrollWidth=390`、`clientWidth=390`，Canvas 正常，页面无横向溢出；控制台无应用错误，仅有 Three.js 驱动提示。

2026-08-14 Round 7 视觉修正与生产回归：

- 依据《君乐缘素材.xlsx》的产品展示、冲杆和手工杆图片，调整了程序化原型的真实长杆比例、前把到后把的连续渐变、先角/皮头尺寸和尾端收口。
- 将前把高插改为贴合杆身的嵌入式长尖点；接牙改为主接环加细端环，移除容易误读为弹簧的多重环组；缠把选项使用双向螺旋纹理，无缠把时保留木质握把。
- 本地 Chromium 在桌面 `1440x1000` 与移动 `390x844` 完成 Full、Detail、Explode 截图检查；两端 Canvas 正常、无横向溢出、无应用控制台错误。
- 生产 `https://junleyuan.eissys.top/company-site/cue-builder` 返回 HTTP 200；桌面 Full/Detail/Explode 和移动 Full 均加载新 `CueBuilder-BeREACwj.js`，移动端 `scrollWidth=390`、`clientWidth=390`。
- 生产服务 `nginx` 与 `company-site-platform.service` 保持 active；部署前备份为 `/var/www/eiscore/company-site.bak.20260814_030527`。本轮未改动平台状态、订单、库存或生产任务。
- 验收截图保存在工作区 `output/playwright/production-round7-full.png`、`production-round7-detail.png`、`production-round7-exploded.png` 和 `production-round7-mobile-final.png`。

2026-08-14 Round 8 视觉回归：

- 重新按真实视觉检查调整程序化几何：保持标准台球杆的细前节、接牙、粗后把、缠把和尾端胶塞连续关系，移除默认状态容易被误读为装饰片的前把尖片。
- 接牙增加清晰的深色分隔与金属接环；显示比例和 3/4 镜头增加安全边距，桌面与移动端均能看到完整杆尖和尾端。
- Chromium 截图：`output/playwright/round6-desktop.png`、`output/playwright/round6-mobile.png`；两端 Canvas 正常、无横向溢出、无 `.stage-error`。
- 本轮仍只改变展示几何和镜头，不改变 Design JSON、BOM、报价或生产闸门；所有候选素材继续保持 `prototype_only` / `rfq_required`。

构建环境当前为 Node 20.18.1；Vite 提示推荐 Node 20.19+，但本轮构建已成功。正式 CI/生产构建应升级 Node 到项目 engines 要求的版本。

## 当前边界

- 本轮是 P01/P02/P03 的可运行垂直切片，不包含真实工厂 SKU、正式 PBR 纹理、供应商授权文件或生产级 CDN 资产。
- 不直接创建 EISCore 订单、库存预留或生产任务；后端的 validate / quote / bom 接口通过后，才允许进入订单链路。
- 价格为 indicative prototype quote，候选素材状态为 `prototype_only` / `rfq_required`，不能作为对外承诺；服务端不会创建订单、库存预留或生产任务。

## 下一闸门

1. 由工厂确认 SKU、尺寸、公差、可选组合和实际成本，冻结 catalog v1。
2. 为每个正式材质补齐来源 URL、许可证快照、授权/采购凭证、SHA-256 和缩略图，并把 `approved` 从 `false` 改为可审计状态。
3. 运营台完成人工 RFQ 的材料、成本、MOQ、库存和交期审核，并保留 revision / snapshot hash 追踪。
4. 将正式 catalog、许可证和工厂确认数据接入服务端素材审核闸门，候选素材仍不得升级为生产资产。
5. 在 RFQ 审核后再设计 EISCore 草稿同步，不直接写订单、库存或生产任务。
