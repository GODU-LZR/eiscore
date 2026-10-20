# EIS-015：DeepSeek Harness 三角色隔离

## 目标

将工作助手、工作台 Harness 和闪念应用拆成可由服务端验证的 persona 边界。客户端字段和提示词只用于呈现，不作为授权依据。

## 实现

- `work-assistant` 使用独立 Web/Bridge/runtime、assistant workspace、cookie 前缀、认证 audience 和业务办公插件；负责日常办公、多模态资料和受权限控制的业务操作。
- `workbench` 使用工作台 Web/Bridge/runtime 和既有 business workspace；负责数字分身、智能 BI、经营分析、业务流程和图表输出。
- `flash` 使用独立 Flash Web/Bridge/runtime、workspace 和密钥；仅保留 `flash-builder`，不暴露业务插件或业务数据工具。
- Host 按需保留两个独立 iframe；工作台显示优先于侧面工作助手。Frame 只允许工作助手收发草稿 ACK，工作台不消费工作助手草稿。
- Bridge、runtime、Nginx、Vite 和 Compose 的 API、assets、plugins、plugin events 路径按 persona 分开；Bridge 从实际 Harness 根目录加载 `profile-policy.js` 和 `persona-policy.mjs`。
- runtime metrics 使用实际 registry 装配，避免 production handler 访问未提供的 `gateway.registry`。
- 既有租户/RLS、用户权限、写确认、幂等和审计边界保留；persona 不新增 UI 确认弹窗，也不能绕过服务端写门禁。

## 验证

- `npm run test:harness`：通过。
- `npm run test:syntax`：363 个 Node 文件通过。
- `npm run test:eiscore-embed`：通过，包含双 iframe 生命周期、身份切换和 Flash 路由隔离。
- `npm run test:harness-web-isolation`、`npm run test:harness-runtime-boundaries`、`npm run test:harness-read-http`、`npm run test:harness-bridge`：通过。
- `npm run test:runtime-image`：通过；三份 Compose 静态配置检查通过。
- `eiscore-base`：`npm ci` 后 `npm run build -- --mode test` 通过，构建输出为候选 worktree 的 `eiscore-base/dist`。
- SDK loopback：`ok=true`、一次受控工具代理调用、两次 mock model 请求；这不是真实 Provider 上线证明。
- Playwright 隔离浏览器：`http://127.0.0.1:4185/login` 渲染伦度品牌、轮播图、采购单入口和水泵 BOM 三维动画；企业登录弹窗可打开。证据：`output/eis015-login.png`。

## 未完成与限制

- 本次不启动或重建共享 18080，不部署伦度远端，不写业务数据库；因此真实登录、真实 Provider completion 和登录后业务点击链路仍待在目标运行态验收。
- DSH 文件系统 workspace 是按 persona 服务共享的命名空间，不是按用户/tenant 独立目录。通用 fs/bash 已被 restricted profile 禁止；EISCore 业务工具继续按认证用户和 RLS 约束。
- 候选分支尚未 cherry-pick 到 `codex/systematic-refactor`；候选分支已推送到 `eiscore/codex/fix-eis-015-harness-personas-20261020`，远端确认 SHA 为 `0bcd7314e7a201067d1577d809a36a1a36d6a2da`。需统筹在确认主工作树基线后串行整合。

## 交接

- 候选 worktree：`.codex-tmp/eis015-harness-personas-20261020`
- 分支：`codex/fix-eis-015-harness-personas-20261020`
- 基线：`2b538d30`
- UI 子提交：`986e269b`
- 原始隔离候选提交：`0bcd7314`（候选分支后续文档/测试收口至 `221b8488`）；clean integration 验证分支最终提交：`691d2628`。
