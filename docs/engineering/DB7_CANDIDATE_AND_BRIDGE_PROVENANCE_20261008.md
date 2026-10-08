# DB7 候选与 Harness Bridge provenance 验收记录

日期：2026-10-08，Asia/Shanghai。源码仓库：`C:/Users/Twist/Documents/eiscore/github-eiscore-refactor`，分支 `codex/systematic-refactor`。

本记录只证明明确提交及制品的本地隔离验收。没有正式批准数据库发布，没有替换既有 Compose，没有连接远端或生产，没有写入业务数据库卷。

## 2026-10-08 登录候选、完整插件构建与 Node 22 验收（最新）

本轮主仓库 HEAD 为 `2dad6a669d12300020e8c1c7283362ee63a36250`，分支仍为 `codex/systematic-refactor`。用户授权恢复的 DB2–DB6 五份历史 manifest 再次核对无 diff，恢复前备份保留；没有重复恢复。其他任务的修改已增长为 17 份跟踪文件及两份未跟踪的 `lundu-world-routes-20261008.webp`，涉及伦度登录/素材、企业配置、平台配置模块及其回归，本任务均未覆盖、stage 或代为提交。当前工作树仍不是 clean。

候选继续位于 `.codex-tmp/dsh-sdk-contract-candidate-20261008/`，外部 WSL 工作树仍只读。本轮修复候选的共享 `client-auth.ts`：释放 connect 的 busy 锁；在用户点击时同步打开 popup 并校验目标 URL；popup 存在期间每秒检查服务端认证状态，并在 focus 时检查；成功后同步两个面板；关闭、120 秒截止和失败均允许重试；重复 connect 聚焦已有 popup，不重新请求 auth state。保留消息 source/origin/type/code 及重放检查。该修复兼容当前登录页的服务端 handoff，不修改其他任务的 `LoginView.vue`。

两个 client bundle 已从当前候选源码重新生成。浏览器检查发现分别构建的 CSS Modules 类名冲突，导致两个面板样式相互影响；构建脚本用插件名称区分虚拟 CSS 文件，并增加冲突断言，没有改写源 CSS 的视觉设计。随后把虚拟文件路径改为相对路径，避免构建输出带入 Windows 绝对路径；Windows Node `26.1.0` 和 Linux Node `22.19.0` 生成的五份 host/client 文件逐一 SHA-256 相同。与浏览器已验收的两份旧 bundle 比较，除生成的 CSS 来源路径注释外，完整 bundle 内容相同；证据为 `cross-platform-report.json`，不将该比较称为一次新的浏览器运行。

### Node 22 候选构建及制品

独立 Docker 候选镜像为 `eiscore-dsh-web-candidate:clean-node22-20261008`，image ID 为 `sha256:4c4085bd951f4f5a6146add9e86d92ad7ff773c740a13abe3b3ef6c9a8d6e935`，运行用户 `10001:10001`。基础镜像为前文已核实的 Bridge clean image `sha256:8eff62dd447a808bec637b9fa0e0d5bc00ecc8d90bf2b0dd37738589a97f2cd8`。最终源码归档 `clean-node22-source.tar` 为 566784 bytes，raw SHA-256 为 `9452c0f1b609b1765eac13506f9cfd929416ed03ec203f4e5e93090fdfb48b88`，也写入镜像的 `eiscore.candidate.source-archive-sha256` label。OCI revision 明确为 `uncommitted-candidate`，source 为 `isolated-dsh-sdk-candidate`，没有沿用基础镜像的 Git revision 冒充插件已提交。

依赖来自上一阶段诊断目录的 SDK package/lock 副本及独立 esbuild `0.27.2` 锁文件。首次无缓存安装分别取得 628 和 2 个包；SDK 锁文件 SHA 为 `fe1410e9f8bebd7d330b07ffa22f71edbe1cda5c9b0a0f2cf444b750650754ee`，构建工具锁文件 SHA 为 `8e0accbd6cf76f3bc931e38487974e7ec572a112090ba3124ee27e3e897eebf5`。最终镜像修正验证器和来源标记时复用了这两层已完成的 clean `npm ci`，重新执行三组 TypeScript 检查及 host/client 构建；不能称为两次独立 clean install。原绝对路径 tsdown 配置未执行，候选使用本目录的 esbuild 脚本，尚未成为正式仓库构建入口。

| 候选产物 | bytes | SHA-256 |
| --- | ---: | --- |
| `eiscore-auth/lib/index.js` | 9130 | `3999cd5cb454479f77d0151686fa69b4e25a3b7e38b2ccba284683784789d918` |
| `digital-twin/lib/index.js` | 4904 | `2eb4162dca19dcb8570c15b0c2e993798e193ae4b9d29d39df9d86bde01a5a4a` |
| `enterprise-bi/lib/index.js` | 4803 | `cbe1597037fc07aec4462d3ce31ff5d970503c781c5ea539727f475fd881bb87` |
| `digital-twin/lib/client.js` | 24396 | `4d7e4affd7bdf1bbe6944ea0c21f6e1e330f45db390a6dc8b16018fb8697767e` |
| `enterprise-bi/lib/client.js` | 32241 | `0a3ed20d97920b0f9c6e5583fcce996fc9885955d699055ee5d73a82169d31d6` |

隔离容器 `eiscore-dsh-web-candidate-node22-20261008` 使用 `network none`、只读根文件系统、非 root 用户、专用 tmpfs 和仅报告输出的 bind；没有发布端口，没有业务卷。镜像内 `/opt/candidate` 产物与 `/tmp/candidate` 重建的五份文件完全相同，三组 TypeScript 检查退出 `0`；真实认证 hook 在确定性网络/window/React 边界 stub 中的 34 项检查通过；实际 DSH SDK 的同一组 35 项合成 Gateway HTTP/认证/转发/SSE 检查通过，`stderrBytes=0`。最终脚本退出 `0`，容器已移除。`evidence-clean-node22/node22-build-report.json` 记录 36 项输入，输入清单 JSON 的 SHA 为 `4cf1d59a3c161d648a30386c2b9c17c4090b5bbbd731ce4d295339cc56408170`；其余四份报告保存构建、认证和 HTTP 明细。

更早的 Node 22 HTTP-only 探针也通过同一组 35 项检查，使用归档 `node22-probe-source.tar`，SHA 为 `962a8ce0d0209a8b009f21e4b815dca5bed49caa4b3121e92ced1e16a8b6f4c7`，证据在 `evidence-node22/`。它使用既有 Linux SDK 依赖，不能替代上述完整候选构建，也不累计为额外 35 种覆盖。

