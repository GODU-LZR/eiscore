# 伦度重构分支变更记录

## 记录元数据

- 记录日期：2026-09-26
- 仓库：`GODU-LZR/eiscore`
- 分支：`codex/systematic-refactor`
- 记录基线：`d9a373e fix(lundu): make mobile login page public by default`
- 记录对象：基线之后当前工作树中的全部产品变更，以及与本轮变更直接相关的删除项
- 目标：把伦度独立站登录体验、DeepSeek Harness 原生面板接入、数字分身/智能 BI 权限边界和部署配置集中记录，形成可审计的提交

本记录不把本地临时目录、浏览器缓存、构建备份或远端操作脚本作为产品变更提交。它们在文末单独列出，便于复核工作树是否干净。

## 一、变更总览

本轮工作树相对上述基线包含四类变化：

1. 伦度独立站和登录入口的品牌化、响应式布局、移动端公开访问和企业认证交接。
2. DeepSeek Harness Web 原生前端通过受控代理嵌入数字分身和智能 BI/经营助手，并保留原 EISCore 页面作为失败回退。
3. Agent、Flash、数字分身和经营助手共用角色感知的本体语义、模块/应用权限和字段 ACL，查询与写入均在应用层再次校验。
4. 相关部署文件、企业资源、包管理元数据、回归测试和治理文档同步更新；旧的临时论文/图片和旧版伦度资源删除项也按当前工作树保留在提交中。

## 二、伦度独立站与登录页面

### 2.1 登录页行为

- 桌面端 `LoginView.vue` 使用伦度企业配置驱动品牌、Logo、口号、企业信息、导航、轮播、业务体系、产品和联系信息。
- 登录卡片保留授权账号语义，企业账户文案、登录提示、页脚和二次入口由 `eiscore-enterprise.json` 控制。
- 页面补充固定头部、产品/制造/质量区块、响应式图片裁切、滚动进入动画和低动态偏好处理。
- 移动端登录页与桌面端共享伦度配置，移动端默认允许公开加载独立站页面；企业登录仍由统一认证接口执行。
- 移动端旧入口 `/mobile/login` 和未认证的移动端路由统一跳转到主站 `/login?login=1`，保留安全的 `redirect` 参数；主站登录成功后对 `/mobile/` 目标使用整页跳转，避免跨应用路由状态丢失。
- 登录页接入 `/agent/company-site/auth/handoff` 的认证交接，为 Harness Web 面板建立当前 EISCore 会话。

### 2.2 企业配置与资源

- `eiscore-base/public/config/eiscore-enterprise.json` 将伦度 Logo、背景图、轮播图、业务链、能力和联系信息切换为当前企业资源。
- `enterprise-packs/lundu/data/company-site.json`、`enterprise-packs/lundu/runtime/eiscore-enterprise.json` 和证据文件同步伦度官网内容及资源来源。
- 新的前端资源位于 `eiscore-base/public/enterprise-assets/site/`，包括 Logo、官网图、产品图、透明产品图、宽幅图和卡片裁切图；这些资源用于登录首屏、产品区、方案区和移动端展示。
- `eiscore-base/public/agent/company-site/public/assets/site/factory-overview.jpg` 作为企业站 Agent 静态资源同步纳入。
- 企业站 seed、运行配置和登录配置已统一改用当前存在的 `crops/*.jpg` 与卡片资源；`enterprise-packs/lundu/manifest.json` 由仓库生成器重建，移除已删除旧 PNG 的失效条目并刷新文件哈希。

### 2.3 产品展示与页面基础组件

- `eiscore-base/src/components/PumpBomViewer.vue` 更新泵体 BOM 的分件、装配动画、间距和移动端布局，避免零件相交并让控制条在移动端保持可用。
- `eiscore-base/src/layout/index.vue` 统一平台管理员、系统管理员和超级管理员的模块入口判断，恢复有权限用户的左侧模块显示。
- `eiscore-base/src/views/HomeView.vue` 增加 Harness 数字分身和智能 BI 容器，同时保留原生 Twin/AI Copilot 回退路径。

## 三、DeepSeek Harness 原生前端接入

### 3.1 Web 服务与代理

