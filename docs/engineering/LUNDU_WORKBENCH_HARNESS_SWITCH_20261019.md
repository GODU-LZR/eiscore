# EIS-010：工作台统一 Harness 入口

2026-10-19。用户确认将工作台顶部“数字分身 / 智慧 BI / 业务流程”改为“DeepSeek Harness / 业务流程”，本轮完成宿主源码、隔离构建和浏览器切换验证。

## 行为与范围

- 默认仍为业务流程；保持现有管理员可见切换栏规则。
- 首次进入 DeepSeek Harness 使用现有认证交接，加载 `/harness-embed/` iframe。
- 数字分身与智能 BI 的业务 UI 插件及内部入口保留；删除宿主的两个单独模式与 feature 事件派发。
- 通过 `v-show` 保留 iframe，往返业务流程不会重建 iframe、清空未发送输入或重复认证；认证失败显示错误和重试。
- 两列布局；窄屏沿用横向滚动，Chrome 在 390px、侧栏折叠后验证入口可访问。

本轮不改闪念、公开客服、数据库、权限边界、Harness 插件配置、其他模块或远端。主树既有平台包删除及其他未提交改动均保留。

## 验证事实

以下检查通过：

- `npm run test:eiscore-embed`：路由契约，以及执行真实 HomeView script 的双模式、延迟认证、往返不重复请求、认证失败与重试回归。
- `node tests/engineering/remaining-session-consumers-regression.mjs`。
- `node tests/engineering/production-config-regression.mjs`。
- `node tests/engineering/harness-frontend-panel-isolation-regression.mjs`。
- HomeView 与相关新增文件的 `git diff --check`。
- 隔离工作树 `eiscore-base` 的 `npm run build`：Vite 7.3.0，5919 模块，35.91 秒。既有 Sass import 与大包警告仍存在。

主树直接构建失败：既有未提交删除导致 `packages/eiscore-platform` 缺失，先后出现包导出及共享 safe-storage 相对导入无法解析。没有回退这些删除。成功构建使用当前提交 `c0c40fba0b7cc5ff2950ca383a8ccc90eafbcb54` 的独立 worktree 加本次 HomeView；它不是包含所有主树脏改动的完整构建。

独立 worktree：`.codex-tmp/workbench-harness-build-20261019`。构建产物在其 `eiscore-base/dist`，入口 `assets/index-DQD0-q0m.js`，工作台 `assets/HomeView-Dr5pcyUN.js`。主树与候选 HomeView 的 SHA256 同为 `3de62ddd32243a0b47f9e726eebceaa2e9c936863c274d66f7b6fba8c5c3af31`。

真实 Chrome 通过隔离预览 `127.0.0.1:4181` 验证：两个顶部入口、业务流程可见、iframe DOM 身份保留、未发送输入保留、401 认证失败后重试成功、认证未完成时往返不重复请求、1440px 与 390px 切换、JavaScript pageerror 为 0。

浏览器认证、业务 API 和 iframe 内容均为明确标记的测试替身；只证明真实构建宿主的 UI/生命周期，不证明真实 Harness 后端、Provider completion 或实际业务权限已经验收。未连接远端，未写库；没有替换现有 18080 测试服务或发布完整 12 入口。

本地证据在 `output/playwright/lundu-workbench-20261019/`：`setup.cjs`、`verify.cjs`、`verification.json`，以及桌面流程/Harness、窄屏 Harness、认证失败四张截图。生成物不提交源码仓库。

## 整合与退出

仅整合 HomeView、回归、npm 测试入口与本记录/问题台账。正式本地服务或远端生效需要另行准备并校验完整 12 入口制品；当前不能声称运行态已生效。若撤销此交互，回退本任务提交即可；无需数据迁移或数据库回退。

复用惠众双入口及保留 iframe 的方式，但不复制惠众品牌、模块卡片或专属 Harness patch。伦度部署的业务插件依据为 `deploy/lundu/dsh-web.patch.yml`；主树已有的其他企业 patch 修改本轮未动。