### 浏览器结果与失败保留

Playwright session `eiscore-login-final` 在桌面 `1440x900` 和手机 `390x844` 下完成：数字分身 message handoff、会话列表、合成历史、发送及合成 SSE 回复；注销后由智能 BI 发起服务器 handoff，实际调用仓库 `harness-auth-client.js`，popup 跳转 `/harness`，原面板自动显示合成 snapshot，并取得合成经营分析回复。两套面板共四张截图已查看。Twin body 为 flex、BI body 为 block，桌面 BI viewportWidth/scrollWidth 均为 1440。手机截图没有可见控件裁切；收尾时浏览器 session 已变成 `about:blank`，额外手机几何和兄弟面板同步检查未重跑，不补写这些指标。

截图位于 `output/playwright/dsh-login-{twin,bi}-final-{desktop,mobile}-20261008.png`。当时的 Windows client bundle SHA 分别为 `8d08faaea28aa54839c6c53a926703d7532dbe24cf03d4ea588079c2c3a2ecfb` 和 `ffa64a84fcad95ab40dfd547c029256492eeb5f9ba362be46a8009440aee072a`；它们和原构建报告保存在候选的 `evidence-windows-browser/`。主页面 console 的 100 条 error 全为等待登录期间的 auth/status 401，其他 error 为 0、warning 为 0；popup 有一条 favicon 404、零 warning，不能宣称零 console error。此前的遮挡点击 timeout 和 stale ref 通过新 snapshot 重试后正常，收尾几何命令的引号错误和空页面错误也保留为测试操作失败。

构建验收中的失败没有被包装为通过：首次 HTTP-only 探针在 tmpfs 停止后取报告失败，改为停止前导出后退出 `0`；完整候选初次重复构建因 tmpfs `noexec` 返回 esbuild `EACCES`，仅为专用临时挂载增加 exec 后解决；其后 Node `cpSync` 向 WSL/Windows 报告 bind 导出返回 `EPERM`，改用读写报告字节后解决。最终结果来自修正后的实际运行。跨平台对比首次仅去除 CSS 内注释，漏掉 JS 内的 CSS 来源注释而误报；同时规范化这两类生成注释后，完整 bundle 比较通过。

浏览器已关闭，loopback probe 的 stop 返回 `204`，进程最终退出 `0`；复核本轮 probe/DSH Node 进程和 61881 listener 均为 0。两类 Node 22 专用容器也已移除。此前异常退出留下的四份系统 Temp 合成 DSH 状态目录仍保留；清理曾被安全策略拒绝，没有绕过拒绝，也没有读取其中的 credentials。镜像和小型候选证据保留供评审。

### 正式发布边界

