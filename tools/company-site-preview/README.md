# 企业站点本地隔离预览

该拓扑让任意企业包接入本地 EISCore“企业站点运营”模块。它使用独立容器、端口和数据卷，不读取或覆盖已有 EISCore 数据库。

初始化仍遵守 `initialize-only + draft`：导入器会拒绝已有站点数据的数据库，且不会自动审核或生产发布。开发环境通过 `COMPANY_SITE_PREVIEW_ALLOW_DRAFT=true` 让公开门户预览同一批草稿；该开关在 `NODE_ENV=production` 下无效。

1. 使用本目录 Compose 启动数据库。
2. 在仓库根目录运行 `npm run company-site:seed:apply -- --seed=<企业包>/data/company-site.json`。
3. 启动 Agent，并将两个前端的 `VITE_DEV_AGENT_PROXY_TARGET` 指向 `http://127.0.0.1:28078`。

登录鉴权仍可使用原本地 API；此时把 `EISCORE_AUTH_JWT_SECRET` 设置为该 API 的 JWT 验签密钥。企业门户公开数据和企业站点运营数据均来自本拓扑的隔离数据库，数据库密码与登录验签密钥保持分离。
