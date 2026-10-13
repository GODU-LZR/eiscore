# 用户管理“操作指引岗位”文案修改

日期：2026-10-09（Asia/Shanghai）。用户要求将“SOP岗位”改为“操作指引岗位”，并在不切换本地点击测试版本的情况下修改和测试。

## 修改范围

- `eiscore-hr/src/views/HrUserManage.vue`：用户管理列标题改为“操作指引岗位”，列管理和导出复用该标题。
- `eiscore-base/src/layout/index.vue`：同步用户管理的用途、使用场景与操作说明。
- 保留 `sop_role` / `sopRole`、八个岗位选项值、权限与接口契约，以及此前未提交的用户导出修复。没有修改历史 SQL 或冻结 checksum。

使用既有隔离工作树 `.codex-tmp/grid-export-fix-20261009` 验证。两份修改后的 Vue 源码与主工作树一致（忽略 CRLF/LF 差异），没有安装或升级依赖。

## 实际验证

| 检查 | 结果 |
| --- | --- |
| `npm run test:grid-export` | 通过，既有导出名称、密码排除、ACL、汇总行为保留 |
| `npm run test:grid-single-source` | 通过，8 个适配器仍使用共享 Grid |
| `npm run test:base-layout` | 5 项基座策略回归通过，包括岗位归一化、指引推荐和进度兼容 |
| `node tests/engineering/grid-local-layout-boundary-regression.mjs` | 通过 |
| `npm run lint:changed -- --base=HEAD` | 通过，11 份变更文件 |
| `git diff --check` | 通过 |
| 隔离 HR `npm run build` | 通过，生成的 `HrUserManage-CW2URawH.js` 含新标题 |
| 隔离基座 SFC script/template 编译 | 通过，使用已有主仓库 Vue 编译器，无输出文件 |

隔离基座 `npm run build` 曾因该目录缺少自身 node_modules、找不到 vite 而失败；改用无输出的 Vue SFC 编译检查，没有声称完成基座完整生产构建、浏览器点击验收或重跑全量 67 项。

## 运行态边界及已发现问题

本轮没有提交、推送、部署、重启容器、覆盖主 `dist` 或调用业务数据库写接口。新版页面未运行；以后部署时，原有 `syncFieldLabels()` 会同步字段显示名，无需新增数据库迁移。

修改前已观察到主 `eiscore-base/dist` 缺少 `asset-manifest.json` 及 HR 等子应用目录，`/hr/index.html`、`/materials/index.html`、`/sales/index.html` 返回 404。该情况与本轮文案修改分开记录，没有宣称本地全系统已正常。

收尾检查 `/login` 与入口脚本仍为 HTTP 200；Nginx 容器仍为 `caa4091d8bc3200ee1d8c71e0bf103667894de02d747637b887b37843ffa6360`，启动时间仍为 `2026-10-09T05:46:39.368274207Z`。主入口仍为 `/assets/index-DyyD7Swn.js`，主 `index.html` SHA256 前后均为 `c389e49549254dfd24717e2bc84fc008842660686458a1376811fff162edf958`，文件时间仍为本地 `2026-10-09 13:52:08`。Bridge 与 Agent Runtime healthy。

新名称仅交付于源码，待后续协调切换完整站点制品后才在运行页面生效。恢复既有子应用 404 需要单独处理完整站点制品，不能用本次隔离 HR dist 覆盖整站。
