# EISCore Windows 采集端

这是“智能收单与自动入库 Agent”的 Windows 桌面采集端 MVP。

当前实现目标：

1. WebView2 打开已配置的 EISCore 站点。
2. 本地保存服务器、设备、默认上传用户和多监听目录配置。
3. 设备绑定后使用 Windows DPAPI 加密保存 `device_token`；后台重置绑定码或 token 失效后会清空本地 token 并回到待绑定状态。
4. 支持手动选择文件、窗口拖拽文件、本地目录监听入队。
5. 文件入队前等待写入稳定，计算 SHA256 hash，并写入 SQLite 队列。
6. 上传队列支持断网失败后保留、后台重试和重复 hash 跳过。
7. 采集 WebView2 导航失败、进程异常、前端 JS 错误、Promise 异常、console 错误、资源加载失败和 HTTP 错误。
8. 客户端日志先落 SQLite，本地脱敏后批量上报。
9. 支持托盘常驻、开机自启和设备心跳。
10. 支持桌面端未处理异常 dump 和下次启动后崩溃摘要上报。
11. 支持远程下发自动更新策略，下载更新包、校验 SHA256，并按策略启动安装器。
12. 支持单实例运行，重复启动会唤起已有窗口，安装器通过 `AppMutex` 识别运行中的采集端。
13. 区分普通窗口关闭、托盘退出和 Windows 注销/关机；普通关闭隐藏到托盘，明确退出或系统会话结束会放行关闭并执行最终日志 flush。
14. 设备绑定和心跳会上报采集端版本与 WebView2 runtime 版本，便于后台按版本排查客户端环境问题。
15. 设备心跳会上报本地健康快照，包括上传队列各状态数量、最近入队/上传时间、待上传日志数量与时间水位、最近临时文件忽略数量、本地数据库大小、磁盘剩余空间和监听目录缺失情况。
16. 上传队列会保存文件触发时的 Windows 用户快照，断网补传或换用户后仍能追溯原始本机操作环境。
17. 左侧上传队列会显示中文状态、来源、重试次数、下次重试时间、本地文件缺失、最近错误和服务端 asset id，便于现场人员判断文件是否等待退避、上传中或已完成。
18. 左侧监听目录列表会显示启用、停用、缺失和不可访问状态，方便发现目录被删除、移动盘未挂载、权限不足或远程配置下发了不可访问路径。
19. 采集端会在等待文件稳定前跳过 Office 锁文件和浏览器/下载中的临时扩展名，避免半成品文件进入上传队列。
20. WebView 登录 EISCore 后会通过同源当前用户接口和前端桥接上下文同步用户、租户、部门和岗位；拖拽上传优先使用当前网页登录用户，设置弹窗可将其写入默认上传人和企业编号。

## 工程位置

```text
collector-desktop/
  EISCore.Collector/
    EISCore.Collector.csproj
```

## 技术栈

```text
.NET 7
WPF
WebView2
Microsoft.Data.Sqlite
Windows Forms NotifyIcon
Windows DPAPI
Named Mutex / EventWaitHandle
Inno Setup 6（发布安装器时需要）
```

## 构建运行

需要在 Windows 上安装 .NET SDK 7.x 或更高版本。

```powershell
dotnet restore .\collector-desktop\EISCore.Collector\EISCore.Collector.csproj
dotnet build .\collector-desktop\EISCore.Collector\EISCore.Collector.csproj
dotnet run --project .\collector-desktop\EISCore.Collector\EISCore.Collector.csproj
```

桌面端版本号定义在 `EISCore.Collector.csproj` 的 `Version` 字段。客户端启动时会把当前程序集版本同步到本地 `collector-config.json` 的 `clientVersion`，避免旧配置文件中的版本号导致自动更新反复下载同一版本。

## 本地数据

配置、队列和日志默认写入：

```text
%AppData%\EISCore\Collector\
  collector-config.json
  collector-config.json.bak
  collector.db
  crash-dumps\
  updates\
```

`collector-config.json` 中的 `encryptedDeviceToken` 使用当前 Windows 用户的 DPAPI 加密，换用户或换机器后不能直接复用。旧版配置如果存在明文 `deviceToken`，启动加载时会迁移到 `encryptedDeviceToken` 并重写主配置；历史 `.bak` 中的明文 token 也会被净化，避免备份文件继续保存设备凭据。

配置加载、保存、启动监听/立即上传前的运行时动作和远程同步比较，都会对设备编号、设备名称、默认上传人、岗位、客户端/WebView 版本、远程配置版本、待安装更新路径，以及监听目录路径、显示名和目录默认责任人等本地文本字段执行 trim、控制字符清理和长度限制，避免后台坏配置、旧 JSON 或手工编辑把超长/换行文本带入本地配置、日志上下文、心跳和上传 metadata，也避免远程持续返回带换行文本时重复记录配置同步。

监听目录会按净化后的路径去空并大小写无关去重，尾部斜杠差异不会产生第二个 watcher；本地旧配置、远程 `watchFolders` 和启动 watcher 前的运行态配置都会保留第一条有效目录配置。

文件扩展名白名单会在配置加载和保存时统一归一化：自动补 `.`、转小写、去重排序、丢弃通配符/路径分隔符/多段扩展名/超长项，并最多保留 128 项，避免坏白名单扩大采集范围或拖慢文件入队过滤。

上传大小策略会在配置加载和保存时限幅：单文件上限默认为 256MB，允许 1MB 到 1GB；分片大小默认为 8MB，允许 256KB 到 64MB。旧配置或手工 JSON 写入 0、负数或超大值时，会恢复到安全范围，避免大文件上传分片异常或内存占用失控。

开机自启会写入当前 Windows 用户的 `Run` 启动项，启动命令默认携带 `--minimized --from-startup`。因此采集端随 Windows 登录启动时会直接常驻托盘，不主动弹出主窗口；用户双击托盘图标或选择“显示”后再回到主界面。如果注册表写入被权限或安全软件拦截，客户端不会把失败的自启状态保存到本地配置，会记录 `collector_autostart_apply_failed` 并继续应用其他远程配置。启动加载 UI 时如果读取 Run 项失败，会记录 `collector_autostart_read_failed` 并按本地配置显示，不会中断本地采集启动。

心跳、远程配置同步、日志上传或文件上传收到设备认证 401/403 时，客户端会记录 `collector_device_auth_failed`，清空内存和配置中的 `encryptedDeviceToken`，将本地 `DeviceStatus` 标记为 `pending`，停止目录监听，并阻止手动选择/拖拽文件继续写入上传队列。若本地 pending 状态保存失败，当前进程仍会清空内存 token、刷新界面和停止采集，并 best-effort 记录 `collector_device_auth_state_save_failed`，避免配置文件短暂不可写时继续用失效 token 采集。现场使用后台新授权码重新绑定成功后，本地 `DeviceStatus` 会恢复为 `active`，监听、日志上传和上传队列随运行态刷新继续工作。若认证失败发生在文件上传中，当前队列行会从 `uploading` 退回 `queued`，不会增加 `retry_count`，同时记录 `file_upload_auth_failed` 并携带 queue id、文件名、hash 和当前重试次数，避免后台重置绑定码后把正常文件误判为重试耗尽，也方便日志中心定位是哪条上传触发了认证失败。

设备绑定接口返回 2xx 时必须同时包含非空 `deviceId` 和 `deviceToken`。如果后台返回缺字段或空 token，客户端会拒绝保存配置，不会把本地设备状态置为 `active`，避免出现界面显示已绑定但心跳、日志和文件上传都没有有效设备凭据的半绑定状态。

设备绑定失败时，客户端会把底层异常归一成现场可读提示：授权码无效提示后台重置绑定码，超时提示检查网络，无法连接提示检查服务器地址，后台响应不完整提示管理员检查绑定接口；日志 `collector_bind_failed` 会记录 `failure_kind`、HTTP 状态码和当前设备/服务器上下文，便于日志中心按失败类型筛选。如果绑定前修改了服务器、企业编号或设备编号，客户端会立即清空当前内存 token 并切到待绑定运行态；该待绑定状态保存失败时会 best-effort 记录 `collector_bind_invalidated_state_save_failed`，但不会盖掉原始绑定失败提示。

设备授权码输入框会在非空绑定尝试结束后自动清空；无论绑定成功、授权码无效还是网络失败，客户端都不会把一次性授权码继续留在界面中。

服务器地址在配置加载、保存、绑定和接口调用前都会统一归一化与校验：生产域名漏写协议时默认补为 `https://`，`localhost` / `127.*` / `::1` 漏写协议时默认补为 `http://`，未加方括号的 IPv6 本机地址会归一化为 `[::1]`，并去掉末尾 `/`；如果现场复制了 `/agent`、`/agent/document-intake/...` 或 release 下载链接，客户端会剥掉 API 前缀并保留其前面的站点子路径，避免生成 `/agent/agent/...`；非 `http/https` 地址会被拒绝并在状态栏提示，点击“仅保存配置”“保存并绑定”“启动监听”“立即上传”或手动投递文件都不会把这类地址写入运行配置。空服务器地址仍可作为草稿保存，但绑定和上传前必须配置有效地址。已绑定设备如果修改服务器地址、企业编号或设备编号，客户端会清空本地 `encryptedDeviceToken`、清除服务端设备 id 和远程配置版本，并把 `DeviceStatus` 标记为 `pending`，要求重新绑定后再恢复监听和上传；仅修改设备名称、默认上传人或监听目录不会触发 token 失效。

内嵌 WebView 不读取登录密码。页面登录后，采集端只在同源上下文中使用当前浏览器登录态探测 `/agent/api/auth/me`、`/api/auth/me`、`/api/current-user` 等当前用户接口，或接收前端通过 `eiscoreCollectorLog.setContext` 主动同步的上下文；可识别 `userId`、`username`、`role`、`tenantId`/`enterpriseCode`、`tenantName`、`departmentId`、`departmentName` 等常见字段，也兼容 `employeeNo`、`employeeName`、`staffNo`、`staffName`、`orgCode`、`deptCode`、`appRole`、`roleName` 等企业登录接口别名。设置弹窗的“当前网页登录用户”会显示检测结果、识别来源和同步时间；点击“同步为默认上传人”会把用户写入默认上传人字段，并把租户标识写入“企业编号 / 租户标识”。上传 metadata 会同时包含 `enterprise_code` 和 `tenant_id`，便于服务端按租户追溯文件来源。

