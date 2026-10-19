# EIS-012：伦度业务 Harness 界面与可视化

用户确认以惠众当前效果为参考：自动选用业务助手工作区，隐藏工作区、Agent 预设和访问模式选择器，固定标准模式，支持 DOT/DTO、ECharts、Mind 与隔离 HTML 回复。顶部继续使用 DeepSeek Harness / 业务流程。

任务基线为 `d68d0372`，在独立工作树和 `codex/fix-eis012-business-harness-20261020` 分支实现。主树既有改动及平台包删除保留。

## 范围与退出

使用通用 Harness 静态 UI 扩展和输出策略插件，不复制惠众品牌、业务字段或模块限制。工作区目录及隐藏控件不代替 EISCore 身份、租户与权限检查。HTML 在无同源权限的 sandbox iframe 内执行，不能获取父页面凭据；图表资源自托管。

扩展由伦度业务 Harness runner 提供并注入，实际仅更新伦度 `deepseek-web`。未修改外层 Web/Nginx、完整12入口 release、独立站艺术资源、闪念服务、惠众服务或业务数据库。发布使用共享伦度锁，预先备份 Harness 配置及运行参数；失败回退本任务服务配置，不回退业务数据。

## 当前状态

已实现 runner 静态资源注入、自动业务工作区、固定标准模式、七种语言标记的四类隔离可视化；移除本次业务 profile 的预设选择器，并仅适配同源 `/plugins/events` 到现有 SSE 代理路径。Flash profile 不加载该扩展。

本地真实 Chrome 已通过 ECharts、Mind、DOT/DTO、HTML 按钮交互、下载、流式替换、390px 布局和 sandbox/消息来源负例。生产配置、runner、前后端隔离、工作台模式、制品、Web smoke 与静态 UI 回归通过；发布器 Windows 测试含软链接跳过，Linux 测试实际执行软链接负例。图表库固定 ECharts 6.1.0 与 Viz 3.31.0，核对库、许可证和包完整性；全新 npm 下载首轮超时，实际制品使用经校验的既有缓存，不冒称下载通过。

线上现有 twin/BI API 插件继承并核对捕获字节，本轮不插入缺失的 `eiscore-tools`，也不代表全业务工具链、用户/租户工作区 ACL 已闭合。部署前已捕获原 Harness 文件、容器参数、完整独立站文件清单；候选须来自提交后的干净任务树。

首轮提交 `4c8bfbe8` 已整合为 `d87f5b12` 并推送、受锁发布。真实 Provider 已返回 `EIS012_OK`，四类示例回复均实际完成渲染，HTML 点击计数及父页访问拒绝、工作台切换保留和下一轮普通回复通过。原运行环境没有 Provider 配置，使用用户此前明确授权的测试 Key 经官方 completion 200 验证后私有配置，备份在 `/opt/lundu-eiscore/backups/provider-eis012-20261019T204711Z`，未写入源码。

线上复验发现继承的数字分身客户端复用 session store 注册 root hero，触发 `one handle, one scope`，全新浏览器同样复现，不能归咎缓存。原生 preset 停用项已生效，实际错误来自旧双面业务插件。最终打包仅删除两个捕获 package manifest 的 `dsh.client` 声明，保留后端入口、导出和 API 字节；原生解析器在声明缺失时不会发现客户端。该确定性变换记录输入/输出 checksum，不修改原捕获文件，也不重编译或手改镜像。最终提交 `22323470` 已整合为 `d40d3af9`，两个分支均已推送。

## 最终部署与来源

