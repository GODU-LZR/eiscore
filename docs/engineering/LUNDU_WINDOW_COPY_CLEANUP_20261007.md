# 伦度独立站窗体文案精简记录

日期：2026-10-07

本轮处理 eiscore-base/src/views/LoginView.vue 的采购单、客服和支付窗体，删除客户可见的 AI 解释性说明和重复辅助文案，同时保留采购和客服流程所需的控件。

采购单窗体保留标题、商品与数量、四阶段状态、6 个联系方式字段、提交采购单、客服入口和支付接口预留；删除标题说明、数量补充说明、状态解释段落和联系人说明。客服窗体保留标题、消息区、快捷问题、输入框、发送按钮和采购单入口；首次打开不再自动插入客服介绍语，等待状态缩短为省略号。支付窗体保留标题、当前状态和返回采购单操作，去掉重复接口解释段落。

源码分支为 codex/systematic-refactor，基线提交为 561f3d83c760c7c0511a460b567af4eeced95359。工作树含其他 Agent 未提交改动，本轮未覆盖或回退这些改动。npm --prefix eiscore-base run build、前端聚合和 manifest 生成均通过；构建仅有既有 Sass import、circular chunk 和大 chunk 警告。

完整 web 制品为 output/lundu-procurement-customer-service-release-20261007.tar.gz，SHA-256 为 9F7E2DE386DE3706D3B0600CBB5B352FA67049AE138B8961AD94B2E492A7D4D8。入口为 6,258 字节，主包为 /assets/index-Cw9QaeCw.js，manifest 为 a02d50c4bb4255e7 / 561 项 / 76,539,795 bytes；入口、配置和主资源没有君乐缘匹配，公开配置为 enterprise.id=lundu。

发布目标是远端伦度开发/验收 Compose 的 web 服务。发布使用 /opt/lundu-eiscore/.lundu-web-publish.lock，远端先校验归档 SHA-256 与本地一致，再将旧 release 备份到 /opt/lundu-eiscore/backups/lundu-procurement-customer-service-before-20261007004952.tgz，原子替换完整 release，实际只重建 lundu-eiscore-web-1。DB、API、Agent、DeepSeek Web 和 Harness 未重建；Compose 仅报告既有 DeepSeek Web orphan，没有清理其他容器。

线上 HTTP 门禁通过：/login、/asset-manifest.json、/config/eiscore-enterprise.json 和伦度 Logo 均 HTTP 200；线上 manifest 为 a02d50c4bb4255e7 / 561 / 76,539,795，enterprise.id=lundu，登录入口 HTML 无君乐缘匹配。

真实线上 Playwright 脚本 output/playwright/lundu-procurement-customer-service-qa.cjs 在 390x844、414x896、768x1024、1440x900 全部通过。采购单解释性段落数为 0、字段数为 6、提交按钮为“提交采购单”；客服面板均在视口内且高度大于宽度，消息区大于输入区，客服入口固定右下角，展开/收起正常；四个视口均无横向溢出、无旧询价文案、无页面错误和控制台错误。结果见 output/playwright/lundu-procurement-customer-service-qa.json，截图见同目录 expanded 和 collapsed 文件。
