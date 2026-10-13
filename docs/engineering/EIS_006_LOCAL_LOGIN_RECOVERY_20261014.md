# EIS-006 本地登录回环修复

## 问题与原因

目标仅为本地 Desktop Docker `http://127.0.0.1:18080`；用户已纠正最初的远端假设，本次未部署远端。
原基线 `24531450`。真实管理员登录RPC返回200，签名JWT长11,173字符，包含322项权限。
共享会话SDK的8,192字符限制拒绝保存，桌面store忽略失败并提示成功；路由守卫随后发现会话为空，又转回`/login?redirect=/`。
同时带JWT的角色及用户信息请求被Nginx拒绝，返回400 `Request Header Or Cookie Too Large`；相同请求直连PostgREST3000返回200。
后端窗口交叉确认JWT签名密钥摘要一致；浏览器诊断会话无Service Worker/Cache Storage干扰。

## 修复与协作

- 前端独立任务`codex/fix-eis-006-frontend`提交`8a5a2493`并推送至`eiscore`，主分支整合为`9ed97152`。
- SDK默认上限改为12KiB；桌面与移动登录检查会话保存结果，失败时不提示成功或跳转。
- 网关模板增加`large_client_header_buffers 4 16k`，提交`04faf94d`并推送主分支。本地临时恢复配置同步后通过`nginx -t`并reload。
- 现有权限列表、JWT授权契约、数据库、数据卷和Agent保持不变。Node默认16KiB总请求头限制未放大；SDK12KiB为其他头保留名义4KiB余量。
- 原生四窗口收到任务并执行只读复核；统筹串行整合和更新服务，执行窗口不发布。

## 本地制品与回退

当前本地仅重建`eiscore-nginx`，未启动历史全局目标、未执行数据库迁移、未更换业务卷。
完整12入口从当前主工作树源码构建到`.codex-tmp/eis006-build-20261014-v2/`，并已切换本地服务。
服务静态挂载为`.codex-tmp/eis006-build-20261014-v2/eiscore-base`，配置挂载为`.codex-tmp/local-startup-20261013`。
规范目录`eiscore-base/dist`已同步同一份完整制品，其他窗口不得直接重建/覆盖。
manifest版本`38abb6424c74dcf6`，575资源，78,272,095字节；所有清单文件在制品中存在。
桌面入口`/assets/index-CYxcFO7c.js`。12个真实`index.html`入口HTTP200，`/asset-manifest.json`返回可解析JSON。

回退保留：

- 原Nginx容器`eiscore-nginx-before-eis006-1791914241655`，已停止并断开原网络。
- 旧完整制品`.codex-tmp/local-startup-20261013/dist-before-eis006/`及`dist-before-eis006.tar`。
- 旧配置`.codex-tmp/local-startup-20261013/default-before-eis006.conf.bak`。
- 本轮发布记录`.codex-tmp/local-startup-20261013/eis006-publish-report.json`，第一轮报告保留为同名`.v1-backup-20261014.json`。

回退时由统筹停止新Nginx、断开其网络并保留为失败容器，使用明确的旧制品备份目录和保留配置重建Nginx，恢复`nginx`网络别名。
旧容器绑定原目录路径，不能假定该路径更新后重启旧容器就一定得到旧制品；实际挂载必须再次核对。
只回退前端制品可保留有界网关缓冲；如需原配置也恢复，先还原备份再执行`nginx -t`。
不执行`docker compose down -v`、不删除数据卷。

## 实际验证与限制

- `npm run test:platform-auth`：19组通过，包括约11KiB签名JWT、12KiB边界、自定义小上限、过期判断和存储失败。
- `npm run test:mobile-login-feedback`：通过，实际执行处理器验证失败不跳转。
- `node tests/engineering/production-config-regression.mjs`：通过。
- 12套Vite构建及完整聚合：通过，仅既有Sass、循环chunk及大chunk警告。
- 本地真实登录200；角色、用户视图、应用列表、发布路由及Agent受控读接口200；auth handoff201，未运行模型。
- 超过16KiB的认证头仍被网关400拒绝，限制有界。
- `/api/rpc/get_app_manifest`不是当前服务的有效接口（404/PGRST202）；验收使用实际`apps`、`published_routes`及静态manifest，不能误报不存在RPC通过。
- 浏览器点击回归：Chrome 使用第二轮制品完成登录并进入工作台，URL为`http://127.0.0.1:18080/`，页面显示“伦度机电”，侧栏11项可见；`auth_token`长度11173，`user_info`长度8480。
- 刷新后仍保持登录；`/hr/`（人事）与`/materials/`（仓储）均完成渲染，主要请求返回200或206；`/apps/`应用中心正常且控制台无错误。
- 退出后访问`/settings`会回到`/login?redirect=/settings`，重新登录后正确进入`/settings`。无状态新会话也可直接登录进入首页。
- HR与仓储页面各有一个`TypeError: Cannot read properties of undefined (reading 'vitemount')`控制台异常，但未阻断页面渲染；该既有问题另行跟踪，不属于本次登录会话修复。`role_data_scopes`自动同步请求本轮返回200，未修改业务逻辑。

### 第一轮浏览器验收发现的依赖漂移

第一轮完整构建及静态入口验证通过，但Chrome实际登录仍失败；新页面正确提示保存失败，没有假成功。
原因是`eiscore-base`和`eiscore-company-site`的`node_modules/@eiscore/platform`仍指向历史pnpm file包副本，包含旧8KiB上限。
源码回归直接使用当前源码，因此不能代替检查实际构建依赖。
统筹将这两处依赖junction备份为同目录`platform-before-eis006`，重新链接到当前`packages/eiscore-platform`，未改包版本或锁文件。
第二轮构建对12套已安装SDK的所有`src`文件逐字节比较当前源码，不一致立即失败，再重新构建完整12入口到新的staging目录；第二轮制品已作为当前本地版本发布。

本轮只修登录会话与网关容量。未重跑67项全业务链，未处理既有`role_data_scopes`同步409或未部署的Flash隔离服务。
