# Env

此目录用于存放环境与初始化相关文件。

- `.env`：本机或部署环境变量，不得提交到 Git。
- `.env.example`：可提交的变量契约模板，其中占位符不能直接部署。
- init_roles.sql：数据库初始化角色脚本（供 docker-compose 使用）。
- `../database/baselines/eiscore-db-v1/`：受校验和保护的规范数据库基线；Compose 只读挂载 `schema.sql` 与 `register.sql`，不再使用结构和业务数据混合转储。
- `../scripts/configure-database-runtime-secret.sh`：空库首次初始化时把部署提供的 JWT 密钥写入数据库运行设置；脚本不包含或输出密钥值。
- insert_ai_config.sql：AI 配置初始化脚本。
- login_payload.json：登录测试载荷示例。

## 创建生产配置

```bash
cp env/.env.example env/.env
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
node scripts/validate-production-env.mjs --env-file env/.env
docker compose --env-file env/.env -f docker-compose.prod.yml config --quiet
```

请为 `POSTGRES_PASSWORD` 和 `PGRST_JWT_SECRET` 分别生成一次随机值，不要复用。`EISCORE_PUBLIC_BASE_URL` 必须是没有路径和末尾 `/` 的 HTTPS 公网地址。

生产 Compose 对三个关键变量使用“缺失即失败”语义。AI 与 Cline 配置保持可选，不配置时对应能力不可用。