- `deploy/lundu/compose.yml` 增加 `deepseek-web` 服务、只读容器、无特权运行、临时文件系统、独立 DSH home 卷和 `agent-internal` 网络。
- `deploy/lundu/compose.harness-web.yml` 提供使用本地 runner 的部署覆盖配置，明确 Lundu 网络、Agent 内网和 Harness 数据卷。
- `deploy/lundu/dsh-web-runner.mjs` 启动 DSH Web profile，在 3081 端口为 HTTP/WebSocket 请求注入启动 token，并把流量转发到内部 3080 服务。
- `deploy/lundu/dsh-web.patch.yml` 关闭旧的 EISCore 内嵌 UI 插件，加载 `eiscore-auth`、`digital-twin` 和 `enterprise-bi` 三个原生客户端插件。
- `deploy/lundu/nginx/lundu-eiscore.conf` 增加 `/harness/`、`/harness-api/`、`/harness-plugins/`、`/harness-assets/` 和 `/api/eiscore/` 路由，保留升级头以支持 WebSocket，并对 base、API、插件和资源路径做子路径适配。
- Nginx 将历史 `/mobile/login` 入口重定向到统一主站登录页，避免用户看到与当前企业不一致的旧移动端登录壳。

### 3.2 前端认证交接与页面挂载

- `eiscore-base/src/services/harness-auth-client.js` 先初始化 Harness Web 会话，再通过 Agent handoff 获取一次性 code，最后调用 Harness auth bridge 完成当前用户会话交接。
- `HomeView.vue` 在数字分身模式挂载 Harness `digital-twin` 面板，在智能 BI/经营助手模式挂载 Harness `enterprise-bi` 面板；加载失败、认证未就绪或开发环境未开启时回退到原页面。
- 面板 URL、认证状态和 iframe 失败状态均由前端显式管理，避免将匿名或失效会话直接交给 Harness。

## 四、数字分身、Flash 与经营助手权限边界

### 4.1 权限上下文

- `realtime/ai-context-service.js` 统一读取 `agent_ontology_context`，要求 `agent_ontology_context_v1` 和角色范围上下文；上下文只解释权限，不授予额外能力。
- `realtime/ai-chat-http.js`、`realtime/twin-chat-http.js`、`realtime/flash-http.js` 和 `realtime/index.js` 将权限上下文接入 HTTP、聊天和组合根路径。
- `realtime/flash-authorization.js` 建立 Flash 工具静态策略、模块/应用/操作权限、表能力和字段 ACL 判定；上下文不可用或字段 ACL 不完整时，受保护工具不进入目录且拒绝调用。
- `realtime/flash-field-acl.js` 负责字段 ACL 查询重写、隐藏字段过滤、写入字段校验和响应脱敏；`select`、过滤、排序及逻辑表达式均不能引用当前用户不可见字段。

### 4.2 Flash 工具与业务助手

- `realtime/flash-semantic-executor.js`、`realtime/flash-tool-registry.js` 和 `realtime/flash-tool-service.js` 在工具注册、语义执行和服务调用前后接入统一授权。
- `realtime/twin-tools.js` 按当前用户权限暴露员工、组织、物料、库存、仓库、应用和个人信息工具；每次调用刷新权限上下文，结果再次按字段 ACL 脱敏。
- `realtime/ai-context-service.js` 的经营助手快照按模块 capability 过滤，无权限域不会发起 PostgREST 查询。
- 当前实现仍使用用户 JWT 和现有 RLS/RPC，应用层过滤不替代数据库授权；多个有效角色的字段权限按“任一有效角色允许即保留”合并。

## 五、测试、包管理与治理文档

### 5.1 回归覆盖

- 新增 `tests/engineering/flash-authorization-regression.mjs`、`tests/engineering/twin-tools-permission-regression.mjs`。
- 扩展 `ai-context-service-regression.mjs`、`flash-semantic-executor-regression.mjs`、`flash-tool-service-regression.mjs`、`twin-chat-http-regression.mjs`、`enterprise-login-branding-regression.mjs`、`direct-fetch-inventory-regression.mjs` 和 `realtime-composition-root-regression.mjs`。
- 登录统一入口还更新了 `enterprise-login-portal-regression.mjs`、`mobile-api-http-regression.mjs`、`platform-auth-session-regression.mjs`、`session-invalidation-migration-regression.mjs` 和 `system-config-http-regression.mjs`，覆盖移动端 401/过期会话、主站跳转、企业登录参数和品牌配置契约。
- `package.json` 增加 `test:agent-permission-boundary`，覆盖 Flash 授权、Flash 语义执行和数字分身权限回归。

### 5.2 包管理元数据

- `eiscore-base/pnpm-workspace.yaml`、`eiscore-base/pnpm-lock.yaml`、`eiscore-mobile/pnpm-workspace.yaml`、`eiscore-mobile/pnpm-lock.yaml` 固化前端工作区和依赖解析结果。
- 根 `package.json` 增加权限边界回归脚本入口。

### 5.3 文档

- `docs/AGENT_SEMANTIC_CAPABILITY_CATALOG_V1.md` 新增 Agent 运行时权限边界、字段 ACL、数字分身工具和多角色合并规则。
- `docs/permission-boundary-deployment-readiness.md` 记录本地回归结果、远端部署前置条件、低权限角色验证要求和数据库卷约束。

## 六、删除与资源替换清单

