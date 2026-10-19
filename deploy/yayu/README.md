# 雅御独立开发测试环境

源码使用 `雅御` 分支，部署根目录 `/opt/yayu-eiscore`，公网入口 `https://yayu.eiscore.top` 与 `*.yayu.eiscore.top`。独立站页面内容另行确认，本环境先提供同源登录和 EISCore 业务模块。数据库不包含惠众、伦度业务与演示数据。

当前公开入口使用部署层 `login.css` 隐藏继承的产品宣传、采购和客服内容，只保留企业标识、登录按钮和原有认证弹窗。构建时复制为 `/config/deployment-login.css` 并写入宿主入口；不修改 Vue 页面或认证流程，后续官网方案确定后可移除此部署覆盖。

`source/` 用于雅御开发；`releases/<version>/` 为构建候选，`releases/current` 为当前静态制品，`releases/previous` 为上次成功版本。Web 必须将整个 releases 目录只读挂载为 `/srv/releases`，以 `/srv/releases/current` 为站点根；容器固定名称 `yayu-eiscore-web`，独立 loopback `127.0.0.1:18396`。

构建容器使用 Node 20.19 以上的 Node 20 镜像。将雅御源码挂载 `/workspace`、独立 releases 挂载 `/releases`，将雅御部署配置只读覆盖 `/workspace/eiscore-base/public/config/eiscore-enterprise.json`。配置须为 `enterprise.id=yayu`、`publicBaseUrl=https://yayu.eiscore.top`；开启 hr/materials/apps/sales/mobile，关闭 company-site/production/quality/equipment/decision。现有 sales 配置契约要求 purchase 为 true，因此保留此依赖标记，但采购不构建、不开放 Web 路由，并通过独立 `app_settings.visibility` 隐藏入口。密钥只保存在远端私有文件，不能注入 Vite 构建变量。

在 Compose 已定义的 builder 中运行：

```sh
cd /opt/yayu-eiscore
docker compose --profile tools run --rm -e EISCORE_SOURCE_REVISION=<40位源码提交> builder dev-20261020-001
```

也可在独立源码目录使用宿主 Node 20.19 执行相同脚本：显式设置 `YAYU_SOURCE_ROOT=/opt/yayu-eiscore/source`、`YAYU_RELEASES_ROOT=/opt/yayu-eiscore/releases` 和 `EISCORE_SOURCE_REVISION`，并先准备该源码副本自己的雅御 public 配置；不得修改其他企业源码或制品。

脚本按 lockfile 安装根、平台 SDK 和七个前端依赖，运行认证、模块路由、企业配置与两项销售回归（共五项）；构建前还会独立校验实际雅御品牌配置，避免依赖示例企业专属断言。随后逐个构建并聚合到新候选。候选版本号不可覆盖；失败候选保留排查，下一次使用新版本。它不会修改 `current`。

在宿主先只读检查，再切换当前版本：

```sh
bash source/deploy/yayu/publish.sh dev-20261020-001 --check-only
bash source/deploy/yayu/publish.sh dev-20261020-001
```

发布前要求雅御 Web 已启动；没有 current 的首次启动可暂时返回 404。发布验证七个入口的文件、链接资源、清单与企业身份，运行 `docker exec yayu-eiscore-web nginx -t`，原子切换 current 后从固定雅御 loopback 核对版本。失败时恢复原 current。公网开放前还须验证 HTTPS、真实登录、模块导航、API 与运行时健康。

回退调用相同发布脚本，参数改为历史成功版本；无需重启 Web。旧哈希资源请求若跨越发布时刻可能返回 404，刷新会加载新入口；本开发环境保留历史发布目录用于人工回退，不提供跨版本哈希资源合并。并发发布需由同一负责窗口串行执行。

现有 `*.eiscore.top` 证书仅覆盖主域 `yayu.eiscore.top`，二级通配符必须使用包含 `*.yayu.eiscore.top` 的独立 DNS-01 证书。公共边缘 Nginx 的变更由部署负责人备份、检查并 reload；本静态发布脚本不会修改边缘服务或其他客户服务。

初始化仅适用于新建雅御空库：Compose 的 db 依次导入 roles-v2、v1 schema/register 与独立运行密钥。保存真实 pg_dump 备份后，使用 `scripts/apply-runtime-migrations.mjs` 依次执行 runtime-v2、company-site、core 三个当前 manifest，明确指定 `--db-container yayu-eiscore-db`、备份证据、源码版本与操作者。重跑运行密钥脚本恢复 core-026 后的独立角色配置，再通过环境变量传入 `YAYU_ADMIN_USERNAME`、`YAYU_ADMIN_PASSWORD`（至少24字符）、`YAYU_ENTERPRISE_ID=yayu` 和 `YAYU_PRODUCT_NAME`，运行 `bootstrap.sql`。不得使用其他企业库或凭据。当前冻结 v6/v7 描述符与新源码存在漂移，本环境使用当前受治理迁移及实际 postcheck，不宣称通过冻结版本的完整发布契约。

`core-028` 修复管理员会话函数；`core-029` 补齐既有销售页面所需报价、合同与应收结构。`verify-sales.sql` 在独立雅御身份校验后，以 web_user 在事务内检验收款同步，再执行 ROLLBACK。仅操作本测试库，不可对客户生产库运行。

业务 Runtime 使用独立镜像；DB/API/Web 使用固定摘要。Harness 的程序包复制为独立只读部署输入，状态、工具密钥和数据库凭据均独立生成；未配置 `DEEPSEEK_API_KEY` 时保持 `EISCORE_HARNESS_ENABLED=false`，不宣称真实模型已验收。此环境不包含 Flash Runtime/Bridge，闪念代码生成与预览未交付。配置业务 AI 后仅重建雅御 agent、harness-bridge 与 deepseek-web。官网、AI 提供方和新增业务开发分别继续，不自动更新其他企业。