本轮补齐的是可追踪的完整候选构建、合成登录/业务交互和 Node 22 SDK 验收，外部三个插件仍未正式归并。主工作树的伦度/企业配置修改仍由其他任务持有；DB7 仍为 candidate only，DB6 历史门禁不变；没有真实身份、业务数据库/RLS、完整 Compose 或多模态业务链验收。当前 `HEAD:agent-harness` 与已验收 Bridge 提交 `e0f26c20:agent-harness` 的 tree 同为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`，没有重复收费 Provider 调用。现有 Compose 未替换或重启，原 Web 挂载缺入口的运行态没有修复，没有推送、部署或连接远端。正式源码归并及 DB7 批准问题仍待答复，全局目标保持 `active`。

## 2026-10-08 SDK 正式契约候选与浏览器验证（上一阶段）

本轮开始的主仓库 HEAD 为 `76767ced2e00699aeaad5436fa5ee572cdc4bf94`。DB2–DB6 五份历史 manifest 已按用户授权备份恢复，本轮 `git diff --exit-code` 再次为 `0`，没有重复恢复。九份伦度既有修改仍完整保留，未被本任务覆盖、stage 或提交。本轮只完善隔离候选和验收记录，没有归并外部插件源码、替换 Compose、连接远端或访问业务数据库。

隔离候选位于 `.codex-tmp/dsh-sdk-contract-candidate-20261008/`，从上一节的诊断副本复制插件源码，依赖目录仅以 Windows junction 指向原诊断依赖。WSL `/home/lzr/eiscore-refactor/agent-harness/client-plugins` 仍只读，三个外部未提交插件仍不是主仓库正式源码。候选新增共享 `http-routes.ts`：GET 使用正式 `connection.fetch.register`；POST 使用正式 `webServer.register`，先调用 `connection.requestRejection` 保留 DSH cookie、Host/Origin 认证边界，再处理 method、body 和 response。保留 abort、body 上限及流式响应，使用 Node `pipeline` 保留 SSE 和 backpressure；未修改 SDK 类型，也未用断言将 POST 冒充 GET/HEAD。

三个候选 host 都注入 `connection` 和 `webServer`。auth callback 改为配置的 `EISCORE_AUTH_URL` origin 加 `/harness-embed-api/eiscore/auth/handoff`，不从 forwarded header 或 SDK 的 `dsh.internal` 生成返回 origin；auth body 上限为 4096 bytes。本次没有改写其他任务的 `LoginView.vue`，也没有证明真实 EISCore 登录 popup 已完成。

固定 DSH `0.1.2-rc.1`、Cordis `4.0.4`、TypeScript `6.0.3` 下，三个候选插件的 `tsc --noEmit --rootDir <candidate>/client-plugins` 均退出 `0`。使用仓库已安装的 esbuild 构建三个 host bundle，SHA-256 写入 `host-build-report.json`；该报告已区分 bundler 和 typeChecker。两个 browser `client.js` 仍沿用旧诊断 bundle，没有在本轮重新完整构建；原插件 tsdown 配置仍引用 WSL Harness 源码绝对路径。因此这里闭合的是隔离候选的 SDK host 契约，不是正式、完整、同源的插件发布制品。

`http-probe.mjs` 启动实际已发布 DSH SDK 和随机 loopback stub Gateway，35 项检查全部通过，`stderrBytes=0`。覆盖 DSH cookie 必需、错误 Origin 拒绝、method 检查、handoff 格式/state/replay、callback origin/path、未登录业务请求不进入 Gateway、4097-byte auth body 返回 413 后合法 handoff 仍成功、认证后 GET/POST、服务端 Bearer、cookie/伪造 tenant header 不转发、query/body/idempotency/request-id 保留、SSE 首块在第二块放行前可读，以及 logout 后写入返回 401 且不进入 Gateway。合成 JWT 仅用于该 stub 认证，不证明真实 JWT 验签、租户/RLS、Provider 或业务操作。严格仓库 runtime smoke 对此候选也退出 `0`：三个未登录路由 401、HTML 200、两组组合 bundle 200、stderr 为 0。

Playwright CLI 的独立 session `eiscore-sdk-contract` 在 `1440x900` 和 `390x844` 下，验证数字分身、智能 BI 两个 sidebar 入口、各自面板打开、关闭和未登录连接提示。四张截图已查看，标题、关闭按钮与提示在视口内；没有做视觉重构。初次代理只转发 HTTP，导致 SDK connection 未就绪警告；给临时代理补上 WebSocket upgrade tunnel 后警告消失，最终 console 是两个预期的 `/api/eiscore/auth/status` 401、零 warning，无新增运行时 JS 异常。全新临时 DSH profile 出现 SDK 内测声明和 API key 首次设置弹窗，测试只点击继续与稍后配置，没有填写 key；首次点击数字分身被设置弹窗遮挡的 timeout 记录保留。该全新 profile 不等于既有 EISCore 部署，不能据此宣称原部署弹窗回归或已修复。

浏览器证据位于 `output/playwright/dsh-sdk-contract-{twin,bi}-{desktop,mobile}-20261008.png`，HTTP 证据为候选目录的 `http-contract-report.json`，类型检查与构建命令在该目录脚本和本节中保留。Playwright session 已关闭；临时 probe 停止时 Windows exec 返回 `1`，不是测试失败改写为通过。事后进程及 listener 复核确认 probe、DSH child 和代理已停止。两次 browser probe 的临时 DSH home 仍位于系统 Temp；显式清理请求被执行环境安全策略拒绝，不能声称其已删除。本任务不读取或输出其中的 credentials，也不把临时状态加入 Git。

剩余发布边界：九份伦度改动仍由其他任务持有；DB7 为 candidate only，历史 DB6 门禁仍正确 fail-closed；Bridge clean-build/真实 Provider 证据与当前 Harness Git tree 一致，但运行中 Compose 没有切到该镜像；原 Web 缺三个编译入口的挂载故障未被更改。下一步须收口外部源码来源、可复现完整 host/client 构建和正式制品，再另行执行允许的隔离完整栈验收。全局目标保持 `active`，不宣称完整系统或正式发布完成。

## 2026-10-08 Web HTTP 与验收门禁复核（上一阶段）

本轮开始的主仓库 HEAD 为 `6f519792f802dc57cdfd0a348dd84910883b0958`。用户授权“备份后恢复五份历史 manifest”已经执行；再次核对 DB2–DB6 五份文件的 `git diff --exit-code` 退出 `0`。恢复前副本仍保存在 `.codex-tmp/protected-changes-20261008-e0f26c20-review/`。九份伦度修改继续保留，尤其登录视图和样式有其他任务后续修改，不能再用旧备份覆盖它们。主工作树仍不是 clean；本次恢复没有批准 DB7 或替换本地服务。

Web 诊断使用 `.codex-tmp/dsh-client-compatibility-20261008/`，其中 24 份源文件来自 WSL `/home/lzr/eiscore-refactor/agent-harness/client-plugins` 的未提交外部源码，复制时逐项核对 SHA-256。它们不属于主仓库正式源码，也不是可正式部署的同源制品；esbuild 生成的临时 bundle 只用于诊断。固定 SDK 为 DSH `0.1.2-rc.1`，Cordis `4.0.4`，TypeScript `6.0.3`；本轮 host 运行于 Windows Node `v26.1.0`，不能将其描述为 Node 22 Docker 验收。

三组 `tsc --noEmit` 仍失败：auth host 使用的 `requestBody` 不在 `ConnectionFetchRoute` 类型中，digital-twin 和 enterprise-bi 的 `POST` 不属于 `ConnectionFetchMethod`（正式声明仅为 GET/HEAD）。但该版本 SDK 的 JS 实现没有检查方法白名单，实际会匹配已注册的 POST；因此“类型不兼容”不等于“运行时路由一定无法注册”。本轮一次性启动探针确认三个 Cordis fiber 都为 active，GET 路由、HTML 和两个组合 bundle 返回预期状态。最初路由未注册/空 stdout 的失败报告保留，尚未证实其原因，不能把它作为确定性根因，也不能用类型断言擦除正式兼容性问题。

仓库 Web smoke 存在独立误报：它只按响应数量判断就绪，第三个路由的状态或响应 marker 错误也能继续并输出成功。本轮修复 `scripts/dsh-web-plugin-runtime-smoke.mjs`，就绪条件检查全部三个状态及 marker，结束时逐项断言；失败诊断仅记录退出信息及日志字节数，避免输出 startup token。新增 `tests/engineering/dsh-web-plugin-smoke-regression.mjs`（stdlib、自身作为临时 DSH child），验证正常结果、最后路由 503、最后路由错误 marker 三种实际进程退出行为。提供 `npm run test:harness-web-smoke` 并接入 `test:production-config`。这项修复只收紧验收工具，不修改面板、插件、Bridge、数据库或部署配置。

修复后的 smoke 对上述诊断制品退出 `0`：三个未登录路由均 401，index 200，两组 bundle 200，stderr 为 0。该结果仅证明 host 激活及资源可获取，不证明 browser JS 执行、真实登录、数据库权限或正式制品来源。

本轮相关仓库验证取得最终退出码 `0`：`node tests/engineering/dsh-web-plugin-smoke-regression.mjs`、`npm run test:production-config`（包含新三场景回归）和 `npm run test:syntax`（308 份脚本）。五份 manifest 恢复前备份的原始 SHA-256 也再次与 `checksums.json` 一致。`HEAD:agent-harness` 与 `e0f26c20:agent-harness` 的 Git tree 都为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`，本轮未改变已验证的 Bridge 源码，不重复构建或调用收费 Provider。未执行浏览器、真实业务链、正式 release/recovery 或远端测试。

