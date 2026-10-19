# EIS-012：伦度业务 Harness 界面与可视化

用户确认以惠众当前效果为参考：自动选用业务助手工作区，隐藏工作区、Agent 预设和访问模式选择器，固定标准模式，支持 DOT/DTO、ECharts、Mind 与隔离 HTML 回复。顶部继续使用 DeepSeek Harness / 业务流程。

任务基线为 `d68d0372`，在独立工作树和 `codex/fix-eis012-business-harness-20261020` 分支实现。主树既有改动及平台包删除保留。

## 范围与退出

使用通用 Harness 静态 UI 扩展和输出策略插件，不复制惠众品牌、业务字段或模块限制。工作区目录及隐藏控件不代替 EISCore 身份、租户与权限检查。HTML 在无同源权限的 sandbox iframe 内执行，不能获取父页面凭据；图表资源自托管。

扩展由伦度业务 Harness runner 提供并注入，只计划更新伦度 `deepseek-web`。不改外层 Web/Nginx、完整12入口 release、独立站艺术资源、闪念服务、惠众服务或业务数据库。发布使用共享伦度锁，预先备份 Harness 配置及运行参数；失败回退本任务服务配置，不回退业务数据。

## 当前状态

已实现 runner 静态资源注入、自动业务工作区、固定标准模式、七种语言标记的四类隔离可视化；移除本次业务 profile 的预设选择器及重复挂载，并仅适配同源 `/plugins/events` 到现有 SSE 代理路径。Flash profile 不加载该扩展。

本地真实 Chrome 已通过 ECharts、Mind、DOT/DTO、HTML 按钮交互、下载、流式替换、390px 布局和 sandbox/消息来源负例。生产配置、runner、前后端隔离、工作台模式、制品、Web smoke 与静态 UI 回归通过；发布器 Windows 测试含软链接跳过，Linux 测试实际执行软链接负例。图表库固定 ECharts 6.1.0 与 Viz 3.31.0，核对库、许可证和包完整性；全新 npm 下载首轮超时，实际制品使用经校验的既有缓存，不冒称下载通过。

线上现有 twin/BI 插件继承并核对捕获字节，本轮不插入缺失的 `eiscore-tools`，也不代表全业务工具链、用户/租户工作区 ACL 已闭合。部署前已捕获原 Harness 文件、容器参数、完整独立站文件清单；候选须来自提交后的干净任务树。当前尚未部署，真实 Provider 完成与线上验收仍待完成。
