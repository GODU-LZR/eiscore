# 经纬网厂独立站试用 Docker 包

此目录提供一个与现有 EISCore 容器隔离的试用栈：

- `jinwei-web`：构建 `eiscore-company-site`，对外只绑定宿主机 `127.0.0.1:18192`。
- `jinwei-leads`：轻量询盘接收服务，使用 Docker volume 保存 JSON；只用于测试，不接正式 PostgreSQL、客户或销售数据。
- `host-nginx.conf`：宿主机 Nginx 的独立域名反代模板，域名为 `jwwc.eiscore.top`。

DNS 已核验指向 `149.104.26.71`。部署前仍需确认服务器登录权限和现有 Nginx 配置，不能覆盖默认站点。

## 本地验证

在仓库根目录执行：

```bash
docker compose -f deploy/jinwei/docker-compose.yml config
docker compose -f deploy/jinwei/docker-compose.yml up -d --build
curl -i http://127.0.0.1:18192/healthz
curl -i http://127.0.0.1:18192/
docker compose -f deploy/jinwei/docker-compose.yml ps
```

询盘接口使用和独立站相同的路径：

```bash
curl -i -X POST http://127.0.0.1:18192/agent/company-site/public/leads \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: local-jinwei-trial-001' \
  --data '{"companyName":"试用客户","contactName":"测试联系人","email":"test@example.com","productSlugs":["knotless-net"],"message":"规格询盘测试","consent":{"accepted":true}}'
```

相同 `Idempotency-Key` 重复提交应返回 `deduplicated: true`。询盘文件位于 volume `jinwei_leads_data`，不要把它当作正式客户库。

## 服务器部署顺序

1. 先用可用的 SSH 账号登录服务器，做只读审计：`hostname`、`/etc/os-release`、`docker version`、`docker compose version`、`docker ps`、`ss -ltnp`、`nginx -T`、`df -h`。
2. 备份现有 Nginx 配置和证书目录；确认 `127.0.0.1:18192` 未被占用。
3. 上传仓库或仅上传本目录及构建所需源码，在仓库根目录运行：

   ```bash
   docker compose -f deploy/jinwei/docker-compose.yml up -d --build
   ```

4. 复制 `host-nginx.conf` 为新的 `jwwc.eiscore.top` server block，先执行 `nginx -t`，再 `systemctl reload nginx`。如果宿主机已有同名 server block，应合并代理 location，不要创建重复监听配置。
5. 先用 HTTP 验收 `/healthz`、`/`、`/company-site/jinwei`、移动端布局和询盘幂等提交，再使用现有证书或 certbot 配置 HTTPS。证书申请和 DNS/防火墙变更必须按服务器现状执行。

## 回滚

```bash
docker compose -f deploy/jinwei/docker-compose.yml down
```

删除容器不会自动删除 `jinwei_leads_data` volume；如需清理试用询盘，先导出并由负责人确认后再执行 `docker volume rm <project>_jinwei_leads_data`。宿主机 Nginx 回滚应恢复部署前备份，并再次执行 `nginx -t`。

## 生产边界

该 JSON 服务没有正式登录、审批、RLS、备份策略或客户数据保留策略。上线前必须切换到已有 company-site leads API/PostgreSQL，配置认证、审计、限流、备份和隐私政策；不要直接把试用 volume 当作生产数据源。