进一步的一次性 loopback HTTP 探针取得 22 项通过：无 DSH cookie 401、错误 Origin 403、五个未登录业务 GET/POST 401、坏 JSON 400、无 state 的 handoff 403、错误 method 404、auth-start 的 HttpOnly/SameSite=Strict，以及临时 Gateway 的合成身份 handoff 200、state 重放 403、auth status 200、三个认证后 GET 和两个 POST 200、logout 后会话撤销且不再调用 Gateway。认证后转发验证 body/query/idempotency/request-id/client marker 保留，Bearer 来自服务端会话，浏览器 cookie 和伪造 tenant header 未转发；数字分身 SSE 第一块可在 Gateway 放行第二块之前被读取。这些请求全部进入随机 loopback 端口的 stub Gateway，合成 JWT 仅在内存中存在，不代表真实 JWT 验签、租户/RLS、模型或业务功能验收。

认证 callback 仍有可复现的不一致：没有转发头时 auth-start 使用 SDK Request 的 `http://dsh.internal` 作为返回 origin；提供当前 Nginx 使用的转发头后，外部 origin 正确，但生成 `/api/eiscore/auth/handoff`，主仓库登录页仅接受 `/harness-embed-api/eiscore/auth/handoff`。诊断报告明确记录 `embeddedLoginCallbackMatches=false`；它的 HTTP 边界通过不表示 EISCore 嵌入登录链通过。这里只定位了外部待归并源码，未改写 WSL 插件或其他任务的登录页。

证据位于忽略目录的 `startup-probe-report.json`、`runtime-strict-recheck.json`、`http-boundary-forwarded-report.json` 和 `auth-proxy-synthetic-report.json`。最初 runtime 失败、误写 bootstrap 302（实际 SDK 为 303）的失败和无转发头 callback 不匹配的失败报告均保留，没有覆写为成功；本轮随机临时 DSH home 与 child、stub Gateway 均清理。没有重复收费 Provider completion，没有读取业务数据库或既有 DSH 状态卷，没有发布/重启现有 Compose。

剩余正式边界不变：DB7 为 candidate only，历史 v6 面对当前源码仍 fail-closed；九份伦度修改属于其他任务；既有 Compose 没有切到 clean Bridge image，Web 挂载仍缺三个编译入口。完整栈需要把插件源码、SDK 正式契约、嵌入 callback 与构建制品一起收口，不能把临时产物恢复到挂载目录就视为正式修复。全局目标保持 `active`。

## 2026-10-08 源码提交 `e0f26c20` 本地复核（历史 Bridge 基线）

本节取代后续历史章节中的“当前提交”和数量描述。基于 `codex/systematic-refactor@e0f26c20c77ba108f2a6e8c371ab1c2dc1ce21fd` 的 `git archive`（仅 `agent-harness/`，542720 bytes）完成无缓存 Bridge 构建，临时镜像为 `eiscore-harness-bridge:clean-build-20261008-e0f26c20-labeled`，本地 image ID 为 `sha256:8eff62dd447a808bec637b9fa0e0d5bc00ecc8d90bf2b0dd37738589a97f2cd8`。镜像 OCI labels 为 `org.opencontainers.image.revision=e0f26c20c77ba108f2a6e8c371ab1c2dc1ce21fd`、`org.opencontainers.image.source=github-eiscore-refactor`；运行用户为 `10001:10001`，Node `22.19.0`，DSH `0.1.2-rc.1`，生产依赖安装数量为 524。8 个 Bridge/tool/profile/contract 文件及 package.json/package-lock.json 的镜像内 SHA-256 与 archive 解压文件逐项一致；核对容器使用 `--rm --network none --read-only`，未使用主工作树未提交文件。archive SHA-256 为 `b658b58fbf266b13c1565ef26b0155179bc2da0d9deb1b6c2d92666c0d2dc1e5`。

该镜像的真实 Provider 探针容器名为 `eiscore-bridge-provenance-e0f26c20`，使用默认 Docker bridge 网络、固定 `-p 38080:3080`（未限制绑定到 loopback）、非 root、只读根文件系统，以及 `/tmp` 和 `/var/lib/dsh` tmpfs。这里的隔离指独立容器和临时状态，不表示独立网络或随机端口。摘要为：`/healthz=200`、`/readyz=200`（`runtime/plugins/sessions` 全部 `true`）、插件数 `9`；使用现有本地 Bridge 环境中的 Provider 配置仅在内存中注入一次 `deepseek-official` / `deepseek-chat` completion，结果为 HTTP `200`、choices 存在、内容长度 `2`；相同 request 重放为 `409 HARNESS_REQUEST_REPLAY`，同一 session 跨 tenant 为 `403 HARNESS_SESSION_OWNERSHIP_DENIED`。未输出、持久化或写入任何 API key、secret 或响应正文。工具代理指向 `127.0.0.1:9/unused`，没有进入业务工具或数据库链路。一次性容器已清理，Docker 清单复核确认其不再存在；没有挂载主机路径或数据库卷。

源码字节边界已核实：Windows 系统 Git 配置为 `core.autocrlf=true`，archive 中 JS/JSON 的 CRLF 与 Git blob 的 LF 存在原始 SHA 差异；十个文件均仅换行转换，LF 规范化后完全相同。不能把镜像/archive SHA 冒称为 Git blob SHA。用 `git -c core.autocrlf=true archive --format=tar e0f26c20 agent-harness` 独立重生成 archive，取得同一 raw SHA；因此构建上下文可按已记录规则从提交复现。基础镜像本地 ID 为 `sha256:d2166de198f26e17e5a442f537754dd616ab069c47cc57b889310a717e0abbf9`，平台 `linux/amd64`。

失败记录保留：首次 WSL curl 请求受代理影响返回 502，使用 `--noproxy '*'` 后本地请求正常，不能将这些代理响应归因于 Bridge Provider；错误协议头 `1` 返回 426；PowerShell HTTP helper 未使用 `.GetEnumerator()` 导致请求头缺失，也返回 426。最终成功探针使用 `eiscore-agent-v1` 协议头。只有最终一次请求实际完成 Provider completion。

当前提交的回归也通过：`npm run test:harness-bridge`（loopback `ok=true`、`proxyCalls=1`、`modelRequests=2`）、`npm run test:database-migrations`，以及 `npm run db:release:check -- --release database/release-candidates/eiscore-db-v7/manifest.json`。后者报告 candidate canonical SHA `1b4e6982ed2d086ddd9a23d0bace2a4f49776afc1133bfd17ea2999446d343bd`，无 Docker、数据库、备份或流量切换。