手动选择文件或拖拽文件时，左侧状态栏会按实际结果显示“已入队或已存在队列”和“未入队”的数量；设备待绑定、后台禁用、空文件、临时文件、文件类型不允许或超过大小限制时，不会再误提示全部文件已入队。

手动选择文件、窗口拖拽文件和上传队列刷新属于 UI 事件入口；如果本地文件系统、SQLite 或队列格式化在这些入口中短暂异常，客户端会在状态栏提示并 best-effort 记录日志，不会让异常从 WPF `async void` 事件处理器冒出导致主窗口崩溃。

点击“立即上传”前，客户端会先检查设备状态、服务器地址和本地设备 token；设备待绑定、后台禁用、服务器地址为空或 token 缺失时会直接在状态栏说明原因，不会显示“上传队列处理完成”来掩盖实际未上传。手动处理完成后，状态栏会按真实结果区分上传数量、重复文件、本地文件缺失、队列正在处理、暂无待上传、失败项等待退避、失败项已达到最大重试次数和设备认证失效等情况。若后台返回 401/403 设备认证失效，客户端会清空本地 token、切到待绑定态，并自动打开设置弹窗聚焦设备授权码，方便现场重新绑定；重新绑定成功后会收起设置弹窗并重新导航 WebView，回到浏览器壳。

后台上传循环与“立即上传”使用同一套上传预检口径；如果旧配置文件里残留了非法服务器地址、设备待绑定、后台禁用或 token 缺失，队列处理会直接暂停并等待配置修复，不会把待上传文件标记为失败，也不会消耗本地重试次数。

点击“启动监听”时，客户端会按设备状态和监听目录配置给出明确反馈；设备待绑定、后台禁用或没有启用目录时，不会误提示监听目录已重新启动。

配置保存采用临时文件写入后替换主文件的方式，并在替换前 best-effort 保留上一版 `collector-config.json.bak`；主配置和 `.bak` 净化/替换都通过同目录唯一 `.tmp` 写入后再替换目标文件，避免半截备份覆盖上一版可用配置。如果 `.bak` 路径被占用、权限不足或瞬时 I/O 失败，客户端会继续完成主配置原子替换，不会因为备份失败丢掉本次有效配置。同一采集端进程内的配置加载/保存会串行执行，避免心跳同步、手动保存和认证失效处理同时写入时互相踩主配置或备份。启动加载时如果主配置为空、半截写入或 JSON 损坏，会尝试从 `.bak` 回退加载并继续归一化配置，降低断电或进程崩溃导致设备绑定、监听目录和远程策略丢失的风险。

`collector.db` 使用 SQLite WAL 日志模式，并为每个连接设置 `busy_timeout=5000ms`。上传队列和客户端日志共用统一连接初始化，降低监听入队、上传循环、日志 flush 同时写库时出现 `database is locked` 的概率。

## 崩溃 dump

桌面端启动时会注册全局异常处理：

1. WPF UI 线程未处理异常。
2. AppDomain 未处理异常。
3. 未观察到的 Task 异常。

发生异常时会优先在本地写入：

```text
%AppData%\EISCore\Collector\crash-dumps\
  yyyyMMdd-HHmmss-fff-<source>-<pid>.dmp
  yyyyMMdd-HHmmss-fff-<source>-<pid>.json
```

`.json` manifest 保存异常类型、脱敏消息、脱敏堆栈、dump 路径和 dump 大小。应用下次启动时会扫描未上报 manifest，写入本地日志队列，随后通过现有日志批量上传接口上报，并生成 `.reported` 标记避免重复上报。已上报的 manifest、`.reported` 标记和同名 `.dmp` 会按 `logs.retention_days` 清理；未上报 manifest 不会被保留策略删除，断网期间仍可等待下次启动补报。crash dump 写入、`.reported` 标记写入、目录扫描或清理如果遇到权限、目录被移动或文件系统瞬时异常，会按 best-effort 跳过，不会让全局异常处理器或采集端启动再次失败。

## WebView 日志

桌面端在 WebView2 初始化时注入日志脚本，采集 `window.onerror`、`unhandledrejection`、`console.error`、`console.warn`、资源加载失败、fetch 异常和 XMLHttpRequest 异常。

如果 WebView2 runtime 缺失、损坏、初始化失败或网页导航失败，客户端会记录 `webview_initialization_failed` / `webview_navigation_failed`，但不会中断采集端启动；本地文件夹监听、上传队列、心跳和日志后台循环会继续运行，避免浏览器壳异常导致无人值守资料采集停摆。降级页会提示更具体的失败原因：初始化阶段可区分未检测到 WebView2 Runtime、用户数据目录不可写、Runtime 系统组件错误或本机安全策略拦截；导航阶段可区分 DNS 解析失败、连接超时、服务器不可达、证书异常、代理认证、HTTP 错误和服务器响应异常。日志会带上 `failureKind` 和诊断文案，便于后台按失败类型筛查。降级页会提供“重试打开网页”和“打开设置”入口，方便现场网络恢复或配置修正后直接回到浏览器壳；点击重试会记录 `webview_navigation_retry_requested`，并带上服务器地址、设备状态和 WebView 可用状态。从降级页打开设置时会直接聚焦设备授权码输入框，便于待绑定或认证失效后快速重新绑定；手动关闭设置弹窗或按 Esc 会把焦点还给右上角齿轮，重新绑定成功自动收起弹窗时则直接重新导航 WebView。

WebView2 用户数据目录固定写入 `%AppData%\EISCore\Collector\webview-user-data`，不会依赖程序所在目录。这样从 WSL/UNC 开发路径启动调试版时，WebView2 不会因为默认用户数据目录落在网络路径或不可写位置而报 `E_ACCESSDENIED` 并导致右侧空白。

注入脚本会暴露 `window.eiscoreCollectorLog`，前端可以调用 `setContext(...)`、`info(...)`、`warn(...)`、`error(...)` 或 `log(...)` 主动上报 Vue/axios/路由/用户操作等 SDK 日志。上报字段中的 `appModule`、`traceId`、`aiImportBatchId`、`sourceFileHash`、`userId`、`username`、`role` 会写入客户端日志表的独立列，未传用户字段时回退到设备默认上传人；这些字段如果由前端传成数字或布尔值会转为字符串，message/stack 等对象或数组会保留为紧凑 JSON 文本，`statusCode` 支持数字或数字字符串，避免前端埋点字段类型不稳定时静默丢失上下文。`setContext(...)` 还会把最近一次网页登录用户快照同步到原生端，供本机手动选择文件和窗口拖拽文件入队时写入上传归属；退出登录或用户信息清空时会同步清空原生端快照。

如果业务前端尚未主动调用 `setContext(...)`，注入脚本会在页面初始加载、路由切换、窗口重新获得焦点和定时巡检时，先从同源 `localStorage`/`sessionStorage` 的 `user_info` 等 JSON 中识别用户上下文，再使用同源存储中的 `auth_token`、`jwt_token` 等登录令牌以 Bearer 方式探测 `/agent/api/auth/me`、`/agent/api/me`、`/api/auth/me`、`/api/me`、`/auth/me` 等当前用户接口。其中 `/agent/...` 路径适配线上 nginx 把运行组件挂在 `/agent`、`/api` 挂给 PostgREST 的部署形态。探测请求会带 `X-EISCore-Collector-Probe: login-context` 和 `__eiscore_collector_probe=login-context` 标记，原生日志层会忽略这些探测自身的 401/404/5xx 噪声；探测结果只同步用户 ID、用户名、岗位/角色等上传归属字段，不会把 token 回传给原生端。

采集端启动时会自动补齐旧版 `client_log_events` 本地 SQLite 表缺失的日志上下文字段、`uploaded` 标记和索引依赖列。旧客户端升级后无需清空本地日志队列，已有未上传日志会带安全默认值继续等待补传，新日志可以直接写入独立追溯列。若旧库或手工修改导致 `created_at` 不是合法时间，单条日志读取会回退到 Unix epoch，健康水位读取会回退为空；异常 `uploaded` 标记会归一化为 pending/已上传布尔值，非法 `status_code` 会置空，空 metadata 会恢复为 `{}`，避免一条坏日志卡住整批补传或日志健康水位。

原生 WebView2 层也会记录导航失败、WebView 进程异常，以及 `WebResourceResponseReceived` 中的 HTTP 4xx/5xx 响应。4xx 记录为 `warn`，5xx 记录为 `error`，并带上 request URL、method、reason phrase 和 status code，便于排查页面白屏、静态资源丢失和接口失败。

WebView2 初始化时会读取当前 runtime 版本，写入本地日志的 `webview_version` 字段，并在设备绑定与后续心跳中同步到后台 `collector_devices.webview_version`，让设备列表和日志中心使用同一套版本口径。

WebView、文件夹监听和设备运行态切换中的后台日志写入都会通过统一的 fire-and-forget 异常隔离封装执行；如果本地 SQLite 短暂不可写或日志服务抛出异常，这类事件处理器不会产生未观察任务异常，也不会反过来中断监听或 WebView 事件处理。

主窗口初始化、绑定、保存配置、手动上传、开机自启、心跳、远程配置同步、健康快照和设备认证失效等 catch 分支里的兜底日志也会 best-effort 写入；如果本地日志库此时不可写，客户端会保留界面状态或继续后台循环，不会因为“记录失败日志失败”再抛出第二个异常。

启动成功、设备绑定成功、上传队列中断恢复、已上报崩溃报告清理、WebView 初始化降级和托盘初始化降级等审计日志也按 best-effort 写入；日志库短暂不可写时不会把“已启动”“已绑定”这类成功状态反向改成失败，也不会阻断本地采集主流程。

## 心跳健康快照

