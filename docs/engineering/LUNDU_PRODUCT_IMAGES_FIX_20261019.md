# 伦度公开产品和采购单图片修复（2026-10-19）

## 问题与边界

用户在 `https://lundu.eiscore.top` 看到产品卡片以“三”等名称首字代替图片。公开档案接口返回 83 个产品，`content.products[].imageUrls` 均为空；原页面只为历史产品编码配置图片，而当前导入编码为 `LUNDU-P-PUMP-*`、`LUNDU-P-MOTOR-*`，因此没有命中。图片资产本身未丢失。

本次从重构仓库的独立工作树 `codex/fix-lundu-empty-carousel`、基线 `817e442cf503b58164fc897d0a55bd670e4cd4af` 修复。只更新伦度 Web 静态前端，不写数据库，不重建 DB、API、Agent、DeepSeek/Harness，不操作惠众。

## 修复

- 保留合法已发布产品图优先级，缺图时按既有产品编码、系列和分类选择现有伦度图片。
- 潜水/污水泵、管道泵、自吸泵、单相及三相电机分别复用现有系列图；无法识别的产品不强配图片。系列图用于展示，不能视为每个 SKU 的实拍照片。
- 伦度图片回退仅在 `enterprise.id=lundu` 时启用，其他企业不使用伦度图片。
- 产品卡片、详情、制造服务入口、加入采购单与本地采购单恢复共用图片结果；恢复采购单按当前产品重新取图，不信任旧缓存图片。
- 采购单图片失败后只尝试一次系列回退；再次失败清空，避免循环加载。
- 采购单缩略图使用 `object-fit: contain` 并取消桌面与移动端放大，完整显示产品主体。
- 浏览器在 390px 视口复现产品区有图片但整体透明：较长产品区无法达到 18% 的交叉观察阈值。阈值改为进入视口即显示，保留原渐显效果与一次性解除观察。
- 保留原水泵 BOM 三维拆解/组装、六张首页轮播、Logo、地图和其他艺术资源。

## 验证与发布记录

`node tests/engineering/lundu-product-image-regression.mjs`、`npm run test:enterprise-profile`、`npm run lint:changed`（5 文件）、`git diff --check` 已通过。独立审查已核对真实组件的加入/恢复/错误处理、租户边界和防循环逻辑。

浏览器候选使用真实 `lundu.eiscore.top` hostname，仅拦截静态资源为本次构建，公开 API 仍读取现网。不能用 localhost 替代该项测试：企业档案有域名匹配保护。首轮一次公开档案请求取消未重现；后续真实接口返回正常，不据此修改权限、域名检查或超时策略。

### 本地构建与候选验收

完整 12 入口候选目录为本独立工作树的 `eiscore-base/dist`。11 微应用已从各包构建，宿主在最终修复后重建成功，随后执行 `node scripts/aggregate-frontend-dist.mjs` 和 `node scripts/generate-client-cache-manifest.mjs eiscore-base/dist`。

- manifest：`2ef653fcc2779be6` / 609 项 / 77,427,670 bytes。
- 主包：`/assets/index-D2z3lVl9.js`；登录包：`LoginView-CwCAOwyh.js`。
- 独立只读复核：12 入口、92 个去重直接资源缺失 0；11 微应用共 466 文件与各自 dist 全文件 SHA-256 一致；manifest 文件集没有遗漏或历史备份文件。
- Playwright CLI 会话 `codex-lundu-product-images-final` 在 390×844、414×896、768×1024、1440×900 通过：12 产品卡、0 字符占位、0 坏图；产品区滚入后 opacity=1；详情图、旧采购单恢复后的水泵/电机图与加入采购单正常；缩略图 contain；无横向溢出或错误企业品牌；浏览器错误 0。
- 六张轮播配置及艺术资源保留；三维 canvas 就绪，拆分/组装按钮可操作，移动端可在 canvas 区域滚动页面。截图已逐张视觉检查，位于 `output/playwright/lundu-product-images-candidate-{catalog,quote,pump-exploded,pump-assembled}-*.png`。
- 没有提交采购单、发送客服消息或写入业务数据；采购单验收仅使用本会话浏览器存储。

本节记录发布前候选验收；实际远端发布与线上验收见下文。

### 发布门禁发现与处置

首次 SFTP 传输断开，没有切换 release；改用 SCP 兼容传输后，制品 SHA-256 核对通过。第一次切换后全清单 HTTP 门禁遇到 `/agent/company-site/public/assets/site/factory-overview.jpg` 返回 404，已自动回退，复核远端 manifest 恢复为 `56fc8646ccb90f09` / 549 项。