DB7 candidate 绑定 `sourceRevision=e0f26c20c77ba108f2a6e8c371ab1c2dc1ce21fd`、58 个 artifact，migration terminal 为 `runtime-v2-010`、`company-site-001`、`core-011`。在 WSL 原生 `/tmp/eiscore-db7-source-e0f26c20` 的 `core.autocrlf=false` clone 中，使用 candidate 临时 manifest 和随机临时数据库容器、独立网络、tmpfs 完成以下测试，均退出码 `0`：`DB_RELEASE_PATH=.codex-tmp/db7-candidate-20261008/manifest.json DB_RELEASE_PREDECESSOR=eiscore-db-v6 npm run test:database-release:docker`、`DB_RELEASE_PATH=.codex-tmp/db7-candidate-20261008/manifest.json npm run test:database-recovery:docker`、`npm run test:database-contracts:docker`、`npm run test:database-roles:docker`。测试前后 `git status --porcelain=v1` 均为空；复核时没有本轮 DB3/DB5 临时容器或网络。历史 DB2 容器和网络仍保留，未清理其他任务资源。数据库 contract fingerprint 为 `ef59503c0208dbb3f9cb081dce45fb265fcf71a9f1735731f4301edd9da3aec9`。Windows 首次路径错误与 Docker Desktop named-pipe 不可用的失败发生在数据库操作前；Windows clone 的换行转换造成差异，因此成功验收使用上述 WSL 原生 clone，没有将 Windows 失败包装为通过。

新鲜回归另通过 Gateway、Runtime/multimodal/HTTP/WS 边界、输出策略、runtime-image、production-config 和 production-path 六组命令。没有额外调用收费 Provider。五份历史 manifest 恢复后重新执行默认 `npm run db:release:check`，仍退出 `1`，漂移错误由 17 项减至 14 项；错误涉及当前 database contract、legacy resolution、core manifest/postcheck、recovery、审计/备份/基线/catalog 脚本、core terminal/list、catalog 与 PostgREST 指纹。这是历史 v6 与当前源码不匹配的拒绝，不被 DB7 candidate 的成功替代。同轮显式 DB7 candidate dry-run 再次退出 `0`，canonical SHA 未变化，没有执行数据库操作。

本轮没有替换现有 Compose。运行中的 `eiscore-harness-bridge` 仍使用 image `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，状态 healthy，挂载主工作树 `agent-harness/` 和既有 DSH 状态卷；它不等同于无挂载的新 clean image。`deepseek-web` 仍处于 `Restarting (1)`，所以不能宣称完整本地栈健康。DB7 仍是 candidate only，正式冻结 v6 没有重新批准或发布。

恢复前主工作树共 17 项修改：本任务的 DB7 candidate 和两份验收文档，以及 14 项保留改动。14 项已复制至 `.codex-tmp/protected-changes-20261008-e0f26c20-review/` 并逐文件核对 SHA-256。收到用户明确答复“备份后恢复五份历史 manifest”后，仅恢复了 `database/releases/eiscore-db-v2/manifest.json` 至 `eiscore-db-v6/manifest.json` 的历史 checksum；`git diff --exit-code` 对这五份文件退出 `0`，它们已与 HEAD 一致。14 份备份再次全部通过 SHA-256 校验，五份 manifest 的恢复前内容仍可从副本取回。没有修改历史 SQL 或账本，也没有把当前结构重新包装为历史 v6。

恢复后剩下本任务三项修改和九份伦度修改；九份均与备份字节一致，本任务没有覆盖、stage 或提交它们。主工作树没有未跟踪产品文件，仍不能声明 clean。九份保留文件的准确范围为：

- `docs/engineering/LUNDU_CUSTOMER_SERVICE_TRIGGER_RESTORE_20261007.md`
- `eiscore-base/public/config/eiscore-enterprise.json`
- `eiscore-base/public/enterprise-assets/site/favicon.svg`
- `eiscore-base/src/components/PumpBomViewer.vue`
- `eiscore-base/src/styles/login-view.scss`
- `eiscore-base/src/views/LoginView.vue`
- `enterprise-packs/lundu/assets/site/favicon.svg`
- `enterprise-packs/lundu/data/company-site.json`
- `enterprise-packs/lundu/runtime/eiscore-enterprise.json`

本次授权只处置五份历史 manifest。DB7 candidate 的正式本地制品批准问题仍未得到答复，因此没有提升到 `database/releases/`，没有切换默认 release。九份伦度变更继续由负责其实现和验收的任务处置。

候选与上述验收记录已本地提交为 `1c1f636d07aa596de37131caec3f4164dcf60074`，提交范围仅三个本任务文件。提交后的 index 为空，主工作树仅剩上述九份伦度变更；`1c1f636d:agent-harness` 与构建源码 `e0f26c20:agent-harness` 的 Git tree 均为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`。后续记录提交不改变 Harness 源码或 DB7 绑定的执行 artifact，无需为文档提交重复构建或调用 Provider。只读核对 Codex 任务“伦度独立站”仍处于 active/inProgress；该任务的交接文档记录了同一组蓝色主题源码/公开配置/企业包修改。本任务不向该任务发送消息，也不代为提交其未收口变更。

### 既有 DeepSeek Web 重启故障的只读定位

`eiscore-codex-local-deepseek-web-1` 实际仍使用旧 image `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，Node `22.19.0`、非 root、只读根文件系统。日志报告 Cordis 无法加载三个 client plugin，inspect 显示 `/opt/eiscore-harness/client-plugins` 绑定至主工作树的 `.codex-tmp/harness-delivery-candidate/client-plugins`；该目录存在，但 `eiscore-auth/lib/index.js`、`digital-twin/lib/index.js` 和 `enterprise-bi/lib/index.js` 三个文件逐项 `Test-Path` 均为 `false`。因此当前 Web 的确定性阻塞是缺少所挂载的编译插件入口，不能用 Bridge 的模型 completion 成功代替 Web 启动验收。

本轮只读定位没有恢复临时目录、修改挂载、读取 DSH 状态卷或重启服务。后续完整栈验收需要从可追溯的前端插件源码生成完整制品并验证实际加载，不能把历史临时目录或仅有后端文件的 Bridge 镜像当作完整 Web 交付。本记录没有证据确定这些临时入口缺失的原因。

本轮脱敏摘要保存于 `.codex-tmp/bridge-provenance-20261008-e0f26c20/report.json`；该文件记录实际拓扑、源码/镜像字节核对和执行结果，不包含密钥或 completion 正文。本任务制品可提交不等于正式 release 批准，目标保持 `active`。

## 历史复核：2026-10-08 提交 `7e0774aa`

基于 `codex/systematic-refactor@7e0774aa9e0770ecd6c097c59d6c3350ee9b9222`，从 Git archive（不是工作树、旧 tarball 或运行中容器）构建了无缓存镜像 `eiscore-harness-bridge:clean-build-20261008-7e0774aa`。镜像 ID 为 `sha256:539ce844874c9755bf5475048a5d98ce017db6941ff0fe7202045e8fd3d81373`，标签 `org.opencontainers.image.revision=7e0774aa9e0770ecd6c097c59d6c3350ee9b9222`、`org.opencontainers.image.source=github-eiscore-refactor`；基础镜像为 `node@sha256:d2166de198f26e17e5a442f537754dd616ab069c47cc57b889310a717e0abbf9`。镜像内 Node `22.19.0`、DSH `0.1.2-rc.1`，Harness tree 为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`，8 个 Bridge/tool/profile/contract 文件与 archive 字节一致。

