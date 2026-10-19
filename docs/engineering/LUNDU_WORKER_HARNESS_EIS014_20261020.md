# EIS-014：右侧工作助手复用 Harness

用户要求点击工作助手后，在右侧类似手机宽度的面板展示 DeepSeek Harness，复用现有全屏按钮，并抽取组件供工作台复用。

## 实现与边界

- Layout 固定持有一个业务 iframe，Home 只登记显示区域。工作台/侧栏切换、全屏/还原、关闭重开和普通业务路由切换只改变显示位置，不移动或重新创建 iframe。默认仍显示业务流程。
- 侧栏380px，窄屏限制在视口内；抽取 `HarnessFullscreenButton`，新旧壳共用，仍使用既有全屏偏好。认证、加载、失败重试和草稿交接在 `BusinessHarnessFrame`；入口/尺寸在 `BusinessHarnessHost`。
- 业务认证队列放到 service 模块，跨 iframe 卸载仍串行；两个兼容独立路由也共用队列。排队任务和结果都检查当前身份/生命周期，避免旧登录身份延后覆盖 cookie 或复活旧界面。
- DOM/qiankun 的 `open-worker` 仍由原 Bridge 去重，但只打开 Harness 和交接草稿；不再后台调用旧聊天，不传页面样本、上下文权限或凭据，不自动提交。原生 Lexical composer 通过自身粘贴处理更新真实草稿，已有内容须明确替换。
- 草稿协议校验同源直接父页、类型、字段、版本、ID及长度；队列最多8条、历史去重最多256条；异步采用、IME、超量重试及投递失败有明确边界。ACK 表示接收/填入草稿，不代表业务执行成功。
- 进入闪念或独立 Harness 路由时卸载共享业务 iframe，避免重复实例。公开客服服务和闪念认证/工具/数据卷不修改。

决策详见 [ADR](ADR_EIS014_BUSINESS_HARNESS_HOST.md)。旧 AiCopilot 的公式回填、导入映射、BPMN 等私有结果 UI 没有被注入 iframe；本次交付壳复用和指令草稿交接，后续业务执行继续使用已有受控 Harness 工具，不能据此宣布旧私有动作全量迁移或租户 ACL 全量通过。

## 来源与发布

| 项目 | 记录 |
| --- | --- |
| 基线/任务分支 | `6c9e93fc`；`codex/fix-eis014-harness-assistant-20261020` |
| 实现/尺寸修正 | `3cad4ed443fae646bf58bba0ce7fbca7249df7a2` / `851184ee03ab494d1968f061aaab3722f174d8df` |
| 主线整合 | `660cf602` / `44d52132`；`codex/systematic-refactor` |
| Web版本 | `0e08748b07293b2a`，manifest569项，完整12入口、575文件，531保护文件逐字节保持 |
| Web来源/tree | `851184ee`；`2e965e932a7f63664ef73bc4dd3f239a65ce3378a10dccd12cf215f444c7447d` |
| Web归档SHA256 | `6be51c3093eeb589a2e3b8bc9a12dcee04103fe4064fe4346c161ccfa48233ac` |
| 主包 | `/assets/index-G6eOUY8g.js` |
| Web容器 | `687187c99ab80ee14e571979c3ab9842315789a8a03a346be03c0ab1f33e69fd` |
| Harness来源/运行目录 | `3cad4ed4`；`/opt/lundu-eiscore/harness-releases/eis014-3cad4ed4`（只读） |
| Harness归档SHA256 | `bfe437ebb353c178132656e01883e879330f8bca12461d07eaef021f8aef7739` |
| Harness容器 | `b31f230d5ae0cebca115ade5d43a2bcb626d5bc8f9b2ab56b8938c002529d211` |

本地制品及证据目录：`output/lundu-worker-harness-eis014-20261020/`。`full-dist` 是发现边框2px问题的首轮候选；实际发布使用 `full-dist-final`，不得混用。Harness制品使用 `candidate-harness`。两份制品均来自干净任务提交，不从主树既有脏文件构建。

实际串行重建 `deepseek-web`、`web`。两个发布器各自持共享伦度锁，检查各自发布期间其他运行容器不变。整个任务初始到结束，另项目 `/yayulink-api` 曾变化，不能声称全服务器一直静止；伦度其余服务、惠众服务均保持。未执行数据库写入、迁移、卷替换，也未替换共享本地测试服务。主树原有未提交修改及平台包删除全部保留。

