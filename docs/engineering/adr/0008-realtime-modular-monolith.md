# ADR-0008：Realtime 采用可渐进验证的模块化单体边界

- 状态：接受
- 日期：2026-08-31

## 背景

`realtime/index.js` 同时承担进程配置、HTTP 路由、WebSocket 装配、应用处理器、领域流程和持久化调用，当前约 7,386 行。直接改写框架或一次性搬迁全部处理器会同时改变路由顺序、鉴权位置、响应行为和启动时序，难以证明与现网兼容。

首轮盘点确认 HTTP 层共有 41 条公开路由：33 条精确路径、7 条正则路径和 1 条前缀路径，覆盖 health、document-intake、AI、Flash 与 Twin 五个域；服务器仍使用 Node 原生 `http.createServer`，WebSocket Server 依赖同一个 HTTP Server。

## 决策

- `realtime/index.js` 作为过渡期组合根，负责读取配置、构造业务处理器、注入依赖并按原顺序启动 HTTP 与 WebSocket；它不再直接声明 HTTP 路由条件。
- `realtime/http-router.js` 是 HTTP 传输边界，以只读 Manifest 声明方法、匹配类型、路径或正则、处理器引用和可选鉴权器；路由顺序属于兼容契约。
- 业务处理器继续拥有请求解析、响应 payload、状态码和数据库调用。传输层只负责 OPTIONS/CORS、路由匹配、鉴权调用、处理器分发和未命中 404。
- 处理器与鉴权器通过命名注册表注入，路由模块不得反向导入数据库客户端、领域服务或进程配置。调用时保留注册对象上下文。
- 暂不引入 Express 等新框架或依赖；后续按业务域把应用处理器、领域服务和持久化适配器逐层移出组合根，每个切片先建立可脱离完整进程运行的契约测试。
- 管理员鉴权必须保持在 document-intake 处理器执行之前；OPTIONS 必须先于路径解析处理；未命中请求继续返回空 404；WebSocket 创建仍紧随 HTTP Server 创建。

## 验证与后果

专项契约逐项锁定全部 41 条 Manifest，模拟验证任意方法 health、精确路由、正则路由、前缀路由、管理员允许/拒绝、方法不匹配、OPTIONS/CORS 和 404，并禁止五个路由域重新内联到 `realtime/index.js`。

第二个切片把 Twin 的会话列表/删除、消息读取、知识上传/列表/删除 6 个持久化型 HTTP 处理器迁入 `twin-resource-http.js`。该工厂显式接收鉴权、用户查询绑定、JSON 读取、JSON 响应和端口，并允许测试替换持久化工厂；Twin Chat 因包含 SSE、上游重试、中断和 ReAct 循环，继续留在组合根直至建立更完整的流特征测试。

第三个切片把 `/ai/config` 与 `/ai/agents` 迁入 `ai-config-http.js`，显式注入 AI 授权、主/视觉配置加载、Agent 目录与响应能力。视觉配置失败继续独立降级，主配置失败继续返回原错误契约，公开响应只暴露启用状态与模型元数据，不包含 API Key。

第四个切片把同属只读面的 `/ai/business-snapshot` 纳入 AI 工厂，并将模块更名为 `ai-http.js`。工厂只消费已经具备部分失败降级的快照加载器；完整快照与降级快照继续使用同一 200 响应，通过 `ok` 和可选 warning 表达状态，不在 HTTP 层重复采集逻辑。

第五个切片把 Flash 工具注册表/HTTP 调用、草稿读写和附件上传迁入 `flash-http.js`。HTTP 工厂注入领域函数与 FlashToolError 状态解析器，保留各自 body 上限和兼容参数；WebSocket 工具调用继续在组合根复用同一 `executeFlashToolCall`，避免单个切片同时改变两种传输协议。

第六个切片在流式特征测试建立后把 Twin Chat 迁入 `twin-chat-http.js`。工厂显式注入会话、语义、上游、SSE 与引擎能力；测试覆盖上游非流回退和真实 SSE chunk 解析、持久化/语义降级、close 中断及发送响应头前后的两类错误，组合根不再持有 Twin HTTP 业务流程。

第七个切片把 Translate、OCR 与 Map Locate 纳入 `ai-http.js`。三者共享授权/JSON 边界但继续注入各自文本上游、OCR 与视觉上游；字段别名、默认 Prompt、模型参数、重试策略及状态透传由专项契约分别保护，避免用一个通用客户端抹平真实语义差异。

第八个切片把最后一条内联业务处理器 AI Chat 迁入 `ai-chat-http.js`。Agent 路由、OCR、企业语义/快照、输出守卫与上游作为应用依赖注入；Node Stream 与 Web Reader 两类传输继续保持原 close/cancel/release 行为。至此 41 条 HTTP 路由和全部业务处理器都已离开组合根，HTTP 子阶段完成；WebSocket、领域服务及持久化拆分仍是 G3 后续工作。

第九个切片把 WebSocket 连接与 9 类输入分发迁入 `websocket-server.js`。只读 Manifest 锁定订阅 2 类、Flash 4 类和 Agent 3 类协议；连接层继续执行 JWT 1008、默认频道、状态初始化和关闭清理，业务能力全部注入。未知类型仍静默忽略，坏 JSON/处理异常仍发送通用 error。至此 HTTP 与 WebSocket 传输装配均退出组合根。

该切片不改变端口、路径、HTTP 方法、鉴权规则、响应格式、数据库、部署拓扑或 WebSocket 时序；可通过回退单提交恢复旧装配。组合根仍包含大量业务处理器，这是 G3 后续切片要解决的受控技术债，而不是本 ADR 宣称已经完成的模块化。