真实 Provider 隔离容器使用随机名称、独立 Docker 网络、只读根文件系统、非 root 用户、无宿主挂载/发布端口和 tmpfs 状态目录，已清理。使用现有本地 Bridge 环境中的 Provider 配置在内存中注入一次真实 `deepseek-official` / `deepseek-chat` completion，未记录密钥或响应正文：`/healthz=200`、`/readyz=200`（runtime/plugins/sessions 全部 true）、插件数 `9`、错误 Bridge secret `401`、completion `200` 且 choices 存在/内容长度 `2`；同一请求重放返回 `409 HARNESS_REQUEST_REPLAY`，同一会话跨租户返回 `403 HARNESS_SESSION_OWNERSHIP_DENIED`。另一 `--network=none` 容器内的 Bridge/SDK 错误、Gateway、Runtime 边界及 loopback 工具回归也全部退出 `0`（proxyCalls=1、modelRequests=2）；该工具回归不是额外真实 Provider 调用。证据目录为 `.codex-tmp/bridge-provenance-20261008-7e0774aa/`，其中 `report.json`、`loopback-report.json`、`reconciliation.json` 保存摘要和 SHA-256。

该镜像没有替换当前 Compose。运行中的 `eiscore-harness-bridge` 仍为容器 `e084cfc64b6ff26b5a9964ebef176885369e6d4decdef9771a778ddfa75bf140`、image `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，状态 `running`；隔离前后其容器 ID、image ID、挂载集合未改变。测试容器从未挂载业务数据库卷，本任务未向既有数据库发送请求。隔离期间既有 `deepseek-web` 的启动时间发生变化，但容器身份/image/mount 没有替换，该变化不归因于本任务，也不作为稳定性证据。

失败也保留：首次脚本因伦度交接文档较旧备份已变化而在预检查处停止；WSL legacy builder 拒绝 `--progress` 后移除该显示选项；默认网络的首次无缓存 `npm ci` 因 `ECONNRESET` 失败，host 网络重试以同一提交/锁文件安装 524 个包并完成构建，未更换 registry 或绕过 integrity。成功隔离探测的原始 `report.json` 仍为 `ok=false`/退出 `1`，因为整体保护检查使用未排序的 mount 数组和所有服务启动时间逐字比较；事后 `reconciliation.json` 用原始快照确认 8 个既有服务 ID/image/mount 集合不变，只有既有 `deepseek-web` 启动时间变化。没有覆写失败报告或重跑收费 completion 来包装总体成功。

本轮未改产品代码。主目录新鲜通过 runtime-image、production-config、harness-production-path、database-release-drift，以及 Harness plugin/gateway/tool/runtime/write/twin/document/sales/query/read/output/migration-switch 各组回归；独立干净 clone 的正式候选路径 dry-run 再次退出 `0`，canonical SHA 不变。数据库 release/recovery 的 Docker 证据仍为上节列出的上一阶段结果，本轮未重复。

伦度交接文档和样式在本轮被其他任务继续更新，旧备份不能代表其最新版本；本任务未覆盖这些文件，另存最新副本于 `.codex-tmp/protected-changes-20261008-7e0774aa/`。本轮核对时文档 SHA 为 `3224c73973fdc291b8cce002b5c769c9d39c1806e335debafc0320412cc1ac69`，样式为 `6673c1eb596c94fb82374ce9ee5ea73f8796f3be180fa793a7328148de4489db`；五份 manifest 与原备份仍一致。备份不是回退授权，之后的新修改仍需重新核实。

本证据不证明整个本地栈已用新制品运行。七项保留修改尚未由所有者处置，v7 仍 candidate only，默认 v6 不变，既有 Compose 未发布更新；本任务不会代替正式审批或覆盖其他任务变更。全局目标保持 active。

## 四项问题的实际状态（以文首最新验收为准）

| 问题 | 已完成 | 尚未完成 |
| --- | --- | --- |
| 主工作树未干净 | 十四项原有修改逐文件备份；用户授权恢复的五份历史 manifest 已与 HEAD 一致；使用独立干净 clone 验收 | 当前 17 份其他任务修改及两份未跟踪素材仍保留，不能声明主仓库 clean |
| candidate 与正式 v6 混淆 | 恢复不可变历史；准备独立 v7；原 v6 → v7 release 和破坏后 recovery 真实通过 | v7 仅待评审，不是正式 release approval；默认 v6 面对当前源码仍 fail-closed |
| 真实 Provider 曾经 502 | DSH_CWD 解析链接及 Node engine 修复；当前提交的 Node 22 clean image 已在隔离 Bridge 取得真实 completion 200，并验证 401/409/403 边界 | 未把一次真实 completion 扩大为所有业务场景上线保证 |
| Bridge clean-build 来源不完整 | Git archive、镜像 label、Harness tree、8 个文件 SHA 和真实 completion 已关联；完整 Web 插件候选也在 Node 22 构建并通过合成验收 | 外部插件正式源码归并未完成；当前 Compose 未替换，不能声明完整栈健康 |

## 实现提交与兼容边界

- `f9aa189eb88833e496b5ab9d2257063ba05df195`：恢复原 `core-002`、`runtime-v2-003` 及 v1 baseline manifest/register；新增 `core-010-harness-tenant-auth-boundaries.sql`；补齐 tenant login、raw ontology 拒绝及原 v6 升级测试；移除 Compose 无账本 initdb 的 `core-002` 挂载。
- `49cb07d2920aea68cffa2be220740556aa584a16`：release/recovery 测试自行创建 `tests/.artifacts`，修复首次干净 checkout 的 ENOENT。
- `c9cf266281872a01d82d22ade24f7efcd5691983`：Git 保存 SQL 原始字节，修复 Linux 干净 checkout 的 raw checksum 与实际函数 definition 漂移。

`core-010` 包含租户登录重载、用户 tenant 回填、RLS helper 授权及原始本体接口撤权。它不替代执行账本，也不应单独挂载到 initdb。空库先初始化批准基线/角色/秘密，再执行批准 release，最后开放业务流量。

升级证据的前提是原冻结 v6 的真实 SQL 和账本状态。曾执行后来改写的 `core-002` 或 `runtime-v2-003`、账本中记录不同 checksum 的库不在本证据范围内，必须拒绝并保留现场。不得直接修改账本 checksum、重登记 baseline 或删除业务卷。涉及结构与权限的回退使用发布前备份恢复。

## 干净检出暴露的根因

早期 candidate dry-run 能通过，但干净 Docker 验收失败：原 v6 重建 catalog 为 `88fcc39c20d064f8e81116df3895bc9e62329167994569796b24ce98f5d9b1de`，与冻结 `c45944529f41b5be49487e637b291676d470a35f02b4423a68372b123fc0afde` 不符；新空库 catalog 也无法匹配批准 predecessor。离线审计同时出现 79 项 legacy SQL raw checksum 不一致。

主目录的 baseline `schema.sql` 原来有 759924 bytes、288 个 CRLF，raw SHA-256 为 `dbcd35e8cc93254dd285a89a9fa210151a9490a60fa55cc287b2f566a7874a28`，与原 manifest 一致。Git text conversion 将它变成 759636 bytes 的 LF 文件。虽然 portable 内容一致，dollar-quoted 函数体的换行会进入 `pg_get_functiondef`，因此实际 PostgreSQL catalog 不一致。

修复采用 Git 原生 `*.sql -text`，保存当前已核实的历史字节。提交涉及 91 份 SQL blob 的换行差异；`git diff --ignore-space-at-eol c9cf2662^ c9cf2662 -- '*.sql'` 为空，没有 SQL 内容变更。96 项 legacy 原 raw checksum 均一致，混合换行的 `sql/company_site_platform_v1.sql` 也原样保存。没有修改历史审计 ledger 或重算冻结 catalog 来绕过失败。

## 历史待批准 v7 制品（`c9cf2662`；当前候选见文首）

本节记录上一阶段 `c9cf2662` 的候选；当前评审文件 [manifest.json](../../database/release-candidates/eiscore-db-v7/manifest.json) 已更新为文首绑定 `e0f26c20`、58 个 artifact 和 `core-011` 的隔离验收候选，以下历史 SHA 和数量不能用于批准当前制品。

| 字段 | 值 |
| --- | --- |
| release ID | `eiscore-db-v7` |
| source revision | `c9cf266281872a01d82d22ade24f7efcd5691983` |
| canonical manifest SHA-256 | `088aee81f4289a20f56d39a32b0e94ae2631d8ec6c75423573e6a51fb630b486` |
| artifact 数量 | 57 |
| core terminal | `core-010` |
| core-010 checksum | `5818fa75d521e4f1b3aa84f0cc933944fee6097da28abe958d8aa00506bf3055` |
| database catalog | `a473c2d932a046c6df278acff03c97ed4afeb919762ea6bdebbb88c7b1e28ff8` |
| PostgREST contract | `cb5c41defeac0c36e307b06a538d50c3abe60b17c9dcbaac25b4ae63cdbe1cd1` |
| 审批状态 | candidate only，未批准、未发布 |

源码锚点是实现提交；后续保存候选和验收文档的提交不会改变其 57 个绑定 artifact。默认 `verifySourceRevision=true`，未关闭来源验证。

冻结 v6 正式路径及默认命令保持不变。恢复前主工作树的未提交 v6 canonical SHA 为 `4d5b2c1dbfd3d436262771ad76a0b385447325edd3f906e55ff0a6c3adea324f`；历史描述符为 `58e09fac34c04a7a14f7ec1476c35735f8e14c3999e9245f6e91ac66c101661d`。当时 `loadAndValidateDatabaseRelease` 分别报告 17 与 14 项错误；用户授权恢复后主工作树使用历史描述符，最新复核为 14 项错误。这是版本不匹配的正确拒绝，不应把当前源码强行包装成 v6。

## 实际验收

独立 clone：`.codex-tmp/db7-source-20261008-f9aa189e`。目录名是首次创建时的提交名，实际执行 Docker 测试时的 detached HEAD 为 `c9cf2662`，测试前后 `git status --porcelain` 为空。交付时又检出保存候选和文档的 `958e81cb`，正式评审路径的 candidate dry-run 再次通过；源码锚点和 manifest SHA 未变化。没有 stash 或覆盖主工作树。

以下测试均取得最终退出码 0：

| 执行位置与命令 | 覆盖范围 |
| --- | --- |
| 主目录及 WSL 干净 clone：`npm run test:database-migrations` | 迁移、baseline、发布/恢复 fail-closed、治理边界、角色与结构门禁 |
| 主目录：`npm run db:release:check -- --release database/release-candidates/eiscore-db-v7/manifest.json`；clone 使用对应临时候选路径 | 实际提交来源、57 个 artifact、契约和候选 dry-run |
| clone：`DB_RELEASE_PATH=.codex-tmp/db7-candidate-20261008/manifest.json DB_RELEASE_PREDECESSOR=eiscore-db-v6 npm run test:database-release:docker` | 原冻结 v6 重建、真实升级、tenant 回填、锁、可核对备份、稳定 DB/API、重复执行、drift/conflict 拒绝 |
| clone：`DB_RELEASE_PATH=.codex-tmp/db7-candidate-20261008/manifest.json npm run test:database-recovery:docker` | 空库 release、事务回滚、备份校验、破坏源表、空目标恢复角色/测试数据/目录/API、恢复账本和运行健康审计 |
| clone：`npm run test:database-contracts:docker` | fresh/原 v6 upgrade/repeat 一致；tenant login 两个 HTTP 重载；raw ontology HTTP/RPC 拒绝 |
| clone：`npm run test:database-roles:docker` | 非超级用户角色、company-site Agent RLS、HR payroll RLS 和拒绝契约 |

历史 v6 从 Git 源码 `b9a3831d08aeb7056ee8a5997ca8b57ae270ca08` 与冻结描述符 `09c2f2018daf45d20cd85e4907fdbf2315dbeb6e` 重建。测试执行真实迁移器与 release/recovery 工具，没有伪造历史发布行或备份记录。

Docker 测试使用随机命名临时容器、独立网络和 tmpfs，结束后清理；测试 canary 只进入这些临时数据库。没有使用现有业务卷。

## Bridge 与真实 Provider 上一阶段证据

构建修复为 `6795249b` 的 DSH_CWD 依赖链接和 `0e955b9e` 的 Node `22.19.0`。Node 20 的 `HARNESS_RUNTIME_EXIT` 与 SDK 依赖要求 Node >=22.19.0 一致；历史 `HARNESS_RUNTIME_PROVIDER_ERROR` 不能被直连 API 200 或 mock 成功覆盖。

此前已验证镜像：`eiscore-harness-bridge:clean-build-20261007-node22`，本地 image ID `sha256:9d13895208906a56a0efd0c6ad7be4dd4454ae550c2daf0eff4e5cfd707c7114`。它由该构建提交的干净 Git archive 生成，安装锁定的 524 个生产包；revision label 是 `0e955b9e`，source label 是 `github-eiscore-refactor`。实现提交与构建提交的 Harness tree 同为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`，该组件源码没有变化。上一阶段只读 inspect 核对上述 ID、labels 和 tree；本轮重新构建及调用的新证据见文首。