采集端心跳除 `client_version`、`webview_version`、Windows 用户和 `last_seen_at` 外，还会携带 `health` 对象。服务端会把完整心跳体保存在 `collector_devices.metadata.heartbeat_payload`，后台排障时可看到：

1. `uploadQueueByStatus`、`totalUploadQueueCount`、`pendingUploadCount`、`missingLocalUploadFileCount`、`oldestMissingLocalUploadFileCreatedAt`、`failedUploadCount`、`failedRetryReadyCount`、`failedRetryWaitingCount`、`failedRetryExhaustedCount`、`nextFailedRetryAt`、`failedUploadErrorSummaries`、`failedUploadErrorSummaryTruncated`、`uploadingCount`、`completedUploadCount`。失败错误摘要会按归一化后的错误文本聚合，只保留最多 5 条错误、次数、最早创建时间和最近创建时间，便于不用翻完整日志也能判断失败是否集中在同一类原因。
2. `lastQueuedAt`、`lastUploadedAt`、`oldestPendingUploadCreatedAt`，用于判断设备是否长期没有新资料或队列是否积压过久。
3. `pendingLogCount`、`lastLogCreatedAt`、`oldestPendingLogCreatedAt`、`lastUploadedLogCreatedAt`、`temporaryFileIgnoredLast24HoursCount`、`temporaryFileIgnoredSince`，用于判断日志补传压力、未上传日志是否积压过久，以及最近是否持续出现 Office 锁文件、浏览器下载中间文件。`lastUploadedLogCreatedAt` 表示已上传日志的创建时间水位，不是服务端接收时间。
4. `pendingCrashDumpReportCount`、`reportedCrashDumpReportCount`、`oldestPendingCrashDumpReportCreatedAt`、`lastCrashDumpReportCreatedAt`、`crashDumpDirectoryBytes`，用于判断客户端崩溃报告是否还没补报、已上报 dump 是否正在占用磁盘。
5. `uploadConnectivityStatus`、`lastUploadConnectivityOfflineAt`、`lastUploadConnectivityOnlineAt`，用于判断上传通道最近是离线、恢复还是从未触发过连通性状态切换。
6. `collectorDatabaseBytes`、`dataDriveAvailableFreeBytes`、`dataDriveTotalBytes`，用于判断断网缓存、本地 SQLite 或更新包是否造成磁盘压力。
7. `watchFolderCount`、`enabledWatchFolderCount`、`disabledWatchFolderCount`、`missingWatchFolderCount`、`accessibleWatchFolderCount`、`inaccessibleWatchFolderCount`。
8. `deviceStatus` 和 `autoStartEnabled`。

健康快照生成失败不会阻止基础心跳上报；客户端会记录 `collector_health_snapshot_failed`，本地日志后续按既有机制补传。

心跳和远程配置同步都会先校验服务器地址和本地设备 token；如果旧配置里残留了非 `http/https` 地址，客户端会跳过本次远程调用并记录一次 `collector_remote_call_unavailable` 本地告警。HTTP 2xx 响应还必须包含 `ok=true` 才会被视为成功；如果服务端业务拒绝、兜底返回 `ok=false` 或响应体无效，客户端不会把默认空配置落到本地。远程配置已经应用到当前进程后，如果本地 `collector-config.json` 暂时保存失败，客户端会记录 `collector_config_sync_state_save_failed`，但仍刷新日志上下文、界面、心跳间隔和监听运行态，避免后台禁用、恢复启用或目录变更卡在半应用状态。设备被后台禁用时，远程配置同步会暂停，但心跳仍保留为最小恢复通道，便于后台重新启用设备后下发恢复配置。

心跳定时器使用不重入保护：如果上一轮心跳、远程配置、更新检查或日志 flush 仍未完成，下一次 Tick 会直接跳过，避免慢网络或服务端卡顿时并发执行多轮后台同步、重复保存配置或堆叠日志补传。

## 自动更新

桌面端会在启动、设备绑定后和心跳循环中检查远程更新策略。远程配置启用 `update.enabled` 且提供 `manifest_url` 后，客户端会按 `check_interval_hours` 周期拉取 manifest。

`manifest_url` 和 manifest 内的 `download_url` 必须是绝对 `http/https` 地址，manifest 响应最大 128KB 且必须是合法 JSON，`version` 必须是 2 到 4 段数字点分版本，`sha256` 必须是 64 位十六进制字符串。更新包只允许 `.exe`、`.msi` 或 `.zip`；其中自动安装只允许 `.exe` / `.msi` 安装器。自动安装参数会优先使用本地配置覆盖 manifest，最终参数会 trim，长度不得超过 512 个字符，且不能包含换行、NUL 等控制字符。如果远程配置为空、使用 `ftp://`、`file://`、相对路径、manifest 返回 HTML/坏 JSON/超大响应、不支持的文件扩展名、版本号非法、自动安装参数非法，或更新包 SHA256 缺失/格式错误，客户端会记录 `collector_update_manifest_invalid` 并跳过本次更新，不会进入下载或安装流程。

本地 `collector-config.json` 加载、保存和 `.bak` 备份写入时也会使用同一套更新策略净化规则：非法 `manifest_url` 会关闭本地自动更新并清空 URL/安装参数，非法安装参数会关闭自动安装但保留合法 manifest 的下载检查，避免旧配置、备份回退或手工修改 JSON 后反复触发坏更新。

manifest 示例：

```json
{
  "version": "0.2.0",
  "download_url": "https://nanpai.eissys.top/agent/document-intake/collector/releases/EISCore.Collector-0.2.0-win-x64-setup.exe",
  "sha256": "64位十六进制SHA256",
  "mandatory": false,
  "auto_install": false,
  "installer_arguments": "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS"
}
```

客户端行为：

1. `version` 高于本地 `clientVersion` 时下载更新包到 `%AppData%\EISCore\Collector\updates\`。
2. 更新包先写入唯一 `.download` 临时文件，完整下载并完成 SHA256 校验后再替换最终安装包；校验失败或下载中断只清理临时文件，不覆盖已有可用安装包。
3. manifest 的 `sha256` 缺失、格式错误或校验不通过时，客户端会记录失败并跳过安装。
4. manifest 版本不高于本地 `clientVersion` 时记录 `collector_update_not_required`，并清空旧的 `pendingUpdateVersion`/`pendingUpdateInstallerPath`/安装器 PID/启动时间，避免升级成功后长期保留陈旧待安装状态。
5. 下载成功后写入 `pendingUpdateVersion` 和 `pendingUpdateInstallerPath`，并清空旧的安装器 PID/启动时间审计字段，避免陈旧状态误判为本次升级已启动安装器。
6. 当远程配置 `update.auto_install = true`，或 manifest 同时声明 `mandatory = true` 与 `auto_install = true` 时，启动安装器。
7. 安装器启动成功后写入 `pendingUpdateInstallerProcessId` 和 `pendingUpdateInstallerStartedAt`，方便排查远端升级是否真正拉起安装器。
8. 安装器启动失败时会保留已下载的 `pendingUpdateVersion`/`pendingUpdateInstallerPath`，记录 `collector_update_installer_start_failed`，但不会保留或写入安装器 PID/启动时间，客户端也不会因为旧 PID 误触发自动更新退出。
9. 更新检查已改变本地更新状态但 `collector-config.json` 暂时保存失败时，客户端会记录 `collector_update_state_save_failed`，并继续按当前进程内存中的更新状态运行；如果本轮已经新启动安装器，仍会进入退出流程给安装器让路。
10. 客户端确认本次更新检查新启动安装器后，会停止心跳、监听、上传队列，停止日志后台循环后再执行最终日志 flush，并主动退出，避免托盘常驻阻塞静默升级。
11. 更新检查、下载、校验、安装器启动和更新退出都会写入客户端日志队列，后续通过日志批量上报。
11. 客户端使用命名 mutex 保持单实例；安装器模板声明同名 `AppMutex`，静默升级时会优先关闭正在运行的采集端再替换文件。

自动更新检查属于后台维护能力；manifest 无效、下载失败、安装器启动失败或当前已是最新版本等诊断日志会记录本次使用的 `manifest_url`，涉及安装包的事件还会记录 `download_url`，便于现场确认客户端实际拉取的策略和产物地址。诊断日志写入如果遇到本地 SQLite 短暂不可写，会 best-effort 跳过该条日志，不会让更新检查异常反向中断心跳、监听、上传队列或配置保存。

## 日志保留

客户端日志先落本地 SQLite，再按远程配置 `logs.batch_size` 和 `logs.flush_interval_seconds` 批量上传。`logs.retention_days` 会清理超过保留期的本地日志，包含已上传日志和长期未能补传的 pending 日志；如果 pending 日志被裁剪，客户端会写入一条 `client_log_retention_pruned` 摘要，后续网络恢复时上报，避免长时间离线把本地 SQLite 无限撑大。

日志补传会先检查设备状态、服务器地址和本地设备 token；设备待绑定、后台禁用、服务器地址为空/非法或 token 缺失时，日志继续保留为 pending，并记录一次 `log_upload_unavailable` 本地告警，等待配置或绑定恢复后继续补传。

日志批量上报时，HTTP 2xx 后还必须收到服务端 `ok=true` 才会把本批本地日志标记为已上传。HTTP 失败、服务端业务拒绝或响应结构异常时，客户端会保留保留期内的 pending 日志，并记录 `log_upload_failed` 本地事件；同一种连续失败原因只记录一次，补传成功后才允许记录新的失败原因，避免断网期间重复刷屏。

日志写入本地前会统一脱敏，覆盖 `authorization`、`authorizationCode`、`bindCode`、`bindingCode`、`cookie`、`set-cookie`、`token`、`client_secret` / `clientSecret`、`csrf_token` / `csrfToken`、`x-csrf-token` / `xCsrfToken`、`access_token` / `accessToken`、`refresh_token` / `refreshToken`、`id_token` / `idToken`、`api_key` / `apiKey`、`device_token` / `deviceToken`、URL 查询参数、Bearer/Basic 头、裸 JWT、URL userinfo 账号密码、手机号和身份证号；超长文本会截断，避免前端 SDK、WebView 原生日志或异常堆栈把绑定授权码、设备凭据或用户隐私带入本地日志和后续批量上报。

## 发布包与 manifest

发布脚本位于：

```text
collector-desktop/scripts/publish-collector.ps1
```

在安装 .NET SDK 的 Windows 构建机上执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -DownloadBaseUrl https://nanpai.eissys.top/agent/document-intake/collector/releases
```

