# 伦度隔离部署

这套部署使用 EISCore codex 重构分支的构建产物，单独运行 Postgres、PostgREST、Agent Runtime 和 Nginx。远端工作目录为 `/opt/lundu-eiscore`，`source/` 是仓库源码，`release/` 是前端制品，`compose.yml` 使用独立的 `lundu-eiscore` 项目名和卷。

## 已有站点的 Web 更新（EIS-011）

宿主同时承载工作台与公开独立站，工作台改动也必须保护公开站。下面是已有站点的必经路径；不得用手工 `cp`、`tar` 覆盖运行中的 `release` 或仅替换 assets。

1. 声明目标为伦度 `web`、干净分支/提交、候选路径和影响。抓取当前完整 release 作只读 baseline，并记录其 manifest/index SHA-256；不从其他企业或历史目录猜基线。
2. 运行 `npm run test:lundu-web-release`。然后在干净隔离 worktree 执行：

   ```sh
   npm run release:lundu:prepare -- --baseline /path/to/live-snapshot --output /path/to/new-candidate
   ```

   准备器检查 `937b548a` 来源和实际图片/公开档案回归，按锁文件安装、实际构建宿主；保留并逐字节验证11个微应用及艺术/配置；生成12入口、独立发布 stamp、完整 manifest 和 `release-provenance.json`。任何失败不用于发布。
3. 用专用 Playwright CLI 会话在伦度 origin 映射候选静态文件（包含 provenance），保持 `/agent/company-site/public/*` 使用真实远端 GET。设 `window.__LUNDU_RELEASE_CHECK__={expectedVersion,expectedTreeSha256}`，运行 `scripts/verify-lundu-site-browser.cjs` 并将返回 JSON 存到候选外。它必须等待真实 published-site，验四视口的六轮播、13零件拆组、12产品/详情/采购图、Logo/favicon及无溢出/错误品牌；禁止 mock `{site:null}` 冒充公开页验收。验后不能再修改候选。
4. 首次或修改缓存流程时，用 `serve-lundu-release-candidates.mjs <old> <candidate>` 启动临时 localhost 服务，在独立浏览器运行 `verify-lundu-service-worker-upgrade.cjs`，验证旧受控 SW 升级；结束关闭该自有服务。不能通过清用户缓存代替升级测试。
5. 将完整候选根目录（无外层 dist 包装）归档，记录 SHA-256；上传归档、浏览器 JSON、提交中的 Python 工具和 policy 到伦度独立 staging。先本机 `--validate-only`，再远端 `--check-only`；后者持共享发布锁，核当前 baseline、全部保护文件、Nginx、实际mount/HTTP字节和容器身份，但不切换。正式发布去掉该开关：

   ```sh
   python3 /opt/lundu-eiscore/tools/publish-lundu-web-release.py \
     --policy /opt/lundu-eiscore/deploy/lundu/web-release-policy.json \
     --archive /path/to/candidate.tar.gz --archive-sha256 <sha256> \
     --evidence /path/to/browser.json --evidence-sha256 <sha256>
   ```

   工具拒绝来源缺失、额外/缺失/改动文件、过期或不匹配的验收证明、旧线上基线、污染路径及并行锁。只原子切换完整站点并重建伦度 web，逐字节检查HTTP和非web容器不变；失败自动回退完整旧站，备份在 `backups/web-before-*`。不读出秘密，不迁移或回退业务数据库。
6. 在真实线上复跑公开浏览器检查，报告实际重建服务、主包/manifest数量、来源、回退目录和结果。候选验证不能混报线上通过。

`release-provenance.json` 绑定全部文件的实际字节（自身除外），独立于基于mtime/size的缓存manifest版本。来源/验收JSON是协作一致性证据，不是签名证明；具备root权限的人仍可绕开工具。本规则和机器门禁用于阻止既有事故路径，不作“任何人为操作都绝不可能覆盖”的承诺。

部署顺序：

1. 复制源码和前端制品到远端，生成仅存在于远端的 `.env`。
2. 将官方 DeepSeek Harness 的 EISCore client plugin 编译产物放在 `LUNDU_HARNESS_ROOT` 指向的目录中；该目录必须至少包含 `client-plugins/eiscore-auth/lib/index.js`、`client-plugins/digital-twin/lib/index.js` 和 `client-plugins/enterprise-bi/lib/index.js`。这些制品不是本后端分支源码，部署前必须作为外部 Harness 输入提供。
3. 在远端部署目录执行只读前置检查：`node source/scripts/validate-lundu-harness-artifacts.mjs --harness-root "$LUNDU_HARNESS_ROOT" --patch ./dsh-web.patch.yml`；缺少任一编译入口时必须停止，不启动容器。
   同时必须在远端 `.env` 显式设置 `DSH_PROVIDER` 和 `DSH_MODEL`；伦度 Compose 对这两个值使用缺失即失败语义，不会静默采用默认 Provider 或模型。
