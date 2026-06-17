# EISCore 智能收单与自动入库 Agent 需求文档

版本：v0.1 初稿
日期：2026-06-16
状态：需求讨论沉淀稿
适用项目：EISCore

## 1. 背景

工厂日常会产生大量业务资料，包括 Excel 表格、Word 文档、PDF、扫描件、照片、截图以及其他非结构化文件。这些资料通常由不同岗位人员在日常工作中产生，例如仓库、采购、销售、生产、质检、设备、人事等岗位。

当前痛点是：工厂人员需要把这些资料里的内容手工录入到系统业务单据中，录入成本高，容易遗漏，并且资料格式非常杂乱，无法依赖固定模板。

本需求目标是建设一套“智能收单与自动入库 Agent”能力，让工厂人员只需把每日资料放入采集电脑上的文件夹，或拖拽到 Windows 采集客户端中，系统自动识别资料内容、判断业务类型、拆分单据、映射字段，并把结果写入 EISCore 正式业务数据中。

## 2. 需求定位

本能力不是简单的“AI 辅助录入”，而是：

```text
无人值守自动录入，人工只做事后修改。
```

核心原则：

1. 工厂人员不做业务类型判断。
2. 工厂人员不做一张或多张单据判断。
3. 系统自动分类、自动拆单、自动字段映射、自动入库。
4. AI 录入结果可以立即参与业务统计。
5. AI 录入结果允许后续人工修改。
6. 系统必须保留来源、识别过程、入库过程和修改痕迹。

## 3. 目标

### 3.1 业务目标

1. 减少工厂人员手工录入业务单据的工作量。
2. 支持杂乱资料自动转为系统业务单据。
3. 覆盖 EISCore 各主要业务模块。
4. 支持动态业务表和固定业务表两类目标。
5. AI 自动录入的数据可被系统统计、查询、修改、审核。
6. 允许企业按场景配置自动化程度和风险策略。

### 3.2 系统目标

1. 建立统一的资料采集入口。
2. 建立统一的原始资料库。
3. 建立统一的文档解析、分类、字段抽取和入库流程。
4. 建立 AI 识别结果与业务单据之间的追溯链路。
5. 建立 Windows 采集客户端的日志采集能力。
6. 为未来知识库升级、业务 Agent 和智能统计提供基础数据。

## 4. 非目标

1. 不要求所有资料 100% 正确识别。
2. 不要求前置人工确认后才入库。
3. 不要求所有企业都使用同一固定表单模板。
4. 不要求 AI 自动新增业务字段作为默认行为。
5. 不把原始文件仅作为知识库问答资料保存，而是要形成可统计、可修改的正式业务数据。

## 5. 已确定规则

### 5.1 自动入库规则

AI 识别到目标业务单据后，默认直接写入正式业务数据，不先生成等待人工确认的草稿。

```text
资料进入系统
-> AI 自动识别
-> AI 自动归类
-> AI 自动拆单
-> AI 自动字段映射
-> AI 自动正式入库
-> 数据参与统计
-> 后续允许人工修改
```

### 5.2 业务影响规则

AI 自动录入结果允许直接影响业务结果，包括但不限于：

1. 库存数量。
2. 生产进度。
3. 工序完工。
4. 质量判定。
5. 采购统计。
6. 销售统计。
7. 人员绩效。
8. 设备记录。
9. 成本和经营报表。

### 5.3 错误修正规则

AI 录入后发现错误时，允许人工修改。

普通字段：

```text
允许直接修改原单据，记录修改日志。
```

影响类字段：

```text
允许修改，但系统要记录修正日志，并触发相关库存、统计、进度、质量结果重算。
```

影响类字段示例：

1. 入库数量。
2. 出库数量。
3. 完工数量。
4. 报废数量。
5. 合格数量。
6. 不合格数量。
7. 质检判定。
8. 工序状态。
9. 库存批次。

### 5.4 未匹配字段规则

当 AI 从资料中识别出字段，但当前目标业务表或动态应用中没有对应列时，默认处理方式为：

```text
写入备注列，并明确标明为 AI 识别出的未匹配字段。
```

备注内容建议格式：

```text
【AI未匹配字段】
包装方式：纸箱
客户特殊要求：出货前拍照确认
炉号：A-20260616-03
来源文件：外协加工单.pdf
```