默认会生成 zip 发布包和 manifest：

```text
collector-desktop/artifacts/
  publish/EISCore.Collector-<version>-win-x64/
  packages/EISCore.Collector-<version>-win-x64.zip
  manifest/update.json
```

`update.json` 会写入版本号、下载地址、SHA256、强制更新标记、自动安装标记和安装参数。未显式传入 `-Version` 时，发布脚本会优先读取桌面端 `.csproj` 的 `Version`；无论来源如何，版本号都必须是 2 到 4 段数字点分版本，例如 `0.2.0`，否则脚本会在生成 manifest 前失败。`DownloadBaseUrl` 必须是客户端可访问的 `http` 或 `https` 绝对 URL，脚本会拒绝相对路径和非 HTTP 地址；最终 manifest 中的 `download_url` 会自动拼上产物文件名。

如果构建机安装了 Inno Setup 6，可以同时生成 EXE 安装器，并让 manifest 指向安装器：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -DownloadBaseUrl https://nanpai.eissys.top/agent/document-intake/collector/releases `
  -BuildInstaller `
  -AutoInstall `
  -InstallerArguments "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS" `
  -ReleaseDirectory .\collector-desktop\artifacts\release
```

安装器模板位于：

```text
collector-desktop/installer/EISCore.Collector.iss
```

安装器默认安装到：

```text
%LocalAppData%\Programs\EISCore\Collector
```

安装器支持桌面图标和开机自启安装任务；自动更新场景建议使用 `/VERYSILENT /NORESTART /CLOSEAPPLICATIONS`。
发布脚本传入 `-AutoInstall` 时会在构建机上实际启动当前 EXE/MSI 安装包；如果产物位于 WSL/UNC 路径，脚本会先复制到 `%TEMP%` 再执行，避免 `Start-Process -Wait` 卡住。脚本 JSON 结果会返回 `autoInstallExecuted`、`autoInstallExitCode` 和 `autoInstallPath`；远程客户端是否自动升级仍由 manifest 的 `auto_install` 和设备远程配置共同控制。
安装器模板声明 `AppMutex=EISCoreCollector_D7F10C50AD264D5785CBCB4AAEA36347`，与客户端单实例 mutex 保持一致，便于 `/CLOSEAPPLICATIONS` 在自动升级时识别运行中的采集端。客户端启动安装器后也会主动优雅退出，覆盖托盘隐藏窗口不响应普通关闭请求的升级场景。
客户端开机自启使用当前用户 Run 注册表项 `EISCoreCollector`。运行时判断自启状态时会解析 Run 命令并确认其指向当前 `EISCore.Collector.exe`，避免旧安装路径残留导致 UI 或远程策略误判为已启用。手动勾选或远程配置下发自启策略时，只有注册表写入成功才会更新 `collector-config.json` 中的 `autoStartEnabled`；读取 Run 状态失败时只降级为按本地配置显示。

## 退出行为

普通点击窗口关闭按钮时，采集端会隐藏到托盘继续监听、上传和上报日志。若 Windows 通知区或 shell 异常导致托盘图标初始化失败，客户端会记录 `collector_tray_initialization_failed` 并继续启动；此时关闭按钮不会隐藏窗口，而是最小化到任务栏，避免用户找不到正在运行的采集端。托盘菜单“退出”、自动更新安装器启动后的主动退出，以及 Windows 注销/关机触发的会话结束，会放行窗口关闭，并按顺序停止心跳、目录监听、上传队列和日志后台循环，最后执行一次日志 flush，避免托盘常驻阻塞升级或系统关机。

`docker-compose.yml` 和 `docker-compose.prod.yml` 会把以下目录以只读方式挂载到 realtime 容器：

```text
collector-desktop/artifacts/release -> /app/data/collector-releases
```

realtime 服务会公开只读下载路由：

```text
GET /agent/document-intake/collector/releases/update.json
HEAD /agent/document-intake/collector/releases/<安装包文件名>
GET /agent/document-intake/collector/releases/<安装包文件名>
```

本地 WSL/Docker 安装验收时，可以生成指向本机 nginx 的 manifest：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -DownloadBaseUrl http://localhost/agent/document-intake/collector/releases `
  -BuildInstaller `
  -AutoInstall `
  -InstallerArguments "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS" `
  -ReleaseDirectory .\collector-desktop\artifacts\release
```

也可以使用一键脚本完成发布、Docker 服务启动/重启、manifest/安装包 SHA256 验证，并可选预置本地采集设备。脚本会确认 `update.json` 中的 `download_url` 指向当前 `DownloadBaseUrl` 路由下的安装包，避免本地验收误通过旧 manifest 或外部下载地址：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\setup-local-wsl-release.ps1 -SeedDevice
```

`-SeedDevice` 默认预置的客户端绑定参数：

```text
服务器地址：http://localhost
企业编号：local
设备编号：local-collector-01
设备授权码：local-bind-code
默认上传用户：local-user
默认岗位：warehouse
```

传入 `-SeedDevice` 时，脚本还会用这些参数调用本地 `POST /agent/document-intake/devices/bind`、`GET /agent/document-intake/devices/config` 和 `POST /agent/document-intake/devices/heartbeat`。验收成功后，脚本输出 JSON 中会包含 `deviceApi.deviceId`、`tokenLength`、`configVersion`、`manifestUrl` 和 `heartbeatOk`。

脚本检测到自身位于 `\\wsl.localhost\<发行版>\...` 时，会自动切到对应 WSL 发行版内执行 Docker Compose 和 `docker exec psql`，并重建 `agent-runtime`，避免 Windows Docker CLI 处理 WSL bind mount 时导致容器内 `/app/index.js` 不可用。

本地设备远程配置可以下发：

```json
{
  "update": {
    "enabled": true,
    "manifest_url": "http://localhost/agent/document-intake/collector/releases/update.json",
    "check_interval_hours": 24,
    "auto_install": true,
    "installer_arguments": "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS"
  }
}
```

远端部署时，设备远程配置可以改为：

```json
{
  "update": {
    "enabled": true,
    "manifest_url": "https://nanpai.eissys.top/agent/document-intake/collector/releases/update.json",
    "check_interval_hours": 24,
    "auto_install": true,
    "installer_arguments": "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS"
  }
}
```

如果已经用 WiX、Inno Setup、NSIS 或其他工具生成 MSI/EXE 安装包，也可以只为安装包生成 manifest：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -PackagePath .\collector-desktop\artifacts\installer\EISCore.Collector-0.2.0.msi `
  -DownloadBaseUrl https://nanpai.eissys.top/agent/document-intake/collector/releases `
  -AutoInstall `
  -InstallerArguments "/quiet /norestart"
```

当产物是 zip 时，脚本会生成可下载 manifest，但不会把 `auto_install` 置为 true。真正无人值守升级建议使用 MSI/EXE，并确保安装器支持静默参数。

## 服务端接口约定

桌面端当前按以下接口对接服务端。服务端实现位于：

```text
realtime/document-intake.js
sql/patch_ai_document_intake_mvp.sql
```

首次部署需要先应用 SQL patch，并为绑定准备授权码。

```bash
psql "$DATABASE_URL" -f sql/patch_ai_document_intake_mvp.sql
```

MVP 支持两种绑定码策略：

1. 在 `collector_devices.binding_code_hash` 预置某台设备的授权码 SHA256。
2. 设置环境变量 `COLLECTOR_BIND_AUTH_CODE` 作为临时统一绑定码。

生产环境建议使用第一种，第二种只适合试点和内网调试。

绑定接口返回 `BIND_CODE_INVALID` 时，桌面端会提示授权码无效或已过期，并保留当前本地配置；该错误不会被归类为已绑定设备 token 失效，也不会触发本地 token 清空或 `pending` 状态收敛。绑定成功时服务端会签发新 `device_token`，客户端会用 DPAPI 保护保存，并把本地设备状态恢复为 `active`。

### 设备绑定

```text
POST /agent/document-intake/devices/bind
```

请求体：

```json
{
  "enterpriseCode": "tenant001",
  "deviceCode": "warehouse-pc-01",
  "deviceName": "仓库电脑01",
  "defaultUserId": "u_123",
  "defaultUsername": "zhangsan",
  "defaultRole": "仓库员",
  "authorizationCode": "bind-code",
  "windowsUsername": "DESKTOP-01\\Admin",
  "clientVersion": "0.1.0"
}
```

响应体：

```json
{
  "deviceId": "dev_001",
  "deviceToken": "signed-device-token",
  "deviceCode": "warehouse-pc-01",
  "deviceName": "仓库电脑01",
  "defaultUserId": "u_123",
  "defaultUsername": "zhangsan",
  "defaultRole": "仓库员"
}
```

### 文件上传

```text
POST /agent/document-intake/assets/upload
Authorization: Bearer <device_token>
Content-Type: multipart/form-data
```

表单字段：

```text
file      原始文件
metadata  JSON 元信息
```

采集端上传 metadata 会包含设备、上传用户和来源目录信息：

```json
{
  "upload_source": "watch_folder",
  "uploaded_by_user_id": "u_warehouse",
  "uploaded_by_username": "operator",
  "uploaded_by_role": "仓库员",
  "windows_username": "DESKTOP-01\\Admin",
  "operator_source": "folder_binding_user",
  "source_folder": "D:\\EISCore\\Inbox"
}
```

手动选择文件或拖拽文件到采集端窗口时，客户端会优先使用 WebView 最近同步的网页登录用户，写入 `operator_source=web_login_user`。如果没有网页登录用户快照，原生“选择文件”路径会使用当前配置中的默认上传用户并写入 `operator_source=manual_selected_user`；窗口拖拽路径会回退到设备默认上传用户并写入 `operator_source=device_default_user`。后台监听目录上传时，客户端会优先使用对应 `watchFolders[].defaultUserId`、`defaultUsername` 和 `defaultRole`，并写入 `operator_source=folder_binding_user`；未配置目录归属时回退到设备默认上传用户。监听目录上传不继承当前网页登录用户，避免无人值守目录被前台页面用户误改归属。服务端会把 `source_folder` 写入 `document_assets.source_folder`，便于按目录追溯。

