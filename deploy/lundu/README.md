# 伦度隔离部署

这套部署使用 EISCore codex 重构分支的构建产物，单独运行 Postgres、PostgREST、Agent Runtime 和 Nginx。远端工作目录为 `/opt/lundu-eiscore`，`source/` 是仓库源码，`release/` 是前端制品，`compose.yml` 使用独立的 `lundu-eiscore` 项目名和卷。

部署顺序：

1. 复制源码和前端制品到远端，生成仅存在于远端的 `.env`。
2. `docker compose up -d db api agent web`，等待数据库和 Agent 健康。
3. 使用 `scripts/import-company-site-seed.mjs` 导入 `enterprise-packs/lundu/data/company-site.json`。导入只创建 `draft` 数据，开发环境通过 `COMPANY_SITE_PREVIEW_ALLOW_DRAFT=true` 提供预览。
4. 在公共入口 Nginx 中代理 `lundu.eiscore.top` 到 `lundu-eiscore-web-1`，先执行 `nginx -t` 并保留配置备份。

公网根路径 `/` 应重定向到 `/login`（伦度公开登录门户）；`/company-site/` 保留为需授权的站点运营控制台。

回退使用 `/opt/lundu-eiscore/backups/eiscore-before-lundu-seed-refresh.dump` 和 Astra Nginx 的 `site.conf.bak-lundu-*`。不要复用 Jinwei 的数据库卷或秘密文件。

现有证书覆盖 `lundu.eiscore.top`，不覆盖 `*.lundu.eiscore.top`；启用二级通配符 HTTPS 前须先签发包含该名称的 DNS-01 证书。
