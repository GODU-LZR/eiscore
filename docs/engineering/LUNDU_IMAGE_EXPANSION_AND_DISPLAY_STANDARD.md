# 伦度独立站图片扩图与展示规范

**适用范围**：伦度独立站登录页及其后续独立站页面中的产品图、场景图、轮播图、解决方案图、制造服务图和画廊图。

**目标**：让每个图片插槽都与容器比例匹配，主体完整、居中、四周有自然留白；桌面端和移动端均不裁切、不变形、不出现黑边或横向溢出。

## 1. 图片范围

每次改版先从实际渲染结果盘点图片，按 URL 去重，建立“插槽 - 素材 - 容器比例 - 展示策略”清单。只处理真实业务图片：

- 首屏和轮播场景图
- 企业介绍、制造服务、应用场景和解决方案图
- 产品卡和产品详情图
- 底部画廊图

以下内容不进入 GPT Image 2 扩图流程：

- 伦度官方 Logo、图标、装饰性 SVG
- 3D Canvas、Three.js 模型或材质贴图
- 已经符合容器比例且无需改变构图的图片
- 含有必须保留的文字、证书编号或法律标识的原图

## 2. 扩图生成规则

### 2.1 生成前

1. 读取当前源码和浏览器实际渲染尺寸，不能只根据文件名猜测比例。
2. 记录原图尺寸、目标容器尺寸、主体类型、文件路径和公开 URL。
3. 确认图片没有承载必须由网页 HTML 展示的文字；标题、说明和按钮放在 DOM 中。
4. 产品图先确认产品结构和关键部件：泵头、法兰、轴、底座、电机端盖、电缆、线圈等。

### 2.2 GPT Image 2 提示词要求

每张图都应明确以下约束：

- 保持原产品的结构、颜色、材质、透视和光照。
- 主体放在画布中央的安全区，四周补齐自然背景。
- 主体完整可见，产品边缘距离画布边界保留稳定留白。
- 不添加文字、Logo、水印、标签、重复产品或额外零件。
- 背景颜色、地面和阴影与原图连续过渡。
- 不使用黑边、纯色硬边、拼接线或明显的生成纹理。

扩图是向外补齐画布，不是把主体放大到边缘，也不是重新设计产品。若原图主体已经接近边缘，应先以原图为参考重新构图，再进行四边 outpainting。

### 2.3 九宫格安全区

将画布划分为 3×3 九宫格：

- 中间格：放置主要产品或场景焦点。
- 上下左右四格：延展连续背景、地面、墙面或环境光。
- 四个角格：只保留背景，不放关键产品部件。

产品主体尽量落在中间格的 60% 至 80% 区域内。细长产品可以横向占据中间行，但两端仍要保留背景缓冲区。

## 3. 目标尺寸与命名

目标尺寸必须匹配实际插槽，当前伦度站采用以下基准：

| 素材类型 | 推荐尺寸 | 推荐比例 | 示例路径 |
| --- | ---: | ---: | --- |
| 首屏宽幅图 | 2048×1024 | 2:1 | `crops/hero-wide.jpg` |
| 轮播、场景、解决方案图 | 2048×1152 | 16:9 | `crops/*-wide.jpg` |
| 产品卡 | 1600×900 | 16:9 | `framed/product-*-card.jpg` |
| Logo | 保留原始尺寸 | 原始比例 | `lundu-logo.png` |

文件名应表达用途，扩图替换时保持公开 URL 不变，避免改变前端数据和缓存键。生成图先保存到独立工作目录，人工检查后再复制到：

```text
eiscore-base/public/enterprise-assets/site
enterprise-packs/lundu/assets/site
```

运行时资源和伦度企业包必须同步，否则企业包重建可能把旧图带回。

## 4. 容器与 CSS 展示规范

### 4.1 场景图和轮播图

场景图容器优先使用稳定的 `aspect-ratio`，图片使用 `object-fit: cover` 和 `object-position: center`。扩图后的背景应足够覆盖容器，`cover` 只裁切外围背景，不能裁切产品主体。