响应体：

```json
{
  "assetId": "asset_001",
  "batchId": "batch_001",
  "duplicate": false,
  "status": "uploaded",
  "message": ""
}
```

### 心跳

```text
POST /agent/document-intake/devices/heartbeat
Authorization: Bearer <device_token>
```

心跳响应会附带当前设备远程配置快照，客户端也会定期拉取独立配置接口：

```text
GET /agent/document-intake/devices/config
Authorization: Bearer <device_token>
```

远程配置 MVP 读取优先级：

1. `collector_devices.metadata.remote_config.watch_folders` 显式下发监听目录时优先使用。
2. 否则读取 `collector_watch_folders` 中该设备启用的监听目录。
3. 其他策略读取 `collector_devices.metadata.remote_config`，缺省时返回服务端默认值。

### 业务修正审计

AI 自动入库后的人工修正可以通过设备 token 上报修正痕迹，写入 `ai_business_corrections`，并将关联的 `document_business_links.metadata.ai_review_status` 标记为 `corrected`。

当 `affectsBusinessResult=true` 且 `DOCUMENT_INTAKE_BUSINESS_CORRECTION_POLICY` 不是 `record_only` 时，接口还会写入 `ai_business_recalculation_tasks`。默认 `record_and_recalculate` 会生成 `pending` 任务；策略为 `manual_review` 时生成 `manual_review_required` 任务，供后续库存、统计、进度、质量等重算 worker 或人工复核队列消费。

服务端 runtime 会启动 `document-recalculation` worker。该 worker 会认领 `pending` 重算任务，写入 `processing`、`attempt_count`、`locked_at`、`locked_by`，并根据结果流转到 `completed`、`manual_review_required`、`pending` 重试或 `failed`。当前 MVP 不硬编码统计、进度、质量公式；没有匹配业务 adapter 的任务会被明确转为 `manual_review_required`，并在 `last_error` 与 `metadata.adapter_missing` 中说明原因，避免把未定义的业务重算误标为完成。后续业务模块可按 `task_type:target_schema.target_table`、`target_schema.target_table` 或 `task_type` 注册 adapter，adapter 返回 `completed` 后 worker 会同步更新修正记录和业务链接的最后重算状态。

库存侧已内置首个 adapter：`scm.inventory_transactions.verify_v1`。它只针对 `scm.inventory_transactions` 业务链接读取既有库存流水，按 `transaction_no`、`id` 或 `batch_id` 复核目标记录是否存在，并把流水快照写入重算元数据；它不会再次调用 `scm.stock_in(...)`，也不会直接修改库存批次或余额。若找不到目标库存流水，任务会流转为 `manual_review_required`，等待人工补链或后续接入更完整的库存余额重算 RPC。

```text
POST /agent/document-intake/business-corrections
Authorization: Bearer <device_token>
Content-Type: application/json
```

请求体：

```json
{
  "businessLinkId": "11111111-1111-4111-8111-111111111111",
  "fieldName": "quantity",
  "oldValue": "10",
  "newValue": "12",
  "correctionType": "manual_correction",
  "affectsBusinessResult": true,
  "recalculationStatus": "pending",
  "correctedBy": "warehouse-user",
  "traceId": "trace-correction-1",
  "metadata": {
    "reason": "人工复核修正"
  }
}
```

如果没有 `businessLinkId`，也可以使用 `targetSchema`、`targetTable`、`targetRecordId` 定位业务记录。`affectsBusinessResult=true` 时默认 `recalculationStatus` 为 `pending`，响应体会返回 `recalculationTask`；后续库存、统计、进度、质量等重算流程可以按任务表的 `status` 和目标业务记录继续接入。

`collector_devices.metadata.remote_config` 示例：

```json
{
  "version": "warehouse-pc-01-v2",
  "default_user_id": "u_warehouse",
  "default_username": "仓库员",
  "default_role": "仓库",
  "auto_start_enabled": true,
  "heartbeat_interval_seconds": 60,
  "watch_folders": [
    {
      "folder_path": "D:\\EISCore\\Inbox",
      "folder_name": "仓库收单",
      "default_user_id": "u_warehouse",
      "default_role": "仓库",
      "enabled": true
    }
  ],
  "upload": {
    "max_file_bytes": 268435456,
    "chunk_size_bytes": 8388608,
    "retry_interval_seconds": 15,
    "max_retry_count": 10,
    "queue_retention_days": 30,
    "allowed_extensions": [".xlsx", ".xls", ".csv", ".docx", ".doc", ".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp", ".txt", ".zip", ".rar", ".7z"]
  },
  "logs": {
    "batch_size": 100,
    "flush_interval_seconds": 30,
    "retention_days": 30,
    "high_priority_immediate": true
  },
  "update": {
    "enabled": true,
    "manifest_url": "https://download.example.com/eiscore/collector/update.json",
    "check_interval_hours": 24,
    "auto_install": false,
    "installer_arguments": "/quiet /norestart"
  }
}
```

客户端合并策略：

1. 不覆盖服务器地址和本地加密 token。
2. 更新设备名、默认上传人、默认岗位、开机自启、心跳/上传/日志策略。
3. 当远程下发监听目录时，替换本地监听目录并重启 watcher。
4. 文件入队前会先跳过 `~$*`、`.tmp`、`.temp`、`.part`、`.partial`、`.download`、`.crdownload` 等临时/下载中文件，再等待文件稳定，按 `max_file_bytes` 和 `allowed_extensions` 过滤，并跳过空文件。
5. `allowed_extensions` 落地前会统一补点、小写、去重、过滤危险项并限制数量。
6. 更新策略落地前会先校验 `manifest_url` 和安装参数；非法 manifest URL 不写入本地并关闭本地自动更新，非法安装参数会关闭自动安装但保留正常下载检查。本地配置加载、保存和 `.bak` 备份写入同样执行这套净化规则。
6. 更新策略变化会清空上次检查时间，使新 manifest 地址或检查周期立即生效。

服务端默认远程配置会显式下发常见业务文档、图片、文本和压缩包扩展名，其中压缩包包括 `.zip`、`.rar`、`.7z`；后台显式下发 `allowed_extensions` 时，以后台配置为准。

文件计算 SHA256 前后会再次比对文件大小和最后修改时间；如果文件在 hash 过程中发生变化，客户端会记录 `file_upload_failed` 并暂不入队。监听目录触发的文件如果因为“尚未稳定”或“hash 过程中发生变化”暂未入队，监听服务会记录 `file_watch_retry_scheduled` 并最多重试 3 次，避免大文件拷贝、网络盘落盘或杀毒扫描导致一次事件后长期漏采；手动选择/拖拽文件仍保持即时反馈，不做后台重试。

临时/下载中文件会记录为 `file_ignored`，日志 metadata 中带 `ignore_reason`，最终文件名落地后由后续监听事件或恢复扫描按正常规则重新采集。

### 大文件分片上传

小文件继续使用一次性上传接口：

```text
POST /agent/document-intake/assets/upload
```

当文件大于客户端当前 `chunk_size_bytes` 时，桌面端会自动切换为分片续传：

```text
POST /agent/document-intake/assets/chunks/init
POST /agent/document-intake/assets/chunks/upload
POST /agent/document-intake/assets/chunks/complete
```

服务端会把上传会话写入 `document_upload_sessions`，把已收到的分片写入 `document_upload_chunks`。客户端重试同一个文件时，初始化接口会返回已上传分片编号和缺失分片编号，客户端优先按服务端 `missingChunks` 只补传缺失分片；未返回缺失列表时再按 `uploadedChunks` 推导。完成接口会按顺序合并分片，校验最终 SHA256 和文件大小后，再复用普通上传的批次、资产、解析任务创建逻辑。

客户端会校验分片初始化响应中的 `chunkSize` 和 `totalChunks` 是否与本地分片计划一致；续传时只信任合法范围内的 `missingChunks` / `uploadedChunks` 编号，并且每片上传后校验服务端确认的 `sessionId`、`chunkIndex`、`totalChunks` 和 `ok` 状态。普通上传、分片初始化重复命中和分片完成响应都必须返回可识别的 `uploaded` / `duplicate` 状态和非空 `assetId`；本地会 trim 并清理 `assetId` / `batchId` / `message` 中的控制字符，超长 `assetId` / `batchId` 会被拒绝而不是截断，并以归一化后的 `status` 判定 duplicate 标志，避免服务端布尔字段缺失或不一致时把重复文件写成普通上传。上述校验也避免异常服务端响应导致跳过未上传分片、重复补传无效分片、在确认错片后继续 complete，或把不可追溯的空资产响应写成本地上传成功。

### 日志批量上报

```text
POST /agent/document-intake/client-logs/batch
Authorization: Bearer <device_token>
```

## 服务端持久化

默认文件保存目录：

```text
/app/data/document-intake
```

`docker-compose.yml` 已挂载命名卷 `document_intake_data` 到该目录，避免容器重建时丢失原始资料。

## 解析 Worker

上传成功后，服务端会自动创建 `document_parse_jobs.pending`。`realtime/document-parser.js` 会后台轮询这些任务：

1. Excel / CSV：使用 `xlsx` 解析 sheet 行数据和文本。
2. Word `.docx`：使用 `mammoth` 提取原始文本。
3. PDF：使用 `pdf-parse` 提取文本。
4. 文本文件：直接按 UTF-8 提取文本。
5. 图片：先写入 `ocr_result.status = pending`，等待后续 AI OCR worker 接入。

可配置环境变量：

```text
DOCUMENT_PARSE_WORKER_ENABLED=true
DOCUMENT_PARSE_POLL_INTERVAL_MS=8000
DOCUMENT_PARSE_MAX_RETRIES=5
DOCUMENT_PARSE_MAX_TEXT_CHARS=600000
DOCUMENT_PARSE_MAX_TABLE_ROWS_PER_SHEET=5000
```

