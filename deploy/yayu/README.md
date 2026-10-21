# 雅御独立开发测试环境

源码使用 `雅御` 分支，部署根目录 `/opt/yayu-eiscore`，公网入口 `https://yayu.eiscore.top` 与 `*.yayu.eiscore.top`。本分支官网采用青绿山水与企业业务内容，复用同源登录和 EISCore 业务模块；线上是否生效以实际发布版本和浏览器验收为准。数据库不包含惠众、伦度业务与演示数据。

官网由 `site-profile.json` 的标准 `{ site, content }` 公共配置驱动，`site.template=industry-ink-v1` 选择通用产业官网组件。品牌名称、业务介绍、艺术资源路径与 SEO 均在部署配置中；其他企业未配置此模板时保留原页面。宿主 `/login` 展示官网，“企业登录”开启原有认证弹窗；`?login=1`、业务路由的 `redirect` 和 Harness 登录交接沿用原流程，已登录用户仍进入工作台。本轮不改变认证函数、路由或用户存储。

构建不再复制或注入临时 `login.css`，该历史文件不属于新发布制品。官网资源由宿主公共目录进入候选，不能放在仍被禁止的 `/company-site/` 路径下。新官网不会实例化旧产品三维展示、采购列表或客服界面；旧版本发布目录保留作为整体回退目标。

`source/` 用于雅御开发；`releases/<version>/` 为构建候选，`releases/current` 为当前静态制品，`releases/previous` 为上次成功版本。Web 必须将整个 releases 目录只读挂载为 `/srv/releases`，以 `/srv/releases/current` 为站点根；容器固定名称 `yayu-eiscore-web`，独立 loopback `127.0.0.1:18396`。

构建容器使用 Node 20.19 以上的 Node 20 镜像。将雅御源码挂载 `/workspace`、独立 releases 挂载 `/releases`，将雅御部署配置只读覆盖 `/workspace/eiscore-base/public/config/eiscore-enterprise.json`。配置须为 `enterprise.id=yayu`、`publicBaseUrl=https://yayu.eiscore.top`；构建宿主、apps、hr、sales 和 mobile 入口。`apps` 入口承载闪念编辑器和预览运行时；普通应用中心通过 `appCenterVisible=false` 隐藏，闪念 Harness 关闭时其专用路由也不可用。`materials` 与 `purchase` 保留依赖契约标记，但 `materialsVisible/purchaseVisible` 均为 false，不开放 Web 路由。现有 sales 配置契约要求 purchase 为 true，因此保留此依赖标记。密钥只保存在远端私有文件，不能注入 Vite 构建变量。

在 Compose 已定义的 builder 中运行：

```sh
cd /opt/yayu-eiscore
docker compose --profile tools run --rm -e EISCORE_SOURCE_REVISION=<40位源码提交> builder dev-20261020-001
```

也可在独立源码目录使用宿主 Node 20.19 执行相同脚本：显式设置 `YAYU_SOURCE_ROOT=/opt/yayu-eiscore/source`、`YAYU_RELEASES_ROOT=/opt/yayu-eiscore/releases` 和 `EISCORE_SOURCE_REVISION`，并先准备该源码副本自己的雅御 public 配置；不得修改其他企业源码或制品。

脚本按 lockfile 安装根、平台 SDK 和宿主、apps、hr、sales、mobile 前端依赖，运行认证、模块路由、主题、产业官网、销售、应用中心、表格写入与 Harness 回归；构建前还会独立校验实际雅御品牌配置，避免依赖示例企业专属断言。随后逐个构建并聚合到新候选。候选版本号不可覆盖；失败候选保留排查，下一次使用新版本。它不会修改 `current`。

在宿主先只读检查，再切换当前版本：

```sh
bash source/deploy/yayu/publish.sh dev-20261020-001 --check-only
bash source/deploy/yayu/publish.sh dev-20261020-001
```

发布前要求雅御 Web 已启动；没有 current 的首次启动可暂时返回 404。发布验证七个入口的文件、链接资源、清单与企业身份，运行 `docker exec yayu-eiscore-web nginx -t`，原子切换 current 后从固定雅御 loopback 核对版本。失败时恢复原 current。公网开放前还须验证 HTTPS、真实登录、模块导航、API 与运行时健康。