4. 新空库先只启动 `db`，完成角色、v1 基线和运行密钥初始化，再按 `source/database/README.md` 对已批准 release 执行一次性数据库发布作业，使用尚未开放业务流量的候选 PostgREST 验证全部迁移、postcheck 和 DB/API 契约。Compose initdb 不直接执行 `core-002` 等受治理迁移；`pg_isready` 成功不能替代发布完成。已有卷先核对目录与账本、验证备份，再执行批准的升级，不能重新初始化或删卷。当前冻结 v6 与新源码不同，独立 candidate 的隔离测试通过也不代表可部署批准。
   只有数据库发布作业成功并写入发布账本后，才执行 `docker compose up -d api agent flash-agent-runtime web deepseek-web deepseek-flash-web harness-bridge flash-harness-bridge`，等待业务与闪念两套 Runtime、Harness Web UI 和独立 bridge 健康。业务与闪念分别使用 `business-internal` 与 `flash-internal` 网络、独立 DSH/审计/Bridge 状态卷；Web UI 通过 `dsh-web-runner.mjs` 对外提供容器内 3081 端口，Nginx 必须代理到对应端口；runner 固定 Web profile 使用启动时 patch，避免依赖 HMR 服务。
5. 使用 `scripts/import-company-site-seed.mjs` 导入 `enterprise-packs/lundu/data/company-site.json`。导入只创建 `draft` 数据，开发环境通过 `COMPANY_SITE_PREVIEW_ALLOW_DRAFT=true` 提供预览。
6. 在公共入口 Nginx 中代理 `lundu.eiscore.top` 到 `lundu-eiscore-web-1`，先执行 `nginx -t` 并保留配置备份。

EISCore Runtime 必须连接独立的 HTTP→SDK bridge。`deepseek-web` 服务只运行 Harness Web UI，`deepseek-web:3080` 不得作为 `EISCORE_HARNESS_URL`；Runtime 需要的 `/v1/chat/completions` 是 EISCore 与 bridge 的兼容契约，不是官方 Web UI API。bridge 必须把官方 DSH SDK stdio JSON-RPC（`initialize`、`session/prompt`、`session.event`、`session.status`）转换为该契约，并先通过真实 runtime 加载和健康检查。没有 bridge 制品时，不得开启 EISCore Harness 主链。

Runtime 到各自 bridge 必须使用独立的随机 secret：业务使用 `EISCORE_HARNESS_BRIDGE_SECRET`、`EISCORE_TOOL_PROXY_SECRET`，闪念使用 `FLASH_EISCORE_HARNESS_BRIDGE_SECRET`、`FLASH_EISCORE_TOOL_PROXY_SECRET`（均至少 32 字符，且业务/闪念之间不得复用）。闪念还必须使用独立的 `FLASH_DEEPSEEK_API_KEY`、`FLASH_AGENT_DB_PASSWORD` 和 `FLASH_EISCORE_HARNESS_AUDIT_HASH_KEY`。bridge 缺少或校验失败时返回 401，不会进入 DSH SDK。业务 bridge 只加载业务插件，闪念 bridge 只加载 `flash-builder`；两者分别通过 `agent:8078` 和 `flash-agent-runtime:8078` 进入对应 EISCore Tool Gateway。该内部路由不接受用户 JWT，缺少 secret、活动 session 或插件能力绑定时拒绝请求。

Bridge 的 `BRIDGE_STATE_FILE` 默认是 `/var/lib/dsh/bridge-state.json`，位于 `harness_bridge_dsh_home` 卷中。该文件只保存哈希后的 session owner、插件绑定和 request replay 时间戳；状态文件损坏或不可写时 bridge 必须故障关闭，不得清空后继续接收写请求。`BRIDGE_MAX_BODY_BYTES` 与 `BRIDGE_MAX_RESPONSE_BYTES` 默认均为 2 MiB，用于限制单次请求和上游响应；`BRIDGE_SHUTDOWN_TIMEOUT_MS` 默认 1000ms，用于限制 SDK 不返回 shutdown 响应时的停机等待。重启后应通过带 `x-eis-harness-protocol: eiscore-agent-v1` 的 `GET /metrics` 检查 `state_persistence=true` 以及受控的 session/replay 计数；该端点不返回主体、租户或业务数据。
`BRIDGE_PROMPT_TIMEOUT_MS`、`BRIDGE_SESSION_DRAIN_TIMEOUT_MS` 与 `BRIDGE_RPC_TIMEOUT_MS` 默认均为 120000ms；前者限制一次 prompt，第二项要求 prompt 超时后等待真实 `session.status=idle`，第三项限制 SDK JSON-RPC receipt。若在 `.env` 中显式设置这些 timeout，必须填写正整数；生产配置校验会拒绝零值、负值和非整数。

公网根路径 `/` 应重定向到 `/login`（伦度公开登录门户）；`/company-site/` 保留为需授权的站点运营控制台。

回退使用 `/opt/lundu-eiscore/backups/eiscore-before-lundu-seed-refresh.dump` 和 Astra Nginx 的 `site.conf.bak-lundu-*`。不要复用 Jinwei 的数据库卷或秘密文件。

现有证书覆盖 `lundu.eiscore.top`，不覆盖 `*.lundu.eiscore.top`；启用二级通配符 HTTPS 前须先签发包含该名称的 DNS-01 证书。