```css
.hero-media,
.story-media,
.gallery-track figure {
  aspect-ratio: 16 / 7;
  overflow: hidden;
}

.hero-media img,
.story-media img,
.gallery-track img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

首屏若使用 `2:1` 素材，应让桌面和移动容器先采用对应比例或通过媒体查询调整高度，避免 `contain` 留下上下空带。

### 4.2 产品图和产品卡

产品图必须完整展示主体，使用 `contain`，并给容器设置稳定比例、内边距和最小尺寸。不要用 `cover` 裁切泵体、电机、法兰或电缆。

```css
.product-card-media,
.manufacturing-series-media,
.solution-media {
  aspect-ratio: 16 / 9;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.product-card-media img,
.manufacturing-series-media img,
.solution-media img {
  width: 100%;
  height: 100%;
  padding: clamp(8px, 2vw, 24px);
  object-fit: contain;
  object-position: center;
}
```

若产品在视觉上过小，只能先调整图片自身外围留白或小幅增加图片缩放，不能用负边距、固定高度或 `cover` 强行放大。

### 4.3 响应式要求

- 图片容器使用 `aspect-ratio`、`min-width`、`max-width` 和 `min-height` 等稳定约束。
- 移动端按钮、标题和图片说明不得被图片挤压换成不可读的多行布局。
- 移动端保持主体位于中间安全区；如果容器比例变化，优先调整容器比例和 `object-position`，不要直接裁切。
- 所有图片父级设置 `overflow: hidden`，但不允许通过隐藏溢出掩盖主体裁切。
- 禁止通过 `background-size: cover` 替代需要完整展示的产品 `<img>`。

## 5. 视觉验收

每次替换图片后必须做本地构建和真实浏览器验收。最低视口集合：

```text
390×844
414×896
768×1024
1440×900
```

逐一检查：

1. 图片请求均为 HTTP 200，`naturalWidth` 和 `naturalHeight` 大于 0。
2. 产品或场景主体完整、居中，关键部件没有被裁切。
3. 图片与容器边界无黑边、硬色带、拼接线和明显模糊。
4. 图片没有被拉伸，宽高比与目标素材一致。
5. `document.documentElement.scrollWidth === viewport.width`，没有横向溢出。
6. 轮播每个分页点都能切换，切换后图片仍完整。
7. 页面错误和控制台错误为 0；Logo 和标题仍属于伦度。
8. 页面正文、入口和公开配置不包含“君乐缘”或 `junleyuan`。

建议保留逐视口截图、图片 URL 清单和接触表。接触表用于检查九宫格安全区、产品主体完整性和黑边，不替代真实浏览器验收。

## 6. 发布与协作

伦度远端是开发/验收 Docker Compose 环境。涉及 web 发布时，发布前必须在协作文档中声明：

- 目标服务：`web`。
- 当前分支和提交。
- 完整制品路径、Manifest 版本、数量和 SHA-256。
- 受影响的资源范围。
- 对其他 Agent 的影响。

发布流程：

1. `npm run build` 生成完整 `dist`，不得只发布局部目录。
2. 生成完整制品和 Manifest，记录入口主包及资源数量。
3. 使用 `/opt/lundu-eiscore/.lundu-web-publish.lock` 串行发布。
4. 原子备份并替换 `/opt/lundu-eiscore/release`。
5. 只重建必要的 `lundu-eiscore-web-1`，不重建 DB、API、Agent、DeepSeek Web 或 Harness。
6. 发布后重新执行 HTTP、Manifest、品牌门禁和四视口浏览器验收。

禁止：

- 使用 `git add -A` 纳入其他 Agent 的未提交文件。
- 覆盖其他 Agent 正在运行的发布。
- 用局部 dist、旧归档或未核对的企业包发布。
- 修改公开 URL 以绕过缓存，而不记录资源版本和回滚路径。

## 7. 交付记录模板

每次图片扩图发布在 `docs/engineering/LUNDU_REMOTE_BRANDING_FIX_20260927.md` 追加以下信息：

```text
日期：YYYY-MM-DD
图片范围：N 张唯一图片，M 张本轮扩图
规则：目标尺寸、比例、安全区和展示策略
源码资源：运行时资源路径、企业包资源路径
制品：完整归档路径、Manifest 版本/数量/总字节数、SHA-256
发布：目标服务、分支/提交、备份路径、实际重建服务
验收：四个视口、图片节点数、断图数、横向溢出、控制台错误、品牌门禁
```

当前已验证的参考发布为 2026-10-05：13 张唯一图片、11 张本轮 GPT Image 2 扩图，Manifest `1fc106518c10bb50` / 619 项，完整制品 SHA-256 为 `6377d89a4288a0c7114fbb83355a26d972fb8c236784566e91eba24d7238a1e2`，线上仅重建 `lundu-eiscore-web-1`。
