# 生产环境配置迁移

本手册用于从历史默认配置迁移到失败关闭的生产环境契约。操作前应确认当前部署仍可访问，并安排一次会话失效窗口。

## 新部署

1. 复制模板：`cp env/.env.example env/.env`。
2. 分别执行两次以下命令，为数据库和 JWT 生成不同值：

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

3. 设置不带路径和末尾 `/` 的 `EISCORE_PUBLIC_BASE_URL`。
4. 执行：

   ```bash
   node scripts/validate-production-env.mjs --env-file env/.env
   docker compose --env-file env/.env -f docker-compose.prod.yml config --quiet
   ```

只有两个命令都成功后才能启动服务。

## 已有数据卷

仅修改 `POSTGRES_PASSWORD` 不会更新既有 PostgreSQL 数据卷中的角色密码。正确顺序如下：

1. 备份数据库和当前环境文件，并确认备份可以读取。
2. 生成新的数据库密码和新的 JWT 密钥，但不要把秘密写入命令历史、聊天或工单。
3. 在运行中的数据库容器里打开交互式管理会话：

   ```bash
   docker exec -it eiscore-db psql -U postgres -d postgres
   ```

4. 在 `psql` 中执行 `\password postgres`，按提示输入新的数据库密码，然后退出。交互式输入可以避免密码进入 Shell 历史。
5. 将同一个新数据库密码写入 `env/.env` 的 `POSTGRES_PASSWORD`；将独立生成的 JWT 密钥写入 `PGRST_JWT_SECRET`。
6. 设置企业的 `EISCORE_PUBLIC_BASE_URL`，执行环境校验和 Compose 配置校验。
7. 重新创建相关容器，并检查数据库、PostgREST、Agent Runtime 和登录流程。

JWT 密钥变化后，旧 Token 将无法验证，这是预期行为。应通知在线用户重新登录。

## 回退

- 在切换前保留受控的旧配置备份，但不要提交到 Git。
- 如果必须回退应用版本，数据库角色密码与应用环境必须保持一致；需要恢复旧密码时同样通过 `\password postgres` 交互式完成。
- 不要为了临时恢复服务重新引入仓库历史中的默认密码或 JWT 密钥。
- 数据库无法连接时，先停止继续发布，使用已验证备份和数据库管理通道恢复，而不是反复修改多个服务的秘密值。