上一阶段同一 Node 22 镜像的隔离只读容器已经取得 `/readyz` HTTP 200（runtime/plugins/sessions 均为 true）和真实 Bridge Provider completion HTTP 200、choices 存在、内容长度 2。没有输出或保存密钥和响应正文；这是一条实际 completion 证据，不是全部业务场景或稳定性测试结论。

当前 Compose `eiscore-harness-bridge` 的 image ID 仍为 `sha256:7e7192e90910b669b0d537ec31025f345ef3aad41f8c8b08beaf5f8a5277dd3e`，核对时 running/healthy。没有将新镜像称为已部署版本，也没有把本地 image ID 称为 registry manifest digest。

## 主工作树保留项与下一步（历史 `c9cf2662`，恢复后的状态见文首）

| 保留文件 | 差异与建议 |
| --- | --- |
| `database/releases/eiscore-db-v2/manifest.json`、`eiscore-db-v3/manifest.json` | 各 4 处历史 checksum 替换，应保留证据后由所有者确认撤回 |
| `database/releases/eiscore-db-v4/manifest.json`、`eiscore-db-v5/manifest.json`、`eiscore-db-v6/manifest.json` | 各 3 处历史 checksum 替换；与已恢复不可变 SQL 冲突，不应提交为历史 release 修复 |
| `docs/engineering/LUNDU_CUSTOMER_SERVICE_TRIGGER_RESTORE_20261007.md` | 其他任务新增客服按钮构建/远端验收记录，由对应任务提交 |
| `eiscore-base/src/styles/login-view.scss` | 其他任务的客服触发器规则调整，本任务未修改或验收前端视觉，由对应任务提交 |