以下删除项来自当前工作树，按现状纳入提交，不在本记录中擅自恢复：

- 旧论文/说明书二进制：
  - `docs/thesis/毕业设计说明书-公开存证版.docx`
  - `docs/毕业论文初稿v2.8_全图重绘版_2026-04-05.docx`
  - `docs/毕业论文初稿v2.8_图片重绘版_2026-04-05.docx`
  - `docs/毕业论文初稿v2.8_模板对齐版_2026-04-06.docx`
  - `docs/毕业论文初稿v2.8_章节格式修正版_2026-04-06.docx`
  - `docs/毕业论文初稿v2.8_老师批注终修版_2026-04-04.docx`
- Jinwei 旧研究图库：`eiscore-company-site/public/assets/jinwei/research-gallery/gallery-001.png`、`gallery-002.png`、`gallery-003.png`、`gallery-021.jpeg`、`gallery-025.jpeg`。
- 旧伦度官网素材：`enterprise-packs/lundu/assets/site/framed/`、`generated/`、`products/`、`ratio/` 和 `transparent-products/` 下本轮标记删除的旧版产品、方案、工厂和比例图。它们由新的 `eiscore-base/public/enterprise-assets/site/` 资源替代。

删除项的完整 Git 状态以本提交的 `git show --stat` 和路径清单为准；资源替换没有改变数据库卷或业务数据。

## 七、验证记录

### 已完成的本地验证

此前已在 `github-eiscore-refactor` 执行并通过：

```text
npm run test:runtime-router
npm run test:agent-permission-boundary
npm run test:syntax
node tests/engineering/ai-context-service-regression.mjs
node tests/engineering/ai-chat-http-regression.mjs
node tests/engineering/message-normalization-regression.mjs
node tests/engineering/flash-http-regression.mjs
node tests/engineering/twin-chat-http-regression.mjs
node --check realtime/ai-context-service.js
node --check realtime/ai-chat-http.js
node --check realtime/twin-tools.js
git diff --check
```

前端 `eiscore-base` 低并发生产构建已通过（约 4526 个模块、约 25 秒）；仅有 Sass 弃用和大 chunk 提示，没有构建失败。

本次整理后再次通过：

```text
npm run enterprise-pack:validate -- enterprise-packs/lundu
npm run test:enterprise-package
node tests/engineering/enterprise-login-branding-regression.mjs
node tests/engineering/enterprise-login-portal-regression.mjs
node tests/engineering/mobile-api-http-regression.mjs
node tests/engineering/platform-auth-session-regression.mjs
node tests/engineering/session-invalidation-migration-regression.mjs
node tests/engineering/system-config-http-regression.mjs
npm run test:syntax
```

伦度包校验结果为 `lundu@0.1.0-draft`、48 个 payload 文件，manifest digest 为 `c815a0a642233d8ffc6b037d12e95836ce9b2b7effa53aef38fe902b5079e011`。

### 远端验证边界

- 伦度独立站登录页、管理员只读访问和 DeepSeek Harness 原生面板曾在现有域名上验证。
- 远端使用原有数据库卷，未更换、迁移或清理业务数据；本轮没有执行真实业务写操作。
- 本地最新字段 ACL 补丁尚未重新部署到远端；普通角色双角色 ACL 的线上证据仍需补齐，因此本记录不把它描述为已完成的线上验收。
- 线上部署必须使用现有域名和现有数据卷，不得把开发数据库卷、开发配置或凭据带入生产。

## 八、回滚与后续注意事项

1. 应用代码和部署配置可回滚到本记录的父提交 `d9a373e`；回滚前保留当前构建产物和 Nginx 配置快照。
2. 回滚 Harness 时同时撤销 Nginx 的 `/harness*` 路由、Compose 服务/覆盖文件和 `HomeView` iframe 开关，否则会留下不可用入口。
3. 数据库卷未在本轮变更中修改；任何线上回滚都不得删除 `lundu_eiscore_pgdata` 或 `deepseek_web_dsh_home`，除非另有经过审批的迁移方案。
4. 上线前仍需用一个低权限角色和一个字段 `can_view=false` 的角色完成左侧模块、数字分身、智能 BI、请求 `select` 和响应脱敏的线上证据闭环。

## 九、刻意排除的本地文件

下列内容不属于产品变更，没有加入本次提交：

- `.codex-tmp/`、`eiscore-base/.codex-tmp/`：远端同步脚本、截图、构建前备份、压缩包和调试输出。
- `.playwright-cli/`：浏览器快照、截图和守护进程日志。
- `output/` 及其他构建/扫描输出目录。
- 任何密码、访问令牌、SSH 私钥或远端操作缓存。

这些文件可以继续留在本地工作区供复核，但不应通过 `git add -A` 误加入产品提交。
