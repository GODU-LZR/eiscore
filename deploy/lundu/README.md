# 伦度隔离部署

这套部署使用 EISCore codex 重构分支的构建产物，单独运行 Postgres、PostgREST、Agent Runtime 和 Nginx。远端工作目录为 `/opt/lundu-eiscore`，`source/` 是仓库源码，`release/` 是前端制品，`compose.yml` 使用独立的 `lundu-eiscore` 项目名和卷。

部署顺序：

1. 复制源码和前端制品到远端，生成仅存在于远端的 `.env`。
2. 将官方 DeepSeek Harness 的 EISCore client plugin 编译产物放在 `LUNDU_HARNESS_ROOT` 指向的目录中；该目录必须至少包含 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js` 和 `client-plugins/enterprise-bi/lib/index.js`。这些制品不是本后端分支源码，部署前必须作为外部 Harness 输入提供。
3. 在远端部署目录执行只读前置检查：`node source/scripts/validate-lundu-harness-artifacts.mjs --harness-root "$LUNDU_HARNESS_ROOT" --patch ./dsh-web.patch.yml`；缺少任一编译入口时必须停止，不启动容器。
   同时必须在远端 `.env` 显式设置 `DSH_PROVIDER` 和 `DSH_MODEL`；伦度 Compose 对这两个值使用缺失即失败语义，不会静默采用默认 Provider 或模型。
4. `docker compose up -d db api agent web deepseek-web harness-bridge`，等待数据库、Agent、Harness Web UI 和独立 bridge 健康。Web UI 通过 `dsh-web-runner.mjs` 对外提供容器内 3081 端口，Nginx 必须代理到该端口；runner 固定 Web profile 使用启动时 patch，避免依赖 HMR 服务。
5. 使用 `scripts/import-company-site-seed.mjs` 导入 `enterprise-packs/lundu/data/company-site.json`。导入只创建 `draft` 数据，开发环境通过 `COMPANY_SITE_PREVIEW_ALLOW_DRAFT=true` 提供预览。
6. 在公共入口 Nginx 中代理 `lundu.eiscore.top` 到 `lundu-eiscore-web-1`，先执行 `nginx -t` 并保留配置备份。

EISCore Runtime 必须连接独立的 HTTP→SDK bridge。`deepseek-web` 服务只运行 Harness Web UI，`deepseek-web:3080` 不得作为 `EISCORE_HARNESS_URL`；Runtime 需要的 `/v1/chat/completions` 是 EISCore 与 bridge 的兼容契约，不是官方 Web UI API。bridge 必须把官方 DSH SDK stdio JSON-RPC（`initialize`、`session/prompt`、`session.event`、`session.status`）转换为该契约，并先通过真实 runtime 加载和健康检查。没有 bridge 制品时，不得开启 EISCore Harness 主链。

Runtime 到 bridge 必须使用独立的随机 `EISCORE_HARNESS_BRIDGE_SECRET`（至少 32 字符）；bridge 缺少或校验失败时返回 401，不会进入 DSH SDK。工具调用另外使用与 `agent` 服务共享的随机 `EISCORE_TOOL_PROXY_SECRET`（至少 32 字符）。两个 secret 不得复用。bridge 从同源 `LUNDU_HARNESS_ROOT` 加载 `eiscore-restricted.cordis.yml` 和 `eiscore-tools.mjs`，仅通过 `http://agent:8078/internal/harness/tool` 进入 EISCore Tool Gateway；该内部路由不接受用户 JWT，缺少 secret、活动 session 或插件能力绑定时拒绝请求。

Bridge 的 `BRIDGE_STATE_FILE` 默认是 `/var/lib/dsh/bridge-state.json`，位于 `harness_bridge_dsh_home` 卷中。该文件只保存哈希后的 session owner、插件绑定和 request replay 时间戳；状态文件损坏或不可写时 bridge 必须故障关闭，不得清空后继续接收写请求。`BRIDGE_MAX_BODY_BYTES` 与 `BRIDGE_MAX_RESPONSE_BYTES` 默认均为 2 MiB，用于限制单次请求和上游响应；`BRIDGE_SHUTDOWN_TIMEOUT_MS` 默认 1000ms，用于限制 SDK 不返回 shutdown 响应时的停机等待。重启后应通过带 `x-eis-harness-protocol: eiscore-agent-v1` 的 `GET /metrics` 检查 `state_persistence=true` 以及受控的 session/replay 计数；该端点不返回主体、租户或业务数据。
`BRIDGE_PROMPT_TIMEOUT_MS`、`BRIDGE_SESSION_DRAIN_TIMEOUT_MS` 与 `BRIDGE_RPC_TIMEOUT_MS` 默认均为 120000ms；前者限制一次 prompt，第二项要求 prompt 超时后等待真实 `session.status=idle`，第三项限制 SDK JSON-RPC receipt。若在 `.env` 中显式设置这些 timeout，必须填写正整数；生产配置校验会拒绝零值、负值和非整数。

公网根路径 `/` 应重定向到 `/login`（伦度公开登录门户）；`/company-site/` 保留为需授权的站点运营控制台。

回退使用 `/opt/lundu-eiscore/backups/eiscore-before-lundu-seed-refresh.dump` 和 Astra Nginx 的 `site.conf.bak-lundu-*`。不要复用 Jinwei 的数据库卷或秘密文件。

现有证书覆盖 `lundu.eiscore.top`，不覆盖 `*.lundu.eiscore.top`；启用二级通配符 HTTPS 前须先签发包含该名称的 DNS-01 证书。