系统后台仍应保留结构化副本：

```json
{
  "unmapped_fields": [
    {
      "name": "包装方式",
      "value": "纸箱",
      "confidence": 0.92,
      "source": "第1页表格"
    }
  ]
}
```

如果目标业务表没有备注列，系统应使用兜底策略：

```text
优先写入 remarks / remark / notes 等备注字段。
如果没有备注字段，则写入 properties.__ai_unmapped_fields。
界面上统一显示为“AI补充备注”。
```

### 5.5 人工判断规则

工厂人员不需要判断：

1. 资料属于哪个业务模块。
2. 资料属于哪种单据类型。
3. 一份资料应该生成一张还是多张单据。
4. 是否应拆成主单和明细。
5. 字段如何对应系统字段。

这些判断由 Agent 自动完成。

### 5.6 无法识别规则

如果系统完全无法判断目标业务类型，则不写入正式业务单据，只归档原始文件，并标记为：

```text
AI未识别，仅归档。
```

如果系统能判断目标单据，但置信度较低，可以入库并标记为：

```text
AI自动入库，低置信度。
```

企业后续可配置是否让低置信度单据参与关键统计。

## 6. EISCore 现有系统适配理解

EISCore 当前存在两类业务数据承载方式：

### 6.1 固定业务模块

包括但不限于：

1. 采购模块。
2. 销售模块。
3. 仓储/物料模块。
4. 生产模块。
5. 质量模块。
6. 设备模块。
7. 人事模块。
8. 决策模块。

这些模块拥有相对固定的业务表和业务流程。

### 6.2 动态业务应用

EISCore 支持通过 `app_center.apps.config.columns` 配置动态字段，并在 `app_data` schema 中创建实际数据表。

动态业务表具有以下特点：

1. 字段可动态新增。
2. 字段配置保存在应用配置中。
3. 数据表可以通过系统能力自动创建和扩展。
4. 字段语义会同步到系统语义体系。
5. 统计、公式、全量汇总和 AI 查询围绕这些字段工作。

因此，文档转单据能力必须支持：

```text
固定模块业务表 + 动态 app_data 业务表。
```

### 6.3 动态表入库原则

对于动态业务表，AI 不能硬编码字段结构，而应读取目标应用当前配置：

```text
目标应用 columns 配置
-> 作为目标字段契约
-> AI 按当前字段结构生成入库 payload
-> 已匹配字段写入对应列
-> 未匹配字段写入备注或 properties
```

这样 AI 录入结果才能自然进入 EISGrid、统计、公式、全量汇总和智能查询能力。

## 7. 产品形态

### 7.1 Windows 采集客户端

需要开发一个 Windows 端采集客户端。

推荐技术形态：

```text
.NET / WPF / WinUI + WebView2
```

客户端表面上像一个浏览器套壳，默认打开 EISCore 网站，但它应具备本地能力：

1. 管理员配置服务器域名、IP、端口。
2. 默认打开配置后的 EISCore 网站。
3. 用户可拖拽多模态文件上传。
4. 支持后台监听本地文件夹。
5. 支持文件 hash 计算。
6. 支持本地上传队列。
7. 支持断网重试。
8. 支持大文件分片上传。
9. 支持开机自启。
10. 支持托盘常驻。
11. 支持客户端日志收集。
12. 支持设备身份绑定。
13. 支持默认上传用户绑定。

### 7.2 服务端智能收单中心

服务端需要提供统一的智能收单中心，负责：

1. 接收采集端上传的原始文件。
2. 建立导入批次。
3. 去重。
4. OCR 和文件解析。
5. 文档分类。
6. 单据类型识别。
7. 一张或多张单据判断。
8. 主单和明细判断。
9. 字段映射。
10. 主数据匹配。
11. 业务入库。
12. 原始文件归档。
13. 追溯记录。
14. 入库结果查看。

### 7.3 系统管理端

管理员需要能够配置：

1. 采集设备。
2. 设备默认上传人。
3. 设备默认岗位。
4. 监听文件夹。
5. 服务器地址。
6. 设备授权码。
7. 自动入库策略。
8. 低置信度策略。
9. 日志采集策略。
10. 文件保留策略。
11. 单据类型映射策略。

## 8. 采集端需求

### 8.1 设备绑定

