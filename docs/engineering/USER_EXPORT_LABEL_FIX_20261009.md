# 用户导出名称与密码排除修复记录

日期：2026-10-09（Asia/Shanghai）。用户要求修复用户管理导出问题并测试，同时保留当前点击测试版本。

## 修复结果

- 部门、角色、SOP 岗位等使用 select/dropdown、options 或 dictKey 的业务字段，通过共享 Grid 的 valueFormatter 转换为选项名称。
- 保留 ACL 遮罩优先级、现有自定义 formatter、仓储 valueFormatter 及 pinned 汇总逻辑。字典未提供对应名称时保留原值，空值导出为空。
- 共享 CSV 入口按当前显示列顺序导出；排除 field 或 colId 最后一段为 password 的字段，以及显式 suppressCsvExport 的列。
- 禁止导出标记保存于 AG Grid 合法的 colDef.context；所有列被排除时不调用导出，避免 AG Grid 空 columnKeys 回退为全部列。
- 用户管理密码列显式禁止导出，页面使用已有 formatter 钩子显示遮罩。
- 新增 `npm run test:grid-export`，并纳入 `test:unit`。

## 隔离与源码交付

初始分支 `codex/systematic-refactor`，HEAD `06a87e363452f7966f6f3e81832cca156d327b00`。

在独立工作树 `C:/Users/Twist/Documents/eiscore/.codex-tmp/grid-export-fix-20261009`、分支 `codex/grid-export-fix-20261009` 实施并构建。依赖复用现有安装目录，没有安装或升级依赖。随后仅将本轮源码、测试及 npm 测试命令同步至主工作树，逐文件核对一致；既有业务链测试改动保留。本轮未提交、推送或部署。

当前 Nginx 仍只读挂载主工作树 `eiscore-base/dist`；本轮构建仅产生隔离工作树的 HR/仓储 dist，没有覆盖当前点击测试 dist 或远端伦度 release。

## 实际验证

| 验证 | 结果 |
| --- | --- |
| 旧版 Core 复现：`node tests/engineering/grid-export-regression.mjs --baseline` | 预期失败，实际返回原始值而非名称 |
| 修复版：`npm run test:grid-export` | 通过；执行实际 Core 函数、列定义及密码列配置，覆盖选项边界、字典更新、ACL、汇总、顺序、排除和空列保护 |
| `npm run test:grid-single-source` | 通过，8 个 adapter 仍复用共享实现 |
| Grid local-layout / paging 回归 | 通过 |
| `npm run lint:changed -- --base=HEAD` | 通过；同步到主工作树后再次通过 |
| HR、仓储 `npm run build` | 隔离工作树中两者通过，最后一次构建包含最终源码 |
| 新增模块与测试语法、`git diff --check` | 通过 |
| 真实用户管理组件 + 真实 SharedGrid + 浏览器点击导出 | 下载 3 份 CSV，文件内容断言通过 |

浏览器验证在独立 `http://127.0.0.1:18081` 运行，渲染真实 `HrUserManage.vue` 及共享 Grid，request adapter 返回合成数据；所有页面 API 调用（含初始化元数据 POST）均停留在内存 fixture，未访问业务数据库。实际文件检查：

- 默认导出包含部门/角色/岗位名称；不含密码列或合成秘密值；隐藏手机号不导出。
- 调整列顺序并隐藏邮箱后，导出顺序正确；带逗号、引号和换行的姓名可正确读回。
- 显式排除部门列后，该列确实不在 CSV 中。
- 仅剩密码可见时不会下载；底部合计保留；未知部门关联保留原值。

证据保存于主工作树忽略目录 `output/playwright/grid-export-20261009/downloads/`：`users-default.csv`、`users-reordered-escaped.csv`、`users-explicit-exclusion.csv`、`users-masked.png`。fixture 代码保存于同级 `fixture/`，不作为产品源码提交。浏览器验证期间唯一 HTTP 错误为 fixture 缺失 favicon，不涉及业务请求；fixture 已补空 favicon。未声称本轮重跑全量 67 项、所有业务 CRUD、真实 Provider 或全量前端构建。

## 当前点击测试服务状态与中断记录

收尾时观察到 WSL Ubuntu 为 Stopped，原 keepalive 进程消失，Windows 18080 入口短暂拒绝连接。停止原因未确认；本轮没有执行 WSL shutdown、Compose 重建、容器删除或数据库迁移。重新启动 WSL 并保留隐藏 keepalive 后，原 8 个容器自动恢复，容器 ID 与开始时相同，Bridge/Agent Runtime healthy。容器启动时间已变化，因此不能声称全程零中断。

恢复后 `/login` 和 11 个微前端 index.html 全部 HTTP 200，约 5 分钟后再次检查仍正常。当前版本保持原样：

- 本地 manifest：`06231c2740972a8f`，564 项。
- `eiscore-base/dist/index.html` SHA256：`90f950ef4729ed5315298ee1c0c217780a51fadb0fd51e5f408a341d33bb97b2`。
- `eiscore-base/dist/asset-manifest.json` SHA256：`d2a18900c199b817e4b5f152e02e5733b764ee0250adbc37f4fb01201fdf124a`。

本轮未修改数据库卷或业务记录、正式 Compose、Nginx 配置与远端服务。隔离浏览器及 18081 fixture 服务已停止；本地点击测试 WSL 会话保留。

## 生效与回退边界

修复已存在主工作树源码中，当前 18080 页面仍使用原制品，尚未应用修复。待用户结束本轮点击测试，再按协作规则构建完整 12 入口制品并切换，不用单独 HR dist 覆盖完整站点。远端当前伦度 release 及 manifest `78294f227a301616` / 600 项保持不动。

本次没有数据库迁移；未来切换制品时的回退方式为恢复已备份的完整旧制品，不回退业务数据，也不覆盖他人未提交修改。