## 分类与入库计划 Worker

解析完成后，`realtime/document-planner.js` 会消费 `document_assets.status = parsed` 的资料，并生成：

1. `document_classification_results`：业务模块、单据类型、目标类型、置信度、判断理由和候选列表。
2. `document_entry_plans`：一张/多张/主从明细的计划、目标动态应用信息、字段契约快照和后续映射状态。

当前是规则引擎 MVP：

1. 固定模块规则覆盖采购入库、质量检验、生产日报、销售出库、设备点检、人事记录。
2. 动态应用规则读取 `app_center.apps.config.columns` 等字段配置，按应用名、描述、表名、字段名、标签和别名匹配。
3. 图片 OCR 未完成时只写未识别分类，不生成正式入库计划。
4. 入库计划生成时会统一应用自动入库策略；低于 `DOCUMENT_INTAKE_CONFIDENCE_THRESHOLD` 且策略要求复核/归档时，计划写为 `archived_only`、`auto_import_ready=false`，后续入库 worker 不会误执行。
5. Planner 只生成分类与入库计划，不直接写正式业务表；正式入库由动态应用入库 Worker 或固定模块业务 Worker 执行。

可配置环境变量：

```text
DOCUMENT_PLAN_WORKER_ENABLED=true
DOCUMENT_PLAN_POLL_INTERVAL_MS=10000
DOCUMENT_PLAN_MAX_TEXT_CHARS=120000
DOCUMENT_INTAKE_CONFIDENCE_THRESHOLD=0.7
DOCUMENT_INTAKE_LOW_CONFIDENCE_POLICY=auto_import_with_review
DOCUMENT_INTAKE_DEFAULT_AUTO_IMPORT_MODE=auto_import
```

## 动态应用入库 Worker

`realtime/document-entry.js` 会消费 `document_entry_plans.status = planned` 且 `target_kind = data_app` 的计划。

当前 MVP 行为：

1. 调用 `app_center.create_data_app_table(app_id, table_name, columns_snapshot)` 确保动态表存在。
2. 根据解析表格的首行表头匹配 `columns_snapshot` 中的字段、标签和别名。
3. 表格多行会生成多条 `app_data.<table>` 记录。
4. 无表格时尝试从文本中的 `字段：值` / `字段=值` 提取一条记录。
5. 未匹配字段写入 `properties.__ai_unmapped_fields`，如果目标表存在 `remarks / remark / notes` 等备注列，则同步写入可读的“AI未匹配字段”备注。
6. 每条入库记录都写入 `properties.ai_generated`、来源文件、批次、设备、上传人、置信度和 `ai_review_status = unreviewed`。
7. 当记录中存在 `document_no`、`bill_no`、`order_no`、`receipt_no`、`transaction_no` 等强单号字段时，生成 `business_dedupe_key` 并先查询同一动态表的 `document_business_links`；已存在时不再写入新的 `app_data` 正式业务记录，只补一条 `duplicate_business_source=true` 的来源追溯链接。
8. 入库完成后写 `document_business_links`，并结构化写入 `document_unmapped_fields`。

固定模块计划暂不由该 worker 执行，后续需要分别接入采购、仓储、质检、生产等正式业务入口，避免绕过库存和状态流转逻辑。

可配置环境变量：

```text
DOCUMENT_ENTRY_WORKER_ENABLED=true
DOCUMENT_ENTRY_POLL_INTERVAL_MS=12000
DOCUMENT_ENTRY_MAX_ROWS_PER_PLAN=200
```

## 固定模块采购入库 Worker

`realtime/document-fixed-entry.js` 会消费 `document_entry_plans.status = planned`、`target_kind = fixed_module_table`、`target_module = materials`、`target_document_type = 采购入库单` 的计划。

当前 MVP 行为：

1. 从解析表格首行匹配物料编码/名称、仓库编码/名称、数量、单位、批次号、生产日期、供应商、采购单价、备注等字段。
2. 通过 `public.raw_materials(batch_no/name)` 解析物料主数据，通过 `scm.warehouses(code/name)` 解析启用仓库/库位。
3. 必填项完整且主数据唯一匹配后，先按 `document_business_links(target_schema, target_table, target_record_id)` 检查同一采购入库单号是否已关联正式库存流水；已存在时跳过 `scm.stock_in(...)`，只写一条 `duplicate_business_source=true` 的来源追溯链接。
4. 未命中业务重复时，调用 `scm.stock_in(...)` 正式业务 RPC 生效入库，不直接写 `inventory_batches` / `inventory_transactions`。
5. `供应商`、`采购单价` 当前 RPC 没有独立参数，会写入入库备注，并同步写入 `document_unmapped_fields` 供人工复核。
6. 业务修正触发重算时，`document-recalculation` 默认通过 `scm.inventory_transactions.verify_v1` 复核已生成的库存流水，不重放 `scm.stock_in(...)`，避免重复增加库存。
7. 行级失败不会中断整张单据；成功行写 `document_business_links`，重复业务行写重复来源链接，失败行写 `document_unmapped_fields`，计划最终状态为 `imported` / `partial` / `skipped_duplicate` / `failed`。

可配置环境变量：

```text
DOCUMENT_FIXED_ENTRY_WORKER_ENABLED=true
DOCUMENT_FIXED_ENTRY_POLL_INTERVAL_MS=12000
DOCUMENT_FIXED_ENTRY_MAX_ROWS_PER_PLAN=200
DOCUMENT_FIXED_ENTRY_DEFAULT_OPERATOR=collector_agent
DOCUMENT_FIXED_ENTRY_DEFAULT_IO_TYPE=采购入库
DOCUMENT_FIXED_ENTRY_DEFAULT_WAREHOUSE_CODE=
DOCUMENT_FIXED_ENTRY_DEFAULT_WAREHOUSE_NAME=
```

## 固定模块质检记录 Worker

同一个 `realtime/document-fixed-entry.js` 也会消费 `target_kind = fixed_module_table`、`target_module = quality`、`target_document_type in ('质量检验单', '质检记录')` 的计划，并写入 `public.quality_inspections`。

当前 MVP 行为：

1. 从解析表格首行或文本中匹配检验单号、检验类型、来源单号、物料/产品编码、物料/产品名称、供应商/客户/产线、批次号、抽样数量、不良数量、判定、检验员、检验日期和备注。
2. 检验类型会归一到 `来料检验`、`过程巡检`、`首件检验`、`成品抽检`；判定会归一到 `待判定`、`合格`、`让步接收`、`不合格`。
3. 必填项和数量关系校验通过后，写入正式 `quality_inspections`，再写 `document_business_links(public.quality_inspections, doc_no)` 建立来源追溯。
4. 若质检单号已存在业务链接或正式质检记录，只写 `duplicate_business_source=true` 的来源追溯链接，不重复插入正式质检记录。
5. 未匹配字段继续写入 `document_unmapped_fields`，目标定位到 `public.quality_inspections`。
6. 行级失败不会中断整张单据；计划最终状态沿用 `imported` / `partial` / `skipped_duplicate` / `failed`。

## 固定模块销售出库 Worker

同一个 `realtime/document-fixed-entry.js` 还会消费 `target_kind = fixed_module_table`、`target_module = sales`、`target_document_type = 销售出库单` 的计划。

当前 MVP 行为：

1. 从解析表格首行或文本中匹配出库单号、销售订单号、产品/物料编码、产品/物料名称、仓库/库位、出库数量、单位、批次号、客户、收货人、送货地址、经办人、出库类型和备注。
2. 通过 `public.raw_materials(batch_no/name)` 解析产品/物料主数据，通过 `scm.warehouses(code/name)` 解析启用仓库/库位。
3. 必填项完整且主数据唯一匹配后，先按 `document_business_links(target_schema, target_table, target_record_id)` 检查同一出库流水号是否已关联正式库存流水；已存在时跳过 `scm.stock_out(...)`，只写一条 `duplicate_business_source=true` 的来源追溯链接。
4. 未命中业务重复时，调用 `scm.stock_out(...)` 正式业务 RPC 生效出库，不直接写 `inventory_batches` / `inventory_transactions`。
5. `客户`、`收货人`、`送货地址` 当前 RPC 没有独立参数，会写入出库备注，并同步写入 `document_unmapped_fields` 供人工复核。
6. 如果资料没有出库单号，worker 会按计划和行号生成稳定的 `AI-SO-...` 出库流水号，便于重复投递时按业务链接去重。
7. 行级失败不会中断整张单据；成功行写 `document_business_links`，重复业务行写重复来源链接，失败行写 `document_unmapped_fields`，计划最终状态为 `imported` / `partial` / `skipped_duplicate` / `failed`。

## 固定模块生产日报 / 报工 Worker

生产报工正式表由 `sql/patch_document_intake_production_work_reports.sql` 提供，目标表为 `scm.production_work_reports`，并提供 `scm.v_production_work_report_summary` 汇总视图。

同一个 `realtime/document-fixed-entry.js` 还会消费 `target_kind = fixed_module_table`、`target_module = production`、`target_document_type in ('生产日报', '生产报工单')` 的计划。

当前 MVP 行为：

1. 从解析表格首行或文本中匹配报工单号、报工日期、工单号、产品/物料编码、产品/物料名称、工序、车间、产线、班次、班组、完工数量、合格数量、不良数量、报废数量、单位、报工人和备注。
2. 有工单号时优先解析 `scm.production_work_orders(work_order_no)`，并使用工单产品和单位；没有工单号时通过 `public.raw_materials(batch_no/name)` 解析产品/物料主数据。
3. 必填项和数量关系校验通过后，写入正式 `scm.production_work_reports`，再写 `document_business_links(scm.production_work_reports, report_no)` 建立来源追溯。
4. 有工单号时，worker 会按该工单的 active 报工累计完工数刷新 `scm.production_work_orders.work_order_status`：累计完工数大于 0 时为 `生产中`，累计完工数达到计划数量时为 `已完工`；`已取消` 工单不会被改状态。
5. 若报工单号已存在业务链接或正式报工记录，只写 `duplicate_business_source=true` 的来源追溯链接，不重复插入正式报工记录，也不重复刷新工单进度。
6. 如果资料没有报工单号，worker 会按计划和行号生成稳定的 `AI-PR-...` 报工单号，便于重复投递时按业务链接去重。
7. 行级失败不会中断整张单据；成功行写 `document_business_links`，重复业务行写重复来源链接，失败行写 `document_unmapped_fields`，计划最终状态为 `imported` / `partial` / `skipped_duplicate` / `failed`。

