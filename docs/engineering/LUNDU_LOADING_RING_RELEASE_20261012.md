# 伦度独立站资源加载环发布交接（2026-10-12）

本轮目标是让加载环只覆盖伦度独立站公开页面的资源加载：桌面端 `/login`、两个公开服务页和移动端 `/mobile/login`。后台路由不显示加载环；加载环等待页面 load、公开配置、字体、首屏可见图片和两帧渲染，异常资源单项最多等待 12 秒。

发布声明：目标服务为 `web`；工作区 `github-eiscore-refactor`，分支 `codex/systematic-refactor`，基线提交 `330d5edc`，工作树包含其他 Agent 未提交改动。本轮只重建 `lundu-eiscore-web-1`，没有重建 DB、API、Agent、DeepSeek Web 或 Harness。完整 12 入口制品为 `output/lundu-loading-ring-20261012/full-dist-publish`，归档为 `output/lundu-loading-ring-20261012/lundu-loading-ring-330d5edc.tar.gz`，SHA-256 为 `AE2CE69A15C1D1C321A3291A7080333EE98341502B27459E4C4E3DA4B61B9942`。

制品由当前桌面端和移动端构建覆盖同版 PayPal 静态制品的根站与 `/mobile` 入口组成；其余 10 个微应用逐文件保持基线版本。发布前门禁通过：manifest `b0e85ee23f81606c`，594 个 URL，`78,494,794` bytes，所有 URL 存在且无备份目录；`enterprise.id=lundu`，伦度 Logo 存在，公开入口无“君乐缘”。

远端使用 `/opt/lundu-eiscore/.lundu-web-publish.lock` 校验旧 manifest `b29f2fcb0fcf219a` 后原子替换完整 release，旧版备份为 `/opt/lundu-eiscore/backups/release-pre-loading-ring-330d5edc-20261011181511`。实际执行：

```sh
docker compose --env-file /opt/lundu-eiscore/.env \
  -f /opt/lundu-eiscore/compose.yml \
  up -d --no-deps --force-recreate web
```

线上结果：容器 `lundu-eiscore-web-1` 为 `be49570631f5`，状态 `Up`；入口 10,012 bytes，主包 `/assets/index-DPsMrQWU.js`；桌面与移动入口均包含路径限定加载环。`/login`、`/mobile/login`、公开配置、manifest、Logo 均返回 HTTP 200。Playwright 在 `1440×900` 和 `390×844` 验收通过：标题正确、Logo 可见、加载环在资源完成后消失、无君乐缘、无横向溢出、无页面或控制台错误。

后续 web 发布必须继续使用完整 12 入口制品，并保留本轮路径限定加载环；不得直接发布旧的 `output/lundu-paypal-release-20261012/full-dist` 或旧的全屏加载环制品。