每台采集电脑需要绑定一个设备身份。

设备字段建议：

```text
device_id
device_name
device_code
enterprise_id
department_id
default_role
default_user_id
default_username
server_base_url
client_version
webview_version
status
last_seen_at
created_at
updated_at
```

设备首次绑定时，管理员输入：

1. 服务器地址。
2. 企业编号或租户标识。
3. 设备名称。
4. 设备角色。
5. 设备授权码。
6. 默认上传用户。
7. 监听目录。

绑定成功后，客户端保存 `device_token`，后续上传使用设备身份认证。

### 8.2 上传用户识别

采集端上传文件时必须附带用户信息。

需要区分三种身份：

```text
设备身份：哪台电脑上传的。
用户身份：归属哪个系统用户或岗位。
系统执行者：AI/采集 Agent 自动完成入库。
```

上传元信息示例：

```json
{
  "device_id": "warehouse-pc-01",
  "device_name": "仓库电脑01",
  "upload_source": "watch_folder",
  "uploaded_by_user_id": "u_123",
  "uploaded_by_username": "zhangsan",
  "uploaded_by_role": "仓库员",
  "windows_username": "DESKTOP-01\\Admin",
  "operator_source": "device_default_user",
  "file_hash": "sha256...",
  "original_filename": "送货单.jpg"
}
```

`operator_source` 取值建议：

```text
web_login_user        当前网页登录用户拖拽上传
device_default_user   采集端绑定的默认责任人
folder_binding_user   某个监听文件夹绑定的责任人
manual_selected_user  管理员手动指定
unknown               无法确认
```

默认策略：

1. 网页登录状态下拖拽上传，使用当前登录用户。
2. 后台监听文件夹上传，使用采集端绑定的默认责任人。
3. 无法识别用户时，允许入库，但标记为未知上传人，并归到设备默认岗位。

### 8.3 拖拽上传

客户端内嵌网页应支持拖拽上传：

1. Excel。
2. Word。
3. PDF。
4. 图片。
5. 截图。
6. 文本。
7. 压缩包。

拖拽上传时，前端页面可直接显示上传进度和入库状态。

### 8.4 文件夹监听

客户端应支持后台监听一个或多个本地目录。

监听规则：

1. 新文件进入目录后，等待文件写入稳定再处理。
2. 计算文件 hash。
3. 写入本地上传队列。
4. 上传成功后标记状态。
5. 上传失败后自动重试。
6. 重复文件不重复上传或不重复入库。

文件夹不能作为业务分类的唯一依据，只能作为弱上下文。即使文件来自仓库电脑，如果内容明显是质检资料，也应归入质检业务。

### 8.5 本地队列

客户端需要本地队列，建议使用 SQLite。

队列字段建议：

```text
id
file_path
original_filename
file_hash
file_size
mime_type
upload_source
device_id
uploaded_by_user_id
status
retry_count
last_error
created_at
uploaded_at
server_asset_id
```

状态建议：

```text
pending
hashing
queued
uploading
uploaded
failed
duplicate
ignored
```

## 9. 前端和客户端日志采集需求

### 9.1 日志目标

采集端需要收集套壳浏览器中的前端错误日志以及其他客户端日志，用于排查：

1. 页面白屏。
2. 前端 JS 异常。
3. 接口请求失败。
4. 文件上传失败。
5. WebView 崩溃。
6. 断网和重连。
7. 文件夹监听异常。
8. AI 自动入库失败。
9. 某台电脑长时间未上传资料。

### 9.2 日志来源

日志分三层：

```text
1. WebView2 原生层日志
2. 注入脚本日志
3. 前端应用 SDK 日志
```

WebView2 原生层日志：

1. 客户端启动。
2. 服务器地址配置。
3. 页面导航失败。
4. WebView 进程失败。
5. 网络响应异常。
6. 本地文件队列状态。
7. 上传任务状态。
8. 文件夹监听状态。

注入脚本日志：

1. `window.onerror`。
2. `unhandledrejection`。
3. `console.error`。
4. `console.warn`。
5. 资源加载失败。
6. fetch 异常。
7. XMLHttpRequest 异常。

前端应用 SDK 日志：

1. Vue `errorHandler`。
2. axios 拦截器错误。
3. 路由错误。
4. 用户操作事件。
5. 当前模块。
6. 当前页面。
7. 当前登录用户。

