# EIS-014：工作台与工作助手共用业务 Harness

日期：2026-10-20。范围为业务宿主和业务 Harness UI，不包含惠众、数据库或闪念。

原右侧 AiCopilot 使用旧聊天编排；工作台独立持有 Harness iframe。仅替换右侧内容会保留隐形旧请求，并因 keep-alive 产生两份对话运行时。

采用 Layout 固定持有一个 BusinessHarnessHost/Frame。Home 的 HarnessWorkspaceSlot 仅登记可见区域，Host 根据区域调整固定定位；不移动或重建 iframe。侧栏、全屏和隐藏采用同一节点，关闭不销毁。离开普通业务页仍保留草稿；进入 Flash 或独立 Harness 路由卸载业务 Host 的 frame，避免双身份/运行时。退出宿主或换登录身份清理交接草稿，重新认证。默认仍是业务流程，原可见路径不扩大权限，Flash 新增隐藏业务助手。

全屏按钮抽为 HarnessFullscreenButton，新旧壳复用；偏好仍用既有安全存储。原生 Harness 管理历史、新对话、附件、对话和可视化，宿主不复制这些功能。

旧 open-worker 的 DOM/qiankun 两入口仍由同一个 bridge 去重，改为受控 controller 打开面板和交接指令草稿；不再 sendMessage，也不传 currentContext、样本、凭据或前端权限。协议只允许同源直接 parent 发送 version=1 的 eiscore:harness-draft，带有界 id/prompt；iframe 使用原生 composer 的粘贴路径，不自动提交，已有草稿需用户明确替换。返回 applied/queued 仅表示草稿交接，不代表业务执行成功。

旧 AiCopilot 的公式回填、导入映射和工作流应用等私有结果处理不注入 iframe，不宣称随壳迁移而已接入。真实业务操作必须继续走 Harness 现有受控工具和后端授权；本次不新增写操作或绕过权限。公开客服与闪念服务、资源和认证路径保持隔离。

部署包含完整12入口 web 与业务 deepseek-web 扩展，均由干净任务提交构建、备份后串行发布；不替换数据库或其他服务。web 仍执行伦度独立站机器门禁及四视口验收。退出方式是完整回退已验 web 和业务 Harness 静态release，不回退业务数据。