该图片是历史 tracked `public` 兼容副本，Vite 会复制进静态制品。仓库通用 Nginx 和 2026-10-09 恢复记录已有精确静态 location，但伦度部署配置缺少该规则，导致被 `/agent/` 通用 API 代理截走。伦度当前页面没有引用该历史图片。

将同一精确静态规则补到 `deploy/lundu/nginx/lundu-eiscore.conf`，发布时只增量补入远端配置，保留其余配置和所有代理。完整 609 项 manifest 不删减，前端制品无需重建。配置和 release 均备份，失败时一起恢复；仍只重建 web。

### 实际远端发布（已完成）

2026-10-19 07:06 UTC（北京时间 15:06）在共享锁 `/opt/lundu-eiscore/.lundu-web-publish.lock` 内发布成功。源码提交 `9ff93969a16fe3ac96fa3b1d6457f04e5c403e3e`，部署配置提交 `68de0ac5`，均已推送到 `eiscore/codex/fix-lundu-empty-carousel`。这表示任务分支已推送，不表示重构主分支已整合。

- 完整 12 入口归档：外层工作区 `output/lundu-product-images-20261019/lundu-product-images-9ff93969.tar.gz`，42,153,022 bytes；SHA-256 `46d652f036e89bcfd623d6553b9fd0cb2e46a0ce9881404f0954d0bd0a6c2e8d`。
- 运行目录：`/opt/lundu-eiscore/release`；线上 manifest `2ef653fcc2779be6` / 609 项 / 77,427,670 bytes；入口 `/assets/index-D2z3lVl9.js`。
- 只在远端原 Nginx 配置中增量加入上述精确静态规则，没有用工作树的整份配置覆盖远端其他代理。
- 实际只重建 `lundu-eiscore-web-1`，新容器 `18b8d49f05be`。`agent`、`deepseek-web`、`api`、`db` 的容器 ID 和启动时间均未改变；未操作惠众。
- `nginx -t` 通过；既有重复 MIME 警告及既有 DeepSeek Web orphan 提示未作清理。
- 旧完整 release：`/opt/lundu-eiscore/backups/release-pre-product-images-20261019T070604Z`。
- 旧 Nginx 配置：`/opt/lundu-eiscore/backups/nginx-pre-product-images-20261019T070604Z.conf`。

回退时先持有同一发布锁，确认当前版本没有被后续发布替换；保留当前完整 release 后恢复上述 release 和 Nginx 配置，只执行 `docker compose --env-file /opt/lundu-eiscore/.env -f /opt/lundu-eiscore/compose.yml up -d --no-deps --force-recreate web`。不得回退数据库或重建其他服务。

### 真实线上验收（已通过）

- 发布门禁从服务器实际 HTTP 入口读取全部 609 项及 manifest/config/SW，每项 SHA-256 均与制品一致。首次发布失败的兼容厂房图已返回 200。
- 独立只读 HTTPS 复核：12 个精确 `index.html` 入口均 200，字节与候选一致；manifest 为 JSON；Logo 为 `image/png`；兼容厂房图为 `image/jpeg`；主包、登录包和三维水泵包均正确返回 JavaScript 且哈希一致。公开档案仍为伦度、83 产品，无跨企业品牌。
- Playwright 使用真实 `https://lundu.eiscore.top`，没有静态拦截，在 390×844、414×896、768×1024、1440×900 全部通过：12 产品卡、0 字符占位、0 坏图，详情图、旧采购单恢复、水泵/电机缩略图与数量均正常；无横向溢出和浏览器错误。
- 六张轮播逐一点击并解码成功，六个 URL 各不相同；水泵分别等待拆分进度到 1、组装到 0 后截图，移动端 canvas 上滚动仍正常。
- 共 12 张线上截图已逐张视觉复核：四视口产品区、四视口采购单、手机与桌面完整拆分/组装。图片主体完整、采购单不再使用“三”等首字占位。
- 另用允许 Service Worker 的独立浏览器上下文验证受控后刷新：worker `/sw.js` 生效，缓存名对应本次 manifest，12 产品图片全部正常，无占位、溢出或页面错误；截图已检查。此项为新上下文刷新检查，不宣称覆盖所有历史浏览器缓存升级路径。

发布日志：外层工作区 `output/lundu-product-images-20261019/deployment-final.log`。线上脚本、日志与截图在本工作树 `output/playwright/lundu-product-images-*`，其中 `remote-qa.log` 和 `remote-cache-qa.log` 记录真实运行结果；文件名包含 `candidate` 的证据仍仅代表候选。

本次没有写业务数据库、提交订单或调用真实客服模型。缺图产品使用现有系列展示图，不代表已补齐每个 SKU 的独立实拍照片。