### 9.3 日志字段

日志事件字段建议：

```text
id
level
event_type
message
stack
device_id
device_name
user_id
username
role
app_module
route
url
request_url
status_code
client_session_id
trace_id
ai_import_batch_id
source_file_hash
app_version
webview_version
created_at
metadata
```

事件类型建议：

```text
js_error
vue_error
promise_error
console_error
console_warn
http_error
resource_error
webview_navigation_error
webview_process_failed
file_watch_error
file_upload_failed
collector_start
collector_stop
collector_heartbeat
```

### 9.4 日志上传

日志上传规则：

1. 本地先落队列。
2. 批量上传。
3. 断网时缓存。
4. 恢复网络后补传。
5. 高优先级错误立即上传。
6. 普通日志按批次上传。
7. 客户端保留最近一段时间日志。

### 9.5 日志脱敏

客户端上传日志前必须脱敏：

1. 不上传密码。
2. 不上传 token。
3. 不上传 Cookie。
4. 不上传 Authorization header。
5. 不上传完整文件内容。
6. URL query 中的敏感参数要过滤。
7. 手机号、身份证号等可按企业配置脱敏。

## 10. 服务端智能收单流程

### 10.1 总流程

```text
采集端上传文件
-> 创建导入批次
-> 保存原始文件
-> 文件去重
-> 解析任务入队
-> OCR/表格/文档解析
-> 文档分类
-> 单据类型判断
-> 一张/多张/主从明细判断
-> 字段抽取
-> 主数据匹配
-> 未匹配字段写入备注
-> 调用正式业务入库逻辑
-> 记录业务单据链接
-> 归档原始文件
-> 生成追溯记录
```

### 10.2 原始资料库

所有上传资料都应先进入原始资料库。

原始资料字段建议：

```text
id
batch_id
device_id
uploaded_by_user_id
uploaded_by_username
operator_source
original_filename
storage_path
mime_type
file_ext
file_size
file_hash
source_folder
upload_source
status
created_at
updated_at
metadata
```

### 10.3 导入批次

一次拖拽上传或一次文件夹扫描可形成一个导入批次。

批次字段建议：

```text
id
batch_no
device_id
uploaded_by_user_id
source
file_count
success_count
partial_count
failed_count
duplicate_count
status
started_at
finished_at
metadata
```

批次状态建议：

```text
created
uploading
uploaded
parsing
classifying
importing
completed
partial
failed
```

### 10.4 文件去重

需要两层去重：

1. 文件级去重：根据 file_hash 判断是否同一文件。
2. 业务级去重：根据单号、日期、供应商、客户、物料、数量、批次等关键字段判断是否已生成过业务单据。

重复文件默认不重复生成正式业务单据，只记录重复来源。

## 11. AI 识别与入库计划

### 11.1 入库计划

Agent 不应只输出字段，还应先生成内部入库计划，然后自动执行。

入库计划示例：

```json
{
  "target_module": "materials",
  "target_document_type": "采购入库单",
  "target_kind": "fixed_module_table",
  "mode": "one_document_with_lines",
  "document_count": 1,
  "line_count": 12,
  "confidence": 0.91,
  "reason": "识别到供应商、送货单号、物料明细和入库数量",
  "documents": []
}
```

### 11.2 单据数量判断

Agent 需要自动判断：

1. 一份资料生成一张单据。
2. 一份资料生成多张单据。
3. 一份资料生成一张主单和多行明细。
4. 一份资料生成多种业务单据。
5. 多个文件合并生成一张单据。

判断依据：

1. 单号。
2. 供应商。
3. 客户。
4. 日期。
5. 批次。
6. 车间。
7. 负责人。
8. 业务主题。
9. 表格行结构。
10. 文件内容语义。

### 11.3 目标类型

目标类型分为：

```text
fixed_module_table  固定业务模块表
data_app            动态业务应用表
```

对于 `data_app`，入库计划必须包含：

```text
app_id
app_name
schema
table_name
columns_snapshot
```

### 11.4 字段映射

字段映射应支持：

1. 字段名相似匹配。
2. 别名匹配。
3. 中文语义匹配。
4. 业务语义匹配。
5. 选项值归一化。
6. 日期格式归一化。
7. 数量和单位归一化。
8. 主数据匹配。
9. 未匹配字段写备注。

