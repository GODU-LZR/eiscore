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

第十个切片把 PostgreSQL LISTEN、通知过滤/广播、可选 Workflow Engine、重连和资源回收迁入 `database-notifier.js`。模块拥有数据库连接生命周期，并向组合根只暴露 `start`、`query` 和 `shutdown`；AI 配置读取通过同一适配器查询。专项契约以模拟客户端锁定频道、目标用户、角色过滤、Workflow 专用分发、单一重连计时器和关闭清理，不连接数据库。

第十一个切片把 AI 主/视觉配置 TTL 缓存、上游 payload、代理/超时、JSON/流传输与两套重试策略迁入 `ai-runtime-service.js`。服务只依赖数据库 query 端口和 Axios 适配器；组合根继续拥有 Agent 路由、OCR 编排和输出守卫，但不再直接导入 Axios 或管理 API Key。专项契约验证敏感字段不会透传、主/视觉默认值和重试差异保持，并覆盖 Node Stream 与 Web Reader。

第十二个切片把图片提取、视觉 OCR 调用、逐图降级和消息替换迁入 `ai-ocr-service.js`。服务注入视觉运行时和文本解析器，继续顺序处理最多 6 张图片；任一图片失败只生成对应失败标记，不阻断其余图片或原文本。HTTP 媒体 OCR 与聊天内嵌 OCR 仍复用同一 `runImageOcr`。

第十三个切片把企业分析输出守卫迁入 `ai-output-guard.js`。服务只暴露路由判定和守卫执行，注入 AI 上游与文本解析能力；非企业及 Workflow 路由继续原样放行，企业回答继续执行流程泄漏改写、客套语清理、ECharts 本地规范化、AI 修复与最终静态兜底。专项契约锁定 completion 结构、重试参数和六轮修复上限，不发起真实 AI 请求。

第十四个切片把用户态 PostgREST 调用与 Flash 动态表恢复迁入 `flash-postgrest-adapter.js`。适配器注入 JWT、HTTP、Query 清洗、JSON 解析与计时能力，向 Flash、语义上下文、业务快照和 Twin 提供绑定查询；用户 Claims、Profile、错误映射、超时、`app_data` 补表及 Schema Cache 重试保持。专项契约只使用模拟响应，明确禁止真实数据库连接。

第十五个切片把 Flash 工具注册表迁入 `flash-tool-registry.js`。迁移前后逐字段审计纠正库存为 43 项与 39 个别名，19 项低风险无需确认、24 项需要确认；服务统一提供定义查询、别名解析、版本/数量和公开 Manifest。HTTP、执行器与 Cline 不再各自接触可变注册表，专项契约锁定全部元数据和顺序。

第十六个切片把 Flash 调用策略迁入 `flash-tool-service.js`。服务注入注册表和具体工具执行器，拥有 Envelope 兼容、Trace/幂等键清洗、确认门槛、按用户隔离的 TTL 缓存、统一响应与审计；HTTP/WebSocket 继续共享同一能力。专项契约锁定读写权限、回放/过期、跨用户隔离及错误结构，具体业务工具矩阵仍待后续整体抽离。

第十七个切片把 43 项 Flash 业务工具矩阵迁入 `flash-semantic-executor.js`。工厂注入 PostgREST、动态表、草稿与附件端口，注册表和执行器集合由契约强制相等；分页、Query/Body/Profile、字段兼容、校验、RPC、Upsert 和执行审计规范化保持。至此 Flash 工具的传输、注册、策略、持久化与业务执行均可分层测试，Cline 生命周期仍待治理。

第十八个切片把 Flash Cline 运行时原语迁入 `flash-cline-runtime.js`。Bash 兼容、工作目录、命令与代理环境、受限输出捕获、包管理器、构建/安装、自愈、历史和附件 Prompt、输出筛选、重试、参数、会话与取消均由注入式工厂提供；组合根只消费端口并暂时保留顶层任务编排。离线契约以假文件系统和假子进程覆盖安全路径、参数、截断、依赖安装重建及状态事件，禁止测试触发真实 Cline、外部 AI 或依赖安装。

第十九个切片把 Flash Cline 顶层任务生命周期迁入 `flash-cline-service.js`。服务只依赖运行时、权限、AI 配置、草稿文件和审计端口，组合根不再解析 Cline 输出或管理进程；离线契约锁定守卫、并发、鉴权参数、双流分帧、状态协议、超时、双向草稿同步、自愈结果、退出码和异常清理。WebSocket 装配继续只消费 `run/create/kill` 三个能力，协议和客户端无需改变。

第二十个切片把 Flash Cline 与草稿的 20 项环境变量集中到冻结的 `flash-cline-config.js`。配置加载器保持原有默认值、裁剪、关闭语义、数值换算、目录派生、附件下限和 URL 清理；组合根只解构一次并分别注入草稿文件端口、运行时与任务服务，禁止业务函数继续读取 Cline 环境。

第二十一个切片把 AI Agent 的消息清洗、意图与模式路由、三类 Runtime 配置、Smart BI/Grid Prompt、上下文压缩、系统 Prompt 和输出提取迁入纯 `ai-agent-policy.js`。该模块不访问网络、数据库或环境；HTTP Chat 和 Agent 任务调用只消费策略端口。契约锁定不信任消息过滤、权限降级、配置别名/范围、数据长度上限、六域指标与三类 Agent 的硬性输出规则。

这些切片不改变端口、路径、HTTP 方法、鉴权规则、响应格式、数据库或部署拓扑；可通过回退各自单提交恢复旧装配。Notifier 抽离保留默认连接参数、LISTEN 频道和通知 payload，同时在重连时显式回收旧 Workflow Engine。组合根仍包含大量 Flash/Agent 及 AI Agent 路由/Prompt 领域实现，这是 G3 后续切片要解决的受控技术债，而不是本 ADR 宣称已经完成的模块化。
