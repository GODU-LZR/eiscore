# 单租户企业独立站上线与回滚手册

适用范围：`site_key=primary`、企业主体“台州君乐缘体育用品有限公司”、站点 `junleyuan.eissys.top`。

本手册只描述受控上线步骤。开发过程不会自动连接远端数据库、执行 seed、创建正式订单或发布未经确认的企业主张。

## 1. 发布物

- 数据结构：[company_site_platform_v1.sql](../sql/company_site_platform_v1.sql)
- 君乐缘内容 seed：[company_site_junleyuan_seed.sql](../sql/company_site_junleyuan_seed.sql)
- Runtime BFF：`realtime/company-site.js`、`realtime/company-sales-agent.js`、`realtime/index.js`
- 静态站源目录：`/mnt/c/users/twist/desktop/君乐缘数字化项目/enterprise-site/`
- 静态站必须包含：`index.html`、`script.js`、`styles.css`、`site-config.json` 和 `assets/`

## 2. 上线顺序

1. 备份远端数据库和当前 `/var/www/company` 静态站目录。
2. 发布 Runtime 代码并确认 Node 语法检查通过。
3. 应用 `company_site_platform_v1.sql`；已有数据库不能依赖 Docker init 目录，必须由管理员显式执行并检查错误。
4. 审阅 `company_site_junleyuan_seed.sql` 中的法律主体、品牌、商标授权、图片、产品、FAQ、SEO 和公开渠道。
5. 管理员确认后执行 seed；seed 只写 `company_site`，不写 EISCore 正式客户、销售订单、库存或生产数据。
6. 发布静态站到 `/var/www/company`，保留 `/company/` 入口和 `assets/` 相对路径。
7. 检查 Nginx 配置，确认 `/agent/` 转发到 Runtime、`/company/` 回退到静态首页、HTTPS 证书有效。
8. 重启或滚动 Runtime，等待数据库连接就绪，再执行下面的验收请求。

## 3. 只读验收

```text
GET  https://junleyuan.eissys.top/agent/company-site/public/site-config
GET  https://junleyuan.eissys.top/agent/company-site/public/pages/home
GET  https://junleyuan.eissys.top/agent/company-site/public/products
GET  https://junleyuan.eissys.top/agent/company-site/public/solutions
GET  https://junleyuan.eissys.top/agent/company-site/public/cases
GET  https://junleyuan.eissys.top/agent/company-site/public/faq
GET  https://junleyuan.eissys.top/agent/company-site/public/sitemap.xml
GET  https://junleyuan.eissys.top/company/
GET  https://junleyuan.eissys.top/company/products/billiard-cues
```

验收要求：

- `site-config` 只返回已发布配置，且 `siteKey=primary`、域名和法律主体正确。
- 草稿、内部案例、内部 FAQ 和未发布 SEO 页面不出现在公开响应或 sitemap。
- 首页、产品详情和 Agent 面板在 390、768、1440 宽度无横向溢出。
- 询盘必须有隐私同意，并且邮箱、电话、WhatsApp 至少一个可联系字段。
- 重放同一个 `Idempotency-Key` 不产生第二条询盘、商机、报价或草稿。
- Agent 回答必须有已发布知识引用；没有依据时转人工，不输出价格、库存、交期或认证承诺。
- 管理 API 无 token 返回 401，非授权角色返回 403。

## 4. 回滚

- 静态站异常：将 `/var/www/company` 切回上一个完整目录，不删除数据库内容。
- 内容异常：把对应对象状态改为 `archived` 或恢复 `content_revisions` 中的已审核版本；不要直接删除审计记录。
- 站点配置异常：先将 `site_config.status` 设为 `suspended`，再由管理员恢复上一个版本。
- Runtime 异常：回退 Runtime 镜像/代码版本，保留 `company_site` 数据和 `agent_audit_events`。
- 同步失败：只重试 `sync_jobs` 的失败任务，必须沿用原 `idempotency_key`；不得手工重复写正式业务表。

## 5. 不允许的操作

- 未取得企业确认前公开商标授权、证书、客户名称、人物肖像、价格、库存、产能或交期。
- 通过 `web_anon` 或 `web_user` 直接查询 `company_site` 表。
- 让访客 Agent 调用库存写入、正式订单、生产工单或任意 SQL 工具。
- 在远端直接运行未审阅的 seed 或把本地测试数据导入生产。