七个当前文件已复制到忽略的 `.codex-tmp/protected-changes-20261008-c9cf2662/`，`checksums.json` 记录逐文件原始 SHA-256 和字节数。副本与主文件核对一致；备份不等于已经授权回退原文件，也不包含后续其他任务继续修改的内容。

推荐保持 v6 历史冻结，把本次通过的 v7 作为待批准新版本。批准前不要移动候选到正式 releases、修改默认 release 或执行目标环境 release/recovery。清理七项其他任务修改需要先明确处置，不能由本任务擅自 stage、提交或回退。全局目标继续 active，不能声明主工作树干净或系统正式上线就绪。

## 当前 HEAD clean-build 复核（2026-10-08）

本轮在用户授权恢复 DB2–DB6 历史 manifest 后进行，未重新触碰五份 manifest；五份文件与 HEAD 无 diff。当前 HEAD 为 `eb23ac2cb9dfaf68ad420c09f24ca1477599cffe`，`HEAD:agent-harness` tree 为 `6ec1bfe00814d514d16ccde2d917e90af2368be1`。

从该 HEAD 的 Git archive（仅 `agent-harness/`，532480 bytes，SHA-256 `6f3a9a257ee30328f2387f9c5f8b945b576109105f02e62f56b1e2d1e178bad4`）以无缓存方式构建 `eiscore-harness-bridge:clean-build-20261008-eb23ac2c`。镜像 ID 为 `sha256:089b5f6a84b29e9b9f7a62ca6542138785ad39b3252a19b12e90d498769cea6c`，labels 为 `org.opencontainers.image.revision=eb23ac2cb9dfaf68ad420c09f24ca1477599cffe`、`org.opencontainers.image.source=github-eiscore-refactor`。镜像内 8 个 Bridge/tool/profile/contract 文件及两份 package 文件与 archive 逐项 SHA-256 一致；隔离只读、无网络容器通过 Node `22.19.0`、DSH `0.1.2-rc.1`、入口和 node_modules 链接检查。

第一次默认网络构建只因 npm registry `ECONNRESET` 失败，未生成镜像；同一 archive/锁文件使用 Docker host 网络重试后成功。host 网络只作用于构建依赖下载，未改变运行中的 Compose 网络。构建前后 `eiscore-harness-bridge` 容器 ID `e084cfc64b6f` 与 `deepseek-web` 容器 ID `45701b32cd9f`、运行镜像均未改变，未替换服务，也没有重复调用真实 Provider。

同轮回归：`npm run test:harness-bridge`、`node tests/engineering/runtime-image-contract.mjs`、`npm run test:production-config`、`git diff --check` 均退出 0。默认 `npm run db:release:check` 仍退出 1，报告 14 项正式 DB6 provenance drift（contract、legacy resolution、core migration/postcheck、recovery/audit/backup/baseline/catalog、terminal/list、database catalog 和 PostgREST checksum）；没有执行正式 release/recovery，没有写入业务数据库卷。外部 Web client-plugin 仍来自临时候选挂载，尚未归并为正式仓库来源。
