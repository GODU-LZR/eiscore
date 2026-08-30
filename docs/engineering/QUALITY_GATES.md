# 渐进式质量门禁

EISCore 的质量门禁优先阻止新增风险，同时避免因历史代码存量问题让工程化无法启动。

## CI 门禁

`npm run test:quality` 依次执行：

1. `test:syntax`：检查 Node 可执行脚本语法。
2. `test:secrets`：扫描全部已跟踪和本地新增文本文件中的高置信度秘密格式；命中时只输出位置和类型，不输出秘密值。
3. `lint:changed`：使用 ESLint 检查相对 Git 基线新增或修改的 JavaScript、MJS、CJS 和 Vue 文件。
4. `test:infrastructure`：检查全部 Shell 文件的 LF 换行与 Bash 语法，并验证生产 Compose 的有效配置和失败关闭行为。

GitHub Actions 使用 PR 基准提交或 push 前提交作为 `EISCORE_QUALITY_BASE`，并以完整 Git 历史检出代码。完整离线回归和全部前端构建继续作为后续门禁。

## 渐进 lint 范围

当前 ESLint 只启用高置信度正确性与安全规则，例如重复键、不可达代码、非法 `typeof`、`eval` 和不安全 `finally`。暂不把历史格式、命名和未使用变量一次性升级为阻断项。

本地默认比较 `HEAD^`，并始终加入工作树、暂存区和未跟踪文件：

```bash
npm run lint:changed
```

指定评审基线：

```bash
node scripts/lint-changed.mjs --base origin/main
```

只有当存量代码已经通过专项清理并具备稳定测试后，才扩大规则或全量目录范围。

## 秘密扫描边界

扫描覆盖私钥、常见云平台/API Token、JWT 和生产部署中的已知弱默认值。它是提交前门禁，不替代托管平台的秘密扫描、密钥轮换或生产凭据管理系统。

发现真实秘密时应立即停止提交、轮换凭据并审计使用记录，不要只把字符串加入忽略列表。