## 固定模块设备点检 Worker

同一个 `realtime/document-fixed-entry.js` 还会消费 `target_kind = fixed_module_table`、`target_module = equipment`、`target_document_type = 设备点检记录` 的计划，并写入 `public.equipment_checks`。

当前 MVP 行为：

1. 从解析表格首行或文本中匹配点检单号、设备编号、设备名称、点检类型、点检项目数、异常数量、点检结果、点检人、点检日期和备注。
2. 通过 `public.equipment_assets(asset_no/asset_name)` 解析设备台账；如果资料中有设备名称但暂未匹配到台账，仍可写正式点检记录，并在 `properties.unresolved_asset=true` 标记待后续补链。
3. 点检类型会归一到 `班前点检`、`日常巡检`、`专项点检`；点检结果会归一到 `待处理`、`正常`、`异常`、`停机`，未显式给结果但异常数量大于 0 时自动判为 `异常`。
4. 必填项和数量关系校验通过后，写入正式 `equipment_checks`，再写 `document_business_links(public.equipment_checks, check_no)` 建立来源追溯。
5. 有设备台账关联时，worker 会根据点检结果更新设备台账：`停机` 会同步设备运行状态，`异常/停机` 会降低健康分，并记录最近一次 AI 点检信息。
6. 若点检单号已存在业务链接或正式点检记录，只写 `duplicate_business_source=true` 的来源追溯链接，不重复插入正式点检记录，也不重复更新设备台账。
7. 未匹配字段继续写入 `document_unmapped_fields`，同时保存在点检记录 `properties.__ai_unmapped_fields`，用于保留温度、振动、点检照片等扩展字段。
8. 本阶段只写点检记录；异常自动生成 `equipment_issues` 或维修工单作为后续增强，避免一次资料导入直接展开维修流程。
9. 行级失败不会中断整张单据；成功行写 `document_business_links`，重复业务行写重复来源链接，失败行写 `document_unmapped_fields`，计划最终状态为 `imported` / `partial` / `skipped_duplicate` / `failed`。

## 固定模块人事记录 Worker

人事记录正式表由 `sql/patch_document_intake_hr_records.sql` 提供，目标表为 `hr.document_intake_records`，并提供 `hr.v_document_intake_record_summary` 汇总视图。该补丁还提供 `hr.attendance_month_recalculation_snapshots`，用于保存人工修正后由重算 worker 生成的员工月度考勤快照。人事记录表保留 `attendance_sync_status`、`attendance_record_id` 和 `attendance_sync_message`，用于追踪人事记录向考勤明细的安全同步结果。

同一个 `realtime/document-fixed-entry.js` 还会消费 `target_kind = fixed_module_table`、`target_module = hr`、`target_document_type = 人事记录` 的计划。

当前 MVP 行为：

1. 从解析表格首行或文本中匹配人事单号、日期、员工编号、员工姓名、部门、岗位、事项类型、时长、加班时长、请假时长、缺勤时长、状态、经办人和备注。
2. 事项类型会归一到 `考勤`、`请假`、`加班`、`出差`、`调休`、`入职`、`离职`、`调岗`、`绩效`、`培训`、`其他`；未显式填写事项但存在加班/请假/缺勤时长时，会自动推断为对应事件。
3. 只要求至少存在员工编号或员工姓名，不强制命中 `hr.archives`。这样入职候选人、离职资料、临时人员考勤等资料可以先正式留痕，再由人工补链或修正。
4. 写入正式 `hr.document_intake_records` 后，再写 `document_business_links(hr.document_intake_records, record_no)` 建立来源追溯。
5. 若人事单号已存在业务链接或正式人事记录，只写 `duplicate_business_source=true` 的来源追溯链接，不重复插入正式记录。
6. 未匹配字段继续写入 `document_unmapped_fields`，同时保存在人事记录 `properties.__ai_unmapped_fields`，用于保留餐补、班次、证明附件说明等扩展字段。
7. 对 `考勤`、`请假`、`加班` 三类低风险事件，worker 会在正式人事记录写入后尝试同步 `hr.attendance_records`。同步要求资料包含日期，并且能通过员工编号或姓名唯一匹配 `hr.archives`；未匹配档案、考勤表缺失或非考勤类事件只会写入 `attendance_sync_status=skipped/not_applicable`，不会回滚人事记录。
8. 考勤同步采用 upsert：同一天同一员工已有考勤记录时，只合并请假/缺勤/迟到/早退标记和加班分钟，保留来源备注与 `properties.source_hr_record_no`，避免重复资料反复新增考勤行。
9. 当人工修正影响业务结果的人事记录或考勤记录时，`realtime/document-recalculation.js` 会为 `hr.document_intake_records` / `hr.attendance_records` 生成或刷新 `hr.attendance_month_recalculation_snapshots`。快照按员工与月份汇总记录数、请假数、缺勤数、迟到数、早退数和加班分钟，并记录来源修正任务。
10. 收单中心提供考勤快照列表、状态筛选和确认操作：HR 可将快照从 `pending_confirmation` 确认为 `confirmed`，也可退回为 `rejected` 并填写原因；只有已确认快照才能标记为 `payroll_precheck_status=ready`，表示进入薪资核算前置审核。后续重算刷新同一员工月份快照时，会自动回到待确认并清掉薪资前置状态。
11. `hr.v_payroll_precheck_attendance_snapshots` 将 `confirmed + ready` 的考勤快照暴露为薪资前置只读队列，包含员工月份、考勤汇总、来源文件、提交人、只读引用键和 `no_payroll_mutation=true` 标记；收单中心“薪资前置”页签和薪资复核页 `/apps/payroll-precheck-review` 都可直接查看该队列，薪资模块可按 `snapshot_id` 或 `employee_month_key` 只读引用。
12. 本阶段不直接修改 `hr.archives` 或 `hr.payroll`，避免资料导入或修正重算直接改变花名册和薪酬结果；入职、离职、调岗、绩效、培训等事件先作为正式人事记录留痕，后续可接审批或人工修正流程。
13. 行级失败不会中断整张单据；成功行写 `document_business_links`，重复业务行写重复来源链接，失败行写 `document_unmapped_fields`，计划最终状态为 `imported` / `partial` / `skipped_duplicate` / `failed`。

## 客户端日志安全

桌面采集端写入本地 SQLite 日志队列前，会统一经过 `ClientLogService.Sanitize(...)` 脱敏。默认覆盖：

1. `authorization`、`cookie`、`token`、`password`、`secret`、`access_token`、`refresh_token`、`id_token`、`api_key`、`device_token` 等键名。
2. JSON 字符串字段、普通 `key=value` / `key: value` 片段、URL query 参数。
3. `Bearer` / `Basic` 授权头。
4. 手机号与身份证号。
5. 单条文本最大保留 8192 字符，超出后追加 `[truncated]`，避免异常日志误带完整文件内容或大响应体。

脱敏在本地落库前完成，因此断网缓存期间的 `client_log_events` 本地队列也不会保存明文 token、Cookie 或授权码。

采集端内部日志 metadata 统一通过 `ClientLogMetadata.Serialize(...)` 构造，不再手写 JSON 字符串。文件夹路径、版本号、asset id 等字段即使包含引号、反斜杠或换行，也会先经过标准 JSON 转义，再进入本地日志队列。

日志上传失败时不会把本地记录标记为已上传；即使 HTTP 返回 2xx，也必须等服务端批量接口响应 `ok=true` 后才会把本批日志标记为已上传，服务端业务拒绝或响应结构异常时会保留保留期内的 pending 等待下次补传。超过远程 `logs.retention_days` 的已上传和未上传日志都会被清理；未上传日志被清理时会补写 `client_log_retention_pruned` 摘要。高优先级错误写入本地队列后会触发即时 flush。用户从托盘退出时会写入 `collector_stop`；自动更新退出会写入 `collector_update_shutdown`，两者都会在停止日志后台循环后再做最终 flush。

## 上传队列中断恢复

桌面采集端启动时会调用 `UploadQueueStore.ResetInterruptedUploadsAsync()`，把本地 SQLite 队列中上次遗留的 `uploading` 记录恢复为 `queued`，并记录 `upload_queue_recovered` 日志。

该机制覆盖：

1. 采集端上传文件时进程崩溃。
2. 自动更新安装器关闭采集端。
3. Windows 重启或用户强制退出。
4. 分片上传过程中断后下次启动继续进入重试循环。

恢复时不会删除本地文件，也不会清空 `retry_count`；服务端仍通过文件 hash / 分片 session / duplicate 检测避免重复入库。

如果同一文件此前已进入 `failed` 且 `retry_count` 达到远程配置的 `upload.maxRetryCount`，用户再次拖入该文件或监听目录再次投递同一 hash 时，采集端会复用原队列记录，将其状态重置为 `queued`、`retry_count=0`，并刷新来源目录、上传归属和文件路径。已经 `uploaded` / `duplicate` 的文件仍按重复文件跳过，避免重复正式入库。

采集端启动时也会自动补齐旧版 `upload_queue` 本地 SQLite 表缺失的来源目录、Windows 用户快照、上传人、重试次数、错误信息、上传完成时间和服务端 asset id 等列，然后再创建状态/时间与文件 hash 索引。旧客户端升级后无需清空本地上传队列，历史未完成任务会带安全默认值继续等待恢复或重试。若旧库或手工修改导致 `created_at`、`uploaded_at` 或 `next_retry_at` 不是合法时间，队列读取会分别回退为 Unix epoch 或空值；若 `status` 大小写异常会归一化，未知状态会恢复为 `failed`，非法 `retry_count` 和 `file_size` 会恢复为 0 并保留错误摘要，避免坏本地字段卡住队列显示、健康快照或上传循环。