### 11.5 主数据匹配

需要匹配的主数据包括但不限于：

1. 物料。
2. 供应商。
3. 客户。
4. 仓库。
5. 库区。
6. 库位。
7. 员工。
8. 设备。
9. 工序。
10. 产品。
11. 批次。

如果存在多个候选，系统可以选择最高置信度候选并保留候选列表。

## 12. 业务入库要求

### 12.1 不直接绕过业务逻辑

AI 识别结果不应随意直接写底层表。

要求优先走和人工录入一致的业务入口：

1. 现有保存接口。
2. 业务 RPC。
3. 工作流入口。
4. 库存变更逻辑。
5. 状态流转逻辑。

这样可以保证：

1. 权限一致。
2. 库存影响一致。
3. 统计一致。
4. 工作流一致。
5. 日志一致。
6. 公式和汇总一致。

### 12.2 AI 来源标记

每张 AI 生成的业务单据都需要标记：

```text
ai_generated
ai_source_asset_id
ai_import_batch_id
ai_source_device_id
ai_uploaded_by_user_id
ai_confidence
ai_parse_status
ai_review_status
ai_unmapped_fields
ai_trace_id
```

建议 `ai_review_status` 取值：

```text
unreviewed
reviewed
corrected
ignored
```

### 12.3 业务归属

AI 自动生成的业务单据应有清晰归属：

```text
created_by / owner_user     业务归属人
ai_system_actor             collector_agent
ai_uploaded_by_user_id      上传归属用户
ai_source_device_id         采集设备
```

业务上看，这张单据属于某个员工或岗位；系统上看，它由 AI 采集 Agent 自动生成。

## 13. 数据模型建议

以下为候选表设计，后续需要结合现有 schema 命名调整。

### 13.1 采集设备

```text
collector_devices
```

用途：记录 Windows 采集端设备。

核心字段：

```text
id
device_code
device_name
enterprise_id
department_id
default_user_id
default_role
server_base_url
device_token_hash
client_version
status
last_seen_at
metadata
created_at
updated_at
```

### 13.2 设备监听目录

```text
collector_watch_folders
```

用途：记录设备上的监听目录及默认归属。

核心字段：

```text
id
device_id
folder_path
folder_name
default_user_id
default_role
enabled
metadata
created_at
updated_at
```

### 13.3 原始文件

```text
document_assets
```

用途：保存上传的原始资料元数据和存储位置。

### 13.4 导入批次

```text
document_import_batches
```

用途：记录一次拖拽上传或文件夹采集批次。

### 13.5 解析任务

```text
document_parse_jobs
```

用途：记录 OCR、表格解析、文档解析任务。

### 13.6 解析结果

```text
document_parse_results
```

用途：保存文本、表格、版面结构、OCR 结果、图片描述等。

### 13.7 分类结果

```text
document_classification_results
```

用途：保存模块判断、单据类型判断、置信度和理由。

### 13.8 入库计划

```text
document_entry_plans
```

用途：保存 Agent 生成的一张或多张业务单据入库计划。

### 13.9 业务单据链接

```text
document_business_links
```

用途：记录原始资料和最终业务单据之间的关系。

核心字段：

```text
id
asset_id
batch_id
entry_plan_id
target_schema
target_table
target_record_id
target_module
target_document_type
target_app_id
ai_confidence
created_at
metadata
```

### 13.10 未匹配字段

```text
document_unmapped_fields
```

用途：结构化保存写入备注的未匹配字段，便于后续字段升级和历史回填。

### 13.11 业务修正记录

```text
ai_business_corrections
```

用途：记录 AI 单据被人工修改后的修正痕迹，以及是否触发重算。

### 13.12 客户端日志

```text
client_log_sessions
client_log_events
```

用途：记录采集端、WebView、前端页面、上传队列、文件监听等日志。

## 14. 管理后台需求

需要提供一个“智能收单中心”页面。

### 14.1 总览

展示：

1. 今日采集文件数。
2. 成功入库数量。
3. 低置信度数量。
4. 未识别数量。
5. 重复文件数量。
6. 失败数量。
7. 活跃采集设备数量。
8. 离线采集设备数量。

### 14.2 文件列表

每个文件展示：

