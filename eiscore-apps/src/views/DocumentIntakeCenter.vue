<template>
  <div class="document-intake-center">
    <header class="page-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div class="header-text">
          <h2>智能收单中心</h2>
          <p>采集文件、入库结果、采集设备与客户端日志统一追溯</p>
        </div>
      </div>
      <div class="header-actions">
        <el-tag effect="plain">{{ lastLoadedAtText }}</el-tag>
        <el-button :icon="Refresh" :loading="loadingAny" @click="reloadAll">刷新</el-button>
      </div>
    </header>

    <section class="metric-row">
      <article v-for="item in overviewCards" :key="item.key" class="metric-card" :class="item.tone">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value">{{ item.value }}</div>
        <div class="metric-note">{{ item.note }}</div>
      </article>
    </section>

    <section class="policy-strip">
      <article v-for="item in policyCards" :key="item.key" class="policy-card">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </article>
      <button type="button" class="policy-action" @click="openPolicyDialog">
        <el-icon><Setting /></el-icon>
        <span>配置策略</span>
      </button>
    </section>

    <section class="center-shell">
      <aside class="center-nav" aria-label="智能收单中心导航">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="nav-item"
          :class="{ active: activeView === item.key }"
          @click="activeView = item.key"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span class="nav-copy">
            <span>{{ item.title }}</span>
            <small>{{ item.desc }}</small>
          </span>
          <strong>{{ item.metric }}</strong>
        </button>
      </aside>

      <main class="center-stage">
        <section v-show="activeView === 'assets'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>文件列表</h3>
              <p>按设备、状态、文件 hash 和上传人查看采集文件</p>
            </div>
            <el-tag effect="plain">{{ assets.total }} 条</el-tag>
          </div>

          <div class="filter-strip">
            <el-select v-model="assetFilters.status" clearable placeholder="识别状态" class="filter-small">
              <el-option label="已上传" value="uploaded" />
              <el-option label="排队" value="queued" />
              <el-option label="解析中" value="parsing" />
              <el-option label="已解析" value="parsed" />
              <el-option label="已分类" value="classified" />
              <el-option label="入库中" value="importing" />
              <el-option label="已入库" value="imported" />
              <el-option label="部分入库" value="partial_imported" />
              <el-option label="未识别" value="unrecognized" />
              <el-option label="重复" value="duplicate" />
              <el-option label="失败" value="failed" />
              <el-option label="已归档" value="archived" />
            </el-select>
            <el-select v-model="assetFilters.duplicate" clearable placeholder="重复状态" class="filter-small">
              <el-option label="重复" value="true" />
              <el-option label="非重复" value="false" />
            </el-select>
            <el-select v-model="assetFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="assetFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-input v-model="assetFilters.targetModule" clearable placeholder="目标模块" class="filter-small" />
            <el-input v-model="assetFilters.targetDocumentType" clearable placeholder="目标单据类型" class="filter-small" />
            <el-input v-model="assetFilters.deviceCode" clearable placeholder="设备编号" class="filter-small" />
            <el-input v-model="assetFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="assetFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-input v-model="assetFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="assetFilters.fileHash" clearable placeholder="文件 hash" class="filter-small" />
            <el-input v-model="assetFilters.search" clearable placeholder="文件名 / 关键词" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="assets.loading" @click="loadAssets">查询</el-button>
            <el-button :disabled="assets.loading" @click="resetAssetFiltersAndLoad">重置</el-button>
          </div>

          <el-table
            v-loading="assets.loading"
            :data="assets.items"
            size="small"
            border
            empty-text="暂无采集文件"
          >
            <el-table-column label="原始文件" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.originalFilename }}</span>
                  <small>{{ row.mimeType || row.fileExt || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
                  <small>{{ row.sourceFolder || row.deviceCode || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源" min-width="136" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadSourceText(row.uploadSource) }}</span>
                  <small>{{ operatorSourceText(row.operatorSource) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传用户" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="批次" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.batchNo || row.batchId || '-' }}</span>
                  <small>{{ batchStatusText(row.batchStatus) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传时间" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.uploadedAt) }}</template>
            </el-table-column>
            <el-table-column label="识别状态" min-width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="assetStatusType(row.status)" effect="plain">
                  {{ assetStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="是否重复" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <el-tag size="small" :type="row.duplicate ? 'warning' : 'success'" effect="plain">
                    {{ row.duplicate ? '重复' : '非重复' }}
                  </el-tag>
                  <small v-if="row.duplicate">{{ duplicateOriginText(row) }}</small>
                  <small v-if="duplicateOriginMetaText(row)">{{ duplicateOriginMetaText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="复核" min-width="110">
              <template #default="{ row }">
                <el-tag v-if="row.reviewStatus" size="small" :type="reviewStatusType(row.reviewStatus)" effect="plain">
                  {{ reviewStatusText(row.reviewStatus) }}
                </el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column label="目标业务" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.targetDocumentType || '-' }}</span>
                  <small>{{ row.targetModule || row.targetKind || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="generatedDocumentCount" label="单据" width="82" align="right" />
            <el-table-column label="置信度" width="110">
              <template #default="{ row }">{{ formatPercent(row.confidence) }}</template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="92">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="openAssetDetail(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="assetPage"
              v-model:page-size="assetPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="assets.total"
              @current-change="loadAssets"
              @size-change="loadAssets"
            />
          </div>
        </section>

        <section v-show="activeView === 'devices'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>设备管理</h3>
              <p>维护采集设备、默认上传人、监听目录和重新绑定授权码</p>
            </div>
            <div class="panel-actions">
              <el-tag effect="plain">{{ devices.total }} 台</el-tag>
              <el-button type="primary" :icon="Plus" @click="openDeviceCreate">新增设备</el-button>
            </div>
          </div>

          <div class="filter-strip">
            <el-select v-model="deviceFilters.status" clearable placeholder="设备状态" class="filter-small">
              <el-option label="待绑定" value="pending" />
              <el-option label="活跃" value="active" />
              <el-option label="离线" value="offline" />
              <el-option label="禁用" value="disabled" />
            </el-select>
            <el-select v-model="deviceFilters.onlineStatus" clearable placeholder="在线状态" class="filter-small">
              <el-option label="在线" value="active" />
              <el-option label="离线" value="offline" />
              <el-option label="禁用" value="disabled" />
            </el-select>
            <el-select v-model="deviceFilters.healthIssue" clearable placeholder="健康异常" class="filter-small">
              <el-option label="任意异常" value="any" />
              <el-option label="上传积压" value="upload_backlog" />
              <el-option label="日志积压" value="log_backlog" />
              <el-option label="目录缺失" value="missing_watch_folder" />
              <el-option label="目录不可访问" value="inaccessible_watch_folder" />
            </el-select>
            <el-input v-model="deviceFilters.clientVersion" clearable placeholder="客户端版本" class="filter-small" />
            <el-input v-model="deviceFilters.webviewVersion" clearable placeholder="WebView 版本" class="filter-small" />
            <el-input v-model="deviceFilters.defaultUser" clearable placeholder="默认上传人" class="filter-small" />
            <el-input v-model="deviceFilters.defaultRole" clearable placeholder="默认岗位" class="filter-small" />
            <el-input v-model="deviceFilters.lastSeenFrom" clearable placeholder="心跳开始" class="filter-small" />
            <el-input v-model="deviceFilters.lastSeenTo" clearable placeholder="心跳结束" class="filter-small" />
            <el-input v-model="deviceFilters.search" clearable placeholder="设备编号 / 名称 / 上传人" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="devices.loading" @click="loadDevices">查询</el-button>
            <el-button :disabled="devices.loading" @click="resetDeviceFiltersAndLoad">重置</el-button>
          </div>

          <el-table v-loading="devices.loading" :data="devices.items" size="small" border empty-text="暂无采集设备">
            <el-table-column label="设备" min-width="210" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName }}</span>
                  <small>{{ row.deviceCode }} / {{ row.enterpriseId }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="在线" width="94">
              <template #default="{ row }">
                <el-tag size="small" :type="deviceStatusType(row.onlineStatus)" effect="plain">
                  {{ deviceStatusText(row.onlineStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="版本" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.clientVersion || '-' }}</span>
                  <small>{{ row.webviewVersion || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="健康" min-width="180">
              <template #default="{ row }">
                <div v-if="deviceHealthTags(row.healthSummary).length" class="tag-stack">
                  <el-tag
                    v-for="tag in deviceHealthTags(row.healthSummary)"
                    :key="tag.key"
                    size="small"
                    :type="tag.type"
                    effect="plain"
                    :class="{ 'diagnostic-tag': deviceHealthTagActionable(tag) }"
                    @click="viewDeviceHealthIssueLogs(row, tag)"
                  >
                    {{ tag.label }}
                  </el-tag>
                </div>
                <span v-else class="muted-text">正常</span>
              </template>
            </el-table-column>
            <el-table-column label="默认上传人" min-width="150">
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.defaultUsername || '-' }}</span>
                  <small>{{ row.defaultUserId || '-' }} / {{ row.defaultRole || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="目录" width="76" align="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="primary"
                  :aria-label="`查看监听目录 ${row.watchFolderCount || 0}`"
                  @click="viewDeviceWatchFolders(row)"
                >
                  {{ row.watchFolderCount || 0 }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="今日文件" width="98" align="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="primary"
                  :aria-label="`查看今日文件 ${row.todayFileCount || 0}`"
                  @click="viewDeviceAssets(row)"
                >
                  {{ row.todayFileCount || 0 }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="日志" width="76" align="right">
              <template #default="{ row }">
                <el-button
                  text
                  type="primary"
                  :aria-label="`查看设备日志 ${row.logCount || 0}`"
                  @click="viewDeviceLogs(row)"
                >
                  {{ row.logCount || 0 }}
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="最近心跳" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.lastSeenAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="222">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="viewDeviceLogs(row)">日志</el-button>
                <el-button size="small" text type="primary" @click="openDeviceEdit(row)">编辑</el-button>
                <el-button size="small" text type="warning" @click="resetDeviceBindCode(row)">重置授权码</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="devicePage"
              v-model:page-size="devicePageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="devices.total"
              @current-change="loadDevices"
              @size-change="loadDevices"
            />
          </div>
        </section>

        <section v-show="activeView === 'logs'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>日志中心</h3>
              <p>按设备、用户、页面、错误等级、批次、会话和 trace 追踪客户端事件</p>
            </div>
            <el-tag effect="plain">{{ logs.total }} 条</el-tag>
          </div>

          <div class="filter-strip log-filter">
            <el-select v-model="logFilters.level" clearable placeholder="等级" class="filter-small">
              <el-option label="error" value="error" />
              <el-option label="warn" value="warn" />
              <el-option label="info" value="info" />
            </el-select>
            <el-input v-model="logFilters.deviceCode" clearable placeholder="设备编号" class="filter-small" />
            <el-input v-model="logFilters.username" clearable placeholder="用户ID / 用户名" class="filter-small" />
            <el-input v-model="logFilters.role" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-input v-model="logFilters.appModule" clearable placeholder="模块" class="filter-small" />
            <el-input v-model="logFilters.route" clearable placeholder="页面 / 路由" class="filter-small" />
            <el-input v-model="logFilters.eventType" clearable placeholder="事件类型" class="filter-small" />
            <el-input v-model="logFilters.batchNo" clearable placeholder="批次号" class="filter-small" />
            <el-input v-model="logFilters.fileHash" clearable placeholder="文件 hash" class="filter-small" />
            <el-select v-model="logFilters.assetStatus" clearable placeholder="资产状态" class="filter-small">
              <el-option label="已上传" value="uploaded" />
              <el-option label="排队" value="queued" />
              <el-option label="解析中" value="parsing" />
              <el-option label="已解析" value="parsed" />
              <el-option label="已分类" value="classified" />
              <el-option label="入库中" value="importing" />
              <el-option label="已入库" value="imported" />
              <el-option label="部分入库" value="partial_imported" />
              <el-option label="未识别" value="unrecognized" />
              <el-option label="重复" value="duplicate" />
              <el-option label="失败" value="failed" />
              <el-option label="已归档" value="archived" />
            </el-select>
            <el-input v-model="logFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="logFilters.uploadedByRole" clearable placeholder="上传岗位" class="filter-small" />
            <el-select v-model="logFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="logFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-select v-model="logFilters.duplicate" clearable placeholder="重复状态" class="filter-small">
              <el-option label="重复" value="true" />
              <el-option label="非重复" value="false" />
            </el-select>
            <el-input v-model="logFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="logFilters.clientSessionId" clearable placeholder="会话 ID" class="filter-small" />
            <el-input v-model="logFilters.traceId" clearable placeholder="trace_id" class="filter-small" />
            <el-input v-model="logFilters.search" clearable placeholder="消息 / 页面 / URL" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="logs.loading" @click="loadLogs">查询</el-button>
            <el-button :disabled="logs.loading" @click="resetLogFiltersAndLoad">重置</el-button>
          </div>

          <el-table v-loading="logs.loading" :data="logs.items" size="small" border empty-text="暂无客户端日志">
            <el-table-column type="expand" width="42">
              <template #default="{ row }">
                <div class="log-detail-grid">
                  <div>
                    <span>请求 URL</span>
                    <strong>{{ row.requestUrl || '-' }}</strong>
                  </div>
                  <div>
                    <span>页面 URL</span>
                    <strong>{{ row.url || '-' }}</strong>
                  </div>
                  <div>
                    <span>模块</span>
                    <strong>{{ row.appModule || '-' }}</strong>
                  </div>
                  <div>
                    <span>状态码</span>
                    <strong>{{ row.statusCode ?? '-' }}</strong>
                  </div>
                  <div>
                    <span>上传归属</span>
                    <strong>{{ uploadOwnerText(row) }} / {{ uploadOwnerSubText(row) }}</strong>
                  </div>
                  <div>
                    <span>上传来源</span>
                    <strong>{{ uploadSourceText(row.uploadSource) }} / {{ row.sourceFolder || '-' }}</strong>
                  </div>
                  <div>
                    <span>客户端版本</span>
                    <strong>{{ row.appVersion || '-' }}</strong>
                  </div>
                  <div>
                    <span>WebView</span>
                    <strong>{{ row.webviewVersion || '-' }}</strong>
                  </div>
                </div>
                <div class="log-quick-actions">
                  <el-button v-if="row.aiImportBatchNo" size="small" text type="primary" @click="viewRelatedLogs(row, 'batch')">同批次</el-button>
                  <el-button v-if="row.clientSessionId" size="small" text type="primary" @click="viewRelatedLogs(row, 'session')">同会话</el-button>
                  <el-button v-if="row.traceId" size="small" text type="primary" @click="viewRelatedLogs(row, 'trace')">同 trace</el-button>
                  <el-button v-if="row.sourceFileHash" size="small" text type="primary" @click="viewRelatedLogs(row, 'file')">同文件</el-button>
                </div>
                <pre v-if="row.stack" class="log-detail-pre">{{ row.stack }}</pre>
                <pre v-if="hasLogMetadata(row)" class="log-detail-pre">{{ formatLogMetadata(row.metadata) }}</pre>
              </template>
            </el-table-column>
            <el-table-column label="时间" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="等级" width="86">
              <template #default="{ row }">
                <el-tag size="small" :type="logLevelType(row.level)" effect="plain">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="eventType" label="事件类型" min-width="160" show-overflow-tooltip />
            <el-table-column prop="message" label="消息" min-width="260" show-overflow-tooltip />
            <el-table-column label="设备 / 用户" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceCode || row.deviceName || '-' }}</span>
                  <small>{{ logUserText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="route" label="页面" min-width="170" show-overflow-tooltip />
            <el-table-column label="批次 / 文件" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.aiImportBatchNo || row.aiImportBatchId || '-' }}</span>
                  <small>{{ row.sourceFileHash || '-' }} / {{ assetStatusText(row.assetStatus) }} / {{ logDuplicateText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传归属" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传来源" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadSourceText(row.uploadSource) }}</span>
                  <small>{{ row.sourceFolder || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="clientSessionId" label="会话 ID" min-width="150" show-overflow-tooltip />
            <el-table-column prop="traceId" label="trace_id" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" fixed="right" width="126">
              <template #default="{ row }">
                <div class="row-actions">
                  <el-button size="small" text type="primary" @click="viewLogSourceAsset(row)">文件</el-button>
                  <el-button v-if="row.sourceAssetId" size="small" text type="primary" @click="openLogSourceAssetDetail(row)">详情</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="logPage"
              v-model:page-size="logPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[50, 100, 200, 500]"
              :total="logs.total"
              @current-change="loadLogs"
              @size-change="loadLogs"
            />
          </div>
        </section>

        <section v-show="activeView === 'recalculation'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>重算任务</h3>
              <p>查看业务修正后待重算的库存、统计、进度和质量结果</p>
            </div>
            <el-tag effect="plain">{{ recalculationTasks.total }} 条</el-tag>
          </div>

          <div class="filter-strip">
            <el-select v-model="recalculationTaskFilters.status" clearable placeholder="重算状态" class="filter-small">
              <el-option label="待重算" value="pending" />
              <el-option label="待复核" value="manual_review_required" />
              <el-option label="处理中" value="processing" />
              <el-option label="已完成" value="completed" />
              <el-option label="失败" value="failed" />
              <el-option label="已取消" value="cancelled" />
            </el-select>
            <el-input v-model="recalculationTaskFilters.targetSchema" clearable placeholder="业务 schema" class="filter-small" />
            <el-input v-model="recalculationTaskFilters.targetTable" clearable placeholder="业务表" class="filter-small" />
            <el-input v-model="recalculationTaskFilters.targetRecordId" clearable placeholder="业务记录 ID" class="filter-small" />
            <el-input v-model="recalculationTaskFilters.requestedBy" clearable placeholder="请求人" class="filter-small" />
            <el-input v-model="recalculationTaskFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="recalculationTaskFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-select v-model="recalculationTaskFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面采集端" value="collector_desktop" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="手动选择" value="manual_picker" />
              <el-option label="网页拖拽" value="web_drag_drop" />
            </el-select>
            <el-select v-model="recalculationTaskFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-input v-model="recalculationTaskFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="recalculationTaskFilters.search" clearable placeholder="文件名 / hash / 错误" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="recalculationTasks.loading" @click="loadRecalculationTasks">查询</el-button>
          </div>

          <el-table
            v-loading="recalculationTasks.loading"
            :data="recalculationTasks.items"
            size="small"
            border
            empty-text="暂无重算任务"
          >
            <el-table-column label="状态" width="104">
              <template #default="{ row }">
                <el-tag size="small" :type="recalculationTaskStatusType(row.status)" effect="plain">
                  {{ recalculationTaskStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="业务记录" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.targetRecordId || '-' }}</span>
                  <small>{{ row.targetSchema || '-' }} / {{ row.targetTable || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="单据类型" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.targetDocumentType || '-' }}</span>
                  <small>{{ row.targetModule || row.taskType || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源文件" min-width="230" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceFilename || '-' }}</span>
                  <small>{{ sourceFileTraceText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传归属" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
                  <small>{{ row.batchNo || row.batchStatus || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="请求人" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">{{ row.requestedBy || '-' }}</template>
            </el-table-column>
            <el-table-column label="优先级" width="86" align="right" prop="priority" />
            <el-table-column label="尝试" width="78" align="right" prop="attemptCount" />
            <el-table-column label="请求时间" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.requestedAt) }}</template>
            </el-table-column>
            <el-table-column label="下次处理" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.nextAttemptAt) }}</template>
            </el-table-column>
            <el-table-column label="完成时间" min-width="160">
              <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
            </el-table-column>
            <el-table-column label="锁定" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.lockedBy || '-' }}</span>
                  <small>{{ formatDateTime(row.lockedAt) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="最近错误" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ row.lastError || '-' }}</template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="92">
              <template #default="{ row }">
                <el-button size="small" text type="primary" :disabled="!row.assetId" @click="openRecalculationTaskAsset(row)">详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="recalculationTaskPage"
              v-model:page-size="recalculationTaskPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="recalculationTasks.total"
              @current-change="loadRecalculationTasks"
              @size-change="loadRecalculationTasks"
            />
          </div>
        </section>

        <section v-show="activeView === 'productionReports'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>生产报工</h3>
              <p>查看 AI 自动入库的生产日报/报工记录和来源文件</p>
            </div>
            <el-tag effect="plain">{{ productionReports.unavailable ? '未部署' : `${productionReports.total} 条` }}</el-tag>
          </div>

          <el-alert
            v-if="productionReports.unavailable"
            type="warning"
            show-icon
            :closable="false"
            class="inline-alert"
            :title="productionReports.unavailableReason || '生产报工表尚未部署'"
          />

          <div class="filter-strip">
            <el-input v-model="productionReportFilters.dateFrom" clearable placeholder="开始日期" class="filter-small" />
            <el-input v-model="productionReportFilters.dateTo" clearable placeholder="结束日期" class="filter-small" />
            <el-input v-model="productionReportFilters.reportNo" clearable placeholder="报工单号" class="filter-small" />
            <el-input v-model="productionReportFilters.workOrderNo" clearable placeholder="工单号" class="filter-small" />
            <el-input v-model="productionReportFilters.productMaterialCode" clearable placeholder="产品编码" class="filter-small" />
            <el-input v-model="productionReportFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="productionReportFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-select v-model="productionReportFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="productionReportFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-select v-model="productionReportFilters.duplicateBusinessSource" clearable placeholder="业务重复" class="filter-small">
              <el-option label="重复业务来源" value="true" />
              <el-option label="正式业务来源" value="false" />
            </el-select>
            <el-input v-model="productionReportFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="productionReportFilters.search" clearable placeholder="工序 / 车间 / 文件 / hash" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="productionReports.loading" @click="loadProductionReports">查询</el-button>
            <el-button :disabled="productionReports.loading" @click="resetProductionReportFiltersAndLoad">重置</el-button>
          </div>

          <el-table
            v-loading="productionReports.loading"
            :data="productionReports.items"
            size="small"
            border
            empty-text="暂无生产报工记录"
          >
            <el-table-column label="报工单" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.reportNo || '-' }}</span>
                  <small>{{ formatDate(row.reportDate) }} / {{ row.reportStatus || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="工单/产品" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.workOrderNo || '-' }}</span>
                  <small>{{ row.productMaterialCode || '-' }} / {{ row.productMaterialName || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="工序/车间" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.processName || '-' }}</span>
                  <small>{{ row.workshopName || '-' }} / {{ row.productionLine || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="班组" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.shiftName || '-' }}</span>
                  <small>{{ row.teamName || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="完工" width="98" align="right">
              <template #default="{ row }">{{ formatQty(row.completedQty, row.unit) }}</template>
            </el-table-column>
            <el-table-column label="合格" width="98" align="right">
              <template #default="{ row }">{{ formatQty(row.goodQty, row.unit) }}</template>
            </el-table-column>
            <el-table-column label="不良" width="98" align="right">
              <template #default="{ row }">{{ formatQty(row.defectQty, row.unit) }}</template>
            </el-table-column>
            <el-table-column label="报废" width="98" align="right">
              <template #default="{ row }">{{ formatQty(row.scrapQty, row.unit) }}</template>
            </el-table-column>
            <el-table-column label="报工人" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.operator || row.createdBy || '-' }}</template>
            </el-table-column>
            <el-table-column label="来源文件" min-width="230" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceFilename || '-' }}</span>
                  <small>{{ sourceFileTraceText(row) }}</small>
                  <el-tag
                    v-if="row.businessLinkId"
                    size="small"
                    :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                    effect="plain"
                  >
                    {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
                  <small>{{ uploadSourceText(row.uploadSource) }} / {{ row.batchStatus || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="136">
              <template #default="{ row }">
                <div class="row-actions">
                  <el-button size="small" text type="primary" @click="traceProductionReportSource(row)">来源</el-button>
                  <el-button size="small" text type="primary" :disabled="!row.assetId" @click="openProductionReportAsset(row)">详情</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="productionReportPage"
              v-model:page-size="productionReportPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="productionReports.total"
              @current-change="loadProductionReports"
              @size-change="loadProductionReports"
            />
          </div>
        </section>

        <section v-show="activeView === 'qualityInspections'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>质检记录</h3>
              <p>查看 AI 自动入库的质量检验单和来源文件</p>
            </div>
            <el-tag effect="plain">{{ qualityInspections.unavailable ? '未部署' : `${qualityInspections.total} 条` }}</el-tag>
          </div>

          <el-alert
            v-if="qualityInspections.unavailable"
            type="warning"
            show-icon
            :closable="false"
            class="inline-alert"
            :title="qualityInspections.unavailableReason || '质检记录表尚未部署'"
          />

          <div class="filter-strip">
            <el-input v-model="qualityInspectionFilters.dateFrom" clearable placeholder="开始日期" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.dateTo" clearable placeholder="结束日期" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.docNo" clearable placeholder="检验单号" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.sourceDocNo" clearable placeholder="来源单号" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.inspectionType" clearable placeholder="检验类型" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.itemCode" clearable placeholder="物料编码" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.result" clearable placeholder="判定" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.inspector" clearable placeholder="检验员" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-select v-model="qualityInspectionFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="qualityInspectionFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-select v-model="qualityInspectionFilters.duplicateBusinessSource" clearable placeholder="业务重复" class="filter-small">
              <el-option label="重复业务来源" value="true" />
              <el-option label="正式业务来源" value="false" />
            </el-select>
            <el-input v-model="qualityInspectionFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="qualityInspectionFilters.search" clearable placeholder="物料 / 批次 / 文件 / hash" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="qualityInspections.loading" @click="loadQualityInspections">查询</el-button>
            <el-button :disabled="qualityInspections.loading" @click="resetQualityInspectionFiltersAndLoad">重置</el-button>
          </div>

          <el-table
            v-loading="qualityInspections.loading"
            :data="qualityInspections.items"
            size="small"
            border
            empty-text="暂无质检记录"
          >
            <el-table-column label="检验单" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.docNo || '-' }}</span>
                  <small>{{ formatDate(row.inspectionDate) }} / {{ row.status || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="判定" width="104">
              <template #default="{ row }">
                <el-tag size="small" :type="qualityResultType(row.result)" effect="plain">{{ row.result || '-' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="检验对象" min-width="230" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.itemName || '-' }}</span>
                  <small>{{ row.itemCode || '-' }} / {{ row.batchNo || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源单据" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceDocNo || '-' }}</span>
                  <small>{{ row.sourceName || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="类型/检验员" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.inspectionType || '-' }}</span>
                  <small>{{ row.inspector || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="抽检" width="92" align="right">
              <template #default="{ row }">{{ formatQty(row.sampleQty) }}</template>
            </el-table-column>
            <el-table-column label="不良" width="92" align="right">
              <template #default="{ row }">{{ formatQty(row.defectQty) }}</template>
            </el-table-column>
            <el-table-column label="不良率" width="96" align="right">
              <template #default="{ row }">{{ formatDefectRate(row.sampleQty, row.defectQty) }}</template>
            </el-table-column>
            <el-table-column label="来源文件" min-width="230" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceFilename || '-' }}</span>
                  <small>{{ sourceFileTraceText(row) }}</small>
                  <el-tag
                    v-if="row.businessLinkId"
                    size="small"
                    :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                    effect="plain"
                  >
                    {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
                  <small>{{ uploadSourceText(row.uploadSource) }} / {{ row.batchStatus || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="136">
              <template #default="{ row }">
                <div class="row-actions">
                  <el-button size="small" text type="primary" @click="traceQualityInspectionSource(row)">来源</el-button>
                  <el-button size="small" text type="primary" :disabled="!row.assetId" @click="openQualityInspectionAsset(row)">详情</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="qualityInspectionPage"
              v-model:page-size="qualityInspectionPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="qualityInspections.total"
              @current-change="loadQualityInspections"
              @size-change="loadQualityInspections"
            />
          </div>
        </section>

        <section v-show="activeView === 'hrAttendance'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>考勤快照</h3>
              <p>查看人事/考勤修正后生成的员工月度考勤重算结果</p>
            </div>
            <el-tag effect="plain">{{ hrAttendanceSnapshots.unavailable ? '未部署' : `${hrAttendanceSnapshots.total} 条` }}</el-tag>
          </div>

          <el-alert
            v-if="hrAttendanceSnapshots.unavailable"
            type="warning"
            show-icon
            :closable="false"
            class="inline-alert"
            :title="hrAttendanceSnapshots.unavailableReason || '考勤快照表尚未部署'"
          />

          <div class="filter-strip">
            <el-input v-model="hrAttendanceSnapshotFilters.month" clearable placeholder="月份 2026-06" class="filter-small" />
            <el-select v-model="hrAttendanceSnapshotFilters.confirmationStatus" clearable placeholder="确认状态" class="filter-small">
              <el-option label="待确认" value="pending_confirmation" />
              <el-option label="已确认" value="confirmed" />
              <el-option label="已退回" value="rejected" />
            </el-select>
            <el-select v-model="hrAttendanceSnapshotFilters.payrollPrecheckStatus" clearable placeholder="薪资前置" class="filter-small">
              <el-option label="未提交" value="not_requested" />
              <el-option label="已提交" value="ready" />
            </el-select>
            <el-input v-model="hrAttendanceSnapshotFilters.employeeNo" clearable placeholder="员工编号" class="filter-small" />
            <el-input v-model="hrAttendanceSnapshotFilters.employeeName" clearable placeholder="员工姓名" class="filter-small" />
            <el-input v-model="hrAttendanceSnapshotFilters.deptName" clearable placeholder="部门" class="filter-small" />
            <el-input v-model="hrAttendanceSnapshotFilters.sourceTargetRecordId" clearable placeholder="来源记录 ID" class="filter-small" />
            <el-input v-model="hrAttendanceSnapshotFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="hrAttendanceSnapshotFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-select v-model="hrAttendanceSnapshotFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="hrAttendanceSnapshotFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-select v-model="hrAttendanceSnapshotFilters.duplicateBusinessSource" clearable placeholder="业务重复" class="filter-small">
              <el-option label="重复业务来源" value="true" />
              <el-option label="正式业务来源" value="false" />
            </el-select>
            <el-input v-model="hrAttendanceSnapshotFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="hrAttendanceSnapshotFilters.search" clearable placeholder="员工 / 文件 / hash" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="hrAttendanceSnapshots.loading" @click="loadHrAttendanceSnapshots">查询</el-button>
            <el-button :disabled="hrAttendanceSnapshots.loading" @click="resetHrAttendanceSnapshotFiltersAndLoad">重置</el-button>
          </div>

          <el-table
            v-loading="hrAttendanceSnapshots.loading"
            :data="hrAttendanceSnapshots.items"
            size="small"
            border
            empty-text="暂无考勤重算快照"
          >
            <el-table-column label="员工月份" min-width="210" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.employeeName || '-' }}</span>
                  <small>{{ row.employeeNo || row.employeeId || '-' }} / {{ row.month || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="部门" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">{{ row.deptName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="recordCount" label="记录" width="78" align="right" />
            <el-table-column prop="leaveCount" label="请假" width="78" align="right" />
            <el-table-column prop="absentCount" label="缺勤" width="78" align="right" />
            <el-table-column prop="lateCount" label="迟到" width="78" align="right" />
            <el-table-column prop="earlyCount" label="早退" width="78" align="right" />
            <el-table-column label="加班" width="92" align="right">
              <template #default="{ row }">{{ formatMinutes(row.overtimeMinutes) }}</template>
            </el-table-column>
            <el-table-column label="确认状态" min-width="150">
              <template #default="{ row }">
                <div class="tag-stack">
                  <el-tag size="small" :type="hrAttendanceConfirmationStatusType(row.confirmationStatus)" effect="plain">
                    {{ hrAttendanceConfirmationStatusText(row.confirmationStatus) }}
                  </el-tag>
                  <el-tag size="small" :type="hrAttendancePayrollPrecheckStatusType(row.payrollPrecheckStatus)" effect="plain">
                    {{ hrAttendancePayrollPrecheckStatusText(row.payrollPrecheckStatus) }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="考勤范围" min-width="170">
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ formatDate(row.firstAttDate) }}</span>
                  <small>{{ formatDate(row.lastAttDate) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源修正" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceTargetRecordId || '-' }}</span>
                  <small>{{ row.sourceTargetSchema || '-' }} / {{ row.sourceTargetTable || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源文件" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceFilename || '-' }}</span>
                  <small>{{ sourceFileTraceText(row) }}</small>
                  <el-tag
                    v-if="row.lastBusinessLinkId"
                    size="small"
                    :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                    effect="plain"
                  >
                    {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
                  <small>{{ uploadSourceText(row.uploadSource) }} / {{ row.batchStatus || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="重算任务" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <el-tag v-if="row.taskStatus" size="small" :type="recalculationTaskStatusType(row.taskStatus)" effect="plain">
                    {{ recalculationTaskStatusText(row.taskStatus) }}
                  </el-tag>
                  <span v-else>-</span>
                  <small>{{ formatDateTime(row.recalculatedAt) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="300">
              <template #default="{ row }">
                <div class="row-actions">
                  <el-button
                    size="small"
                    text
                    type="primary"
                    @click="traceHrAttendanceSnapshotSource(row)"
                  >
                    来源
                  </el-button>
                  <el-button
                    size="small"
                    type="success"
                    :icon="Check"
                    :disabled="row.confirmationStatus === 'confirmed'"
                    :loading="hrAttendanceSnapshotActionLoading[row.id] === 'confirm'"
                    @click="runHrAttendanceSnapshotAction(row, 'confirm')"
                  >
                    确认
                  </el-button>
                  <el-button
                    size="small"
                    type="warning"
                    :icon="Close"
                    :loading="hrAttendanceSnapshotActionLoading[row.id] === 'reject'"
                    @click="runHrAttendanceSnapshotAction(row, 'reject')"
                  >
                    退回
                  </el-button>
                  <el-button
                    size="small"
                    :disabled="row.confirmationStatus !== 'confirmed' || row.payrollPrecheckStatus === 'ready'"
                    :loading="hrAttendanceSnapshotActionLoading[row.id] === 'submit_payroll_precheck'"
                    @click="runHrAttendanceSnapshotAction(row, 'submit_payroll_precheck')"
                  >
                    薪资前置
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="hrAttendanceSnapshotPage"
              v-model:page-size="hrAttendanceSnapshotPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="hrAttendanceSnapshots.total"
              @current-change="loadHrAttendanceSnapshots"
              @size-change="loadHrAttendanceSnapshots"
            />
          </div>
        </section>

        <section v-show="activeView === 'payrollPrecheck'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>薪资前置</h3>
              <p>只读查看已确认并提交薪资核算前置审核的考勤快照</p>
            </div>
            <el-tag effect="plain">{{ payrollPrecheckSnapshots.unavailable ? '未部署' : `${payrollPrecheckSnapshots.total} 条` }}</el-tag>
          </div>

          <el-alert
            v-if="payrollPrecheckSnapshots.unavailable"
            type="warning"
            show-icon
            :closable="false"
            class="inline-alert"
            :title="payrollPrecheckSnapshots.unavailableReason || '薪资前置快照视图尚未部署'"
          />

          <div class="filter-strip">
            <el-input v-model="payrollPrecheckFilters.month" clearable placeholder="月份 2026-06" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.employeeNo" clearable placeholder="员工编号" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.employeeName" clearable placeholder="员工姓名" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.deptName" clearable placeholder="部门" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.sourceTargetRecordId" clearable placeholder="来源记录 ID" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-select v-model="payrollPrecheckFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="payrollPrecheckFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-select v-model="payrollPrecheckFilters.duplicateBusinessSource" clearable placeholder="业务重复" class="filter-small">
              <el-option label="重复业务来源" value="true" />
              <el-option label="正式业务来源" value="false" />
            </el-select>
            <el-input v-model="payrollPrecheckFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-input v-model="payrollPrecheckFilters.search" clearable placeholder="员工 / 文件 / hash" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="payrollPrecheckSnapshots.loading" @click="loadPayrollPrecheckSnapshots">查询</el-button>
            <el-button :disabled="payrollPrecheckSnapshots.loading" @click="resetPayrollPrecheckFiltersAndLoad">重置</el-button>
          </div>

          <el-table
            v-loading="payrollPrecheckSnapshots.loading"
            :data="payrollPrecheckSnapshots.items"
            size="small"
            border
            empty-text="暂无薪资前置考勤快照"
          >
            <el-table-column label="员工月份" min-width="210" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.employeeName || '-' }}</span>
                  <small>{{ row.employeeNo || row.employeeId || '-' }} / {{ row.month || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="部门" min-width="130" show-overflow-tooltip>
              <template #default="{ row }">{{ row.deptName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="recordCount" label="记录" width="78" align="right" />
            <el-table-column prop="leaveCount" label="请假" width="78" align="right" />
            <el-table-column prop="absentCount" label="缺勤" width="78" align="right" />
            <el-table-column prop="lateCount" label="迟到" width="78" align="right" />
            <el-table-column prop="earlyCount" label="早退" width="78" align="right" />
            <el-table-column label="加班" width="92" align="right">
              <template #default="{ row }">{{ formatMinutes(row.overtimeMinutes) }}</template>
            </el-table-column>
            <el-table-column label="只读引用" min-width="150">
              <template #default="{ row }">
                <div class="tag-stack">
                  <el-tag size="small" type="success" effect="plain">{{ hrAttendancePayrollPrecheckStatusText(row.payrollPrecheckStatus) }}</el-tag>
                  <el-tag size="small" :type="row.payrollMutationAllowed ? 'danger' : 'info'" effect="plain">
                    {{ row.payrollMutationAllowed ? '可写薪资' : '不写薪资' }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="确认/提交" min-width="210" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.confirmedBy || '-' }} / {{ formatDateTime(row.confirmedAt) }}</span>
                  <small>{{ row.payrollPrecheckRequestedBy || '-' }} / {{ formatDateTime(row.payrollPrecheckRequestedAt) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源文件" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.sourceFilename || '-' }}</span>
                  <small>{{ sourceFileTraceText(row) }}</small>
                  <el-tag
                    v-if="row.lastBusinessLinkId"
                    size="small"
                    :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                    effect="plain"
                  >
                    {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row) }}</span>
                  <small>{{ uploadOwnerSubText(row) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
                  <small>{{ uploadSourceText(row.uploadSource) }} / {{ row.batchStatus || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="薪资引用键" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.employeeMonthKey || '-' }}</span>
                  <small>{{ row.snapshotId || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="92">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="traceHrAttendanceSnapshotSource(row)">来源</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager-row">
            <el-pagination
              v-model:current-page="payrollPrecheckPage"
              v-model:page-size="payrollPrecheckPageSize"
              layout="total, sizes, prev, pager, next"
              :page-sizes="[20, 50, 100, 200]"
              :total="payrollPrecheckSnapshots.total"
              @current-change="loadPayrollPrecheckSnapshots"
              @size-change="loadPayrollPrecheckSnapshots"
            />
          </div>
        </section>

        <section v-show="activeView === 'sources'" class="stage-panel">
          <div class="panel-head">
            <div>
              <h3>来源追溯</h3>
              <p>按业务记录反查 AI 入库来源文件、采集设备和上传归属</p>
            </div>
            <el-tag effect="plain">{{ businessSources.total }} 条</el-tag>
          </div>

          <div class="filter-strip">
            <el-input v-model="businessSourceFilters.targetAppId" clearable placeholder="应用 ID" class="filter-small" />
            <el-input v-model="businessSourceFilters.targetSchema" clearable placeholder="业务 schema" class="filter-small" />
            <el-input v-model="businessSourceFilters.targetTable" clearable placeholder="业务表" class="filter-small" />
            <el-input v-model="businessSourceFilters.targetRecordId" clearable placeholder="业务记录 ID" class="filter-small" />
            <el-input v-model="businessSourceFilters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
            <el-input v-model="businessSourceFilters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
            <el-select v-model="businessSourceFilters.uploadSource" clearable placeholder="上传来源" class="filter-small">
              <el-option label="桌面端" value="collector_desktop" />
              <el-option label="桌面端分片" value="collector_desktop_chunked" />
              <el-option label="监听目录" value="watch_folder" />
              <el-option label="网页拖拽" value="web_drag_drop" />
              <el-option label="窗口拖拽" value="manual_drag_drop" />
              <el-option label="手动选择" value="manual_selected_file" />
              <el-option label="手动上传" value="manual_upload" />
            </el-select>
            <el-select v-model="businessSourceFilters.operatorSource" clearable placeholder="归属来源" class="filter-small">
              <el-option label="网页登录用户" value="web_login_user" />
              <el-option label="设备默认用户" value="device_default_user" />
              <el-option label="手动指定用户" value="manual_selected_user" />
              <el-option label="目录默认用户" value="folder_binding_user" />
              <el-option label="未知上传人" value="unknown" />
            </el-select>
            <el-input v-model="businessSourceFilters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
            <el-select v-model="businessSourceFilters.duplicateBusinessSource" clearable placeholder="业务重复" class="filter-small">
              <el-option label="重复业务来源" value="true" />
              <el-option label="正式业务来源" value="false" />
            </el-select>
            <el-input v-model="businessSourceFilters.businessLinkId" clearable placeholder="业务链接 ID" class="filter-grow">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-button type="primary" :loading="businessSources.loading" @click="loadBusinessSources">查询</el-button>
            <el-button :disabled="businessSources.loading" @click="resetBusinessSourceFiltersAndResults">重置</el-button>
          </div>

          <el-table
            v-loading="businessSources.loading"
            :data="businessSources.items"
            size="small"
            border
            empty-text="请输入业务记录条件后查询来源文件"
          >
            <el-table-column label="业务记录" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.businessLink.targetRecordId || '-' }}</span>
                  <small>{{ row.businessLink.targetSchema || row.businessLink.targetAppId || '-' }} / {{ row.businessLink.targetTable || '-' }}</small>
                  <el-tag
                    size="small"
                    :type="row.businessLink.duplicateBusinessSource ? 'warning' : 'success'"
                    effect="plain"
                  >
                    {{ row.businessLink.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源文件" min-width="240" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.asset.originalFilename || '-' }}</span>
                  <small>{{ row.asset.fileHash || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="来源设备" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.asset.deviceName || row.asset.deviceCode || '-' }}</span>
                  <small>{{ row.asset.sourceFolder || '-' }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="上传用户" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ uploadOwnerText(row.asset) }}</span>
                  <small>{{ uploadOwnerSubText(row.asset) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="批次" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="main-cell">
                  <span>{{ row.asset.batchNo || row.asset.batchId || '-' }}</span>
                  <small>{{ batchStatusText(row.asset.batchStatus) }}</small>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" fixed="right" width="168">
              <template #default="{ row }">
                <div class="row-actions">
                  <el-button size="small" text type="primary" @click="viewBusinessSourceAssets(row)">文件</el-button>
                  <el-button size="small" text type="primary" @click="openBusinessSourceAsset(row)">详情</el-button>
                  <el-button size="small" text type="primary" @click="viewBusinessSourceLogs(row)">日志</el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </main>
    </section>

    <el-drawer v-model="assetDrawer.visible" size="68%" title="文件入库详情">
      <div v-loading="assetDrawer.loading" class="asset-detail">
        <template v-if="assetDrawer.detail?.asset">
          <section class="detail-summary">
            <div>
              <h3>{{ assetDrawer.detail.asset.originalFilename }}</h3>
              <p>
                {{ assetDrawer.detail.asset.deviceName || assetDrawer.detail.asset.deviceCode }}
                · {{ formatDateTime(assetDrawer.detail.asset.uploadedAt) }}
                · {{ assetDrawer.detail.asset.batchNo || assetDrawer.detail.asset.batchId || '无批次' }}
                · {{ batchStatusText(assetDrawer.detail.asset.batchStatus) }}
              </p>
              <p>
                上传归属：{{ uploadOwnerText(assetDrawer.detail.asset) }}
                · {{ uploadOwnerSubText(assetDrawer.detail.asset) }}
                · {{ uploadSourceText(assetDrawer.detail.asset.uploadSource) }}
              </p>
              <p v-if="assetDrawer.detail.asset.duplicate" class="duplicate-source-line">
                重复来源：{{ duplicateOriginText(assetDrawer.detail.asset) }}
                <template v-if="duplicateOriginMetaText(assetDrawer.detail.asset)">
                  · {{ duplicateOriginMetaText(assetDrawer.detail.asset) }}
                </template>
              </p>
            </div>
            <div class="summary-tags">
              <el-tag :type="assetStatusType(assetDrawer.detail.asset.status)" effect="plain">
                {{ assetStatusText(assetDrawer.detail.asset.status) }}
              </el-tag>
              <el-tag v-if="assetDrawer.detail.asset.reviewStatus" :type="reviewStatusType(assetDrawer.detail.asset.reviewStatus)" effect="plain">
                {{ reviewStatusText(assetDrawer.detail.asset.reviewStatus) }}
              </el-tag>
              <el-button
                size="small"
                :loading="assetDrawer.downloading"
                @click="downloadOriginalAsset"
              >
                下载原始文件
              </el-button>
              <el-button
                size="small"
                :loading="assetDrawer.previewing"
                @click="previewOriginalAsset"
              >
                预览原始文件
              </el-button>
              <el-button
                v-if="canApproveAssetReview"
                size="small"
                type="primary"
                :loading="assetDrawer.reviewing"
                @click="approveAssetReview"
              >
                复核通过并入库
              </el-button>
            </div>
          </section>

          <section v-if="aiSupplementRemarks" class="ai-remarks-panel">
            <div class="ai-remarks-head">
              <strong>AI补充备注</strong>
              <el-tag size="small" effect="plain">写入备注</el-tag>
            </div>
            <pre>{{ aiSupplementRemarks }}</pre>
          </section>

          <el-tabs v-model="assetDetailTab">
            <el-tab-pane label="OCR 文本" name="parse">
              <pre class="ocr-box">{{ latestParseText }}</pre>
            </el-tab-pane>
            <el-tab-pane label="AI 判断" name="classification">
              <div class="detail-list">
                <article v-for="item in assetDrawer.detail.classifications" :key="item.id" class="detail-item">
                  <strong>{{ item.targetDocumentType || '-' }}</strong>
                  <span>{{ item.reason || '-' }}</span>
                  <small>置信度 {{ formatPercent(item.confidence) }}</small>
                </article>
              </div>
            </el-tab-pane>
            <el-tab-pane label="入库计划" name="plans">
              <el-table :data="assetDrawer.detail.entryPlans" size="small" border empty-text="暂无入库计划">
                <el-table-column type="expand" width="42">
                  <template #default="{ row }">
                    <div class="entry-plan-detail">
                      <template v-if="entryPlanDocuments(row).length">
                        <article
                          v-for="(document, index) in entryPlanDocuments(row)"
                          :key="index"
                          class="entry-doc-card"
                        >
                          <div class="entry-doc-head">
                            <strong>{{ entryDocumentTitle(document, index) }}</strong>
                            <el-tag size="small" effect="plain">{{ entryDocumentMappingStatus(document) }}</el-tag>
                          </div>
                          <div v-if="entryDocumentSource(document)" class="entry-doc-source">
                            来源：{{ entryDocumentSource(document) }}
                          </div>
                          <div v-if="entryDocumentFields(document).length" class="entry-doc-section">
                            <strong>字段映射</strong>
                            <dl class="field-map-list">
                              <div v-for="field in entryDocumentFields(document)" :key="field.name">
                                <dt>{{ field.name }}</dt>
                                <dd>{{ field.value }}</dd>
                              </div>
                            </dl>
                          </div>
                          <div v-if="entryDocumentLineItems(document).length" class="entry-doc-section">
                            <strong>行明细</strong>
                            <pre class="entry-doc-pre">{{ formatJson(entryDocumentLineItems(document)) }}</pre>
                          </div>
                          <div v-if="entryDocumentRemarks(document)" class="entry-doc-section">
                            <strong>AI补充备注</strong>
                            <pre class="entry-doc-pre">{{ entryDocumentRemarks(document) }}</pre>
                          </div>
                        </article>
                      </template>
                      <el-empty v-else description="暂无生成单据明细" />
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="targetDocumentType" label="业务类型" min-width="150" />
                <el-table-column prop="targetTable" label="目标表" min-width="160" />
                <el-table-column prop="documentCount" label="单据" width="80" />
                <el-table-column prop="lineCount" label="行数" width="80" />
                <el-table-column prop="status" label="状态" width="110" />
                <el-table-column prop="reason" label="说明" min-width="240" show-overflow-tooltip />
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="业务链接" name="links">
              <el-table :data="assetDrawer.detail.businessLinks" size="small" border empty-text="暂无业务链接">
                <el-table-column prop="targetModule" label="模块" width="120" />
                <el-table-column prop="targetDocumentType" label="单据类型" min-width="150" />
                <el-table-column prop="targetTable" label="目标表" min-width="150" />
                <el-table-column prop="targetRecordId" label="业务记录" min-width="150" />
                <el-table-column label="置信度" width="100">
                  <template #default="{ row }">{{ formatPercent(row.aiConfidence) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="136">
                  <template #default="{ row }">
                    <div class="row-actions">
                      <el-link
                        v-if="businessLinkHref(row)"
                        type="primary"
                        :href="businessLinkHref(row)"
                        target="_blank"
                      >
                        打开
                      </el-link>
                      <span v-else>-</span>
                      <el-button size="small" text type="primary" @click="traceBusinessLinkSource(row)">追溯</el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="未匹配字段" name="unmapped">
              <el-table :data="assetDrawer.detail.unmappedFields" size="small" border empty-text="暂无未匹配字段">
                <el-table-column prop="name" label="字段" min-width="140" />
                <el-table-column prop="value" label="值" min-width="200" show-overflow-tooltip />
                <el-table-column prop="writeLocation" label="写入位置" width="120" />
                <el-table-column label="置信度" width="100">
                  <template #default="{ row }">{{ formatPercent(row.confidence) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="修正记录" name="corrections">
              <el-table :data="assetDrawer.detail.corrections" size="small" border empty-text="暂无修正记录">
                <el-table-column prop="fieldName" label="字段" min-width="120" />
                <el-table-column prop="oldValue" label="旧值" min-width="140" show-overflow-tooltip />
                <el-table-column prop="newValue" label="新值" min-width="140" show-overflow-tooltip />
                <el-table-column label="影响业务" width="100">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.affectsBusinessResult ? 'warning' : 'info'" effect="plain">
                      {{ row.affectsBusinessResult ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="recalculationStatus" label="重算状态" width="120" />
                <el-table-column prop="correctedBy" label="修正人" width="120" />
                <el-table-column label="时间" min-width="160">
                  <template #default="{ row }">{{ formatDateTime(row.correctedAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="重算任务" name="recalculation">
              <el-table :data="assetDrawer.detail.recalculationTasks || []" size="small" border empty-text="暂无重算任务">
                <el-table-column label="状态" width="120">
                  <template #default="{ row }">
                    <el-tag size="small" :type="recalculationTaskStatusType(row.status)" effect="plain">
                      {{ recalculationTaskStatusText(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="targetTable" label="目标表" min-width="150" />
                <el-table-column prop="targetRecordId" label="业务记录" min-width="150" />
                <el-table-column prop="requestedBy" label="发起人" width="120" />
                <el-table-column prop="lastError" label="最近错误" min-width="180" show-overflow-tooltip />
                <el-table-column label="发起时间" min-width="160">
                  <template #default="{ row }">{{ formatDateTime(row.requestedAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="入库日志" name="logs">
              <el-table :data="assetDrawer.detail.logs" size="small" border empty-text="暂无入库日志">
                <el-table-column label="等级" width="86">
                  <template #default="{ row }">
                    <el-tag size="small" :type="logLevelType(row.level)" effect="plain">{{ row.level }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="eventType" label="事件类型" min-width="150" show-overflow-tooltip />
                <el-table-column prop="message" label="消息" min-width="230" show-overflow-tooltip />
                <el-table-column label="上传归属" min-width="170" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="main-cell">
                      <span>{{ uploadOwnerText(row) }}</span>
                      <small>{{ uploadOwnerSubText(row) }}</small>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="上传来源" min-width="170" show-overflow-tooltip>
                  <template #default="{ row }">
                    <div class="main-cell">
                      <span>{{ uploadSourceText(row.uploadSource) }}</span>
                      <small>{{ row.sourceFolder || '-' }}</small>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column prop="traceId" label="trace_id" min-width="150" show-overflow-tooltip />
                <el-table-column prop="requestUrl" label="请求 URL" min-width="240" show-overflow-tooltip />
                <el-table-column label="时间" min-width="160">
                  <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </template>
      </div>
    </el-drawer>

    <el-dialog v-model="policyDialog.visible" title="智能收单策略" width="960px">
      <el-form v-loading="policyDialog.loading" :model="policyForm" label-width="132px" class="policy-form">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="收单开关">
              <el-switch v-model="policyForm.enabled" active-text="启用" inactive-text="停用" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="日志采集">
              <el-switch v-model="policyForm.logCollectionEnabled" active-text="启用" inactive-text="停用" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="自动入库">
              <el-select v-model="policyForm.defaultAutoImportMode">
                <el-option v-for="option in policySelectOptions.defaultAutoImportMode" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="低置信度">
              <el-select v-model="policyForm.lowConfidencePolicy">
                <el-option v-for="option in policySelectOptions.lowConfidencePolicy" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="未识别文件">
              <el-select v-model="policyForm.unrecognizedFilePolicy">
                <el-option v-for="option in policySelectOptions.unrecognizedFilePolicy" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="重复文件">
              <el-select v-model="policyForm.duplicateFilePolicy">
                <el-option v-for="option in policySelectOptions.duplicateFilePolicy" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="未匹配字段">
              <el-select v-model="policyForm.unmappedFieldPolicy">
                <el-option v-for="option in policySelectOptions.unmappedFieldPolicy" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="业务修正">
              <el-select v-model="policyForm.businessCorrectionPolicy">
                <el-option v-for="option in policySelectOptions.businessCorrectionPolicy" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="置信度阈值">
              <el-input-number v-model="policyForm.confidenceThreshold" :min="0.01" :max="1" :step="0.01" :precision="2" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="日志保留天数">
              <el-input-number v-model="policyForm.logRetentionDays" :min="1" :max="3650" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="文件保留天数">
              <el-input-number v-model="policyForm.sourceFileRetentionDays" :min="1" :max="3650" :step="1" controls-position="right" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="单据类型映射">
              <div class="mapping-editor">
                <div class="mapping-editor__toolbar">
                  <span>{{ documentTypeMappingRows.length }} 条</span>
                  <el-button size="small" :icon="Plus" @click="addDocumentTypeMapping">新增映射</el-button>
                </div>
                <el-table :data="documentTypeMappingRows" size="small" border empty-text="暂无映射">
                  <el-table-column label="启用" width="70" align="center">
                    <template #default="{ row }">
                      <el-switch v-model="row.enabled" />
                    </template>
                  </el-table-column>
                  <el-table-column label="名称" min-width="120">
                    <template #default="{ row }">
                      <el-input v-model="row.name" placeholder="mapping_name" />
                    </template>
                  </el-table-column>
                  <el-table-column label="模块" min-width="110">
                    <template #default="{ row }">
                      <el-input v-model="row.targetModule" placeholder="target_module" />
                    </template>
                  </el-table-column>
                  <el-table-column label="单据类型" min-width="140">
                    <template #default="{ row }">
                      <el-input v-model="row.targetDocumentType" placeholder="target_document_type" />
                    </template>
                  </el-table-column>
                  <el-table-column label="关键词" min-width="180">
                    <template #default="{ row }">
                      <el-input v-model="row.keywordText" placeholder="match_keywords" />
                    </template>
                  </el-table-column>
                  <el-table-column label="优先级" width="110">
                    <template #default="{ row }">
                      <el-input-number v-model="row.priority" :min="0" :max="1000" :step="10" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="76" align="center">
                    <template #default="{ $index }">
                      <el-button size="small" text type="danger" @click="removeDocumentTypeMapping($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-form-item>
          </el-col>
        </el-row>
        <div class="policy-maintenance">
          <strong>源文件保留</strong>
          <span v-if="sourceRetentionResult">{{ sourceRetentionSummary }}</span>
          <div>
            <el-button :loading="policyDialog.retentionPreviewing" @click="previewSourceRetention">预检源文件</el-button>
            <el-button type="danger" plain :loading="policyDialog.retentionRunning" @click="runSourceRetention">清理过期源文件</el-button>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button :loading="policyDialog.resetting" @click="resetPolicyDialog">恢复默认</el-button>
        <el-button @click="policyDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="policyDialog.saving" @click="savePolicyDialog">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="deviceDialog.visible" :title="deviceDialog.mode === 'create' ? '新增采集设备' : '编辑采集设备'" width="760px">
      <el-form :model="deviceForm" label-width="110px" class="device-form">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="企业标识">
              <el-input v-model="deviceForm.enterpriseId" :disabled="deviceDialog.mode === 'edit'" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备编号">
              <el-input v-model="deviceForm.deviceCode" :disabled="deviceDialog.mode === 'edit'" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备名称">
              <el-input v-model="deviceForm.deviceName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态">
              <el-select v-model="deviceForm.status">
                <el-option label="待绑定" value="pending" />
                <el-option label="活跃" value="active" />
                <el-option label="离线" value="offline" />
                <el-option label="禁用" value="disabled" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="默认用户ID">
              <el-input v-model="deviceForm.defaultUserId" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="默认上传人">
              <el-input v-model="deviceForm.defaultUsername" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="默认岗位">
              <el-input v-model="deviceForm.defaultRole" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="配置版本">
              <el-input v-model="deviceForm.configVersion" placeholder="留空自动生成" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="远程配置">
              <el-input
                v-model="deviceForm.remoteConfigText"
                type="textarea"
                :autosize="{ minRows: 5, maxRows: 12 }"
                placeholder="{ &quot;logs&quot;: { &quot;retention_days&quot;: 30 } }"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <div v-if="deviceDialog.mode === 'edit'" class="device-health-panel">
          <div class="folder-editor-head">
            <strong>健康快照</strong>
            <el-tag
              size="small"
              :type="deviceHealthSnapshotStatus(deviceForm.healthSnapshot).type"
              effect="plain"
            >
              {{ deviceHealthSnapshotStatus(deviceForm.healthSnapshot).label }}
            </el-tag>
          </div>
          <div class="health-grid">
            <div
              v-for="item in deviceHealthSnapshotItems(deviceForm.healthSnapshot)"
              :key="item.key"
              class="health-card"
              :class="{ 'diagnostic-card': deviceHealthSnapshotItemActionable(item) }"
              @click="viewDeviceHealthSnapshotItem(item)"
            >
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small v-if="item.note">{{ item.note }}</small>
            </div>
          </div>
          <div v-if="deviceHealthFailedUploadSummaries(deviceForm.healthSnapshot).length" class="health-error-list">
            <strong>失败原因</strong>
            <div
              v-for="item in deviceHealthFailedUploadSummaries(deviceForm.healthSnapshot)"
              :key="`${item.error}-${item.count}`"
              class="health-error-row diagnostic-error-row"
              role="button"
              tabindex="0"
              :aria-label="`查看 ${item.error} 失败日志`"
              @click="viewDeviceFailedUploadSummaryLogs(item)"
              @keydown.enter.prevent="viewDeviceFailedUploadSummaryLogs(item)"
              @keydown.space.prevent="viewDeviceFailedUploadSummaryLogs(item)"
            >
              <span>{{ item.error }}</span>
              <small>{{ item.count }} 次 · {{ item.oldest }} 至 {{ item.latest }}</small>
            </div>
          </div>
        </div>

        <div class="folder-editor">
          <div class="folder-editor-head">
            <strong>监听目录</strong>
            <el-button size="small" :icon="Plus" @click="addWatchFolder">添加目录</el-button>
          </div>
          <div v-for="(folder, index) in deviceForm.watchFolders" :key="index" class="folder-row">
            <el-input v-model="folder.folderPath" placeholder="D:\\EISCore\\Inbox" />
            <el-input v-model="folder.folderName" placeholder="目录名称" />
            <el-input v-model="folder.defaultUserId" placeholder="默认用户ID" />
            <el-input v-model="folder.defaultUsername" placeholder="默认上传人" />
            <el-input v-model="folder.defaultRole" placeholder="默认岗位" />
            <div class="folder-state-cell">
              <el-switch v-model="folder.enabled" />
              <el-tag size="small" :type="folder.enabled !== false ? 'success' : 'info'" effect="plain">
                {{ folder.enabled !== false ? '启用' : '停用' }}
              </el-tag>
              <el-tag
                v-if="watchFolderHealthStatus(folder).label"
                size="small"
                :type="watchFolderHealthStatus(folder).type"
                effect="plain"
              >
                {{ watchFolderHealthStatus(folder).label }}
              </el-tag>
            </div>
            <div class="folder-trace-actions">
              <el-button size="small" text type="primary" :disabled="!hasWatchFolderPath(folder)" @click="viewWatchFolderAssets(folder)">文件</el-button>
              <el-button size="small" text type="primary" :disabled="!hasWatchFolderPath(folder)" @click="viewWatchFolderLogs(folder)">日志</el-button>
              <el-button
                v-if="isWatchFolderHealthAbnormal(folder)"
                size="small"
                text
                type="danger"
                :disabled="!hasWatchFolderPath(folder)"
                @click="viewWatchFolderIssueLogs(folder)"
              >
                异常日志
              </el-button>
            </div>
            <el-button text type="danger" @click="removeWatchFolder(index)">删除</el-button>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="deviceDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="deviceDialog.saving" @click="submitDevice">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="sourcePreview.visible" title="原始文件预览" width="760px">
      <div class="source-preview-head">
        <strong>{{ sourcePreview.title || '原始文件' }}</strong>
        <el-tag v-if="sourcePreview.truncated" size="small" type="warning" effect="plain">
          已截断
        </el-tag>
      </div>
      <pre class="source-preview-box">{{ sourcePreview.text }}</pre>
      <template #footer>
        <el-button type="primary" @click="sourcePreview.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="bindCodeDialog.visible" title="设备授权码" width="460px">
      <div class="bind-code-box">
        <span>{{ bindCodeDialog.code }}</span>
      </div>
      <p class="dialog-note">授权码仅在本次操作后返回，请交给对应桌面采集端完成绑定。</p>
      <template #footer>
        <el-button type="primary" @click="bindCodeDialog.visible = false">我已记录</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  Check,
  Close,
  Document,
  List,
  Monitor,
  Plus,
  Refresh,
  Search,
  Setting
} from '@element-plus/icons-vue'
import { getToken } from '@/utils/auth'

const router = useRouter()
const activeView = ref('assets')
const lastLoadedAt = ref('')

const overview = ref({
  metrics: {},
  statusBreakdown: []
})
const overviewLoading = ref(false)

const assets = reactive({ loading: false, total: 0, items: [] })
const devices = reactive({ loading: false, total: 0, items: [] })
const logs = reactive({ loading: false, total: 0, items: [] })
const businessSources = reactive({ loading: false, total: 0, items: [] })
const recalculationTasks = reactive({ loading: false, total: 0, items: [] })
const hrAttendanceSnapshots = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})
const payrollPrecheckSnapshots = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})
const productionReports = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})
const qualityInspections = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})

const assetPage = ref(1)
const assetPageSize = ref(50)
const devicePage = ref(1)
const devicePageSize = ref(50)
const logPage = ref(1)
const logPageSize = ref(100)
const recalculationTaskPage = ref(1)
const recalculationTaskPageSize = ref(50)
const productionReportPage = ref(1)
const productionReportPageSize = ref(50)
const qualityInspectionPage = ref(1)
const qualityInspectionPageSize = ref(50)
const hrAttendanceSnapshotPage = ref(1)
const hrAttendanceSnapshotPageSize = ref(50)
const payrollPrecheckPage = ref(1)
const payrollPrecheckPageSize = ref(50)

const assetFilters = reactive({
  status: '',
  duplicate: '',
  uploadSource: '',
  operatorSource: '',
  targetModule: '',
  targetDocumentType: '',
  deviceCode: '',
  uploadedBy: '',
  uploadedByRole: '',
  sourceFolder: '',
  fileHash: '',
  search: ''
})
const deviceFilters = reactive({
  status: '',
  onlineStatus: '',
  healthIssue: '',
  clientVersion: '',
  webviewVersion: '',
  defaultUser: '',
  defaultRole: '',
  lastSeenFrom: '',
  lastSeenTo: '',
  search: ''
})
const logFilters = reactive({
  level: '',
  deviceCode: '',
  username: '',
  role: '',
  appModule: '',
  route: '',
  eventType: '',
  batchNo: '',
  fileHash: '',
  assetStatus: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  duplicate: '',
  sourceFolder: '',
  clientSessionId: '',
  traceId: '',
  search: ''
})
const businessSourceFilters = reactive({
  targetAppId: '',
  targetSchema: '',
  targetTable: '',
  targetRecordId: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  sourceFolder: '',
  duplicateBusinessSource: '',
  businessLinkId: ''
})
const recalculationTaskFilters = reactive({
  status: 'pending',
  targetSchema: '',
  targetTable: '',
  targetRecordId: '',
  requestedBy: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  sourceFolder: '',
  search: ''
})
const productionReportFilters = reactive({
  dateFrom: '',
  dateTo: '',
  reportNo: '',
  workOrderNo: '',
  productMaterialCode: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  duplicateBusinessSource: '',
  sourceFolder: '',
  search: ''
})
const qualityInspectionFilters = reactive({
  dateFrom: '',
  dateTo: '',
  docNo: '',
  sourceDocNo: '',
  inspectionType: '',
  itemCode: '',
  result: '',
  inspector: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  duplicateBusinessSource: '',
  sourceFolder: '',
  search: ''
})
const hrAttendanceSnapshotFilters = reactive({
  month: '',
  confirmationStatus: '',
  payrollPrecheckStatus: '',
  employeeNo: '',
  employeeName: '',
  deptName: '',
  sourceTargetRecordId: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  duplicateBusinessSource: '',
  sourceFolder: '',
  search: ''
})
const hrAttendanceSnapshotActionLoading = reactive({})
const payrollPrecheckFilters = reactive({
  month: '',
  employeeNo: '',
  employeeName: '',
  deptName: '',
  sourceTargetRecordId: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  duplicateBusinessSource: '',
  sourceFolder: '',
  search: ''
})

const assetDrawer = reactive({
  visible: false,
  loading: false,
  reviewing: false,
  previewing: false,
  downloading: false,
  detail: null
})
const assetDetailTab = ref('parse')
const sourcePreview = reactive({
  visible: false,
  title: '',
  text: '',
  truncated: false,
  maxBytes: 0,
  fileSize: 0
})

const emptyPolicyForm = () => ({
  enabled: true,
  defaultAutoImportMode: 'auto_import',
  lowConfidencePolicy: 'auto_import_with_review',
  unrecognizedFilePolicy: 'archive_and_review',
  duplicateFilePolicy: 'skip_duplicate',
  unmappedFieldPolicy: 'remarks',
  businessCorrectionPolicy: 'record_and_recalculate',
  logCollectionEnabled: true,
  confidenceThreshold: 0.7,
  logRetentionDays: 30,
  sourceFileRetentionDays: 180,
  documentTypeMappings: []
})

const policyDialog = reactive({
  visible: false,
  loading: false,
  saving: false,
  resetting: false,
  retentionPreviewing: false,
  retentionRunning: false
})
const policyForm = reactive(emptyPolicyForm())
const sourceRetentionResult = ref(null)
const documentTypeMappingRows = ref([])

const emptyDeviceForm = () => ({
  id: '',
  enterpriseId: 'local',
  deviceCode: '',
  deviceName: '',
  status: 'pending',
  defaultUserId: '',
  defaultUsername: '',
  defaultRole: '',
  configVersion: '',
  remoteConfigText: '',
  healthSnapshot: {},
  watchFolders: []
})

const deviceDialog = reactive({
  visible: false,
  mode: 'create',
  saving: false
})
const deviceForm = reactive(emptyDeviceForm())
const bindCodeDialog = reactive({
  visible: false,
  code: ''
})

const loadingAny = computed(() =>
  overviewLoading.value || assets.loading || devices.loading || logs.loading || businessSources.loading || recalculationTasks.loading || productionReports.loading || qualityInspections.loading || hrAttendanceSnapshots.loading || payrollPrecheckSnapshots.loading
)

const lastLoadedAtText = computed(() => lastLoadedAt.value ? `刷新于 ${formatTimeOnly(lastLoadedAt.value)}` : '尚未刷新')

const sourceRetentionSummary = computed(() => {
  const result = sourceRetentionResult.value
  if (!result) return ''
  const mode = result.dryRun ? '预检' : '清理'
  return `${mode} ${result.scannedCount || 0} 个，删除 ${result.deletedCount || 0} 个，缺失 ${result.missingCount || 0} 个，跳过 ${result.skippedCount || 0} 个`
})

const overviewCards = computed(() => {
  const metrics = overview.value.metrics || {}
  return [
    { key: 'todayFileCount', label: '今日采集', value: metrics.todayFileCount || 0, note: '文件数', tone: 'blue' },
    { key: 'todayImportedCount', label: '成功入库', value: metrics.todayImportedCount || 0, note: '已写入业务', tone: 'green' },
    { key: 'classifiedCount', label: '已分类', value: metrics.classifiedCount || 0, note: '待入库/复核', tone: 'green' },
    { key: 'archivedCount', label: '已归档', value: metrics.archivedCount || 0, note: '仅保留来源', tone: 'slate' },
    { key: 'lowConfidenceCount', label: '低置信度', value: metrics.lowConfidenceCount || 0, note: '需要复核', tone: 'orange' },
    { key: 'pendingRecalculationTaskCount', label: '待重算', value: metrics.pendingRecalculationTaskCount || 0, note: '修正后待处理', tone: 'orange' },
    { key: 'unrecognizedCount', label: '未识别', value: metrics.unrecognizedCount || 0, note: '待人工分类', tone: 'slate' },
    { key: 'duplicateCount', label: '重复文件', value: metrics.duplicateCount || 0, note: '已拦截', tone: 'slate' },
    { key: 'failedCount', label: '失败', value: metrics.failedCount || 0, note: '需排查', tone: 'red' },
    { key: 'activeDeviceCount', label: '活跃设备', value: metrics.activeDeviceCount || 0, note: '最近心跳', tone: 'green' },
    { key: 'offlineDeviceCount', label: '离线设备', value: metrics.offlineDeviceCount || 0, note: '超时未心跳', tone: 'orange' }
  ]
})

const policyCards = computed(() => {
  const policies = overview.value.policies || {}
  return [
    { key: 'enabled', label: '收单开关', value: policies.enabled === false ? '停用' : '启用' },
    { key: 'autoImport', label: '自动入库', value: policyText(policies.defaultAutoImportMode, policyTextMaps.defaultAutoImportMode) },
    { key: 'lowConfidence', label: '低置信度', value: policyText(policies.lowConfidencePolicy, policyTextMaps.lowConfidencePolicy) },
    { key: 'unmapped', label: '未匹配字段', value: policyText(policies.unmappedFieldPolicy, policyTextMaps.unmappedFieldPolicy) },
    { key: 'duplicate', label: '重复文件', value: policyText(policies.duplicateFilePolicy, policyTextMaps.duplicateFilePolicy) },
    { key: 'retention', label: '文件保留', value: `${policies.sourceFileRetentionDays || '-'} 天` },
    { key: 'typeMappings', label: '类型映射', value: `${Array.isArray(policies.documentTypeMappings) ? policies.documentTypeMappings.length : 0} 条` }
  ]
})

const navItems = computed(() => [
  {
    key: 'assets',
    title: '采集文件',
    desc: '识别与入库追溯',
    icon: Document,
    metric: String(assets.total || overview.value.metrics?.todayFileCount || 0)
  },
  {
    key: 'devices',
    title: '设备管理',
    desc: '授权、目录、在线态',
    icon: Monitor,
    metric: String(devices.total || overview.value.metrics?.activeDeviceCount || 0)
  },
  {
    key: 'logs',
    title: '日志中心',
    desc: '错误与 trace 检索',
    icon: List,
    metric: String(logs.total || 0)
  },
  {
    key: 'recalculation',
    title: '重算任务',
    desc: '修正后待处理',
    icon: List,
    metric: String(recalculationTasks.total || overview.value.metrics?.pendingRecalculationTaskCount || 0)
  },
  {
    key: 'productionReports',
    title: '生产报工',
    desc: '生产日报入库结果',
    icon: List,
    metric: productionReports.unavailable ? '-' : String(productionReports.total || 0)
  },
  {
    key: 'qualityInspections',
    title: '质检记录',
    desc: '质量检验入库结果',
    icon: List,
    metric: qualityInspections.unavailable ? '-' : String(qualityInspections.total || 0)
  },
  {
    key: 'hrAttendance',
    title: '考勤快照',
    desc: '月度重算结果',
    icon: List,
    metric: hrAttendanceSnapshots.unavailable ? '-' : String(hrAttendanceSnapshots.total || 0)
  },
  {
    key: 'payrollPrecheck',
    title: '薪资前置',
    desc: '只读审核队列',
    icon: List,
    metric: payrollPrecheckSnapshots.unavailable ? '-' : String(payrollPrecheckSnapshots.total || 0)
  },
  {
    key: 'sources',
    title: '来源追溯',
    desc: '业务记录反查',
    icon: Document,
    metric: String(businessSources.total || 0)
  }
])

const latestParseText = computed(() => {
  const rows = assetDrawer.detail?.parseResults || []
  return rows[0]?.textContent || '暂无 OCR 文本'
})

const formatJson = (value) => {
  try {
    return JSON.stringify(value || {}, null, 2)
  } catch {
    return String(value || '')
  }
}

const formatEntryValue = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'object') return formatJson(value)
  return String(value)
}

const entryPlanDocuments = (plan) => Array.isArray(plan?.documents) ? plan.documents : []

const entryDocumentTitle = (document, index) =>
  document?.target_document_type ||
  document?.targetDocumentType ||
  document?.document_type ||
  document?.documentType ||
  document?.code ||
  document?.document_no ||
  document?.documentNo ||
  `生成单据 ${index + 1}`

const entryDocumentSource = (document) =>
  document?.source_asset_filename ||
  document?.sourceAssetFilename ||
  document?.source ||
  ''

const entryDocumentMappingStatus = (document) =>
  document?.field_mapping_status ||
  document?.fieldMappingStatus ||
  '字段映射'

const entryDocumentFields = (document) => {
  const fields = document?.fields || document?.fieldMappings || document?.field_mappings || {}
  if (Array.isArray(fields)) {
    return fields.map((field, index) => ({
      name: field?.name || field?.field || `字段 ${index + 1}`,
      value: formatEntryValue(field?.value ?? field?.mappedValue ?? field?.mapped_value)
    }))
  }
  if (fields && typeof fields === 'object') {
    return Object.entries(fields).map(([name, value]) => ({ name, value: formatEntryValue(value) }))
  }
  return []
}

const entryDocumentLineItems = (document) =>
  Array.isArray(document?.line_items)
    ? document.line_items
    : (Array.isArray(document?.lineItems) ? document.lineItems : [])

const entryDocumentRemarks = (document) =>
  document?.ai_unmapped_remarks ||
  document?.aiUnmappedRemarks ||
  document?.remarks ||
  ''

const canApproveAssetReview = computed(() => {
  const status = assetDrawer.detail?.asset?.reviewStatus
  return ['review_required', 'archived_only'].includes(status)
})

const duplicateOriginText = (asset = {}) => {
  const filename = toDisplayText(asset.duplicateOfOriginalFilename)
  const assetId = toDisplayText(asset.duplicateOfAssetId)
  if (filename && assetId) return `${filename}（${assetId}）`
  return filename || assetId || '原始文件信息待补充'
}

const duplicateOriginMetaText = (asset = {}) => {
  const parts = []
  if (asset.duplicateOfUploadSource) parts.push(uploadSourceText(asset.duplicateOfUploadSource))
  if (asset.duplicateOfUploadedAt) parts.push(formatDateTime(asset.duplicateOfUploadedAt))
  if (asset.duplicateOfFileHash) parts.push(`Hash ${toDisplayText(asset.duplicateOfFileHash).slice(0, 12)}`)
  return parts.filter(Boolean).join(' · ')
}

const aiSupplementRemarks = computed(() => {
  const detail = assetDrawer.detail
  if (!detail) return ''

  const planRemarks = (detail.entryPlans || [])
    .flatMap((plan) => {
      const documents = Array.isArray(plan.documents) ? plan.documents : []
      return [
        plan.metadata?.ai_unmapped_remarks,
        ...documents.map((document) => document?.ai_unmapped_remarks || document?.remarks)
      ]
    })
    .map(toDisplayText)
    .find(Boolean)

  if (planRemarks) return planRemarks

  const remarkFields = (detail.unmappedFields || [])
    .filter((field) => String(field.writeLocation || '').toLowerCase() === 'remarks')
    .filter((field) => field.name || field.value)

  if (!remarkFields.length) return ''

  return [
    '【AI未匹配字段】',
    ...remarkFields.map((field) => `${toDisplayText(field.name) || '未命名字段'}：${toDisplayText(field.value)}`)
  ].join('\n')
})

const toDisplayText = (value) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.trim()
  return String(value).trim()
}

const normalizeDocumentTypeMappingKeywords = (value) => {
  const rawKeywords = Array.isArray(value)
    ? value
    : String(value || '').split(/[,，、\n]/)
  return [...new Set(rawKeywords.map(toDisplayText).filter(Boolean))]
}

const createDocumentTypeMappingRow = (mapping = {}, index = 0) => {
  const targetDocumentType = toDisplayText(mapping.targetDocumentType || mapping.target_document_type)
  const keywords = normalizeDocumentTypeMappingKeywords(mapping.keywords || mapping.keyword_list)
  return {
    id: toDisplayText(mapping.id) || `mapping-${Date.now()}-${index + 1}`,
    name: toDisplayText(mapping.name) || targetDocumentType,
    enabled: mapping.enabled !== false,
    targetModule: toDisplayText(mapping.targetModule || mapping.target_module),
    targetDocumentType,
    targetKind: toDisplayText(mapping.targetKind || mapping.target_kind) || 'fixed_module_table',
    keywordText: keywords.join('、'),
    priority: Number.isFinite(Number(mapping.priority)) ? Number(mapping.priority) : 100
  }
}

const addDocumentTypeMapping = () => {
  documentTypeMappingRows.value.push(createDocumentTypeMappingRow({}, documentTypeMappingRows.value.length))
}

const removeDocumentTypeMapping = (index) => {
  documentTypeMappingRows.value.splice(index, 1)
}

const collectDocumentTypeMappings = () => {
  const mappings = []
  for (const [index, row] of documentTypeMappingRows.value.entries()) {
    const targetModule = toDisplayText(row.targetModule)
    const targetDocumentType = toDisplayText(row.targetDocumentType)
    const keywords = normalizeDocumentTypeMappingKeywords(row.keywordText)
    const hasAnyValue = targetModule || targetDocumentType || keywords.length || toDisplayText(row.name)
    if (!hasAnyValue) continue
    if (!targetModule || !targetDocumentType || !keywords.length) {
      ElMessage.error(`请完整填写第 ${index + 1} 条单据类型映射`)
      return null
    }
    mappings.push({
      id: toDisplayText(row.id) || `mapping-${index + 1}`,
      name: toDisplayText(row.name) || targetDocumentType,
      enabled: row.enabled !== false,
      targetModule,
      targetDocumentType,
      targetKind: toDisplayText(row.targetKind) || 'fixed_module_table',
      keywords,
      priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 100
    })
  }
  return mappings
}

const hasLogMetadata = (row) => {
  const metadata = row?.metadata
  return metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0
}

const formatLogMetadata = (metadata) => formatJson(metadata)

const businessLinkHref = (row) => {
  const appId = String(row?.targetAppId || '').trim()
  const recordId = String(row?.targetRecordId || '').trim()
  if (!appId || !recordId) return ''
  return `/apps/app/${encodeURIComponent(appId)}/record/${encodeURIComponent(recordId)}`
}

const filenameFromContentDisposition = (header, fallback) => {
  const text = String(header || '')
  const encoded = text.match(/filename\*=UTF-8''([^;]+)/i)
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1])
    } catch (error) {}
  }
  const quoted = text.match(/filename="([^"]+)"/i)
  return quoted?.[1] || fallback || 'document-asset.bin'
}

const agentRequest = async (path, options = {}) => {
  const token = getToken()
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
  const response = await fetch(`/agent${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.message || payload?.code || `请求失败(${response.status})`
    throw new Error(message)
  }
  return payload
}

const toQuery = (params) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

const loadOverview = async () => {
  overviewLoading.value = true
  try {
    overview.value = await agentRequest('/document-intake/admin/overview')
    lastLoadedAt.value = new Date().toISOString()
  } catch (error) {
    ElMessage.error(`总览加载失败：${error.message}`)
  } finally {
    overviewLoading.value = false
  }
}

const applyPolicyPayload = (payload = {}) => {
  const policies = payload.policy || payload.policies || payload
  if (!policies || typeof policies !== 'object') return
  Object.assign(policyForm, emptyPolicyForm(), policies)
  documentTypeMappingRows.value = Array.isArray(policyForm.documentTypeMappings)
    ? policyForm.documentTypeMappings.map((mapping, index) => createDocumentTypeMappingRow(mapping, index))
    : []
  overview.value = {
    ...overview.value,
    policies: {
      ...policies,
      documentTypeMappings: documentTypeMappingRows.value.map((row, index) => ({
        id: toDisplayText(row.id) || `mapping-${index + 1}`,
        name: toDisplayText(row.name) || toDisplayText(row.targetDocumentType),
        enabled: row.enabled !== false,
        targetModule: toDisplayText(row.targetModule),
        targetDocumentType: toDisplayText(row.targetDocumentType),
        targetKind: toDisplayText(row.targetKind) || 'fixed_module_table',
        keywords: normalizeDocumentTypeMappingKeywords(row.keywordText),
        priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 100
      }))
    },
    policyOptions: payload.policyOptions || payload.options || overview.value.policyOptions || {}
  }
}

const openPolicyDialog = async () => {
  applyPolicyPayload({ policies: overview.value.policies || emptyPolicyForm() })
  sourceRetentionResult.value = null
  policyDialog.visible = true
  policyDialog.loading = true
  try {
    const payload = await agentRequest('/document-intake/admin/policies')
    applyPolicyPayload(payload)
  } catch (error) {
    ElMessage.error(`策略加载失败：${error.message}`)
  } finally {
    policyDialog.loading = false
  }
}

const savePolicyDialog = async () => {
  const documentTypeMappings = collectDocumentTypeMappings()
  if (!documentTypeMappings) return
  policyDialog.saving = true
  try {
    const payload = await agentRequest('/document-intake/admin/policies', {
      method: 'PATCH',
      body: { policy: { ...policyForm, documentTypeMappings } }
    })
    applyPolicyPayload(payload)
    policyDialog.visible = false
    ElMessage.success('策略已保存')
  } catch (error) {
    ElMessage.error(`策略保存失败：${error.message}`)
  } finally {
    policyDialog.saving = false
  }
}

const resetPolicyDialog = async () => {
  try {
    await ElMessageBox.confirm('确定恢复智能收单策略默认值？', '恢复默认策略', {
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch (error) {
    if (error === 'cancel') return
    if (error === 'close') return
    throw error
  }

  policyDialog.resetting = true
  try {
    const payload = await agentRequest('/document-intake/admin/policies/reset', { method: 'POST', body: {} })
    applyPolicyPayload(payload)
    ElMessage.success('已恢复默认策略')
  } catch (error) {
    ElMessage.error(`恢复失败：${error.message}`)
  } finally {
    policyDialog.resetting = false
  }
}

const requestSourceRetention = async (dryRun) => {
  const payload = await agentRequest('/document-intake/admin/source-file-retention/run', {
    method: 'POST',
    body: {
      dryRun,
      retentionDays: policyForm.sourceFileRetentionDays,
      limit: 100
    }
  })
  sourceRetentionResult.value = payload
  return payload
}

const previewSourceRetention = async () => {
  policyDialog.retentionPreviewing = true
  try {
    await requestSourceRetention(true)
    ElMessage.success('源文件保留预检完成')
  } catch (error) {
    ElMessage.error(`源文件预检失败：${error.message}`)
  } finally {
    policyDialog.retentionPreviewing = false
  }
}

const runSourceRetention = async () => {
  try {
    await ElMessageBox.confirm('确定清理超过保留天数的源文件？', '清理源文件', {
      confirmButtonText: '清理',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch (error) {
    if (error === 'cancel') return
    if (error === 'close') return
    throw error
  }

  policyDialog.retentionRunning = true
  try {
    await requestSourceRetention(false)
    ElMessage.success('源文件清理完成')
  } catch (error) {
    ElMessage.error(`源文件清理失败：${error.message}`)
  } finally {
    policyDialog.retentionRunning = false
  }
}

const loadAssets = async () => {
  assets.loading = true
  try {
    const query = toQuery({
      status: assetFilters.status,
      duplicate: assetFilters.duplicate,
      uploadSource: assetFilters.uploadSource,
      operatorSource: assetFilters.operatorSource,
      targetModule: assetFilters.targetModule,
      targetDocumentType: assetFilters.targetDocumentType,
      deviceCode: assetFilters.deviceCode,
      uploadedBy: assetFilters.uploadedBy,
      uploadedByRole: assetFilters.uploadedByRole,
      sourceFolder: assetFilters.sourceFolder,
      fileHash: assetFilters.fileHash,
      search: assetFilters.search,
      limit: assetPageSize.value,
      offset: (assetPage.value - 1) * assetPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/assets${query}`)
    assets.total = payload.total || 0
    assets.items = payload.items || []
  } catch (error) {
    ElMessage.error(`文件列表加载失败：${error.message}`)
  } finally {
    assets.loading = false
  }
}

const resetAssetFilters = (values = {}) => {
  Object.assign(assetFilters, {
    status: '',
    duplicate: '',
    uploadSource: '',
    operatorSource: '',
    targetModule: '',
    targetDocumentType: '',
    deviceCode: '',
    uploadedBy: '',
    uploadedByRole: '',
    sourceFolder: '',
    fileHash: '',
    search: '',
    ...values
  })
}

const resetAssetFiltersAndLoad = async () => {
  resetAssetFilters()
  assetPage.value = 1
  await loadAssets()
}

const loadDevices = async () => {
  devices.loading = true
  try {
    const query = toQuery({
      status: deviceFilters.status,
      onlineStatus: deviceFilters.onlineStatus,
      healthIssue: deviceFilters.healthIssue,
      clientVersion: deviceFilters.clientVersion,
      webviewVersion: deviceFilters.webviewVersion,
      defaultUser: deviceFilters.defaultUser,
      defaultRole: deviceFilters.defaultRole,
      lastSeenFrom: deviceFilters.lastSeenFrom,
      lastSeenTo: deviceFilters.lastSeenTo,
      search: deviceFilters.search,
      limit: devicePageSize.value,
      offset: (devicePage.value - 1) * devicePageSize.value,
      activeWindowMinutes: 10
    })
    const payload = await agentRequest(`/document-intake/admin/devices${query}`)
    devices.total = payload.total || 0
    devices.items = payload.items || []
  } catch (error) {
    ElMessage.error(`设备列表加载失败：${error.message}`)
  } finally {
    devices.loading = false
  }
}

const resetDeviceFilters = (values = {}) => {
  Object.assign(deviceFilters, {
    status: '',
    onlineStatus: '',
    healthIssue: '',
    clientVersion: '',
    webviewVersion: '',
    defaultUser: '',
    defaultRole: '',
    lastSeenFrom: '',
    lastSeenTo: '',
    search: '',
    ...values
  })
}

const resetDeviceFiltersAndLoad = async () => {
  resetDeviceFilters()
  devicePage.value = 1
  await loadDevices()
}

const loadLogs = async () => {
  logs.loading = true
  try {
    const query = toQuery({
      level: logFilters.level,
      deviceCode: logFilters.deviceCode,
      username: logFilters.username,
      role: logFilters.role,
      appModule: logFilters.appModule,
      route: logFilters.route,
      eventType: logFilters.eventType,
      batchNo: logFilters.batchNo,
      fileHash: logFilters.fileHash,
      assetStatus: logFilters.assetStatus,
      uploadedBy: logFilters.uploadedBy,
      uploadedByRole: logFilters.uploadedByRole,
      uploadSource: logFilters.uploadSource,
      operatorSource: logFilters.operatorSource,
      duplicate: logFilters.duplicate,
      sourceFolder: logFilters.sourceFolder,
      clientSessionId: logFilters.clientSessionId,
      traceId: logFilters.traceId,
      search: logFilters.search,
      limit: logPageSize.value,
      offset: (logPage.value - 1) * logPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/logs${query}`)
    logs.total = payload.total || 0
    logs.items = payload.items || []
  } catch (error) {
    ElMessage.error(`日志加载失败：${error.message}`)
  } finally {
    logs.loading = false
  }
}

const loadRecalculationTasks = async () => {
  recalculationTasks.loading = true
  try {
    const query = toQuery({
      status: recalculationTaskFilters.status,
      targetSchema: recalculationTaskFilters.targetSchema,
      targetTable: recalculationTaskFilters.targetTable,
      targetRecordId: recalculationTaskFilters.targetRecordId,
      requestedBy: recalculationTaskFilters.requestedBy,
      uploadedBy: recalculationTaskFilters.uploadedBy,
      uploadedByRole: recalculationTaskFilters.uploadedByRole,
      uploadSource: recalculationTaskFilters.uploadSource,
      operatorSource: recalculationTaskFilters.operatorSource,
      sourceFolder: recalculationTaskFilters.sourceFolder,
      search: recalculationTaskFilters.search,
      limit: recalculationTaskPageSize.value,
      offset: (recalculationTaskPage.value - 1) * recalculationTaskPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/recalculation-tasks${query}`)
    recalculationTasks.total = payload.total || 0
    recalculationTasks.items = payload.items || []
  } catch (error) {
    ElMessage.error(`重算任务加载失败：${error.message}`)
  } finally {
    recalculationTasks.loading = false
  }
}

const loadProductionReports = async () => {
  productionReports.loading = true
  try {
    const query = toQuery({
      dateFrom: productionReportFilters.dateFrom,
      dateTo: productionReportFilters.dateTo,
      reportNo: productionReportFilters.reportNo,
      workOrderNo: productionReportFilters.workOrderNo,
      productMaterialCode: productionReportFilters.productMaterialCode,
      uploadedBy: productionReportFilters.uploadedBy,
      uploadedByRole: productionReportFilters.uploadedByRole,
      uploadSource: productionReportFilters.uploadSource,
      operatorSource: productionReportFilters.operatorSource,
      duplicateBusinessSource: productionReportFilters.duplicateBusinessSource,
      sourceFolder: productionReportFilters.sourceFolder,
      search: productionReportFilters.search,
      limit: productionReportPageSize.value,
      offset: (productionReportPage.value - 1) * productionReportPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/production-work-reports${query}`)
    productionReports.total = payload.total || 0
    productionReports.items = payload.items || []
    productionReports.unavailable = Boolean(payload.unavailable)
    productionReports.unavailableReason = payload.unavailableReason || ''
  } catch (error) {
    ElMessage.error(`生产报工加载失败：${error.message}`)
  } finally {
    productionReports.loading = false
  }
}

const resetProductionReportFilters = (values = {}) => {
  Object.assign(productionReportFilters, {
    dateFrom: '',
    dateTo: '',
    reportNo: '',
    workOrderNo: '',
    productMaterialCode: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    duplicateBusinessSource: '',
    sourceFolder: '',
    search: '',
    ...values
  })
}

const resetProductionReportFiltersAndLoad = async () => {
  resetProductionReportFilters()
  productionReportPage.value = 1
  await loadProductionReports()
}

const loadQualityInspections = async () => {
  qualityInspections.loading = true
  try {
    const query = toQuery({
      dateFrom: qualityInspectionFilters.dateFrom,
      dateTo: qualityInspectionFilters.dateTo,
      docNo: qualityInspectionFilters.docNo,
      sourceDocNo: qualityInspectionFilters.sourceDocNo,
      inspectionType: qualityInspectionFilters.inspectionType,
      itemCode: qualityInspectionFilters.itemCode,
      result: qualityInspectionFilters.result,
      inspector: qualityInspectionFilters.inspector,
      uploadedBy: qualityInspectionFilters.uploadedBy,
      uploadedByRole: qualityInspectionFilters.uploadedByRole,
      uploadSource: qualityInspectionFilters.uploadSource,
      operatorSource: qualityInspectionFilters.operatorSource,
      duplicateBusinessSource: qualityInspectionFilters.duplicateBusinessSource,
      sourceFolder: qualityInspectionFilters.sourceFolder,
      search: qualityInspectionFilters.search,
      limit: qualityInspectionPageSize.value,
      offset: (qualityInspectionPage.value - 1) * qualityInspectionPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/quality-inspections${query}`)
    qualityInspections.total = payload.total || 0
    qualityInspections.items = payload.items || []
    qualityInspections.unavailable = Boolean(payload.unavailable)
    qualityInspections.unavailableReason = payload.unavailableReason || ''
  } catch (error) {
    ElMessage.error(`质检记录加载失败：${error.message}`)
  } finally {
    qualityInspections.loading = false
  }
}

const resetQualityInspectionFilters = (values = {}) => {
  Object.assign(qualityInspectionFilters, {
    dateFrom: '',
    dateTo: '',
    docNo: '',
    sourceDocNo: '',
    inspectionType: '',
    itemCode: '',
    result: '',
    inspector: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    duplicateBusinessSource: '',
    sourceFolder: '',
    search: '',
    ...values
  })
}

const resetQualityInspectionFiltersAndLoad = async () => {
  resetQualityInspectionFilters()
  qualityInspectionPage.value = 1
  await loadQualityInspections()
}

const loadHrAttendanceSnapshots = async () => {
  hrAttendanceSnapshots.loading = true
  try {
    const query = toQuery({
      month: hrAttendanceSnapshotFilters.month,
      confirmationStatus: hrAttendanceSnapshotFilters.confirmationStatus,
      payrollPrecheckStatus: hrAttendanceSnapshotFilters.payrollPrecheckStatus,
      employeeNo: hrAttendanceSnapshotFilters.employeeNo,
      employeeName: hrAttendanceSnapshotFilters.employeeName,
      deptName: hrAttendanceSnapshotFilters.deptName,
      sourceTargetRecordId: hrAttendanceSnapshotFilters.sourceTargetRecordId,
      uploadedBy: hrAttendanceSnapshotFilters.uploadedBy,
      uploadedByRole: hrAttendanceSnapshotFilters.uploadedByRole,
      uploadSource: hrAttendanceSnapshotFilters.uploadSource,
      operatorSource: hrAttendanceSnapshotFilters.operatorSource,
      duplicateBusinessSource: hrAttendanceSnapshotFilters.duplicateBusinessSource,
      sourceFolder: hrAttendanceSnapshotFilters.sourceFolder,
      search: hrAttendanceSnapshotFilters.search,
      limit: hrAttendanceSnapshotPageSize.value,
      offset: (hrAttendanceSnapshotPage.value - 1) * hrAttendanceSnapshotPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/hr-attendance-snapshots${query}`)
    hrAttendanceSnapshots.total = payload.total || 0
    hrAttendanceSnapshots.items = payload.items || []
    hrAttendanceSnapshots.unavailable = Boolean(payload.unavailable)
    hrAttendanceSnapshots.unavailableReason = payload.unavailableReason || ''
  } catch (error) {
    ElMessage.error(`考勤快照加载失败：${error.message}`)
  } finally {
    hrAttendanceSnapshots.loading = false
  }
}

const resetHrAttendanceSnapshotFilters = (values = {}) => {
  Object.assign(hrAttendanceSnapshotFilters, {
    month: '',
    confirmationStatus: '',
    payrollPrecheckStatus: '',
    employeeNo: '',
    employeeName: '',
    deptName: '',
    sourceTargetRecordId: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    duplicateBusinessSource: '',
    sourceFolder: '',
    search: '',
    ...values
  })
}

const resetHrAttendanceSnapshotFiltersAndLoad = async () => {
  resetHrAttendanceSnapshotFilters()
  hrAttendanceSnapshotPage.value = 1
  await loadHrAttendanceSnapshots()
}

const loadPayrollPrecheckSnapshots = async () => {
  payrollPrecheckSnapshots.loading = true
  try {
    const query = toQuery({
      month: payrollPrecheckFilters.month,
      employeeNo: payrollPrecheckFilters.employeeNo,
      employeeName: payrollPrecheckFilters.employeeName,
      deptName: payrollPrecheckFilters.deptName,
      sourceTargetRecordId: payrollPrecheckFilters.sourceTargetRecordId,
      uploadedBy: payrollPrecheckFilters.uploadedBy,
      uploadedByRole: payrollPrecheckFilters.uploadedByRole,
      uploadSource: payrollPrecheckFilters.uploadSource,
      operatorSource: payrollPrecheckFilters.operatorSource,
      duplicateBusinessSource: payrollPrecheckFilters.duplicateBusinessSource,
      sourceFolder: payrollPrecheckFilters.sourceFolder,
      search: payrollPrecheckFilters.search,
      limit: payrollPrecheckPageSize.value,
      offset: (payrollPrecheckPage.value - 1) * payrollPrecheckPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/hr-payroll-precheck-snapshots${query}`)
    payrollPrecheckSnapshots.total = payload.total || 0
    payrollPrecheckSnapshots.items = payload.items || []
    payrollPrecheckSnapshots.unavailable = Boolean(payload.unavailable)
    payrollPrecheckSnapshots.unavailableReason = payload.unavailableReason || ''
  } catch (error) {
    ElMessage.error(`薪资前置快照加载失败：${error.message}`)
  } finally {
    payrollPrecheckSnapshots.loading = false
  }
}

const resetPayrollPrecheckFilters = (values = {}) => {
  Object.assign(payrollPrecheckFilters, {
    month: '',
    employeeNo: '',
    employeeName: '',
    deptName: '',
    sourceTargetRecordId: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    duplicateBusinessSource: '',
    sourceFolder: '',
    search: '',
    ...values
  })
}

const resetPayrollPrecheckFiltersAndLoad = async () => {
  resetPayrollPrecheckFilters()
  payrollPrecheckPage.value = 1
  await loadPayrollPrecheckSnapshots()
}

const isMessageBoxCancel = (error) => (
  error === 'cancel' ||
  error === 'close' ||
  error?.action === 'cancel' ||
  error?.action === 'close'
)

const runHrAttendanceSnapshotAction = async (row, action) => {
  if (!row?.id || hrAttendanceSnapshotActionLoading[row.id]) return

  const body = { action }
  try {
    if (action === 'confirm') {
      await ElMessageBox.confirm(
        `确认 ${row.employeeName || row.employeeNo || '该员工'} ${row.month || ''} 的考勤快照？`,
        '确认考勤快照',
        {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } else if (action === 'reject') {
      const result = await ElMessageBox.prompt(
        `退回 ${row.employeeName || row.employeeNo || '该员工'} ${row.month || ''} 的考勤快照，请填写原因。`,
        '退回考勤快照',
        {
          confirmButtonText: '退回',
          cancelButtonText: '取消',
          inputType: 'textarea',
          inputPlaceholder: '例如：本月请假记录缺少审批单，需要重新修正来源资料',
          inputPattern: /\S+/,
          inputErrorMessage: '请填写退回原因'
        }
      )
      body.reason = result.value
      body.note = result.value
    } else if (action === 'submit_payroll_precheck') {
      await ElMessageBox.confirm(
        `将 ${row.employeeName || row.employeeNo || '该员工'} ${row.month || ''} 的考勤快照提交到薪资核算前置审核？`,
        '薪资前置审核',
        {
          confirmButtonText: '提交',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    }

    hrAttendanceSnapshotActionLoading[row.id] = action
    const payload = await agentRequest(`/document-intake/admin/hr-attendance-snapshots/${row.id}/action`, {
      method: 'POST',
      body
    })
    if (payload.snapshot) Object.assign(row, payload.snapshot)
    ElMessage.success({
      confirm: '考勤快照已确认',
      reject: '考勤快照已退回',
      submit_payroll_precheck: '已提交薪资核算前置审核'
    }[action] || '考勤快照已更新')
    await loadHrAttendanceSnapshots()
    if (action === 'submit_payroll_precheck') {
      await loadPayrollPrecheckSnapshots()
    }
  } catch (error) {
    if (isMessageBoxCancel(error)) return
    if (error?.message) ElMessage.error(`考勤快照更新失败：${error.message}`)
  } finally {
    delete hrAttendanceSnapshotActionLoading[row.id]
  }
}

const hasBusinessSourceLocator = () => {
  if (String(businessSourceFilters.businessLinkId || '').trim()) return true
  if (String(businessSourceFilters.targetAppId || '').trim() && String(businessSourceFilters.targetRecordId || '').trim()) return true
  return Boolean(
    String(businessSourceFilters.targetSchema || '').trim() &&
    String(businessSourceFilters.targetTable || '').trim() &&
    String(businessSourceFilters.targetRecordId || '').trim()
  )
}

const loadBusinessSources = async () => {
  if (!hasBusinessSourceLocator()) {
    ElMessage.warning('请填写业务链接 ID、应用 ID + 业务记录 ID，或业务 schema + 业务表 + 业务记录 ID')
    return
  }
  businessSources.loading = true
  try {
    const query = toQuery({
      businessLinkId: businessSourceFilters.businessLinkId,
      targetAppId: businessSourceFilters.targetAppId,
      targetSchema: businessSourceFilters.targetSchema,
      targetTable: businessSourceFilters.targetTable,
      targetRecordId: businessSourceFilters.targetRecordId,
      uploadedBy: businessSourceFilters.uploadedBy,
      uploadedByRole: businessSourceFilters.uploadedByRole,
      uploadSource: businessSourceFilters.uploadSource,
      operatorSource: businessSourceFilters.operatorSource,
      sourceFolder: businessSourceFilters.sourceFolder,
      duplicateBusinessSource: businessSourceFilters.duplicateBusinessSource,
      limit: 50,
      offset: 0
    })
    const payload = await agentRequest(`/document-intake/admin/business-sources${query}`)
    businessSources.total = payload.total || 0
    businessSources.items = payload.items || []
  } catch (error) {
    ElMessage.error(`来源追溯查询失败：${error.message}`)
  } finally {
    businessSources.loading = false
  }
}

const resetBusinessSourceFilters = (values = {}) => {
  Object.assign(businessSourceFilters, {
    targetAppId: '',
    targetSchema: '',
    targetTable: '',
    targetRecordId: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    sourceFolder: '',
    duplicateBusinessSource: '',
    businessLinkId: '',
    ...values
  })
}

const resetBusinessSourceFiltersAndResults = () => {
  resetBusinessSourceFilters()
  businessSources.total = 0
  businessSources.items = []
}

const traceBusinessLinkSource = async (row = {}) => {
  const businessLinkId = String(row.id || row.businessLinkId || '').trim()
  if (!businessLinkId) {
    ElMessage.warning('该业务链接缺少可追溯 ID')
    return
  }
  resetBusinessSourceFilters({ businessLinkId })
  assetDrawer.visible = false
  activeView.value = 'sources'
  await loadBusinessSources()
}

const reloadAll = async () => {
  await Promise.all([
    loadOverview(),
    loadAssets(),
    loadDevices(),
    loadLogs(),
    loadRecalculationTasks(),
    loadProductionReports(),
    loadQualityInspections(),
    loadHrAttendanceSnapshots(),
    loadPayrollPrecheckSnapshots()
  ])
}

const openAssetDetail = async (row) => {
  if (!row?.id) return
  assetDrawer.visible = true
  assetDrawer.loading = true
  assetDrawer.reviewing = false
  assetDrawer.previewing = false
  assetDrawer.downloading = false
  assetDrawer.detail = null
  assetDetailTab.value = 'parse'
  try {
    assetDrawer.detail = await agentRequest(`/document-intake/admin/assets/${row.id}`)
  } catch (error) {
    ElMessage.error(`详情加载失败：${error.message}`)
  } finally {
    assetDrawer.loading = false
  }
}

const openBusinessSourceAsset = async (row) => {
  const asset = row?.asset || {}
  if (!asset.id) return
  await openAssetDetail({ id: asset.id })
}

const buildSourceAssetFilters = (source = {}, options = {}) => ({
  deviceCode: String(source.deviceCode || '').trim(),
  uploadedBy: String(source.uploadedByUsername || source.uploadedByUserId || '').trim(),
  uploadedByRole: String(source.uploadedByRole || '').trim(),
  uploadSource: String(source.uploadSource || '').trim(),
  operatorSource: String(source.operatorSource || '').trim(),
  sourceFolder: String(source.sourceFolder || '').trim(),
  fileHash: String(source.fileHash || source.sourceFileHash || '').trim(),
  ...options
})

const viewLogSourceAsset = async (row) => {
  const filters = buildSourceAssetFilters(row)
  if (!Object.values(filters).some(Boolean)) return
  resetAssetFilters(filters)
  assetPage.value = 1
  activeView.value = 'assets'
  await loadAssets()
}

const openLogSourceAssetDetail = async (row) => {
  if (!row?.sourceAssetId) return
  await openAssetDetail({ id: row.sourceAssetId })
}

const buildBusinessSourceAssetFilters = (row) => {
  const asset = row?.asset || {}
  return {
    ...buildSourceAssetFilters(asset),
    status: String(asset.status || '').trim(),
    duplicate: asset.duplicate === true ? 'true' : asset.duplicate === false ? 'false' : ''
  }
}

const viewBusinessSourceAssets = async (row) => {
  const filters = buildBusinessSourceAssetFilters(row)
  if (!Object.values(filters).some(Boolean)) return
  resetAssetFilters(filters)
  assetPage.value = 1
  activeView.value = 'assets'
  await loadAssets()
}

const viewBusinessSourceLogs = async (row) => {
  const filters = {
    ...buildBusinessSourceAssetFilters(row),
    batchNo: String(row?.asset?.batchNo || '').trim()
  }
  if (!Object.values(filters).some(Boolean)) return
  resetLogFilters(filters)
  logPage.value = 1
  activeView.value = 'logs'
  await loadLogs()
}

const openRecalculationTaskAsset = async (row) => {
  if (!row?.assetId) return
  await openAssetDetail({ id: row.assetId })
}

const buildBusinessRecordSourceFilters = (row = {}, fallback = {}) => ({
  businessLinkId: String(row.businessLinkId || '').trim(),
  targetAppId: String(row.targetAppId || fallback.targetAppId || '').trim(),
  targetSchema: String(row.targetSchema || fallback.targetSchema || '').trim(),
  targetTable: String(row.targetTable || fallback.targetTable || '').trim(),
  targetRecordId: String(row.targetRecordId || fallback.targetRecordId || '').trim(),
  uploadedBy: String(row.uploadedByUsername || row.uploadedByUserId || '').trim(),
  uploadedByRole: String(row.uploadedByRole || '').trim(),
  uploadSource: String(row.uploadSource || '').trim(),
  operatorSource: String(row.operatorSource || '').trim(),
  sourceFolder: String(row.sourceFolder || '').trim(),
  duplicateBusinessSource: row.duplicateBusinessSource === true ? 'true' : row.duplicateBusinessSource === false ? 'false' : ''
})

const traceBusinessRecordSource = async (row = {}, fallback = {}) => {
  const filters = buildBusinessRecordSourceFilters(row, fallback)
  if (!filters.businessLinkId && !(
    (filters.targetAppId && filters.targetRecordId) ||
    (filters.targetSchema && filters.targetTable && filters.targetRecordId)
  )) {
    ElMessage.warning('该业务记录缺少可追溯条件')
    return
  }
  resetBusinessSourceFilters(filters)
  activeView.value = 'sources'
  await loadBusinessSources()
}

const traceProductionReportSource = async (row) => {
  await traceBusinessRecordSource(row, {
    targetSchema: 'scm',
    targetTable: 'production_work_reports',
    targetRecordId: row?.reportNo || ''
  })
}

const traceQualityInspectionSource = async (row) => {
  await traceBusinessRecordSource(row, {
    targetSchema: 'public',
    targetTable: 'quality_inspections',
    targetRecordId: row?.docNo || ''
  })
}

const traceHrAttendanceSnapshotSource = async (row = {}) => {
  await traceBusinessRecordSource({
    ...row,
    businessLinkId: row.lastBusinessLinkId || row.businessLinkId || '',
    targetSchema: row.sourceTargetSchema || row.targetSchema || '',
    targetTable: row.sourceTargetTable || row.targetTable || '',
    targetRecordId: row.sourceTargetRecordId || row.targetRecordId || ''
  })
}

const openProductionReportAsset = async (row) => {
  if (!row?.assetId) return
  await openAssetDetail({ id: row.assetId })
}

const openQualityInspectionAsset = async (row) => {
  if (!row?.assetId) return
  await openAssetDetail({ id: row.assetId })
}

const downloadOriginalAsset = async () => {
  const asset = assetDrawer.detail?.asset
  if (!asset?.id || assetDrawer.downloading) return

  assetDrawer.downloading = true
  try {
    const token = getToken()
    const response = await fetch(`/agent/document-intake/admin/assets/${asset.id}/download`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.message || payload?.code || `下载失败(${response.status})`)
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filenameFromContentDisposition(
      response.headers.get('content-disposition'),
      asset.originalFilename
    )
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  } catch (error) {
    ElMessage.error(`原始文件下载失败：${error.message}`)
  } finally {
    assetDrawer.downloading = false
  }
}

const previewOriginalAsset = async () => {
  const asset = assetDrawer.detail?.asset
  if (!asset?.id || assetDrawer.previewing) return

  assetDrawer.previewing = true
  try {
    const token = getToken()
    const response = await fetch(`/agent/document-intake/admin/assets/${asset.id}/preview`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.message || payload?.code || `预览失败(${response.status})`)
    }
    sourcePreview.title = payload.asset?.originalFilename || asset.originalFilename || '原始文件'
    sourcePreview.text = payload.preview?.text || ''
    sourcePreview.truncated = !!payload.preview?.truncated
    sourcePreview.maxBytes = payload.preview?.maxBytes || 0
    sourcePreview.fileSize = payload.asset?.fileSize || 0
    sourcePreview.visible = true
  } catch (error) {
    ElMessage.error(`原始文件预览失败：${error.message}`)
  } finally {
    assetDrawer.previewing = false
  }
}

const approveAssetReview = async () => {
  const asset = assetDrawer.detail?.asset
  if (!asset?.id || assetDrawer.reviewing) return
  try {
    await ElMessageBox.confirm(`确认复核通过 ${asset.originalFilename || '该文件'}，并重新进入自动入库队列？`, '复核通过', {
      confirmButtonText: '通过并入库',
      cancelButtonText: '取消',
      type: 'warning'
    })
    assetDrawer.reviewing = true
    await agentRequest(`/document-intake/admin/assets/${asset.id}/review`, {
      method: 'POST',
      body: { action: 'approve_auto_import' }
    })
    ElMessage.success('已重新进入自动入库队列')
    await Promise.all([loadOverview(), loadAssets(), openAssetDetail(asset)])
  } catch (error) {
    if (error === 'cancel') return
    if (error?.message) ElMessage.error(`复核失败：${error.message}`)
  } finally {
    assetDrawer.reviewing = false
  }
}

const resetDeviceForm = (values = {}) => {
  const next = { ...emptyDeviceForm(), ...values }
  Object.keys(next).forEach((key) => {
    deviceForm[key] = next[key]
  })
  deviceForm.watchFolders = Array.isArray(next.watchFolders)
    ? next.watchFolders.map((folder) => ({ ...folder, enabled: folder.enabled !== false }))
    : []
}

const openDeviceCreate = () => {
  deviceDialog.mode = 'create'
  resetDeviceForm({
    watchFolders: [{ folderPath: '', folderName: '', defaultUserId: '', defaultUsername: '', defaultRole: '', enabled: true }]
  })
  deviceDialog.visible = true
}

const openDeviceEdit = async (row) => {
  if (!row?.id) return
  deviceDialog.mode = 'edit'
  deviceDialog.visible = true
  deviceDialog.saving = true
  try {
    const payload = await agentRequest(`/document-intake/admin/devices/${row.id}`)
    const device = payload.device || row
    const metadata = device.metadata || {}
    const remoteConfig = metadata.remote_config || metadata.remoteConfig || {}
    const heartbeatPayload = metadata.heartbeat_payload || metadata.heartbeatPayload || {}
    const healthSnapshot = heartbeatPayload.health || heartbeatPayload.Health || device.healthSnapshot || {}
    resetDeviceForm({
      id: device.id,
      enterpriseId: device.enterpriseId,
      deviceCode: device.deviceCode,
      deviceName: device.deviceName,
      status: device.status,
      defaultUserId: device.defaultUserId,
      defaultUsername: device.defaultUsername,
      defaultRole: device.defaultRole,
      configVersion: metadata.remote_config_version || metadata.remoteConfigVersion || '',
      remoteConfigText: Object.keys(remoteConfig).length ? JSON.stringify(remoteConfig, null, 2) : '',
      healthSnapshot,
      watchFolders: device.watchFolders || []
    })
  } catch (error) {
    deviceDialog.visible = false
    ElMessage.error(`设备详情加载失败：${error.message}`)
  } finally {
    deviceDialog.saving = false
  }
}

const resetLogFilters = (values = {}) => {
  Object.assign(logFilters, {
    level: '',
    deviceCode: '',
    username: '',
    role: '',
    appModule: '',
    route: '',
    eventType: '',
    batchNo: '',
    fileHash: '',
    assetStatus: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    duplicate: '',
    sourceFolder: '',
    clientSessionId: '',
    traceId: '',
    search: '',
    ...values
  })
}

const resetLogFiltersAndLoad = async () => {
  resetLogFilters()
  logPage.value = 1
  await loadLogs()
}

const viewRelatedLogs = async (row = {}, scope = '') => {
  const filters = {}
  if (scope === 'batch') {
    filters.batchNo = String(row.aiImportBatchNo || '').trim()
  } else if (scope === 'session') {
    filters.clientSessionId = String(row.clientSessionId || '').trim()
  } else if (scope === 'trace') {
    filters.traceId = String(row.traceId || '').trim()
  } else if (scope === 'file') {
    filters.fileHash = String(row.sourceFileHash || '').trim()
  }
  if (!Object.values(filters).some(Boolean)) return
  resetLogFilters(filters)
  logPage.value = 1
  activeView.value = 'logs'
  await loadLogs()
}

const buildDeviceTraceFilters = (source = {}) => ({
  deviceCode: String(source.deviceCode || '').trim(),
  uploadedBy: String(
    source.defaultUsername ||
      source.defaultUserName ||
      source.defaultUser ||
      source.defaultUserId ||
      ''
  ).trim(),
  uploadedByRole: String(source.defaultRole || '').trim()
})

const viewDeviceAssets = async (row) => {
  const filters = buildDeviceTraceFilters(row)
  if (!filters.deviceCode) return
  resetAssetFilters(filters)
  assetPage.value = 1
  activeView.value = 'assets'
  await loadAssets()
}

const viewDeviceWatchFolders = async (row) => {
  await openDeviceEdit(row)
}

const viewDeviceLogs = async (row) => {
  const deviceCode = String(row?.deviceCode || '').trim()
  if (!deviceCode) return
  resetLogFilters({ deviceCode })
  logPage.value = 1
  activeView.value = 'logs'
  await loadLogs()
}

const deviceHealthTagActionable = (tag = {}) => ['upload', 'log', 'missing-folder', 'inaccessible-folder'].includes(tag.key)

const deviceHealthIssueSearchText = (tag = {}) => {
  if (tag.key === 'missing-folder') return '监听目录不存在'
  if (tag.key === 'inaccessible-folder') return '监听目录不可访问'
  return ''
}

const viewDeviceHealthIssueLogs = async (row, tag) => {
  if (!deviceHealthTagActionable(tag)) return
  const deviceFilters = buildDeviceTraceFilters(row)
  const deviceCode = deviceFilters.deviceCode
  if (!deviceCode) return
  if (tag.key === 'upload') {
    resetAssetFilters(deviceFilters)
    assetPage.value = 1
    activeView.value = 'assets'
    await loadAssets()
    return
  }
  if (tag.key === 'log') {
    resetLogFilters({ deviceCode })
    logPage.value = 1
    activeView.value = 'logs'
    await loadLogs()
    return
  }
  resetLogFilters({
    deviceCode,
    level: 'warn',
    eventType: 'file_watch_error',
    search: deviceHealthIssueSearchText(tag)
  })
  logPage.value = 1
  activeView.value = 'logs'
  await loadLogs()
}

const deviceHealthSnapshotItemActionable = (item = {}) => ['upload', 'failed-upload', 'log', 'folder'].includes(item.key)

const viewDeviceHealthSnapshotItem = async (item) => {
  if (!deviceHealthSnapshotItemActionable(item)) return
  const deviceFilters = buildDeviceTraceFilters(deviceForm)
  const deviceCode = deviceFilters.deviceCode
  if (!deviceCode) return
  deviceDialog.visible = false
  if (item.key === 'upload') {
    resetAssetFilters(deviceFilters)
    assetPage.value = 1
    activeView.value = 'assets'
    await loadAssets()
    return
  }
  if (item.key === 'failed-upload') {
    resetLogFilters({ ...deviceFilters, eventType: 'file_upload_failed' })
    logPage.value = 1
    activeView.value = 'logs'
    await loadLogs()
    return
  }
  if (item.key === 'log') {
    resetLogFilters({ deviceCode })
    logPage.value = 1
    activeView.value = 'logs'
    await loadLogs()
    return
  }
  const snapshot = deviceForm.healthSnapshot || {}
  const hasMissingFolder = healthValue(snapshot, 'missingWatchFolderCount') > 0
  resetLogFilters({
    deviceCode,
    level: 'warn',
    eventType: 'file_watch_error',
    search: hasMissingFolder ? '监听目录不存在' : '监听目录不可访问'
  })
  logPage.value = 1
  activeView.value = 'logs'
  await loadLogs()
}

const viewDeviceFailedUploadSummaryLogs = async (item = {}) => {
  const deviceFilters = buildDeviceTraceFilters(deviceForm)
  const deviceCode = deviceFilters.deviceCode
  const error = String(item?.error || '').trim()
  if (!deviceCode || !error) return
  deviceDialog.visible = false
  resetLogFilters({
    ...deviceFilters,
    eventType: 'file_upload_failed',
    search: error
  })
  logPage.value = 1
  activeView.value = 'logs'
  await loadLogs()
}

const hasWatchFolderPath = (folder = {}) => Boolean(String(folder.folderPath || '').trim())

const buildWatchFolderTraceFilters = (folder = {}) => {
  const uploadedBy = String(
    folder.defaultUsername ||
      folder.defaultUserId ||
      deviceForm.defaultUsername ||
      deviceForm.defaultUserId ||
      ''
  ).trim()
  return {
    deviceCode: String(deviceForm.deviceCode || '').trim(),
    uploadedBy,
    uploadedByRole: String(folder.defaultRole || deviceForm.defaultRole || '').trim(),
    uploadSource: 'watch_folder',
    operatorSource: 'folder_binding_user',
    sourceFolder: String(folder.folderPath || '').trim()
  }
}

const normalizeWatchFolderPath = (value) => String(value || '')
  .trim()
  .replace(/[\\/]+$/, '')
  .toLowerCase()

const readHealthStatusField = (item = {}, key) => {
  const pascalKey = key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
  return item?.[key] ?? item?.[pascalKey] ?? ''
}

const watchFolderHealthStatusRows = (snapshot = {}) => {
  const rows = snapshot?.watchFolderStatuses || snapshot?.WatchFolderStatuses || []
  if (!Array.isArray(rows)) return []
  return rows.map((item) => ({
    folderPath: String(readHealthStatusField(item, 'folderPath') || '').trim(),
    folderName: String(readHealthStatusField(item, 'folderName') || '').trim(),
    enabled: readHealthStatusField(item, 'enabled') !== false,
    status: String(readHealthStatusField(item, 'status') || '').trim().toLowerCase(),
    reason: String(readHealthStatusField(item, 'reason') || '').trim()
  }))
}

const watchFolderHealthStatusText = (status) => ({
  accessible: '可访问',
  missing: '缺失',
  inaccessible: '不可访问',
  disabled: '停用'
}[status] || '')

const watchFolderHealthStatusType = (status) => {
  if (status === 'accessible') return 'success'
  if (status === 'missing' || status === 'inaccessible') return 'danger'
  if (status === 'disabled') return 'info'
  return 'info'
}

const watchFolderHealthStatus = (folder = {}) => {
  const folderPath = normalizeWatchFolderPath(folder.folderPath)
  if (!folderPath) return { label: '', type: 'info', reason: '' }
  const row = watchFolderHealthStatusRows(deviceForm.healthSnapshot)
    .find((item) => normalizeWatchFolderPath(item.folderPath) === folderPath)
  if (!row?.status) return { label: '', type: 'info', reason: '' }
  return {
    label: watchFolderHealthStatusText(row.status),
    type: watchFolderHealthStatusType(row.status),
    reason: row.reason
  }
}

const isWatchFolderHealthAbnormal = (folder = {}) => {
  const status = watchFolderHealthStatus(folder)
  return ['缺失', '不可访问'].includes(status.label)
}

const watchFolderIssueSearchText = (folder = {}) => {
  const status = watchFolderHealthStatus(folder)
  if (status.label === '缺失') return '监听目录不存在'
  if (status.label === '不可访问') return '监听目录不可访问'
  return '监听目录'
}

const viewWatchFolderAssets = async (folder) => {
  const filters = buildWatchFolderTraceFilters(folder)
  if (!filters.sourceFolder) return
  resetAssetFilters(filters)
  assetPage.value = 1
  deviceDialog.visible = false
  activeView.value = 'assets'
  await loadAssets()
}

const viewWatchFolderLogs = async (folder) => {
  const filters = buildWatchFolderTraceFilters(folder)
  if (!filters.sourceFolder) return
  resetLogFilters(filters)
  logPage.value = 1
  deviceDialog.visible = false
  activeView.value = 'logs'
  await loadLogs()
}

const viewWatchFolderIssueLogs = async (folder) => {
  const filters = buildWatchFolderTraceFilters(folder)
  if (!filters.sourceFolder) return
  resetLogFilters({
    ...filters,
    level: 'warn',
    eventType: 'file_watch_error',
    search: watchFolderIssueSearchText(folder)
  })
  logPage.value = 1
  deviceDialog.visible = false
  activeView.value = 'logs'
  await loadLogs()
}

const addWatchFolder = () => {
  deviceForm.watchFolders.push({
    folderPath: '',
    folderName: '',
    defaultUserId: '',
    defaultUsername: '',
    defaultRole: '',
    enabled: true
  })
}

const removeWatchFolder = (index) => {
  deviceForm.watchFolders.splice(index, 1)
}

const parseRemoteConfig = () => {
  const text = String(deviceForm.remoteConfigText || '').trim()
  if (!text) return undefined
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('远程配置 JSON 格式不正确')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('远程配置必须是 JSON 对象')
  }
  return parsed
}

const buildDevicePayload = () => {
  const payload = {
    enterpriseId: deviceForm.enterpriseId,
    deviceCode: deviceForm.deviceCode,
    deviceName: deviceForm.deviceName,
    status: deviceForm.status,
    defaultUserId: deviceForm.defaultUserId,
    defaultUsername: deviceForm.defaultUsername,
    defaultRole: deviceForm.defaultRole,
    watchFolders: deviceForm.watchFolders
      .filter((folder) => String(folder.folderPath || '').trim())
      .map((folder) => ({
        folderPath: folder.folderPath,
        folderName: folder.folderName,
        defaultUserId: folder.defaultUserId,
        defaultUsername: folder.defaultUsername,
        defaultRole: folder.defaultRole,
        enabled: folder.enabled !== false
      }))
  }
  const remoteConfig = parseRemoteConfig()
  if (remoteConfig !== undefined) {
    payload.remoteConfig = remoteConfig
    if (deviceForm.configVersion) payload.configVersion = deviceForm.configVersion
  }
  return payload
}

const submitDevice = async () => {
  if (!deviceForm.deviceCode || !deviceForm.deviceName || !deviceForm.enterpriseId) {
    ElMessage.warning('请填写企业标识、设备编号和设备名称')
    return
  }
  deviceDialog.saving = true
  try {
    const payload = buildDevicePayload()
    const response = deviceDialog.mode === 'create'
      ? await agentRequest('/document-intake/admin/devices', { method: 'POST', body: payload })
      : await agentRequest(`/document-intake/admin/devices/${deviceForm.id}`, { method: 'PATCH', body: payload })
    deviceDialog.visible = false
    if (response.authorizationCode) {
      bindCodeDialog.code = response.authorizationCode
      bindCodeDialog.visible = true
    }
    await Promise.all([loadDevices(), loadOverview()])
    ElMessage.success('设备已保存')
  } catch (error) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    deviceDialog.saving = false
  }
}

const resetDeviceBindCode = async (row) => {
  if (!row?.id) return
  try {
    await ElMessageBox.confirm(`确定重置 ${row.deviceName || row.deviceCode} 的绑定授权码？旧采集端 token 将失效。`, '重置授权码', {
      confirmButtonText: '重置',
      cancelButtonText: '取消',
      type: 'warning'
    })
    const payload = await agentRequest(`/document-intake/admin/devices/${row.id}/reset-bind-code`, { method: 'POST', body: {} })
    bindCodeDialog.code = payload.authorizationCode || ''
    bindCodeDialog.visible = true
    await loadDevices()
  } catch (error) {
    if (error === 'cancel') return
    if (error?.message) ElMessage.error(`重置失败：${error.message}`)
  }
}

const goBack = () => {
  router.push('/').catch(() => {})
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toLocaleDateString('zh-CN')
}

const formatQty = (value, unit = '') => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  const text = Number.isInteger(numeric) ? String(numeric) : String(Math.round(numeric * 1000) / 1000)
  return `${text}${unit || ''}`
}

const formatDefectRate = (sampleQty, defectQty) => {
  const sample = Number(sampleQty)
  const defect = Number(defectQty)
  if (!Number.isFinite(sample) || sample <= 0 || !Number.isFinite(defect)) return '-'
  return `${Math.round((defect / sample) * 1000) / 10}%`
}

const sourceFileTraceText = (row) => {
  const folder = String(row?.sourceFolder || '').trim()
  const trace = String(row?.fileHash || row?.importBatchNo || row?.batchNo || '').trim()
  return [folder, trace].filter(Boolean).join(' / ') || '-'
}

const qualityResultType = (result) => {
  if (result === '合格') return 'success'
  if (result === '让步接收' || result === '待判定') return 'warning'
  if (result === '不合格') return 'danger'
  return 'info'
}

const formatMinutes = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '0h'
  const hours = Math.round((numeric / 60) * 10) / 10
  return `${hours}h`
}

const formatTimeOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

const formatPercent = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return `${Math.round(numeric * 1000) / 10}%`
}

const policyTextMaps = {
  defaultAutoImportMode: {
    auto_import: '自动正式入库',
    review_required: '先复核',
    archive_only: '仅归档'
  },
  lowConfidencePolicy: {
    auto_import_with_review: '入库后复核',
    review_required: '先复核',
    archive_only: '仅归档'
  },
  unmappedFieldPolicy: {
    remarks: '写备注',
    properties: '写扩展字段',
    ignore: '忽略'
  },
  duplicateFilePolicy: {
    skip_duplicate: '跳过',
    link_existing: '关联已有',
    allow_reimport: '允许重入'
  },
  unrecognizedFilePolicy: {
    archive_and_review: '归档待复核',
    archive_only: '仅归档',
    reject: '拒收'
  },
  businessCorrectionPolicy: {
    record_and_recalculate: '记录并重算',
    record_only: '仅记录',
    manual_review: '人工复核'
  }
}

const policyText = (value, map) => map?.[value] || value || '-'

const policySelectOptions = Object.fromEntries(
  Object.entries(policyTextMaps).map(([key, labels]) => [
    key,
    Object.entries(labels).map(([value, label]) => ({ value, label }))
  ])
)

const uploadSourceText = (source) => ({
  collector_desktop: '桌面端',
  collector_desktop_chunked: '桌面端分片',
  watch_folder: '监听目录',
  web_drag_drop: '网页拖拽',
  manual_drag_drop: '窗口拖拽',
  manual_selected_file: '手动选择',
  manual_upload: '手动上传'
}[source] || source || '-')

const operatorSourceText = (source) => ({
  web_login_user: '网页登录用户',
  device_default_user: '设备默认用户',
  manual_selected_user: '手动指定用户',
  folder_binding_user: '目录默认用户',
  unknown: '未知上传人'
}[source] || source || '-')

const uploadOwnerText = (row) =>
  row?.uploadedByUsername ||
  row?.uploadedByUserId ||
  '-'

const uploadOwnerSubText = (row) => {
  const role = row?.uploadedByRole || ''
  const source = operatorSourceText(row?.operatorSource)
  if (role && source && source !== '-') return `${role} / ${source}`
  return role || source || '-'
}

const logUserText = (row) => {
  const user = row?.username || row?.userId || ''
  const role = row?.role || ''
  if (user && role) return `${user} / ${role}`
  return user || role || '-'
}

const logDuplicateText = (row) => {
  if (!row?.sourceAssetId && !row?.sourceAssetCount) return '-'
  return row?.duplicate ? '重复' : '非重复'
}

const assetStatusText = (status) => ({
  uploaded: '已上传',
  duplicate: '重复',
  queued: '排队',
  parsing: '解析中',
  parsed: '已解析',
  classified: '已分类',
  importing: '入库中',
  imported: '已入库',
  partial_imported: '部分入库',
  unrecognized: '未识别',
  failed: '失败',
  archived: '已归档'
}[status] || status || '-')

const batchStatusText = (status) => ({
  created: '已创建',
  uploading: '上传中',
  uploaded: '已上传',
  parsing: '解析中',
  classifying: '分类中',
  importing: '入库中',
  completed: '已完成',
  partial: '部分完成',
  failed: '失败'
}[status] || status || '-')

const reviewStatusText = (status) => ({
  review_required: '待复核',
  archived_only: '仅归档',
  generated: '已生成'
}[status] || status || '-')

const assetStatusType = (status) => {
  if (['imported', 'parsed', 'classified'].includes(status)) return 'success'
  if (['failed', 'unrecognized'].includes(status)) return 'danger'
  if (['duplicate', 'partial_imported'].includes(status)) return 'warning'
  return 'info'
}

const reviewStatusType = (status) => {
  if (status === 'review_required') return 'warning'
  if (status === 'archived_only') return 'info'
  if (status === 'generated') return 'success'
  return 'info'
}

const recalculationTaskStatusText = (status) => ({
  pending: '待重算',
  manual_review_required: '待复核',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消'
}[status] || status || '-')

const recalculationTaskStatusType = (status) => {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'danger'
  if (['pending', 'manual_review_required', 'processing'].includes(status)) return 'warning'
  return 'info'
}

const hrAttendanceConfirmationStatusText = (status) => ({
  pending_confirmation: '待确认',
  confirmed: '已确认',
  rejected: '已退回'
}[status] || status || '待确认')

const hrAttendanceConfirmationStatusType = (status) => {
  if (status === 'confirmed') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

const hrAttendancePayrollPrecheckStatusText = (status) => ({
  not_requested: '未提交前置',
  ready: '已提交前置'
}[status] || status || '未提交前置')

const hrAttendancePayrollPrecheckStatusType = (status) => {
  if (status === 'ready') return 'success'
  return 'info'
}

const deviceStatusText = (status) => ({
  active: '在线',
  offline: '离线',
  disabled: '禁用',
  pending: '待绑定'
}[status] || status || '-')

const deviceStatusType = (status) => {
  if (status === 'active') return 'success'
  if (status === 'disabled') return 'danger'
  if (status === 'pending') return 'warning'
  return 'info'
}

const deviceHealthTags = (summary = {}) => {
  const tags = []
  const uploadBacklogCount = Number(summary.uploadBacklogCount || 0)
  const pendingLogCount = Number(summary.pendingLogCount || 0)
  const missingWatchFolderCount = Number(summary.missingWatchFolderCount || 0)
  const inaccessibleWatchFolderCount = Number(summary.inaccessibleWatchFolderCount || 0)
  if (uploadBacklogCount > 0) tags.push({ key: 'upload', label: `上传 ${uploadBacklogCount}`, type: 'warning' })
  if (pendingLogCount > 0) tags.push({ key: 'log', label: `日志 ${pendingLogCount}`, type: 'info' })
  if (missingWatchFolderCount > 0) tags.push({ key: 'missing-folder', label: `缺失目录 ${missingWatchFolderCount}`, type: 'danger' })
  if (inaccessibleWatchFolderCount > 0) tags.push({ key: 'inaccessible-folder', label: `不可访问 ${inaccessibleWatchFolderCount}`, type: 'danger' })
  return tags
}

const healthValue = (snapshot = {}, key, fallback = 0) => {
  const pascalKey = key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
  const value = Number(snapshot?.[key] ?? snapshot?.[pascalKey] ?? fallback)
  return Number.isFinite(value) ? value : fallback
}

const healthRawValue = (snapshot = {}, key) => {
  const pascalKey = key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
  return snapshot?.[key] ?? snapshot?.[pascalKey] ?? ''
}

const formatBytes = (value) => {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes / 1024
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

const deviceHealthSnapshotSummary = (snapshot = {}) => ({
  uploadBacklogCount:
    healthValue(snapshot, 'pendingUploadCount') +
    healthValue(snapshot, 'failedUploadCount') +
    healthValue(snapshot, 'failedRetryReadyCount') +
    healthValue(snapshot, 'failedRetryWaitingCount') +
    healthValue(snapshot, 'failedRetryExhaustedCount') +
    healthValue(snapshot, 'missingLocalUploadFileCount'),
  pendingLogCount: healthValue(snapshot, 'pendingLogCount'),
  missingWatchFolderCount: healthValue(snapshot, 'missingWatchFolderCount'),
  inaccessibleWatchFolderCount: healthValue(snapshot, 'inaccessibleWatchFolderCount')
})

const deviceHealthSnapshotStatus = (snapshot = {}) => {
  const tags = deviceHealthTags(deviceHealthSnapshotSummary(snapshot))
  return tags.length ? { label: '存在异常', type: 'warning' } : { label: '未见异常', type: 'success' }
}

const formatHealthTime = (value) => {
  if (!value) return '-'
  return formatDateTime(value)
}

const deviceHealthSnapshotItems = (snapshot = {}) => [
  {
    key: 'generated',
    label: '生成时间',
    value: formatHealthTime(healthRawValue(snapshot, 'generatedAt')),
    note: healthRawValue(snapshot, 'deviceStatus') ? `设备状态 ${healthRawValue(snapshot, 'deviceStatus')}` : ''
  },
  {
    key: 'upload',
    label: '上传队列',
    value: `待上传 ${healthValue(snapshot, 'pendingUploadCount')}`,
    note: `最早 ${formatHealthTime(healthRawValue(snapshot, 'oldestPendingUploadCreatedAt'))}`
  },
  {
    key: 'failed-upload',
    label: '失败队列',
    value: `失败 ${healthValue(snapshot, 'failedUploadCount')}`,
    note: `耗尽 ${healthValue(snapshot, 'failedRetryExhaustedCount')} / 下次 ${formatHealthTime(healthRawValue(snapshot, 'nextFailedRetryAt'))}`
  },
  {
    key: 'log',
    label: '日志队列',
    value: `待传日志 ${healthValue(snapshot, 'pendingLogCount')}`,
    note: `最早 ${formatHealthTime(healthRawValue(snapshot, 'oldestPendingLogCreatedAt'))}`
  },
  {
    key: 'folder',
    label: '监听目录',
    value: `${healthValue(snapshot, 'enabledWatchFolderCount')}/${healthValue(snapshot, 'watchFolderCount')}`,
    note: `缺失 ${healthValue(snapshot, 'missingWatchFolderCount')} / 不可访问 ${healthValue(snapshot, 'inaccessibleWatchFolderCount')}`
  },
  {
    key: 'storage',
    label: '存储空间',
    value: formatBytes(healthRawValue(snapshot, 'dataDriveAvailableFreeBytes')),
    note: `数据库 ${formatBytes(healthRawValue(snapshot, 'collectorDatabaseBytes'))}`
  }
]

const deviceHealthFailedUploadSummaries = (snapshot = {}) => {
  const rows = snapshot?.failedUploadErrorSummaries || snapshot?.FailedUploadErrorSummaries || []
  if (!Array.isArray(rows)) return []
  return rows.slice(0, 5).map((item, index) => ({
    error: String(item?.error || item?.Error || `失败原因 ${index + 1}`),
    count: Number(item?.count ?? item?.Count ?? 0) || 0,
    oldest: formatHealthTime(item?.oldestCreatedAt || item?.OldestCreatedAt),
    latest: formatHealthTime(item?.latestCreatedAt || item?.LatestCreatedAt)
  }))
}

const logLevelType = (level) => {
  const normalized = String(level || '').toLowerCase()
  if (normalized === 'error') return 'danger'
  if (normalized === 'warn' || normalized === 'warning') return 'warning'
  return 'info'
}

onMounted(() => {
  reloadAll()
})
</script>

<style scoped>
.document-intake-center {
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background: var(--el-bg-color-page);
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.header-left,
.header-actions,
.panel-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  line-height: 26px;
  font-weight: 700;
  color: #303133;
}

.header-text p,
.panel-head p {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: #909399;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.metric-card {
  min-height: 92px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
}

.metric-label,
.metric-note {
  font-size: 12px;
  color: #909399;
}

.metric-value {
  margin: 8px 0 4px;
  font-size: 26px;
  line-height: 30px;
  font-weight: 800;
  color: #303133;
}

.metric-card.blue { border-left: 4px solid var(--el-color-primary); }
.metric-card.green { border-left: 4px solid #67c23a; }
.metric-card.orange { border-left: 4px solid #e6a23c; }
.metric-card.red { border-left: 4px solid #f56c6c; }
.metric-card.slate { border-left: 4px solid #94a3b8; }

.policy-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(126px, 1fr));
  gap: 8px;
  margin: -4px 0 16px;
}

.policy-card {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.policy-card span {
  font-size: 12px;
  color: #909399;
}

.policy-card strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #303133;
}

.policy-action {
  min-width: 116px;
  min-height: 66px;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: #f8fafc;
  color: var(--el-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.policy-action:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.policy-form :deep(.el-select),
.policy-form :deep(.el-input-number) {
  width: 100%;
}

.mapping-editor {
  width: 100%;
  min-width: 0;
}

.mapping-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.mapping-editor__toolbar span {
  color: #606266;
  font-size: 12px;
}

.mapping-editor :deep(.el-table) {
  width: 100%;
}

.mapping-editor :deep(.el-input-number) {
  width: 92px;
}

.policy-maintenance {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.policy-maintenance strong {
  color: #303133;
  font-size: 13px;
}

.policy-maintenance span {
  flex: 1;
  min-width: 0;
  color: #606266;
  font-size: 13px;
}

.policy-maintenance div {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.center-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.center-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-item {
  width: 100%;
  min-height: 78px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  text-align: left;
  cursor: pointer;
  color: #303133;
}

.nav-item.active {
  border-color: var(--el-color-primary);
  box-shadow: 0 8px 20px rgba(var(--el-color-primary-rgb), 0.12);
}

.nav-item .el-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: #fff;
  background: var(--el-color-primary);
}

.nav-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-copy span {
  font-size: 14px;
  font-weight: 700;
}

.nav-copy small,
.main-cell small {
  font-size: 12px;
  color: #909399;
}

.muted-text {
  color: #909399;
}

.nav-item strong {
  font-size: 18px;
  color: #303133;
}

.center-stage {
  min-width: 0;
}

.stage-panel {
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-head h3 {
  margin: 0 0 5px;
  font-size: 16px;
  line-height: 22px;
  color: #303133;
}

.filter-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.inline-alert {
  margin-bottom: 12px;
}

.filter-small {
  width: 160px;
  flex: 0 0 160px;
}

.filter-grow {
  min-width: 180px;
  flex: 1;
}

.main-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.main-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.diagnostic-tag {
  cursor: pointer;
}

.diagnostic-tag:hover {
  filter: brightness(0.96);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.row-actions .el-button + .el-button {
  margin-left: 0;
}

.log-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 10px 10px;
}

.log-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 10px 8px;
}

.log-quick-actions .el-button + .el-button {
  margin-left: 0;
}

.log-detail-grid div {
  min-width: 0;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.log-detail-grid span {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: #909399;
}

.log-detail-grid strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.log-detail-pre {
  margin: 0 10px 10px;
  max-height: 220px;
  overflow: auto;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #111827;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.entry-plan-detail {
  padding: 8px 10px 12px;
  background: #f8fafc;
}

.entry-doc-card {
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.entry-doc-card + .entry-doc-card {
  margin-top: 10px;
}

.entry-doc-head,
.entry-doc-source {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entry-doc-head {
  justify-content: space-between;
}

.entry-doc-source {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.entry-doc-section {
  margin-top: 10px;
}

.entry-doc-section > strong {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #303133;
}

.field-map-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin: 0;
}

.field-map-list div {
  min-width: 0;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.field-map-list dt {
  margin-bottom: 4px;
  font-size: 12px;
  color: #909399;
}

.field-map-list dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  color: #303133;
}

.entry-doc-pre {
  max-height: 220px;
  overflow: auto;
  margin: 0;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #111827;
  color: #e5e7eb;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.source-preview-box {
  max-height: 56vh;
  overflow: auto;
  margin: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  color: #303133;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.pager-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.asset-detail {
  min-height: 360px;
}

.detail-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.detail-summary h3 {
  margin: 0 0 6px;
  font-size: 18px;
}

.detail-summary p {
  margin: 0;
  color: #909399;
}

.duplicate-source-line {
  margin-top: 4px !important;
  color: #b88230 !important;
  word-break: break-all;
}

.summary-tags {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.ai-remarks-panel {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid #f3d19e;
  border-radius: 8px;
  background: #fdf6ec;
}

.ai-remarks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.ai-remarks-head strong {
  font-size: 14px;
  color: #7a4f01;
}

.ai-remarks-panel pre {
  margin: 0;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
}

.ocr-box {
  min-height: 280px;
  max-height: 520px;
  overflow: auto;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.7;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-item {
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-item span,
.detail-item small,
.dialog-note {
  color: #606266;
}

.device-form :deep(.el-select) {
  width: 100%;
}

.folder-editor {
  margin-top: 6px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.device-health-panel {
  margin-top: 6px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.health-card {
  min-width: 0;
  padding: 9px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
}

.diagnostic-card {
  cursor: pointer;
}

.diagnostic-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: #f8fbff;
}

.health-card span,
.health-card small {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.health-card strong {
  display: block;
  margin: 4px 0;
  font-size: 14px;
  color: #111827;
}

.health-error-list {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.health-error-list > strong {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #111827;
}

.health-error-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-top: 1px dashed #e5e7eb;
}

.health-error-row:first-of-type {
  border-top: 0;
}

.health-error-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
}

.health-error-row small {
  flex: 0 0 auto;
  color: #64748b;
}

.diagnostic-error-row {
  cursor: pointer;
  border-radius: 4px;
  padding-right: 4px;
  padding-left: 4px;
}

.diagnostic-error-row:hover,
.diagnostic-error-row:focus-visible {
  background: #f8fbff;
}

.folder-editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.folder-row {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr) minmax(110px, 1fr) minmax(86px, auto) minmax(180px, auto) auto;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.folder-state-cell,
.folder-trace-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.folder-trace-actions .el-button + .el-button {
  margin-left: 0;
}

.bind-code-box {
  padding: 18px;
  border: 1px dashed var(--el-color-primary);
  border-radius: 8px;
  background: #eef6ff;
  text-align: center;
}

.bind-code-box span {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0;
  color: var(--el-color-primary);
}

@media (max-width: 1100px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .policy-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .center-shell {
    grid-template-columns: 1fr;
  }

  .center-nav {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .document-intake-center {
    padding: 12px;
  }

  .page-header,
  .panel-head,
  .filter-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .metric-row,
  .policy-strip,
  .center-nav {
    grid-template-columns: 1fr;
  }

  .filter-small,
  .filter-grow {
    width: 100%;
    flex-basis: auto;
  }

  .folder-row {
    grid-template-columns: 1fr;
  }

  .log-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