新文件入队时会把当时的 `Environment.UserDomainName\\Environment.UserName` 写入 `windows_username`；普通上传和分片上传都会优先使用队列里的快照，而不是补传时的当前登录用户。

如果旧队列中存在重复 `file_hash`，迁移会保留一条优先记录，其余记录标记为 `ignored` 并保留在本地用于审计；缺少 `file_hash` 的旧记录也会标记为 `ignored`，等待监听目录重新扫描后重新入队，避免坏旧数据阻塞唯一索引创建和客户端启动。若旧库已有同名完整唯一索引，采集端会替换为只约束非空且未忽略记录的 partial unique index，避免历史 `ignored` 行阻止同 hash 文件重新入队。

上传失败时，采集端会按远程 `upload.retry_interval_seconds` 写入本地 `next_retry_at`；未到重试时间的 `failed` 记录不会被后台队列再次取出，避免断网期间快速消耗 `retry_count`。旧队列没有 `next_retry_at` 的失败记录仍按旧逻辑可立即重试；任务重新进入 `uploading`、上传成功或人工重新入队时会清空该字段。设备认证失败不会进入普通上传失败退避，也不会记录为上传通道离线；当前文件保持 `queued`，等待重新绑定后继续。如果上传时发现本地原文件已被移动或删除，采集端会把队列行标记为 `failed`、写入 `file_upload_failed` 日志并在左侧队列显示“本地文件缺失”，等待用户恢复文件或重新投递。心跳健康快照会把失败队列拆成可立即重试、等待退避和重试耗尽三类，并上报下一次失败任务到期时间，方便后台判断是正常等待恢复还是需要人工介入。健康快照还会统计未完成上传队列中本地原文件已不存在的数量和最早创建时间；已上传、重复和忽略的历史行不参与该统计，避免用户事后整理原始文件造成误报。上传接口网络异常、超时或临时不可用时，上传循环会记录一次 `upload_connectivity_offline`；后续任一队列文件上传成功时记录 `upload_connectivity_online`，用于日志中心判断采集端断网和恢复时间点。

采集端正常退出、自动更新安装器启动、Windows 注销/关机或后台循环停止时，如果当前文件上传被取消，队列行会立即从 `uploading` 退回 `queued`，不会增加 `retry_count`，也不会写入 `next_retry_at`；本地日志会记录 `file_upload_cancelled_requeued`。下次启动或下一轮上传循环可继续处理该文件，服务端仍通过 hash 去重避免重复入库。

左侧“上传队列”列表会把本地队列行格式化为操作员可读文本：中文状态、文件大小、来源、本地文件缺失、重试次数、下次重试时间、上传完成时间、服务端 asset id 和最近错误。该文本来自本地 SQLite 队列和本机文件存在性检查，不额外访问服务端。

上传队列会按远程 `upload.queue_retention_days` 清理已经超过保留期的本地完成记录，仅覆盖 `uploaded`、`duplicate` 和 `ignored` 状态；`queued`、`uploading`、`failed`、`pending` 以及没有上传完成时间的记录会继续保留。该清理只删除本地 SQLite 队列记录，不删除用户原始文件。

如需在测试或排障时隔离本地数据目录，可设置：

```text
EISCORE_COLLECTOR_DATA_DIR=/tmp/eiscore-collector-test
```

未设置时仍使用当前 Windows 用户 `%AppData%/EISCore/Collector`。

## 后台禁用设备

服务端设备配置响应中的 `device.status` 会同步到本地 `AppConfig.DeviceStatus`。当状态为 `disabled` 时：

1. 桌面端停止本地文件夹监听。
2. 手动拖拽/选择文件不会写入上传队列，并记录 `file_ignored` 日志。
3. 上传队列后台循环跳过文件上传。
4. 日志上传后台循环跳过远端上传，保留期内的未上传日志继续保留在本地 SQLite 队列。
5. 显式远程配置拉取会跳过，避免禁用设备继续获取后台策略。
6. 心跳仍保留为最小恢复通道；管理员在后台重新启用设备后，下一次心跳响应会带回当前配置并恢复客户端运行状态。

重新启用设备后，下一次心跳或远程配置同步会恢复监听目录；原本已排队但暂停上传的文件仍保留在本地 SQLite 队列中。

## 远程监听目录接管

采集端把服务端 `/agent/document-intake/devices/config` 返回的 `config.watchFolders` 视为后台权威配置：

1. 后台新增/修改监听目录后，下一次配置同步会刷新本地监听目录。
2. 后台禁用某个目录后，采集端不会再监听该目录。
3. 后台清空全部监听目录后，采集端会清空本地旧目录并停止监听，而不是继续沿用本机历史配置。
4. 远程目录未设置默认用户/岗位时，会回退到设备默认上传人和默认岗位。
5. 启动或重启监听时会递归扫描目录及子目录中已存在的文件并补入本地上传队列，避免采集端未运行期间放入目录的文件漏采。
6. 监听器同时处理根目录和子目录内的新增、重命名和内容变更事件；同名文件被覆盖且 hash 变化时会再次入队。若收到的是新增/重命名目录事件，会递归扫描该目录内文件，避免现场把整包资料夹拖入监听目录时只触发目录事件而漏采内部文件。
7. 启动监听前会检查目录是否存在且可访问；不可访问目录会记录 `file_watch_error` 并跳过，不影响后续正常目录启动。
8. 文件监听缓冲区提升到 64KB；监听异常或缓冲区溢出后会记录错误，并在目录仍可访问时执行恢复扫描，尽量补回漏掉的文件事件。
9. 监听事件和扫描任务在延迟入队前会再次检查当前配置；目录已被后台停用或清空时，会跳过旧目录文件并记录 `file_watch_ignored`。
10. 监听服务重启或停止时会切换内部 generation，旧的延迟任务会自动退出；事件去重缓存会在停止时清空，并在长期运行中按上限清理，避免路径缓存无限增长。

左侧“监听目录”列表会把启用但本机不存在的目录显示为 `[缺失]`，把存在但无法枚举的目录显示为 `[不可访问]`；停用目录即使路径不存在也继续显示为 `[停用]`。健康快照中的 `missingWatchFolderCount`、`accessibleWatchFolderCount` 和 `inaccessibleWatchFolderCount` 与该 UI 口径一致，都只统计启用目录。

## 智能收单中心后台 API

服务端已提供后台只读接口，供管理后台“智能收单中心”页面使用。路径经 nginx 时通常带 `/agent` 前缀。

前端入口位于应用中心系统入口卡片“智能收单中心”，路由为 `/apps/document-intake-center`；本地开发服务为 `http://127.0.0.1:8083/apps/document-intake-center`。

1. `GET /agent/document-intake/admin/overview`：今日采集文件数、成功入库、低置信度、未识别、重复、失败、待重算任务、活跃设备和离线设备。
2. `GET /agent/document-intake/admin/assets`：文件列表，支持 `status`、`deviceId/deviceCode`、`fileHash`、`uploadedBy`、`createdFrom/createdTo`、`search`、`limit`、`offset`。
3. `GET /agent/document-intake/admin/assets/<assetId>`：单文件详情，返回资产、解析任务、OCR 文本、分类理由、入库计划、业务链接、未匹配字段、业务修正记录、重算任务和关联客户端日志。
4. `GET /agent/document-intake/admin/assets/<assetId>/download`：鉴权下载原始文件，仅允许读取资料库根目录内文件。
5. `GET /agent/document-intake/admin/assets/<assetId>/preview`：鉴权预览原始文件，当前支持基础文本类文件并限制最大读取字节数。
6. `GET /agent/document-intake/admin/business-sources`：按 `businessLinkId`、`targetAppId/targetRecordId` 或 `targetSchema/targetTable/targetRecordId` 反查业务记录来源文件。
7. `GET /agent/document-intake/admin/recalculation-tasks`：重算任务列表，支持 `status`、`targetSchema/targetTable/targetRecordId`、`businessLinkId`、`correctionId`、`assetId`、`requestedBy`、`search`、`limit`、`offset`。
8. `GET /agent/document-intake/admin/devices`：采集设备列表，返回默认上传人、在线状态、监听目录数、今日采集数和日志数。
9. `GET /agent/document-intake/admin/devices/<deviceId>`：设备详情，包含监听目录配置和远程配置 metadata。
10. `POST /agent/document-intake/admin/devices`：新增采集设备，可同时写入初始监听目录；返回一次性 `authorizationCode`，服务端只保存 hash。
11. `PATCH /agent/document-intake/admin/devices/<deviceId>`：更新设备名称、默认上传人、状态、远程配置和监听目录。
12. `POST /agent/document-intake/admin/devices/<deviceId>/reset-bind-code`：重置绑定授权码，清空旧 device token，并将设备状态置为 `pending` 等待重新绑定。
13. `GET /agent/document-intake/admin/logs`：日志中心，支持按设备、用户、模块、页面、等级、事件类型、文件 hash、导入批次和 `trace_id` 筛选。

后台 API 使用普通登录 JWT，不使用采集端 device token。默认允许 `super_admin`、`admin`、`document_intake_admin`、`document_intake_manager`、`document_intake_viewer`，也支持带 `document_intake` 读/管权限的用户；可通过 `DOCUMENT_INTAKE_ADMIN_ROLES` 覆盖默认角色白名单。

写操作需要管理权限。默认允许 `super_admin`、`admin`、`document_intake_admin`、`document_intake_manager`，也支持带 `document_intake` write/manage/admin 权限的用户；可通过 `DOCUMENT_INTAKE_MANAGE_ROLES` 覆盖默认角色白名单。

## 下一步

1. 在具备 .NET SDK 与 Inno Setup 的 Windows 构建机执行真实 publish/installer 验收。
2. 在薪资模块侧基于 `hr.v_payroll_precheck_attendance_snapshots` 建立月度薪资试算/复核结果表，继续保持对 AI 快照和薪资正式结果的只读/分离边界。
3. 为设备点检异常接入 `equipment_issues` / 维保工单自动生成策略。
