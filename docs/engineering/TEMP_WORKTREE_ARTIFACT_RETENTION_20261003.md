# 临时工作目录归档记录

日期：2026-10-03

本记录说明重构工作树中的 Codex/Playwright 临时目录如何处理。它们不是产品源代码，不应进入提交或部署制品。

## 忽略规则

`.gitignore` 已加入以下路径：

- `/.codex-tmp/`
- `/.playwright-cli/`
- `/eiscore-base/.codex-tmp/`
- `/eiscore-base/.playwright-cli/`

## 归档位置

原始目录已整体移动到工作区外的可恢复归档目录：

`C:\Users\Twist\Documents\eiscore-temp-archive\codex-systematic-refactor-20261003`

归档保留原目录结构，并分为 `evidence/`（少量审计证据）与 `history/`（历史缓存、构建上下文、截图、tarball 和重复制品）。本次未直接永久删除文件。

## 保留的审计证据

以下文件从临时目录中单独保留在归档的 `evidence/` 下：

- `db-release-drift.json`：数据库 release provenance drift 报告。
- `remote-site-config.json`：伦度公开站点配置快照。
- `generated-release.json`：历史发布元数据。
- `remote_lundu_visual_check.mjs`：伦度多视口视觉验收脚本。
- `single-build-20260926.log`：独立站前端构建日志。

这些文件只用于审计和追溯，不是当前源码、正式 dist 或部署输入。当前正式验证结果仍以仓库中的测试和状态文档为准。

## 已归档内容

`history/` 包含其余 Codex smoke home、DeepSeek SDK 安装包、Docker build context、伦度历史 dist/tarball、图片生成/裁剪过程文件、Playwright 截图和 console/page 快照。它们保留用于必要时回查，不参与 Git、构建或部署。

归档完成后，工作树不再包含这四个临时目录；后续同名目录若由工具重新生成，会因 `.gitignore` 保持未跟踪且不会误提交。