当前业务 Harness 私有有效 Compose 在 `/opt/lundu-eiscore/backups/business-harness-20261019T224436Z-f1bfb13d/candidate-compose.json`。其中包含环境秘密，权限0600，不复制到公开证据或Git。

## 验证记录

已通过：`test:eiscore-embed`（含三组新增助手回归）、`test:base-layout`、`test:ai-copilot`、业务 UI/可视化/发布器14项（Windows软链接1项跳过）、生产配置、安全会话消费者、Harness生产入口与隔离、Bridge会话、`lint:changed`。Web发布18项回归、干净源码构建、完整基线保护、本地 validate-only 及远端 check-only 均通过。

候选真实 Chrome 已验证默认flow/懒加载、认证503注入后的可见重试、工作台往返保留、380px、全屏、关闭重开、普通路由切换、草稿不覆盖、原生Lexical采用、同ID重播、390px、单iframe/浏览器页面、旧聊天请求0及pageerror0。候选使用独立禁用SW的浏览器上下文映射本地静态制品，API/Harness及四视口独立站公开配置使用真实远端，不能混报线上测试。

候选公开站1440/390/414/768四视口通过：六轮播、13个零件真实拆组、12项产品/详情/采购图、Logo/favicon、无横向溢出和页面错误。线上字节、来源、容器/卷/镜像保护检查通过；业务 Harness 资源匿名403为预期安全边界。

线上默认 Chrome 复验已通过：未拦截静态资源或 API，SW 正常启用，公开配置与认证请求实际使用 `h2`。真实登录后的19项助手检查全部通过，只有一个认证请求、一个 iframe、一个浏览器页面，旧聊天请求与页面异常均为0。工作台往返、380px侧栏、全屏/还原、关闭重开、路由切换、已有草稿保护/明确替换、重播不覆盖和390px布局均验证通过。截图已视觉复核。

线上公开站1440/390/414/768四视口全部通过，六轮播、13零件真实拆组、12产品/详情/采购图、Logo/favicon保持。真实 Provider 在原生输入框发送无工具意图后返回本轮唯一标记 `EIS014_OK_1792451265330`；发送前确认标记不存在，以排除历史回复误命中。该检查不是受控业务工具、工具事件或业务写入审计。另一个禁用HTTP2的独立Chrome也通过四视口及面板检查，作为诊断补充，正式验收采用默认Chrome证据。

最终聚合证据为 `output/lundu-worker-harness-eis014-20261020/final-verification.json`，`pass=true`；线上原始证据为 `online-site-default-final.json`、`online-panel-default-final.json`、`online-provider-default-final.json`、`online-network-default-final.json`。用户人工验收待进行。

首轮失败记录保留：候选静态映射与线上SW版本混用期间观察到自动刷新/配置超时，不能单凭此证明超时原因；首轮边框超出2px后修正并重建；并行只读诊断导航上下文被销毁；首次后续任务分支push被拒，串行重试成功；远端验证器误以为受保护Harness资源应匿名200，修正为要求401/403。初轮Provider固定标记未排除旧消息，最终已改为唯一标记并验证发送前不存在。

线上最初默认Chrome配置请求出现15秒取消，另一次200耗时24秒；服务端直连GET正常。没有修改服务器网络、产品缓存或浏览器策略，没有清用户缓存。后续HTTP1诊断及默认Chrome正式复验均通过，默认Chrome公开配置约143–167ms、认证约112ms，实际协议为h2。早期超时根因未证实；后续通过不表示永久解决了网络波动。保留 `online-site*.log`、`profile-debug-online.json`、`network-probe.json`，不将其改写成成功记录。

普通用户原路径/角色边界由纯策略与VM回归覆盖，未创建新的普通用户账号；未执行全业务链或工作区租户/会话ACL审计。用户人工验收待进行。

## 回退

Web完整备份：`/opt/lundu-eiscore/backups/web-before-2c5954211072811e-20261019T224952Z-1a1a6f06`。按完整Web发布工具回退，不手工覆盖assets。

Harness前一版私有 Compose：`/opt/lundu-eiscore/backups/business-harness-20261019T224436Z-f1bfb13d/before-compose.json`。只用原项目 `--no-deps` 重建 `deepseek-web`，不执行整个旧Compose启动。回退不恢复或删除数据库数据。
