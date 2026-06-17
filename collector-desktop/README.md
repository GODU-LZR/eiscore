# EISCore Windows 采集端

这是“智能收单与自动入库 Agent”的 Windows 桌面采集端 MVP。

当前实现目标：

1. WebView2 打开已配置的 EISCore 站点。
2. 本地保存服务器、设备、默认上传用户和多监听目录配置。
3. 设备绑定后使用 Windows DPAPI 加密保存 `device_token`。
4. 支持手动选择文件、窗口拖拽文件、本地目录监听入队。
5. 文件入队前等待写入稳定，计算 SHA256 hash，并写入 SQLite 队列。
6. 上传队列支持断网失败后保留、后台重试和重复 hash 跳过。
7. 采集 WebView2 导航失败、进程异常、前端 JS 错误、Promise 异常、console 错误、资源加载失败和 HTTP 错误。
8. 客户端日志先落 SQLite，本地脱敏后批量上报。
9. 支持托盘常驻、开机自启和设备心跳。
10. 支持桌面端未处理异常 dump 和下次启动后崩溃摘要上报。
11. 支持远程下发自动更新策略，下载更新包、校验 SHA256，并按策略启动安装器。

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
Inno Setup 6（发布安装器时需要）
```

## 构建运行

需要在 Windows 上安装 .NET SDK 7.x 或更高版本。

```powershell
dotnet restore .\collector-desktop\EISCore.Collector\EISCore.Collector.csproj
dotnet build .\collector-desktop\EISCore.Collector\EISCore.Collector.csproj
dotnet run --project .\collector-desktop\EISCore.Collector\EISCore.Collector.csproj
```

## 本地数据

配置、队列和日志默认写入：

```text
%AppData%\EISCore\Collector\
  collector-config.json
  collector.db
  crash-dumps\
  updates\
```

`collector-config.json` 中的 `encryptedDeviceToken` 使用当前 Windows 用户的 DPAPI 加密，换用户或换机器后不能直接复用。

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

`.json` manifest 保存异常类型、脱敏消息、脱敏堆栈、dump 路径和 dump 大小。应用下次启动时会扫描未上报 manifest，写入本地日志队列，随后通过现有日志批量上传接口上报，并生成 `.reported` 标记避免重复上报。

## 自动更新

桌面端会在启动、设备绑定后和心跳循环中检查远程更新策略。远程配置启用 `update.enabled` 且提供 `manifest_url` 后，客户端会按 `check_interval_hours` 周期拉取 manifest。

manifest 示例：

```json
{
  "version": "0.2.0",
  "download_url": "https://download.example.com/eiscore/EISCore.Collector-0.2.0.msi",
  "sha256": "64位十六进制SHA256",
  "mandatory": false,
  "auto_install": false,
  "installer_arguments": "/quiet /norestart"
}
```

客户端行为：

1. `version` 高于本地 `clientVersion` 时下载更新包到 `%AppData%\EISCore\Collector\updates\`。
2. manifest 提供 `sha256` 时必须校验通过，否则删除已下载文件并记录失败日志。
3. 下载成功后写入 `pendingUpdateVersion` 和 `pendingUpdateInstallerPath`。
4. 当远程配置 `update.auto_install = true`，或 manifest 同时声明 `mandatory = true` 与 `auto_install = true` 时，启动安装器。
5. 更新检查、下载、校验和安装器启动都会写入客户端日志队列，后续通过日志批量上报。

## 发布包与 manifest

发布脚本位于：

```text
collector-desktop/scripts/publish-collector.ps1
```

在安装 .NET SDK 的 Windows 构建机上执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -DownloadBaseUrl https://download.example.com/eiscore/collector
```

默认会生成 zip 发布包和 manifest：

```text
collector-desktop/artifacts/
  publish/EISCore.Collector-<version>-win-x64/
  packages/EISCore.Collector-<version>-win-x64.zip
  manifest/update.json
```

`update.json` 会写入版本号、下载地址、SHA256、强制更新标记、自动安装标记和安装参数。`DownloadBaseUrl` 必须是客户端可访问的绝对 URL，最终 manifest 中的 `download_url` 会自动拼上产物文件名。

如果构建机安装了 Inno Setup 6，可以同时生成 EXE 安装器，并让 manifest 指向安装器：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -DownloadBaseUrl https://download.example.com/eiscore/collector `
  -BuildInstaller `
  -AutoInstall `
  -InstallerArguments "/VERYSILENT /NORESTART /CLOSEAPPLICATIONS"
```

安装器模板位于：

```text
collector-desktop/installer/EISCore.Collector.iss
```

安装器默认安装到：

```text
%ProgramFiles%\EISCore\Collector
```

安装器支持桌面图标和开机自启安装任务；自动更新场景建议使用 `/VERYSILENT /NORESTART /CLOSEAPPLICATIONS`。

如果已经用 WiX、Inno Setup、NSIS 或其他工具生成 MSI/EXE 安装包，也可以只为安装包生成 manifest：

```powershell
powershell -ExecutionPolicy Bypass -File .\collector-desktop\scripts\publish-collector.ps1 `
  -Version 0.2.0 `
  -PackagePath .\collector-desktop\artifacts\installer\EISCore.Collector-0.2.0.msi `
  -DownloadBaseUrl https://download.example.com/eiscore/collector `
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
    "allowed_extensions": [".xlsx", ".xls", ".csv", ".docx", ".pdf", ".jpg", ".png", ".txt"]
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
4. 文件入队前会按 `max_file_bytes` 和 `allowed_extensions` 过滤。
5. 更新策略变化会清空上次检查时间，使新 manifest 地址或检查周期立即生效。

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

服务端会把上传会话写入 `document_upload_sessions`，把已收到的分片写入 `document_upload_chunks`。客户端重试同一个文件时，初始化接口会返回已上传分片编号，客户端只补传缺失分片。完成接口会按顺序合并分片，校验最终 SHA256 和文件大小后，再复用普通上传的批次、资产、解析任务创建逻辑。

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
4. 本阶段不直接写正式业务表，下一阶段由入库执行 worker 调用正式业务入口。

可配置环境变量：

```text
DOCUMENT_PLAN_WORKER_ENABLED=true
DOCUMENT_PLAN_POLL_INTERVAL_MS=10000
DOCUMENT_PLAN_MAX_TEXT_CHARS=120000
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
7. 入库完成后写 `document_business_links`，并结构化写入 `document_unmapped_fields`。

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
3. 必填项完整且主数据唯一匹配后，调用 `scm.stock_in(...)` 正式业务 RPC 生效入库，不直接写 `inventory_batches` / `inventory_transactions`。
4. `供应商`、`采购单价` 当前 RPC 没有独立参数，会写入入库备注，并同步写入 `document_unmapped_fields` 供人工复核。
5. 行级失败不会中断整张单据；成功行写 `document_business_links`，失败行写 `document_unmapped_fields`，计划最终状态为 `imported` / `partial` / `failed`。

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

## 下一步

1. 在具备 .NET SDK 与 Inno Setup 的 Windows 构建机执行真实 publish/installer 验收。
2. 继续接入质检、生产、销售等固定模块正式业务入口。
