# EIS-012：伦度业务 Harness 界面与可视化

用户确认以惠众当前效果为参考：自动选用业务助手工作区，隐藏工作区、Agent 预设和访问模式选择器，固定标准模式，支持 DOT/DTO、ECharts、Mind 与隔离 HTML 回复。顶部继续使用 DeepSeek Harness / 业务流程。

任务基线为 `d68d0372`，在独立工作树和 `codex/fix-eis012-business-harness-20261020` 分支实现。主树既有改动及平台包删除保留。

## 范围与退出

使用通用 Harness 静态 UI 扩展和输出策略插件，不复制惠众品牌、业务字段或模块限制。工作区目录及隐藏控件不代替 EISCore 身份、租户与权限检查。HTML 在无同源权限的 sandbox iframe 内执行，不能获取父页面凭据；图表资源自托管。

扩展由伦度业务 Harness runner 提供并注入，只计划更新伦度 `deepseek-web`。不改外层 Web/Nginx、完整12入口 release、独立站艺术资源、闪念服务、惠众服务或业务数据库。发布使用共享伦度锁，预先备份 Harness 配置及运行参数；失败回退本任务服务配置，不回退业务数据。

## 当前状态

已实现 runner 静态资源注入、自动业务工作区、固定标准模式、七种语言标记的四类隔离可视化；移除本次业务 profile 的预设选择器，并仅适配同源 `/plugins/events` 到现有 SSE 代理路径。Flash profile 不加载该扩展。

本地真实 Chrome 已通过 ECharts、Mind、DOT/DTO、HTML 按钮交互、下载、流式替换、390px 布局和 sandbox/消息来源负例。生产配置、runner、前后端隔离、工作台模式、制品、Web smoke 与静态 UI 回归通过；发布器 Windows 测试含软链接跳过，Linux 测试实际执行软链接负例。图表库固定 ECharts 6.1.0 与 Viz 3.31.0，核对库、许可证和包完整性；全新 npm 下载首轮超时，实际制品使用经校验的既有缓存，不冒称下载通过。

线上现有 twin/BI API 插件继承并核对捕获字节，本轮不插入缺失的 `eiscore-tools`，也不代表全业务工具链、用户/租户工作区 ACL 已闭合。部署前已捕获原 Harness 文件、容器参数、完整独立站文件清单；候选须来自提交后的干净任务树。

首轮提交 `4c8bfbe8` 已整合为 `d87f5b12` 并推送、受锁发布。真实 Provider 已返回 `EIS012_OK`，四类示例回复均实际完成渲染，HTML 点击计数及父页访问拒绝、工作台切换保留和下一轮普通回复通过。原运行环境没有 Provider 配置，使用用户此前明确授权的测试 Key 经官方 completion 200 验证后私有配置，备份在 `/opt/lundu-eiscore/backups/provider-eis012-20261019T204711Z`，未写入源码。

线上复验发现继承的数字分身客户端复用 session store 注册 root hero，触发 `one handle, one scope`，全新浏览器同样复现，不能归咎缓存。原生 preset 停用项已生效，实际错误来自旧双面业务插件。最终打包仅删除两个捕获 package manifest 的 `dsh.client` 声明，保留后端入口、导出和 API 字节；原生解析器在声明缺失时不会发现客户端。该确定性变换记录输入/输出 checksum，不修改原捕获文件，也不重编译或手改镜像。最终复发验证与发布结果待下段补齐。
