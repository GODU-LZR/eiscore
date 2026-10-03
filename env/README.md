# Env

此目录用于存放环境与初始化相关文件。

- `.env`：本机或部署环境变量，不得提交到 Git。
- `.env.example`：可提交的变量契约模板，其中占位符不能直接部署。
- init_roles.sql：数据库初始化角色脚本（供 docker-compose 使用）。
- `../database/baselines/eiscore-db-v1/`：受校验和保护的规范数据库基线；Compose 只读挂载 `schema.sql` 与 `register.sql`，不再使用结构和业务数据混合转储。
- `../scripts/configure-database-runtime-secret.sh`：空库首次初始化时把部署提供的 JWT 密钥写入数据库运行设置；脚本不包含或输出密钥值。
- `insert_ai_config.sql`：已退役的 GLM 旧模型配置历史文件，已由 DeepSeek Harness 路径取代；默认数据库执行策略禁止运行，禁止手动执行。
- login_payload.json：登录测试载荷示例。

## 创建生产配置

```bash
cp env/.env.example env/.env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
node scripts/validate-production-env.mjs --env-file env/.env
docker compose --env-file env/.env -f docker-compose.prod.yml config --quiet
```

请为 `POSTGRES_PASSWORD` 和 `PGRST_JWT_SECRET` 分别生成一次随机值，不要复用。`EISCORE_PUBLIC_BASE_URL` 必须是没有路径和末尾 `/` 的 HTTPS 公网地址。

生产 Compose 对数据库凭据、公网地址和 Harness 运行参数使用“缺失即失败”语义。必须显式配置 `EISCORE_HARNESS_ENABLED=true`、专用 HTTP→SDK bridge 的桥接 URL、审计文件路径、至少 32 字符的审计哈希密钥、独立的 `EISCORE_HARNESS_BRIDGE_SECRET`（Runtime→Bridge）和 `EISCORE_TOOL_PROXY_SECRET`（Bridge→Runtime Tool Proxy），以及 DSH provider/model；旧模型和 Cline 凭据不再使用。根级生产 Compose 已包含 `harness-bridge`，并只读挂载当前仓库的 `agent-harness` 插件与 Bridge 源码。

`deepseek-web:3080` 只提供 DeepSeek Harness Web UI，不是 EISCore Runtime 可调用的 bridge，不能填入 `EISCORE_HARNESS_URL`。该 URL 必须指向单独部署、实现官方 DSH stdio JSON-RPC（`initialize`、`session/prompt`、`session.event`、`session.status`）到 EISCore HTTP 契约的 bridge 服务。没有经过版本锁定和运行时验收的 bridge 制品时，保持 Harness 主链关闭，不以 Web UI 端口替代。