1. 原始文件名。
2. 来源设备。
3. 上传用户。
4. 上传时间。
5. 文件类型。
6. 识别状态。
7. 目标业务类型。
8. 生成单据数量。
9. 置信度。
10. 是否重复。
11. 操作入口。

### 14.3 入库结果

支持查看：

1. 原始文件。
2. OCR 文本。
3. AI 判断理由。
4. 字段映射结果。
5. 未匹配字段。
6. 生成的业务单据。
7. 入库日志。
8. 修改记录。

### 14.4 设备管理

支持：

1. 新增设备。
2. 禁用设备。
3. 重置设备授权码。
4. 配置默认上传人。
5. 配置监听文件夹。
6. 查看设备在线状态。
7. 查看设备日志。

### 14.5 日志中心

支持按以下维度筛选：

1. 设备。
2. 用户。
3. 模块。
4. 页面。
5. 错误等级。
6. 事件类型。
7. 文件 hash。
8. 导入批次。
9. trace_id。

## 15. 配置项

### 15.1 企业级配置

```text
enable_ai_document_intake
default_auto_import_mode
low_confidence_policy
unrecognized_file_policy
duplicate_file_policy
unmapped_field_policy
business_correction_policy
log_collection_enabled
log_retention_days
source_file_retention_days
```

### 15.2 单据类型配置

每类单据需要配置：

```text
document_type_code
document_type_name
target_kind
target_module
target_schema
target_table
target_app_id
required_fields
grouping_fields
line_item_fields
master_data_match_rules
unmapped_field_policy
auto_import_enabled
confidence_threshold
low_confidence_behavior
business_effect_level
```

### 15.3 字段映射配置

字段映射配置包括：

```text
target_field
target_label
aliases
data_type
required
default_value
normalization_rule
option_mapping
master_data_type
write_location
```

`write_location` 取值建议：

```text
column
properties
remarks
ignore
```

## 16. 权限和安全

### 16.1 设备权限

设备必须通过授权码绑定。

设备禁用后：

1. 不允许上传文件。
2. 不允许上传日志。
3. 不允许获取远程配置。

### 16.2 用户权限

上传用户用于业务归属和追溯，但自动入库执行者应是系统 Agent。

系统需要判断：

1. 该设备是否允许上传。
2. 该默认用户是否有效。
3. 目标业务类型是否允许 AI 自动入库。
4. 目标业务表是否允许写入。

### 16.3 数据安全

1. 原始文件需要权限控制。
2. 日志需要脱敏。
3. 设备 token 不应明文存储。
4. 客户端本地队列中的敏感信息应尽量减少。
5. 文件下载和预览需要鉴权。

## 17. 与知识库升级的关系

当前 EISCore 已有知识库能力，主要用于个人数字孪生和知识问答。

本需求不是简单扩展知识库上传，而是把资料处理升级为：

```text
原始资料库 + 文档智能解析 + 业务单据入库 + 知识检索 + 追溯审计。
```

原始文件和解析结果可以进入知识体系，但最终价值是形成正式业务数据。

知识库后续可使用这些数据：

1. 查询原始资料。
2. 回答某张单据来源。
3. 分析某类资料识别质量。
4. 辅助字段升级。
5. 辅助业务统计解释。

## 18. 状态设计

### 18.1 文件状态

```text
uploaded
duplicate
queued
parsing
parsed
classified
importing
imported
partial_imported
unrecognized
failed
archived
```

### 18.2 解析任务状态

```text
pending
running
success
partial
failed
cancelled
```

### 18.3 入库状态

```text
planned
importing
imported
partial
failed
skipped_duplicate
archived_only
```

### 18.4 复核状态

```text
unreviewed
reviewed
corrected
ignored
```

## 19. 阶段边界

本需求属于 EISCore 后续建设的第一阶段主线，优先解决客户工厂现场资料自动进入业务系统的问题。

第一阶段名称：

```text
智能收单与自动入库 Agent
```

第一阶段范围：

1. Windows 采集客户端。
2. 文件拖拽上传。
3. 文件夹无人值守监听。
4. 原始资料库。
5. OCR、表格、文档和图片解析。
6. Agent 自动识别业务模块和单据类型。
7. Agent 自动判断一张、多张、主从明细。
8. 自动写入 EISCore 正式业务表。
9. 未匹配字段写入备注。
10. AI 来源、设备、用户、日志和追溯。

