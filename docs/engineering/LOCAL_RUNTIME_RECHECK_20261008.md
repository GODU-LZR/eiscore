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

## 当前 HEAD Bridge clean-build provenance（2026-10-08）

- 从当前 `HEAD` `eb23ac2cb9dfaf68ad420c09f24ca1477599cffe` 的 Git archive（仅 `agent-harness/`）构建，archive 为 532480 bytes，SHA-256 为 `6f3a9a257ee30328f2387f9c5f8b945b576109105f02e62f56b1e2d1e178bad4`。
- 无缓存构建标签为 `eiscore-harness-bridge:clean-build-20261008-eb23ac2c`，镜像 ID 为 `sha256:089b5f6a84b29e9b9f7a62ca6542138785ad39b3252a19b12e90d498769cea6c`；OCI revision label 精确指向上述 HEAD，source label 为 `github-eiscore-refactor`。
- 镜像中的 8 个 Bridge/tool/profile/contract 文件及 `package.json`、`package-lock.json` 与 archive 对应文件逐项 SHA-256 一致；隔离只读、`--network none` 容器确认 Node `22.19.0`、DSH `0.1.2-rc.1`、入口可执行且 node_modules 链接存在。
- 首次默认网络构建因 npm registry `ECONNRESET` 在依赖下载阶段失败；同一 archive、锁文件和提交使用 Docker host 网络仅重试构建阶段后成功。没有替换运行服务，也没有进行新的 Provider 调用。
- 构建前后 `eiscore-harness-bridge` 容器 ID `e084cfc64b6f`、`deepseek-web` 容器 ID `45701b32cd9f` 及其运行镜像保持不变；新镜像只是隔离验收制品，未部署到 Compose。

