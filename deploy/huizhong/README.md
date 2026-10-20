# 惠众 EISCore 部署适配源码

本目录保存惠众已发布版本的 Harness、闪念、图形渲染及网关适配代码。产品源码位于仓库根目录的各模块中。归档基线为惠众任务提交 `3199a61a`，对应线上前端版本 `huizong-20261021-order-unit1`。

本次归档包括惠众官网及企业登录、销售/人事/物料模块配置、工作台与工作助手、三个入口的角色和会话交接、ECharts/思维导图/DOT/HTML 渲染、渲染失败隐藏、表格汇总与新增性能修复。销售业务闭环的既有提交保留在分支历史中。

## 文件映射

| Git 中的位置 | 惠众服务器中的位置 |
| --- | --- |
| 根目录的产品模块、`shared`、`packages`、`realtime`、`database` | `/opt/huizong-eiscore/source/` 下的同名目录 |
| 本目录 `harness/` | `/opt/huizong-eiscore/harness/` |
| 本目录 `flash-harness/` | `/opt/huizong-eiscore/flash-harness/` |
| 本目录 `compose.yml`、`compose.flash.yml` | `/opt/huizong-eiscore/` 下的同名文件 |
| 本目录 `nginx/huizong.conf` | `/opt/huizong-eiscore/nginx/huizong.conf` |
| 各前端构建产物 | `/opt/huizong-eiscore/release/` 下的对应入口 |

Compose 文件按服务器运行目录组织。`build.context: ./source`、相对挂载和 `.env` 均相对于该运行目录；不能直接在本 Git 目录执行 Compose 并假定运行布局已经准备完成。实际环境参数仍以服务器受保护配置为准。

`harness/client-plugins/*/lib` 是容器直接加载的 JavaScript 插件适配入口；`harness/vendor` 是浏览器直接请求的自托管 ECharts 与 Viz.js 依赖，附带版本、校验值和许可证。这里保留这些运行所需文件，不收录前端构建目录、安装依赖或运行状态。

## 保留的边界

- 惠众业务插件仅提供销售、人事和物料范围的能力；闪念使用单独的运行环境与会话。
- 认证信息由服务端绑定到登录用户及会话，三个入口按职责交接；API Key、JWT、密码及私有 `.env` 不存入 Git。
- 会话、工作区、草稿、审批记录、审计和演示业务数据保留在数据库及 Docker 卷中。本归档不包含数据库 dump，也不执行初始化、恢复、迁移或服务重启。
- `harness/node_modules` 和 `flash-harness/node_modules` 由运行镜像提供 Linux 依赖，不复制 Windows 的依赖目录或目录联接。

## 验证

产品侧离线回归：

```sh
node scripts/test-grid-saved-row.mjs
node scripts/test-grid-summary.mjs
node scripts/test-sales-grid-create.mjs
node eiscore-materials/scripts/test-create-grid-reconciliation.mjs
```

Harness 各 `test-*.mjs` 保留在相应目录。需要 DSH SDK 的检查使用已安装的 `agent-harness/node_modules`，也可通过 `DSH_TEST_MODULE_ROOT` 指定依赖目录；部分测试需要 `node --expose-internals`。

归档工作树中已复跑上述四组产品回归、31 项迁移顺序及校验值检查，并通过 10 项运行适配回归，覆盖角色、入口、原生会话契约、草稿交接、图形响应策略、认证代理、销售交付与闪念。测试复用现有本机依赖；没有访问业务数据库或启动业务服务。

归档前已完成销售、人事、物料、动态应用的生产构建及惠众远端真实浏览器验收：普通新增无需重新查询整表，默认排序下新增记录位于顶部；客户新增约 0.22–0.27 秒、员工约 0.31 秒、物料含自动编号约 0.93 秒。订单单位栏已在 1600、1366、768、390 像素宽度下验证。该记录不表示已重新执行仓库全部 CI。

回退需使用对应发布备份和完整制品，不通过恢复业务数据库或重新运行历史初始化脚本回退前端。Git 推送本身不变更在线运行状态。
