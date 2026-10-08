# 本地运行态复核（2026-10-08）

本记录对应分支 `codex/systematic-refactor`，复核范围是本地 WSL Docker Compose，不包含远端、生产或业务数据库卷。

## 运行态结果

- `eiscore-harness-bridge` 保持原容器和原镜像运行，`/healthz`、`/readyz` 均为 HTTP 200；ready checks 的 `runtime`、`plugins`、`sessions` 均为 `true`。
- 从当前 Bridge 容器内发起一次带 `eiscore-agent-v1` 协议、插件、用户、租户、会话和请求幂等头的真实 `/v1/chat/completions` 请求，返回 HTTP 200、choices 存在、响应内容长度为 2。没有记录响应正文、API key 或 secret。
- `deepseek-web` 的临时候选插件挂载曾因 Docker bind 视图未刷新而反复重启（历史重启计数 310）；仅重启该 Web 容器后，三个编译入口均可读取，当前重启计数为 0，容器保持运行。
- 通过 Nginx `/harness-embed/?token=...` 获取 Web 页面返回 HTTP 200（约 26 KB）。页面验证使用运行时 token，token 未写入本文件。
- 页面实际生成的带 revision 资源 URL 中，`@eiscore/dsh-client-digital-twin/client.js`、`@eiscore/dsh-client-enterprise-bi/client.js` 和 `@deepseek-ai/dsh-client-modules/client.js` 均返回 HTTP 200；此前直接猜测 `/digital-twin/lib/index.js` 的 404 不是实际页面资源路径。
- Web 当前使用 `.codex-tmp/harness-delivery-candidate/client-plugins` 临时挂载，不能视为正式插件源码归并或正式发布制品。Bridge 当前 Compose 镜像 digest 仍为旧运行镜像；已验收的 clean-build 镜像仅作隔离证据，未替换运行中的 Bridge。

## 正式门槛

- `npm run db:release:check` 仍按设计 fail-closed，报告 database contract、legacy resolution、core/runtime migration、recovery SQL、数据库检查脚本、core terminal/list、catalog 和 PostgREST checksum drift。
- DB7 manifest 仍是隔离 candidate，不能批准或替代正式 DB6 冻结制品；没有执行正式 release/recovery，也没有访问业务数据库卷。
- 主工作树仍包含其他 Agent 的未提交伦度/企业配置修改和未跟踪图片。本轮没有覆盖、回退、stage 或提交这些文件。
- 没有连接远端或生产环境。

## 最小回归

本轮通过：真实运行态 Bridge completion、Bridge health/ready、Web embed HTTP 200、页面实际 revision 资源三项 HTTP 200、三个插件入口存在且 Web 重启计数归零；`npm run test:harness-bridge`、`node tests/engineering/runtime-image-contract.mjs`、`npm run test:production-config` 和 `git diff --check` 均通过。正式 DB6 门禁保持失败是预期的发布阻断，不将 candidate 验收冒充正式批准。