回退调用相同发布脚本，参数改为历史成功版本；无需重启 Web。旧哈希资源请求若跨越发布时刻可能返回 404，刷新会加载新入口；本开发环境保留历史发布目录用于人工回退，不提供跨版本哈希资源合并。并发发布需由同一负责窗口串行执行。

现有 `*.eiscore.top` 证书仅覆盖主域 `yayu.eiscore.top`，二级通配符必须使用包含 `*.yayu.eiscore.top` 的独立 DNS-01 证书。公共边缘 Nginx 的变更由部署负责人备份、检查并 reload；本静态发布脚本不会修改边缘服务或其他客户服务。

本地 UI 预览在安装宿主依赖后运行 `node deploy/yayu/preview.mjs`，入口为 `http://127.0.0.1:18420/login`。端口占用时可设置 `YAYU_PREVIEW_PORT` 改用其他端口。专用脚本提供雅御 runtime 配置（本地 `publicBaseUrl` 为空）及标准公共 profile（`site.domain` 与本地 hostname 一致），阻断对其他企业后端的代理和写入。SDK 的域名校验保持启用。仓库默认 `eiscore-base/public/config/eiscore-enterprise.json` 不是雅御配置，正式雅御构建通过 Compose 只读挂载覆盖它；直接运行普通 Vite 不能作为雅御验收。使用真实雅御 API 验证登录需要独立安排同源代理，纯 UI 预览不代表认证或业务链已通过。

初始化仅适用于新建雅御空库：Compose 的 db 依次导入 roles-v2、v1 schema/register 与独立运行密钥。保存真实 pg_dump 备份后，使用 `scripts/apply-runtime-migrations.mjs` 依次执行 runtime-v2、company-site、core 三个当前 manifest，明确指定 `--db-container yayu-eiscore-db`、备份证据、源码版本与操作者。重跑运行密钥脚本恢复 core-026 后的独立角色配置，再通过环境变量传入 `YAYU_ADMIN_USERNAME`、`YAYU_ADMIN_PASSWORD`（至少24字符）、`YAYU_ENTERPRISE_ID=yayu` 和 `YAYU_PRODUCT_NAME`，运行 `bootstrap.sql`。不得使用其他企业库或凭据。当前冻结 v6/v7 描述符与新源码存在漂移，本环境使用当前受治理迁移及实际 postcheck，不宣称通过冻结版本的完整发布契约。

`core-028` 修复管理员会话函数；`core-029` 补齐既有销售页面所需报价、合同与应收结构。`verify-sales.sql` 在独立雅御身份校验后，以 web_user 在事务内检验收款同步，再执行 ROLLBACK。仅操作本测试库，不可对客户生产库运行。

业务 Runtime 使用独立镜像；DB/API/Web 使用固定摘要。Harness 必须由有版本来源记录的外部只读 bundle 提供，不能把忽略目录或临时构建目录当作制品。将 `YAYU_HARNESS_ROOT` 设置为该 bundle 的绝对路径，并在启动前执行：

```sh
node source/scripts/validate-yayu-harness-artifacts.mjs --harness-root "$YAYU_HARNESS_ROOT" --flash-patch source/agent-harness/dsh-flash-web.patch.yml
```

校验通过后才允许 Compose 读取该目录；业务 patch 必须包含 `eiscore-auth`，传入 `--flash-patch` 时还会校验雅御源码中的闪念 patch 引用 `eiscore-auth` 与 `flash-context`，并确认后者存在于 bundle。所有模式都会校验 Web/UI 运行时文件，避免空目录挂载遮蔽镜像内置 Runtime 文件。当前仓库没有这些外部编译插件的源代码或正式制品，因此本地构建不会生成它们，也不宣称 Harness 已上线。状态、工具密钥和数据库凭据均独立生成；未配置 `DEEPSEEK_API_KEY` 或 `FLASH_DEEPSEEK_API_KEY` 时保持 `EISCORE_HARNESS_ENABLED=false`，不宣称真实模型已验收。闪念链路使用独立的 `flash-agent-runtime`、`flash-harness-bridge`、`deepseek-flash-web`、数据库角色、状态卷和 `flash` 网络，入口为 `/flash/` 与 `/harness-flash-embed/`。配置业务或闪念 AI 后只重建雅御对应服务，不能复用另一链路的密钥或工作区。官网、AI 提供方和新增业务开发分别继续，不自动更新其他企业。