第二阶段规划为：

```text
Agent 实施贯标运维系统
```

第二阶段负责 EISCore 自身从商务、售前、调研、合同、实施、二次开发、验收、售后到维护的交付全生命周期管理。

两者关系：

```text
第一阶段：交付给客户现场使用的业务自动化能力。
第二阶段：支撑 EISCore 团队快速交付、配置和维护客户系统的交付管理能力。
```

第一阶段不要求先完成第二阶段，但第一阶段产生的智能收单配置、模板、日志和验收经验，未来可以被第二阶段复用。

## 20. MVP 建议

### 20.1 MVP 1：拖拽上传闭环

目标：先跑通“拖拽上传到自动入库”的闭环。

范围：

1. Windows WebView2 客户端。
2. 服务器地址配置。
3. 设备绑定。
4. 当前登录用户拖拽上传。
5. 原始文件保存。
6. 文件 hash 去重。
7. OCR/Excel/Word/PDF 基础解析。
8. AI 判断业务类型。
9. AI 判断一张或多张单据。
10. 动态应用表入库。
11. 未匹配字段写备注。
12. AI 来源标记。
13. 基础日志采集。

### 20.2 MVP 2：无人值守文件夹采集

目标：实现无人值守文件夹采集。

范围：

1. 本地文件夹监听。
2. 本地 SQLite 上传队列。
3. 断网重试。
4. 后台上传。
5. 默认上传用户绑定。
6. 低置信度标记。
7. 智能收单中心列表。
8. 入库追溯页面。

### 20.3 MVP 3：企业级可运维能力

目标：形成企业级可运维能力。

范围：

1. 开机自启。
2. 托盘常驻。
3. 自动更新。
4. 设备远程配置。
5. 客户端日志中心。
6. WebView 崩溃日志。
7. 前端 JS 错误上报。
8. 业务修正记录。
9. 影响类字段重算。
10. 多模块单据类型配置。

## 21. 验收标准

### 21.1 自动采集

1. 用户可通过 Windows 采集客户端拖拽文件上传。
2. 客户端可监听指定文件夹并自动上传新增文件。
3. 文件重复上传时，系统可以识别重复。
4. 断网后恢复网络，文件可以继续上传。

### 21.2 自动识别

1. 系统能识别常见 Excel、Word、PDF、图片资料。
2. 系统能判断资料所属业务模块。
3. 系统能判断资料所属单据类型。
4. 系统能判断一张、多张、主从明细结构。
5. 无法识别资料时只归档不入库。

### 21.3 自动入库

1. 能匹配字段正常写入业务表。
2. 未匹配字段写入备注并标明。
3. AI 自动入库数据可参与系统统计。
4. AI 自动入库数据可被人工修改。
5. AI 自动入库数据有来源标记。

### 21.4 追溯

1. 能从业务单据查看来源文件。
2. 能从来源文件查看生成的业务单据。
3. 能查看 AI 判断理由和字段映射结果。
4. 能查看上传设备和上传用户。
5. 能查看修改记录和修正记录。

### 21.5 日志

1. 能采集前端 JS 错误。
2. 能采集 WebView 导航和崩溃错误。
3. 能采集上传失败日志。
4. 能按设备、用户、批次、trace_id 查询日志。
5. 日志上传前完成敏感信息脱敏。

## 22. 当前待确认问题

1. 第一批试点业务模块选择哪些，建议从仓库、质检、生产日报中选 1 到 2 个。
2. 原始文件存储使用数据库、对象存储、文件系统，还是混合方案。
3. AI 自动入库是否需要按企业、模块、单据类型设置不同置信度阈值。
4. 影响类字段重算优先接入哪些业务流程。
5. Windows 客户端是否需要自动更新机制。
6. 客户端日志保留周期和服务端日志保留周期。
7. 设备授权码由系统生成还是管理员手工录入。
8. 动态业务表中没有备注列时，是否统一创建系统备注字段，还是只写 properties。

## 23. 一句话总结

本需求要建设的是 EISCore 的“无人值守智能收单系统”：每台 Windows 采集电脑负责接收工厂杂乱资料，服务端 Agent 自动理解资料、归类、拆单、映射字段并正式入库，数据立即参与业务统计，同时保留来源、日志、修正和追溯能力。
