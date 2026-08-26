# 经纬网厂独立站试用 Docker 包

## 完整 EISCore 发布

`docker-compose.eiscore.yml` 是经纬网厂的独立完整栈，和已有的试用容器及其他
站点使用不同的项目名、容器名、数据卷和宿主机端口。它包含 PostgreSQL、
PostgREST、Agent Runtime、Swagger、受密码保护的 code-server，以及同时提供
公开站点和管理端的静态 Web 镜像。

在仓库根目录构建发布目录并生成缓存清单：

```bash
bash scripts/build-jinwei-release.sh
```

启动完整栈时显式指定环境文件（Compose 的 `env_file` 不参与 `${...}` 插值）：

```bash
docker compose --env-file env/.env \
  -f deploy/jinwei/docker-compose.eiscore.yml \
  up -d --build
```

正式部署前，`env/.env` 至少应包含随机生成的
`POSTGRES_PASSWORD`、`PGRST_JWT_SECRET` 和 `CODE_SERVER_PASSWORD`。
首次初始化会执行 `patch_login_jwt_secret_setting.sql`，让登录函数使用同一
个 JWT 密钥；不要把本地开发 `.env` 或其他租户的密钥复制到服务器。

完整栈的内部入口：

- `http://127.0.0.1:18193`：公开站点监听器
- `http://127.0.0.1:18194`：EISCore 管理端监听器
- `http://127.0.0.1:18079/doc/`：Swagger（由管理端 `/doc/` 反代）
- `http://127.0.0.1:18443/`：code-server（由管理端 `/ide/` 反代）

网关只需要把 `jwwc.eiscore.top` 代理到 Web 的 `8080`，把
`jwwc-admin.eiscore.top` 代理到同一容器的 `8081`。不要使用
`*.eiscore.top` 的兜底 server block，以免接管 `vedio.eiscore.top`。

此目录提供一个与现有 EISCore 容器隔离的试用栈：

- `jinwei-web`：构建 `eiscore-company-site`，对外只绑定宿主机 `127.0.0.1:18192`。
- `jinwei-leads`：轻量询盘接收服务，使用 Docker volume 保存 JSON；只用于测试，不接正式 PostgreSQL、客户或销售数据。
- `host-nginx.conf`：宿主机 Nginx 的独立域名反代模板，只匹配 `jwwc.eiscore.top` 和可选的 `*.jwwc.eiscore.top`。
- `host-nginx-https.conf`：需要 DNS-01 通配符证书时使用的 443 模板。
- `gps-edge-jinwei.conf`：当前 `gps-platform-edge` 网关使用的经纬路由块（运行时 Docker DNS 解析）。

DNS 已核验 `jwwc.eiscore.top` 指向 `149.104.26.71`。`vedio.eiscore.top` 属于现有短视频系统，不应被本配置接管。部署前仍需确认服务器登录权限和现有 Nginx 配置，不能覆盖默认站点。

## 域名隔离与通配符

如果只使用主域名，保留 `server_name jwwc.eiscore.top;` 即可。如果需要把 `demo.jwwc.eiscore.top`、`pda.jwwc.eiscore.top` 等子域也交给经纬试用系统，使用模板中的：

```nginx
server_name jwwc.eiscore.top *.jwwc.eiscore.top;
```

DNS 需要同时有两条记录（不能只配 wildcard，因为 wildcard 不覆盖 apex）：

```text
jwwc.eiscore.top       A 149.104.26.71
*.jwwc.eiscore.top     A 149.104.26.71
```

不要把 `*.eiscore.top` 写进经纬站的 Nginx server block；那会把其他应用的请求混入同一个代理选择范围。Nginx 的精确主机名会优先于通配符，但显式的独立 server block 仍更容易审计和回滚。

当前公网证书的 SAN 是 `*.eiscore.top` 和 `eiscore.top`，它能覆盖 `jwwc.eiscore.top`，不能覆盖 `foo.jwwc.eiscore.top`。启用子域通配符 HTTPS 前，需用 DNS-01 申请同时包含主域和子域 wildcard 的证书，例如：

```bash
certbot certonly --manual --preferred-challenges dns \
  -d jwwc.eiscore.top -d '*.jwwc.eiscore.top'
```

证书申请命令只作为模板，DNS TXT 校验和证书路径必须按实际 DNS/证书管理方式执行。

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

   在本服务器的 `gps-platform-edge` 网关后运行时，使用远端网络覆盖文件，让网关可以按容器名访问经纬 Web：

   ```bash
   docker compose -f deploy/jinwei/docker-compose.yml -f deploy/jinwei/docker-compose.remote.yml up -d --build
   ```

   该覆盖文件只连接已有的 `gps-platform_default` 网络，不会重新创建或停止短视频服务。

4. 对本服务器的 `gps-platform-edge`，将 `gps-edge-jinwei.conf` 中的两个 server block 合并到 `/opt/gps-platform/nginx/conf.d/edge.conf`（现有网关不是宿主机 systemd Nginx），先执行 `docker exec gps-platform-edge nginx -t`，再 `docker exec gps-platform-edge nginx -s reload`。如果已有同名 server block，应合并代理 location，不要创建重复监听配置。
5. 需要 HTTPS 时，在证书就绪后再启用 `host-nginx-https.conf`；确认它只包含 `jwwc.eiscore.top` 和 `*.jwwc.eiscore.top`，不会影响 `vedio.eiscore.top`。证书申请和 DNS/防火墙变更必须按服务器现状执行。

## 回滚

```bash
docker compose -f deploy/jinwei/docker-compose.yml down
```

删除容器不会自动删除 `jinwei_leads_data` volume；如需清理试用询盘，先导出并由负责人确认后再执行 `docker volume rm <project>_jinwei_leads_data`。宿主机 Nginx 回滚应恢复部署前备份，并再次执行 `nginx -t`。

## 生产边界

该 JSON 服务没有正式登录、审批、RLS、备份策略或客户数据保留策略。上线前必须切换到已有 company-site leads API/PostgreSQL，配置认证、审计、限流、备份和隐私政策；不要直接把试用 volume 当作生产数据源。