| 项目 | 实际结果 |
| --- | --- |
| 目标 | `https://lundu.eiscore.top/`，工作台 DeepSeek Harness |
| 源码提交 | `2232347018cc553f796f0afb304ce4e596369d96`，干净独立任务树 |
| 运行制品 | `/opt/lundu-eiscore/harness-releases/eis012-22323470`，只读挂载 |
| 包清单 | 67 个文件及清单本身，共68；manifest SHA256 `d72cf2bee324b79b59756833f04a7a9b0ed3511f976199c6b1f22dafe65255cf` |
| 上传归档 SHA256 | `b06964107c1920699fe142fa3de118644f94d1b8249eb51e2c3e66af43c4fb5b` |
| 实际重建 | 仅 `lundu-eiscore-deepseek-web-1`；使用原镜像，未新建镜像 |
| 最终容器 | `23de89cab1a7c60a3fccc10489ad54c9596c008ee00bcec7ecf9851bf326a7aa` |
| 独立站清单 | `bffb63a78c4e3e81 / 609`，完整615文件逐字节不变 |
| 卷及网络 | 原 DSH_HOME 命名卷、两个网络的IP/别名保持；业务数据库及卷不操作 |

当前有效 Compose 为 `/opt/lundu-eiscore/backups/business-harness-20261019T210813Z-436450bd/candidate-compose.json`，包含私有环境，权限0600，不进入Git或公开证据。后续只重建本服务须沿用该配置或从运行 inspect 重新生成，不用旧源目录覆盖当前制品。

整项回退配置为 `/opt/lundu-eiscore/backups/business-harness-20261019T204756Z-3c9e2b21/before-compose.json`；最终步骤的前一版配置则在 `business-harness-20261019T210813Z-436450bd/before-compose.json`。回退只运行对应 Compose 的 `deepseek-web`，使用 `--no-deps`，不操作其他服务或数据库。Provider单项回退需对照私有备份移除本轮新增变量，不能整份覆盖后续环境配置。

## 实际验收与限制

- 本地 `test:harness-business-ui`、runner、production-config、前后端隔离、workbench模式、制品回归及 Web smoke good/bad-status/bad-marker通过；真实Chrome可视化回归通过；`lint:changed`及diff检查通过。发布器最终Linux 14/14通过，Windows 13通过、1软链接跳过。
- 两次真实受锁发布均通过包、基线、原镜像/卷/IP和独立站保护门禁。最终包另核验仅删除两个客户端声明，API文件字节不变。
- 最终原生面板默认业务工作区、隐藏入口、历史侧栏、6资源 MIME、发送按钮及真实SSE `200 text/event-stream` 通过；页面错误0。原始记录保留主动关闭SSE及导航取消的 `ERR_ABORTED`，不混报网络故障。
- 真实模型依次完成 `EIS012_OK`、四类示例、`EIS012_PLAIN`、最终部署后的 `EIS012_FINAL`。四图实际存在Canvas/SVG；HTML计数按钮可交互、父页访问被拒绝；工作台来回切换保留iframe和草稿；刷新后四图历史重新渲染，普通后续轮次没有多生图表。没有使用mock completion或写业务数据。
- 1440px桌面及390px宿主折叠现有侧栏后通过，截图已视觉核对；200px宿主侧栏展开会把预览压至约100px，最初严格内部无溢出检查失败，原记录保留。本轮没有重做宿主移动布局。
- 独立站真实公开配置四视口1440/390/414/768通过：6轮播图、13部件水泵真实拆解组装、12产品/详情/采购图片、Logo/favicon、无横向溢出和控制台错误0。站点前端制品未替换。
- 最终发布锁基线中的39个其他容器身份全部保持。相对任务最早快照，另有3个惠众Flash容器及1个其他项目API在本次最终发布之前独立变化；原保护报告的早期 `pass:false` 予以保留，实际本轮保护结论使用 `deploymentProtectionPass:true`，不宣称全服务器从任务开始一直静止。

聚合证据：`output/lundu-business-harness-eis012-20261020/final-verification.json`，`pass:true`；同目录保留 `online-phase1-final.json`、`online-history-final.json`、`site-browser-final.json`、`protection-post-final.json`、`package-final-check.json` 和 `deployment-final.log`。截图在 `output/playwright/lundu-eis012-final-*.png`。

本轮交付界面、渲染和真实模型回复；业务工具链完整权限验收、用户/租户/session工作区ACL仍不能由这些测试推出。用户人工验收待进行。
