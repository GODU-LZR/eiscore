<!--
  SPDX-License-Identifier: AGPL-3.0-or-later
  Copyright (c) 2026 林志荣
-->

<template>
  <main class="document-intake-center">
    <header class="page-header">
      <div>
        <h1>智能收单中心</h1>
        <p>文件列表、上传归属、来源设备和重复状态追溯</p>
      </div>
      <el-button :icon="Refresh" :loading="activeLoading" @click="refreshActiveList">刷新</el-button>
    </header>

    <section v-loading="overviewLoading" class="overview-grid" aria-label="智能收单总览">
      <div
        v-for="item in overviewItems"
        :key="item.key"
        class="overview-card"
        :class="{ 'is-clickable': item.action }"
        role="button"
        tabindex="0"
        @click="applyOverviewMetric(item)"
        @keydown.enter.prevent="applyOverviewMetric(item)"
        @keydown.space.prevent="applyOverviewMetric(item)"
      >
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <el-tabs v-model="activeTab" class="intake-tabs">
      <el-tab-pane label="文件列表" name="assets" />
      <el-tab-pane label="设备列表" name="devices" />
      <el-tab-pane label="日志列表" name="logs" />
      <el-tab-pane label="入库结果" name="entryResults" />
    </el-tabs>

    <section v-if="activeTab === 'assets'" class="toolbar" aria-label="文件列表筛选">
      <el-segmented
        v-model="filters.duplicate"
        :options="duplicateFilterOptions"
        class="duplicate-filter"
      />
      <el-input
        v-model="filters.q"
        class="keyword-input"
        clearable
        placeholder="搜索文件名或 hash"
        :prefix-icon="Search"
        @keyup.enter="reloadFromFirstPage"
        @clear="reloadFromFirstPage"
      />
      <el-select
        v-model="filters.status"
        class="status-select"
        clearable
        placeholder="入库状态"
        @change="reloadFromFirstPage"
        @clear="reloadFromFirstPage"
      >
        <el-option label="已上传" value="uploaded" />
        <el-option label="重复" value="duplicate" />
        <el-option label="解析中" value="parsing" />
        <el-option label="已识别" value="classified" />
        <el-option label="已入库" value="imported" />
        <el-option label="失败" value="failed" />
      </el-select>
      <el-input
        v-model="filters.user"
        class="user-input"
        clearable
        placeholder="上传人 / 岗位"
        @keyup.enter="reloadFromFirstPage"
        @clear="reloadFromFirstPage"
      />
      <el-select
        v-model="filters.operatorSource"
        class="source-select"
        clearable
        placeholder="来源方式"
        @change="reloadFromFirstPage"
        @clear="reloadFromFirstPage"
      >
        <el-option
          v-for="item in operatorSourceFilterOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-input
        v-model="filters.sourceFolder"
        class="source-folder-input"
        clearable
        placeholder="监听目录"
        @keyup.enter="reloadFromFirstPage"
        @clear="reloadFromFirstPage"
      />
      <el-select
        v-model="filters.watchFolderSource"
        class="source-select"
        clearable
        placeholder="目录来源"
        @change="reloadFromFirstPage"
        @clear="reloadFromFirstPage"
      >
        <el-option
          v-for="item in watchFolderSourceFilterOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-tag
        v-if="filters.today"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearAssetTodayFilter"
      >
        今日采集
      </el-tag>
      <el-tag
        v-if="filters.deviceId"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearAssetDeviceFilter"
      >
        来源设备：{{ filters.deviceName || filters.deviceId }}
      </el-tag>
    </section>

    <section v-else-if="activeTab === 'devices'" class="toolbar" aria-label="设备列表筛选">
      <el-segmented
        v-model="deviceFilters.status"
        :options="deviceStatusFilterOptions"
        class="device-status-filter"
      />
      <el-input
        v-model="deviceFilters.q"
        class="keyword-input"
        clearable
        placeholder="搜索设备编号、名称、企业或默认用户"
        :prefix-icon="Search"
        @keyup.enter="reloadDevicesFromFirstPage"
        @clear="reloadDevicesFromFirstPage"
      />
      <el-input
        v-model="deviceFilters.user"
        class="user-input"
        clearable
        placeholder="默认上传人 / 岗位"
        @keyup.enter="reloadDevicesFromFirstPage"
        @clear="reloadDevicesFromFirstPage"
      />
      <el-input
        v-model="deviceFilters.serverBaseUrl"
        class="server-input"
        clearable
        placeholder="服务器地址"
        @keyup.enter="reloadDevicesFromFirstPage"
        @clear="reloadDevicesFromFirstPage"
      />
      <el-input
        v-model="deviceFilters.clientVersion"
        class="version-input"
        clearable
        placeholder="客户端版本"
        @keyup.enter="reloadDevicesFromFirstPage"
        @clear="reloadDevicesFromFirstPage"
      />
      <el-input
        v-model="deviceFilters.webviewVersion"
        class="version-input"
        clearable
        placeholder="WebView版本"
        @keyup.enter="reloadDevicesFromFirstPage"
        @clear="reloadDevicesFromFirstPage"
      />
    </section>

    <section v-else-if="activeTab === 'logs'" class="toolbar" aria-label="日志列表筛选">
      <el-segmented
        v-model="logFilters.level"
        :options="logLevelFilterOptions"
        class="log-level-filter"
      />
      <el-input
        v-model="logFilters.q"
        class="keyword-input"
        clearable
        placeholder="搜索日志消息、事件、设备或用户"
        :prefix-icon="Search"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.traceId"
        class="trace-input"
        clearable
        placeholder="trace_id"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.eventType"
        class="event-type-input"
        clearable
        placeholder="事件类型"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.sourceFileHash"
        class="file-hash-input"
        clearable
        placeholder="文件 hash"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.sourceFolder"
        class="source-folder-input"
        clearable
        placeholder="监听目录"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-select
        v-model="logFilters.watchFolderSource"
        class="source-select"
        clearable
        placeholder="目录来源"
        @change="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      >
        <el-option
          v-for="item in watchFolderSourceFilterOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-input
        v-model="logFilters.user"
        class="user-input"
        clearable
        placeholder="用户 / 岗位"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.appModule"
        class="module-input"
        clearable
        placeholder="模块"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.route"
        class="route-input"
        clearable
        placeholder="页面 / URL"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-input
        v-model="logFilters.batchId"
        class="batch-input"
        clearable
        placeholder="导入批次"
        @keyup.enter="reloadLogsFromFirstPage"
        @clear="reloadLogsFromFirstPage"
      />
      <el-tag
        v-if="logFilters.deviceId"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearLogDeviceFilter"
      >
        设备：{{ logFilters.deviceName || logFilters.deviceId }}
      </el-tag>
    </section>

    <section v-else class="toolbar" aria-label="入库结果筛选">
      <el-segmented
        v-model="entryResultFilters.status"
        :options="entryResultStatusFilterOptions"
        class="entry-status-filter"
      />
      <el-segmented
        v-model="entryResultFilters.targetKind"
        :options="targetKindFilterOptions"
        class="target-kind-filter"
      />
      <el-segmented
        v-model="entryResultFilters.duplicate"
        :options="duplicateFilterOptions"
        class="entry-duplicate-filter"
      />
      <el-select
        v-model="entryResultFilters.operatorSource"
        class="source-select"
        clearable
        placeholder="来源方式"
        @change="reloadEntryResultsFromFirstPage"
        @clear="reloadEntryResultsFromFirstPage"
      >
        <el-option
          v-for="item in operatorSourceFilterOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-input
        v-model="entryResultFilters.q"
        class="keyword-input"
        clearable
        placeholder="搜索文件、目标业务或上传人"
        :prefix-icon="Search"
        @keyup.enter="reloadEntryResultsFromFirstPage"
        @clear="reloadEntryResultsFromFirstPage"
      />
      <el-input
        v-model="entryResultFilters.user"
        class="user-input"
        clearable
        placeholder="上传人 / 岗位"
        @keyup.enter="reloadEntryResultsFromFirstPage"
        @clear="reloadEntryResultsFromFirstPage"
      />
      <el-input
        v-model="entryResultFilters.deviceId"
        class="device-input"
        clearable
        placeholder="设备编号"
        @keyup.enter="reloadEntryResultsFromFirstPage"
        @clear="reloadEntryResultsFromFirstPage"
      />
      <el-tag
        v-if="entryResultFilters.today"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearEntryResultTodayFilter"
      >
        今日结果
      </el-tag>
      <el-tag
        v-if="entryResultFilters.lowConfidence"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearEntryResultLowConfidenceFilter"
      >
        低置信度
      </el-tag>
      <el-tag
        v-if="entryResultFilters.assetId"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearEntryResultAssetFilter"
      >
        来源文件：{{ entryResultFilters.assetName || entryResultFilters.assetId }}
      </el-tag>
      <el-tag
        v-if="entryResultFilters.batchId"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearEntryResultBatchFilter"
      >
        导入批次：{{ entryResultFilters.batchLabel || entryResultFilters.batchId }}
      </el-tag>
      <el-tag
        v-if="entryResultFilters.deviceId"
        class="asset-filter-tag"
        closable
        effect="light"
        @close="clearEntryResultDeviceFilter"
      >
        来源设备：{{ entryResultFilters.deviceName || entryResultFilters.deviceId }}
      </el-tag>
    </section>

    <el-alert
      v-if="errorMessage"
      class="error-alert"
      type="error"
      :title="errorMessage"
      show-icon
      :closable="false"
    />

    <el-table
      v-if="activeTab === 'assets'"
      v-loading="loading"
      class="asset-table"
      :data="assets"
      row-key="id"
      border
      height="calc(100vh - 258px)"
      empty-text="暂无文件"
    >
      <el-table-column prop="originalFilename" label="文件名" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="file-cell">
            <el-icon><Document /></el-icon>
            <span>{{ row.originalFilename || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="文件类型" width="105">
        <template #default="{ row }">{{ assetFileTypeLabel(row) }}</template>
      </el-table-column>
      <el-table-column label="上传人" min-width="170">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.uploadedByUsername || row.uploadedByUserId || '-' }}</strong>
            <span>{{ row.uploadedByRole || '未记录岗位' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="来源设备" min-width="170">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.deviceName || '-' }}</strong>
            <span>{{ row.deviceCode || row.deviceId || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="来源" min-width="145">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ sourceLabel(row.uploadSource) }}</strong>
            <span>{{ operatorSourceLabel(row.operatorSource) }}</span>
            <span>{{ assetSourceFolderLabel(row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="目标业务" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ assetTargetLabel(row) }}</strong>
            <span>{{ targetKindLabel(row.targetKind) }} · {{ targetTableLabel(row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="生成单据" width="120">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ assetGeneratedCountLabel(row) }}</strong>
            <span>{{ formatConfidence(row.confidence) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="fileSize" label="大小" width="105">
        <template #default="{ row }">{{ formatBytes(row.fileSize) }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" effect="light">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="重复" width="110">
        <template #default="{ row }">
          <el-tag v-if="row.duplicate" type="warning" effect="light">重复</el-tag>
          <el-tag v-else type="success" effect="light">非重复</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="上传时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="112" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="View" @click.stop="showEntryResultsForAsset(row)">入库结果</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-table
      v-else-if="activeTab === 'devices'"
      v-loading="deviceLoading"
      class="asset-table"
      :data="devices"
      row-key="id"
      border
      height="calc(100vh - 258px)"
      empty-text="暂无设备"
    >
      <el-table-column prop="deviceName" label="设备名称" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.deviceName || '-' }}</strong>
            <span>{{ row.deviceCode || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="默认上传人" min-width="170">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.defaultUsername || row.defaultUserId || '-' }}</strong>
            <span>{{ row.defaultRole || '未记录岗位' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="enterpriseId" label="企业/租户" min-width="145" show-overflow-tooltip />
      <el-table-column label="版本" min-width="145">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.clientVersion || '-' }}</strong>
            <span>WebView {{ row.webviewVersion || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="deviceStatusTagType(row.status)" effect="light">{{ deviceStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastSeenAt" label="最后心跳" width="180">
        <template #default="{ row }">{{ formatTime(row.lastSeenAt) }}</template>
      </el-table-column>
      <el-table-column prop="serverBaseUrl" label="服务器" min-width="210" show-overflow-tooltip />
      <el-table-column label="操作" width="330" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Document" @click.stop="showAssetsForDevice(row)">文件</el-button>
          <el-button link type="primary" :icon="Document" @click.stop="openWatchFolders(row)">目录</el-button>
          <el-button link type="primary" :icon="View" @click.stop="showLogsForDevice(row)">日志</el-button>
          <el-button link type="primary" :icon="View" @click.stop="showEntryResultsForDevice(row)">入库</el-button>
          <el-button
            link
            :type="row.status === 'disabled' ? 'success' : 'warning'"
            :loading="deviceActionLoadingId === `${row.id}:status`"
            @click.stop="toggleDeviceStatus(row)"
          >
            {{ row.status === 'disabled' ? '启用' : '停用' }}
          </el-button>
          <el-button
            link
            type="danger"
            :loading="deviceActionLoadingId === `${row.id}:reset-code`"
            @click.stop="resetDeviceBindingCode(row)"
          >
            重置码
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-table
      v-else-if="activeTab === 'logs'"
      v-loading="logLoading"
      class="asset-table"
      :data="logs"
      row-key="id"
      border
      height="calc(100vh - 258px)"
      empty-text="暂无日志"
    >
      <el-table-column prop="level" label="级别" width="100">
        <template #default="{ row }">
          <el-tag :type="logLevelTagType(row.level)" effect="light">{{ logLevelLabel(row.level) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="事件 / 消息" min-width="280" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.eventType || '-' }}</strong>
            <span>{{ row.message || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="设备" min-width="170">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.deviceName || '-' }}</strong>
            <span>{{ row.deviceCode || row.deviceId || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="用户 / 岗位" min-width="155">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.username || row.userId || '-' }}</strong>
            <span>{{ row.role || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="位置" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.appModule || '-' }}</strong>
            <span>{{ row.route || row.url || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="请求" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.statusCode || '-' }}</strong>
            <span>{{ row.requestUrl || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="来源文件" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.sourceFileHash || '-' }}</strong>
            <span>{{ logSourceFolderLabel(row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="traceId" label="trace_id" min-width="180" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.sourceFileHash"
            link
            type="primary"
            :icon="Document"
            @click.stop="showAssetForLog(row)"
          >
            文件
          </el-button>
          <el-button
            v-if="row.aiImportBatchId"
            link
            type="primary"
            :icon="View"
            @click.stop="showEntryResultsForLog(row)"
          >
            入库结果
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-table
      v-else
      v-loading="entryResultLoading"
      class="asset-table"
      :data="entryResults"
      row-key="id"
      border
      height="calc(100vh - 258px)"
      empty-text="暂无入库结果"
      @row-dblclick="openEntryResultDetail"
    >
      <el-table-column label="来源文件" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="file-cell">
            <el-icon><Document /></el-icon>
            <span>{{ row.originalFilename || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="入库状态" width="120">
        <template #default="{ row }">
          <el-tag :type="entryResultStatusTagType(row.status)" effect="light">{{ entryResultStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="目标业务" min-width="230" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.targetDocumentType || row.appName || row.targetModule || '-' }}</strong>
            <span>{{ targetKindLabel(row.targetKind) }} · {{ targetTableLabel(row) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="业务记录" min-width="150">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.importedCount }} 条已入库</strong>
            <span>{{ row.rejectedCount }} 条失败 · {{ row.unmappedFieldCount }} 个未匹配字段</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="上传人 / 来源" min-width="170">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.uploadedByUsername || row.uploadedByUserId || '-' }}</strong>
            <span>{{ row.uploadedByRole || operatorSourceLabel(row.operatorSource) }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="来源设备" min-width="170">
        <template #default="{ row }">
          <div class="stacked-cell">
            <strong>{{ row.deviceName || '-' }}</strong>
            <span>{{ row.deviceCode || row.deviceId || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="置信度" width="105">
        <template #default="{ row }">{{ formatConfidence(row.confidence) }}</template>
      </el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="180">
        <template #default="{ row }">{{ formatTime(row.updatedAt || row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="98" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="View" @click.stop="openEntryResultDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <footer v-if="activeTab === 'assets'" class="table-footer">
      <span>共 {{ total }} 个文件</span>
      <el-pagination
        background
        layout="prev, pager, next, sizes"
        :total="total"
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </footer>

    <footer v-else-if="activeTab === 'devices'" class="table-footer">
      <span>共 {{ deviceTotal }} 台设备</span>
      <el-pagination
        background
        layout="prev, pager, next, sizes"
        :total="deviceTotal"
        :current-page="devicePage"
        :page-size="devicePageSize"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="handleDevicePageChange"
        @size-change="handleDeviceSizeChange"
      />
    </footer>

    <footer v-else-if="activeTab === 'logs'" class="table-footer">
      <span>共 {{ logTotal }} 条日志</span>
      <el-pagination
        background
        layout="prev, pager, next, sizes"
        :total="logTotal"
        :current-page="logPage"
        :page-size="logPageSize"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="handleLogPageChange"
        @size-change="handleLogSizeChange"
      />
    </footer>

    <footer v-else class="table-footer">
      <span>共 {{ entryResultTotal }} 条入库结果</span>
      <el-pagination
        background
        layout="prev, pager, next, sizes"
        :total="entryResultTotal"
        :current-page="entryResultPage"
        :page-size="entryResultPageSize"
        :page-sizes="[20, 50, 100, 200]"
        @current-change="handleEntryResultPageChange"
        @size-change="handleEntryResultSizeChange"
      />
    </footer>

    <el-drawer
      v-model="watchFolderDrawerVisible"
      class="watch-folder-drawer"
      title="监听目录"
      size="640px"
      destroy-on-close
    >
      <div class="watch-folder-detail">
        <el-descriptions v-if="selectedWatchFolderDevice" :column="1" border>
          <el-descriptions-item label="设备名称">{{ selectedWatchFolderDevice.deviceName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="设备编号">{{ selectedWatchFolderDevice.deviceCode || selectedWatchFolderDevice.id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="默认上传人">
            {{ selectedWatchFolderDevice.defaultUsername || selectedWatchFolderDevice.defaultUserId || '-' }}
            <span class="muted-inline">{{ selectedWatchFolderDevice.defaultRole || '未记录岗位' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-form class="watch-folder-form" :model="watchFolderForm" label-width="86px">
          <el-form-item label="目录路径">
            <el-input
              v-model="watchFolderForm.folderPath"
              clearable
              placeholder="例如 D:\\EISCore\\Inbox"
            />
          </el-form-item>
          <el-form-item label="目录名称">
            <el-input
              v-model="watchFolderForm.folderName"
              clearable
              placeholder="例如 仓库收单"
            />
          </el-form-item>
          <el-form-item label="默认归属">
            <div class="watch-folder-owner-row">
              <el-input v-model="watchFolderForm.defaultUserId" clearable placeholder="默认上传用户 ID" />
              <el-input v-model="watchFolderForm.defaultRole" clearable placeholder="默认岗位 / 角色" />
            </div>
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="watchFolderForm.enabled" />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              :loading="watchFolderSaving"
              @click="saveWatchFolder"
            >
              {{ watchFolderForm.id ? '保存目录' : '新增目录' }}
            </el-button>
            <el-button v-if="watchFolderForm.id" @click="resetWatchFolderForm">取消编辑</el-button>
          </el-form-item>
        </el-form>

        <section class="detail-section">
          <div class="detail-section-header">
            <h2>设备监听目录</h2>
            <span>{{ watchFolders.length }} 个</span>
          </div>
          <el-table
            v-loading="watchFolderLoading"
            :data="watchFolders"
            size="small"
            border
            empty-text="暂无监听目录"
          >
            <el-table-column label="目录" min-width="230" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="stacked-cell">
                  <strong>{{ row.folderName || '未命名目录' }}</strong>
                  <span>{{ row.folderPath || '-' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="默认归属" min-width="150" show-overflow-tooltip>
              <template #default="{ row }">
                <div class="stacked-cell">
                  <strong>{{ row.defaultUserId || '-' }}</strong>
                  <span>{{ row.defaultRole || '未记录岗位' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90">
              <template #default="{ row }">
                <el-tag :type="row.enabled ? 'success' : 'info'" effect="light">
                  {{ row.enabled ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" width="155">
              <template #default="{ row }">{{ formatTime(row.updatedAt || row.createdAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="174" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="primary"
                  @click.stop="editWatchFolder(row)"
                >
                  编辑
                </el-button>
                <el-button
                  link
                  :type="row.enabled ? 'warning' : 'success'"
                  :loading="watchFolderActionLoadingId === `${row.id}:status`"
                  @click.stop="toggleWatchFolderStatus(row)"
                >
                  {{ row.enabled ? '停用目录' : '启用目录' }}
                </el-button>
                <el-button
                  link
                  type="danger"
                  :loading="watchFolderActionLoadingId === `${row.id}:delete`"
                  @click.stop="deleteWatchFolder(row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </el-drawer>

    <el-drawer
      v-model="entryResultDrawerVisible"
      class="entry-result-drawer"
      title="入库结果详情"
      size="620px"
      destroy-on-close
    >
      <div v-loading="entryResultDetailLoading" class="entry-result-detail">
        <template v-if="selectedEntryResult">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="来源文件">{{ selectedEntryResult.originalFilename || '-' }}</el-descriptions-item>
            <el-descriptions-item label="入库状态">
              <el-tag :type="entryResultStatusTagType(selectedEntryResult.status)" effect="light">
                {{ entryResultStatusLabel(selectedEntryResult.status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="目标业务">
              {{ selectedEntryResult.targetDocumentType || selectedEntryResult.appName || selectedEntryResult.targetModule || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="目标表">{{ targetTableLabel(selectedEntryResult) }}</el-descriptions-item>
            <el-descriptions-item label="上传人">
              {{ selectedEntryResult.uploadedByUsername || selectedEntryResult.uploadedByUserId || '-' }}
              <span class="muted-inline">{{ selectedEntryResult.uploadedByRole || operatorSourceLabel(selectedEntryResult.operatorSource) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="来源设备">
              {{ selectedEntryResult.deviceName || selectedEntryResult.deviceCode || selectedEntryResult.deviceId || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">{{ formatTime(selectedEntryResult.updatedAt || selectedEntryResult.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="识别原因">{{ selectedEntryResult.reason || '-' }}</el-descriptions-item>
          </el-descriptions>

          <section class="detail-section">
            <div class="detail-section-header">
              <h2>入库日志</h2>
              <span>{{ relatedLogs.length }} 条</span>
            </div>
            <el-table :data="relatedLogs" size="small" border empty-text="暂无入库日志">
              <el-table-column label="级别" width="86">
                <template #default="{ row }">
                  <el-tag :type="logLevelTagType(row.level)" effect="light">{{ logLevelLabel(row.level) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="事件 / 消息" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="stacked-cell">
                    <strong>{{ row.eventType || '-' }}</strong>
                    <span>{{ row.message || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="设备 / 用户" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="stacked-cell">
                    <strong>{{ row.deviceName || row.deviceCode || row.deviceId || '-' }}</strong>
                    <span>{{ row.username || row.userId || row.role || '-' }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="traceId" label="trace_id" min-width="160" show-overflow-tooltip />
              <el-table-column prop="createdAt" label="时间" width="155">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
            </el-table>
          </section>

          <section class="detail-section">
            <div class="detail-section-header">
              <h2>业务记录</h2>
              <span>{{ businessLinks.length }} 条</span>
            </div>
            <el-table :data="businessLinks" size="small" border empty-text="暂无业务记录">
              <el-table-column label="目标表" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">{{ linkTargetTableLabel(row) }}</template>
              </el-table-column>
              <el-table-column prop="targetRecordId" label="记录 ID" min-width="160" show-overflow-tooltip />
              <el-table-column label="置信度" width="90">
                <template #default="{ row }">{{ formatConfidence(row.aiConfidence) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="132" fixed="right">
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :disabled="!businessRecordUrl(row)"
                    @click.stop="openBusinessRecord(row)"
                  >
                    打开
                  </el-button>
                  <el-button
                    link
                    type="primary"
                    :disabled="!row.targetRecordId"
                    @click.stop="copyBusinessRecordId(row)"
                  >
                    复制ID
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </section>

          <section class="detail-section">
            <div class="detail-section-header">
              <h2>修改记录</h2>
              <span>{{ businessCorrections.length }} 条</span>
            </div>
            <el-table :data="businessCorrections" size="small" border empty-text="暂无修改记录">
              <el-table-column label="字段" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">{{ row.fieldName || '-' }}</template>
              </el-table-column>
              <el-table-column label="修改前 / 后" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">
                  <div class="stacked-cell">
                    <strong>{{ correctionValueLabel(row.oldValue) }}</strong>
                    <span>{{ correctionValueLabel(row.newValue) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="影响 / 重算" min-width="150">
                <template #default="{ row }">
                  <div class="stacked-cell">
                    <strong>{{ row.affectsBusinessResult ? '影响业务结果' : '普通修正' }}</strong>
                    <span>{{ recalculationStatusLabel(row.recalculationStatus) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="修正人" min-width="120" show-overflow-tooltip>
                <template #default="{ row }">{{ row.correctedBy || '-' }}</template>
              </el-table-column>
              <el-table-column prop="correctedAt" label="时间" width="155">
                <template #default="{ row }">{{ formatTime(row.correctedAt) }}</template>
              </el-table-column>
            </el-table>
          </section>

          <section class="detail-section">
            <div class="detail-section-header">
              <h2>失败行</h2>
              <span>{{ rejectedRows.length }} 条</span>
            </div>
            <el-table :data="rejectedRows" size="small" border empty-text="暂无失败行">
              <el-table-column label="来源" min-width="150" show-overflow-tooltip>
                <template #default="{ row }">{{ row.source || '-' }}</template>
              </el-table-column>
              <el-table-column label="原因" min-width="220" show-overflow-tooltip>
                <template #default="{ row }">{{ row.reason || row.message || '-' }}</template>
              </el-table-column>
            </el-table>
          </section>

          <section class="detail-section">
            <div class="detail-section-header">
              <h2>未匹配字段</h2>
              <span>{{ unmappedFields.length }} 个</span>
            </div>
            <el-table :data="unmappedFields" size="small" border empty-text="暂无未匹配字段">
              <el-table-column prop="name" label="字段" min-width="120" show-overflow-tooltip />
              <el-table-column prop="value" label="值" min-width="180" show-overflow-tooltip />
              <el-table-column prop="source" label="来源" min-width="130" show-overflow-tooltip />
              <el-table-column prop="writeLocation" label="写入位置" width="105" />
            </el-table>
          </section>
        </template>
      </div>
    </el-drawer>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Document, Refresh, Search, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { navigateEnterprisePath } from '@eiscore/platform/navigation'
import {
  deviceStatusFilterOptions,
  duplicateFilterOptions,
  entryResultStatusFilterOptions,
  logLevelFilterOptions,
  operatorSourceFilterOptions,
  watchFolderSourceFilterOptions,
  targetKindFilterOptions,
  createDocumentIntakeDeviceWatchFolder,
  deleteDocumentIntakeWatchFolder,
  fetchDocumentIntakeAssets,
  fetchDocumentIntakeDevices,
  fetchDocumentIntakeDeviceWatchFolders,
  fetchDocumentIntakeEntryResultDetail,
  fetchDocumentIntakeEntryResults,
  fetchDocumentIntakeLogs,
  fetchDocumentIntakeOverview,
  resetDocumentIntakeDeviceBindingCode,
  updateDocumentIntakeDeviceStatus,
  updateDocumentIntakeWatchFolder,
  updateDocumentIntakeWatchFolderStatus
} from '@/utils/document-intake-api.js'

const activeTab = ref('assets')
const assets = ref([])
const devices = ref([])
const logs = ref([])
const entryResults = ref([])
const overview = ref({})
const total = ref(0)
const deviceTotal = ref(0)
const logTotal = ref(0)
const entryResultTotal = ref(0)
const page = ref(1)
const devicePage = ref(1)
const logPage = ref(1)
const entryResultPage = ref(1)
const pageSize = ref(50)
const devicePageSize = ref(50)
const logPageSize = ref(50)
const entryResultPageSize = ref(50)
const loading = ref(false)
const deviceLoading = ref(false)
const logLoading = ref(false)
const entryResultLoading = ref(false)
const overviewLoading = ref(false)
const entryResultDetailLoading = ref(false)
const entryResultDrawerVisible = ref(false)
const entryResultDetail = ref(null)
const entryResultDetailFallback = ref(null)
const deviceActionLoadingId = ref('')
const watchFolderDrawerVisible = ref(false)
const watchFolderLoading = ref(false)
const watchFolderActionLoadingId = ref('')
const watchFolderSaving = ref(false)
const selectedWatchFolderDevice = ref(null)
const watchFolders = ref([])
const errorMessage = ref('')
const filters = reactive({
  duplicate: '',
  q: '',
  status: '',
  today: false,
  deviceId: '',
  deviceName: '',
  user: '',
  operatorSource: '',
  sourceFolder: '',
  watchFolderSource: ''
})
const deviceFilters = reactive({
  status: '',
  q: '',
  user: '',
  serverBaseUrl: '',
  clientVersion: '',
  webviewVersion: ''
})
const logFilters = reactive({
  level: '',
  q: '',
  traceId: '',
  eventType: '',
  sourceFileHash: '',
  sourceFolder: '',
  watchFolderSource: '',
  user: '',
  appModule: '',
  route: '',
  batchId: '',
  deviceId: '',
  deviceName: ''
})
const entryResultFilters = reactive({
  status: '',
  targetKind: '',
  duplicate: '',
  q: '',
  user: '',
  operatorSource: '',
  today: false,
  lowConfidence: false,
  deviceId: '',
  deviceName: '',
  assetId: '',
  assetName: '',
  batchId: '',
  batchLabel: ''
})
const watchFolderForm = reactive({
  id: '',
  folderPath: '',
  folderName: '',
  defaultUserId: '',
  defaultRole: '',
  enabled: true
})

let requestSeq = 0
let deviceRequestSeq = 0
let logRequestSeq = 0
let entryResultRequestSeq = 0
let entryResultDetailRequestSeq = 0
let overviewRequestSeq = 0
let watchFolderRequestSeq = 0

const activeLoading = computed(() => {
  if (overviewLoading.value) return true
  if (activeTab.value === 'devices') return deviceLoading.value
  if (activeTab.value === 'logs') return logLoading.value
  if (activeTab.value === 'entryResults') return entryResultLoading.value
  return loading.value
})

const overviewItems = computed(() => [
  { key: 'todayFileCount', label: '今日采集', value: formatInteger(overview.value.todayFileCount), action: 'assets-today' },
  { key: 'successfulImportCount', label: '成功入库', value: formatInteger(overview.value.successfulImportCount), action: 'entry-successful' },
  { key: 'lowConfidenceCount', label: '低置信度', value: formatInteger(overview.value.lowConfidenceCount), action: 'entry-low-confidence' },
  { key: 'unrecognizedCount', label: '未识别', value: formatInteger(overview.value.unrecognizedCount), action: 'assets-unrecognized' },
  { key: 'duplicateFileCount', label: '重复文件', value: formatInteger(overview.value.duplicateFileCount), action: 'assets-duplicate' },
  { key: 'failedCount', label: '失败', value: formatInteger(overview.value.failedCount), action: 'entry-failed' },
  { key: 'activeDeviceCount', label: '在线设备', value: formatInteger(overview.value.activeDeviceCount), action: 'devices-active' },
  { key: 'offlineDeviceCount', label: '离线设备', value: formatInteger(overview.value.offlineDeviceCount), action: 'devices-offline' }
])

const selectedEntryResult = computed(() => entryResultDetail.value?.entryResult || entryResultDetailFallback.value)
const businessLinks = computed(() => Array.isArray(entryResultDetail.value?.businessLinks) ? entryResultDetail.value.businessLinks : [])
const businessCorrections = computed(() => Array.isArray(entryResultDetail.value?.businessCorrections) ? entryResultDetail.value.businessCorrections : [])
const relatedLogs = computed(() => Array.isArray(entryResultDetail.value?.relatedLogs) ? entryResultDetail.value.relatedLogs : [])
const unmappedFields = computed(() => Array.isArray(entryResultDetail.value?.unmappedFields) ? entryResultDetail.value.unmappedFields : [])
const rejectedRows = computed(() => {
  if (Array.isArray(entryResultDetail.value?.rejectedRows)) return entryResultDetail.value.rejectedRows
  const metadata = selectedEntryResult.value?.metadata || {}
  return Array.isArray(metadata.rejected_rows) ? metadata.rejected_rows : []
})

const loadOverview = async () => {
  const seq = ++overviewRequestSeq
  overviewLoading.value = true
  try {
    const data = await fetchDocumentIntakeOverview()
    if (seq !== overviewRequestSeq) return
    overview.value = data?.overview && typeof data.overview === 'object' ? data.overview : {}
  } catch (error) {
    if (seq !== overviewRequestSeq) return
    overview.value = {}
    errorMessage.value = error?.message || '智能收单总览加载失败'
  } finally {
    if (seq === overviewRequestSeq) overviewLoading.value = false
  }
}

const loadAssets = async () => {
  const seq = ++requestSeq
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchDocumentIntakeAssets({
      duplicate: filters.duplicate,
      q: filters.q,
      status: filters.status,
      today: filters.today,
      deviceId: filters.deviceId,
      user: filters.user,
      operatorSource: filters.operatorSource,
      sourceFolder: filters.sourceFolder,
      watchFolderSource: filters.watchFolderSource,
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    })
    if (seq !== requestSeq) return
    assets.value = Array.isArray(data.assets) ? data.assets : []
    total.value = Number(data.total || 0)
  } catch (error) {
    if (seq !== requestSeq) return
    assets.value = []
    total.value = 0
    errorMessage.value = error?.message || '文件列表加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

const loadDevices = async () => {
  const seq = ++deviceRequestSeq
  deviceLoading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchDocumentIntakeDevices({
      status: deviceFilters.status,
      q: deviceFilters.q,
      user: deviceFilters.user,
      serverBaseUrl: deviceFilters.serverBaseUrl,
      clientVersion: deviceFilters.clientVersion,
      webviewVersion: deviceFilters.webviewVersion,
      limit: devicePageSize.value,
      offset: (devicePage.value - 1) * devicePageSize.value
    })
    if (seq !== deviceRequestSeq) return
    devices.value = Array.isArray(data.devices) ? data.devices : []
    deviceTotal.value = Number(data.total || 0)
  } catch (error) {
    if (seq !== deviceRequestSeq) return
    devices.value = []
    deviceTotal.value = 0
    errorMessage.value = error?.message || '设备列表加载失败'
  } finally {
    if (seq === deviceRequestSeq) deviceLoading.value = false
  }
}

const loadLogs = async () => {
  const seq = ++logRequestSeq
  logLoading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchDocumentIntakeLogs({
      level: logFilters.level,
      q: logFilters.q,
      traceId: logFilters.traceId,
      eventType: logFilters.eventType,
      sourceFileHash: logFilters.sourceFileHash,
      sourceFolder: logFilters.sourceFolder,
      watchFolderSource: logFilters.watchFolderSource,
      user: logFilters.user,
      appModule: logFilters.appModule,
      route: logFilters.route,
      batchId: logFilters.batchId,
      deviceId: logFilters.deviceId,
      limit: logPageSize.value,
      offset: (logPage.value - 1) * logPageSize.value
    })
    if (seq !== logRequestSeq) return
    logs.value = Array.isArray(data.logs) ? data.logs : []
    logTotal.value = Number(data.total || 0)
  } catch (error) {
    if (seq !== logRequestSeq) return
    logs.value = []
    logTotal.value = 0
    errorMessage.value = error?.message || '日志列表加载失败'
  } finally {
    if (seq === logRequestSeq) logLoading.value = false
  }
}

const loadEntryResults = async () => {
  const seq = ++entryResultRequestSeq
  entryResultLoading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchDocumentIntakeEntryResults({
      status: entryResultFilters.status,
      targetKind: entryResultFilters.targetKind,
      duplicate: entryResultFilters.duplicate,
      q: entryResultFilters.q,
      user: entryResultFilters.user,
      operatorSource: entryResultFilters.operatorSource,
      today: entryResultFilters.today,
      lowConfidence: entryResultFilters.lowConfidence,
      deviceId: entryResultFilters.deviceId,
      assetId: entryResultFilters.assetId,
      batchId: entryResultFilters.batchId,
      limit: entryResultPageSize.value,
      offset: (entryResultPage.value - 1) * entryResultPageSize.value
    })
    if (seq !== entryResultRequestSeq) return
    entryResults.value = Array.isArray(data.entryResults) ? data.entryResults : []
    entryResultTotal.value = Number(data.total || 0)
  } catch (error) {
    if (seq !== entryResultRequestSeq) return
    entryResults.value = []
    entryResultTotal.value = 0
    errorMessage.value = error?.message || '入库结果加载失败'
  } finally {
    if (seq === entryResultRequestSeq) entryResultLoading.value = false
  }
}

const loadEntryResultDetail = async (id) => {
  const seq = ++entryResultDetailRequestSeq
  entryResultDetailLoading.value = true
  try {
    const data = await fetchDocumentIntakeEntryResultDetail(id)
    if (seq !== entryResultDetailRequestSeq) return
    entryResultDetail.value = data
  } catch (error) {
    if (seq !== entryResultDetailRequestSeq) return
    entryResultDetail.value = null
    errorMessage.value = error?.message || '入库结果详情加载失败'
  } finally {
    if (seq === entryResultDetailRequestSeq) entryResultDetailLoading.value = false
  }
}

const openEntryResultDetail = (row) => {
  if (!row?.id) return
  entryResultDrawerVisible.value = true
  entryResultDetailFallback.value = row
  entryResultDetail.value = null
  void loadEntryResultDetail(row.id)
}

const showEntryResultsForAsset = (row) => {
  if (!row?.id) return
  entryResultFilters.assetId = row.id
  entryResultFilters.assetName = row.originalFilename || row.id
  entryResultFilters.status = ''
  entryResultFilters.targetKind = ''
  entryResultFilters.duplicate = ''
  entryResultFilters.q = ''
  entryResultFilters.user = ''
  entryResultFilters.operatorSource = ''
  entryResultFilters.today = false
  entryResultFilters.lowConfidence = false
  entryResultFilters.deviceId = ''
  entryResultFilters.deviceName = ''
  entryResultFilters.batchId = ''
  entryResultFilters.batchLabel = ''
  activeTab.value = 'entryResults'
  reloadEntryResultsFromFirstPage()
}

const showEntryResultsForLog = (row) => {
  if (!row?.aiImportBatchId) return
  entryResultFilters.batchId = row.aiImportBatchId
  entryResultFilters.batchLabel = row.aiImportBatchId
  entryResultFilters.assetId = ''
  entryResultFilters.assetName = ''
  entryResultFilters.status = ''
  entryResultFilters.targetKind = ''
  entryResultFilters.duplicate = ''
  entryResultFilters.q = ''
  entryResultFilters.user = ''
  entryResultFilters.operatorSource = ''
  entryResultFilters.today = false
  entryResultFilters.lowConfidence = false
  entryResultFilters.deviceId = ''
  entryResultFilters.deviceName = ''
  activeTab.value = 'entryResults'
  reloadEntryResultsFromFirstPage()
}

const showEntryResultsForDevice = (row) => {
  const deviceId = row?.id || row?.deviceCode
  if (!deviceId) return
  entryResultFilters.deviceId = deviceId
  entryResultFilters.deviceName = row.deviceName || row.deviceCode || deviceId
  entryResultFilters.status = ''
  entryResultFilters.targetKind = ''
  entryResultFilters.duplicate = ''
  entryResultFilters.q = ''
  entryResultFilters.user = ''
  entryResultFilters.operatorSource = ''
  entryResultFilters.today = false
  entryResultFilters.lowConfidence = false
  entryResultFilters.assetId = ''
  entryResultFilters.assetName = ''
  entryResultFilters.batchId = ''
  entryResultFilters.batchLabel = ''
  activeTab.value = 'entryResults'
  reloadEntryResultsFromFirstPage()
}

const showAssetsForDevice = (row) => {
  const deviceId = row?.id || row?.deviceCode
  if (!deviceId) return
  filters.deviceId = deviceId
  filters.deviceName = row.deviceName || row.deviceCode || deviceId
  filters.q = ''
  filters.status = ''
  filters.duplicate = ''
  filters.today = false
  filters.user = ''
  filters.operatorSource = ''
  filters.sourceFolder = ''
  filters.watchFolderSource = ''
  activeTab.value = 'assets'
  reloadFromFirstPage()
}

const showLogsForDevice = (row) => {
  const deviceId = row?.id || row?.deviceCode
  if (!deviceId) return
  logFilters.deviceId = deviceId
  logFilters.deviceName = row.deviceName || row.deviceCode || deviceId
  logFilters.level = ''
  logFilters.q = ''
  logFilters.traceId = ''
  logFilters.eventType = ''
  logFilters.sourceFileHash = ''
  logFilters.sourceFolder = ''
  logFilters.watchFolderSource = ''
  logFilters.user = ''
  logFilters.appModule = ''
  logFilters.route = ''
  logFilters.batchId = ''
  activeTab.value = 'logs'
  reloadLogsFromFirstPage()
}

const showAssetForLog = (row) => {
  if (!row?.sourceFileHash) return
  filters.q = row.sourceFileHash
  filters.status = ''
  filters.duplicate = ''
  filters.today = false
  filters.deviceId = ''
  filters.deviceName = ''
  filters.user = ''
  filters.operatorSource = ''
  filters.sourceFolder = ''
  filters.watchFolderSource = ''
  activeTab.value = 'assets'
  reloadFromFirstPage()
}

const clearAssetDeviceFilter = () => {
  filters.deviceId = ''
  filters.deviceName = ''
  reloadFromFirstPage()
}

const clearAssetTodayFilter = () => {
  filters.today = false
  reloadFromFirstPage()
}

const clearLogDeviceFilter = () => {
  logFilters.deviceId = ''
  logFilters.deviceName = ''
  reloadLogsFromFirstPage()
}

const resetLogFilters = () => {
  logFilters.level = ''
  logFilters.q = ''
  logFilters.traceId = ''
  logFilters.eventType = ''
  logFilters.sourceFileHash = ''
  logFilters.sourceFolder = ''
  logFilters.watchFolderSource = ''
  logFilters.user = ''
  logFilters.appModule = ''
  logFilters.route = ''
  logFilters.batchId = ''
  logFilters.deviceId = ''
  logFilters.deviceName = ''
}

const clearEntryResultAssetFilter = () => {
  entryResultFilters.assetId = ''
  entryResultFilters.assetName = ''
  reloadEntryResultsFromFirstPage()
}

const clearEntryResultBatchFilter = () => {
  entryResultFilters.batchId = ''
  entryResultFilters.batchLabel = ''
  reloadEntryResultsFromFirstPage()
}

const clearEntryResultDeviceFilter = () => {
  entryResultFilters.deviceId = ''
  entryResultFilters.deviceName = ''
  reloadEntryResultsFromFirstPage()
}

const clearEntryResultTodayFilter = () => {
  entryResultFilters.today = false
  reloadEntryResultsFromFirstPage()
}

const clearEntryResultLowConfidenceFilter = () => {
  entryResultFilters.lowConfidence = false
  reloadEntryResultsFromFirstPage()
}

const resetAssetFilters = () => {
  filters.q = ''
  filters.status = ''
  filters.duplicate = ''
  filters.today = false
  filters.deviceId = ''
  filters.deviceName = ''
  filters.user = ''
  filters.operatorSource = ''
  filters.sourceFolder = ''
  filters.watchFolderSource = ''
}

const resetDeviceFilters = () => {
  deviceFilters.status = ''
  deviceFilters.q = ''
  deviceFilters.user = ''
  deviceFilters.serverBaseUrl = ''
  deviceFilters.clientVersion = ''
  deviceFilters.webviewVersion = ''
}

const toggleDeviceStatus = async (row) => {
  if (!row?.id) return
  const nextStatus = row.status === 'disabled' ? 'active' : 'disabled'
  const label = nextStatus === 'disabled' ? '停用' : '启用'
  try {
    await ElMessageBox.confirm(`确认${label}设备 ${row.deviceName || row.deviceCode || row.id}？`, `${label}设备`, {
      confirmButtonText: label,
      cancelButtonText: '取消',
      type: nextStatus === 'disabled' ? 'warning' : 'info'
    })
  } catch {
    return
  }
  deviceActionLoadingId.value = `${row.id}:status`
  try {
    await updateDocumentIntakeDeviceStatus(row.id, nextStatus)
    ElMessage.success(`设备已${label}`)
    await Promise.all([loadDevices(), loadOverview()])
  } catch (error) {
    ElMessage.error(error?.message || `设备${label}失败`)
  } finally {
    deviceActionLoadingId.value = ''
  }
}

const resetDeviceBindingCode = async (row) => {
  if (!row?.id) return
  try {
    await ElMessageBox.confirm(`确认重置设备 ${row.deviceName || row.deviceCode || row.id} 的授权码？旧 token 将失效，需要重新绑定。`, '重置设备授权码', {
      confirmButtonText: '重置',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  deviceActionLoadingId.value = `${row.id}:reset-code`
  try {
    const data = await resetDocumentIntakeDeviceBindingCode(row.id)
    const bindingCode = data?.bindingCode || ''
    if (bindingCode) {
      try {
        await copyTextToClipboard(bindingCode)
        ElMessage.success('新授权码已复制')
      } catch {
        await ElMessageBox.alert(bindingCode, '新设备授权码', { confirmButtonText: '知道了' })
      }
    } else {
      ElMessage.success('设备授权码已重置')
    }
    await Promise.all([loadDevices(), loadOverview()])
  } catch (error) {
    ElMessage.error(error?.message || '设备授权码重置失败')
  } finally {
    deviceActionLoadingId.value = ''
  }
}

const resetWatchFolderForm = () => {
  watchFolderForm.id = ''
  watchFolderForm.folderPath = ''
  watchFolderForm.folderName = ''
  watchFolderForm.defaultUserId = ''
  watchFolderForm.defaultRole = ''
  watchFolderForm.enabled = true
}

const editWatchFolder = (row) => {
  watchFolderForm.id = row?.id || ''
  watchFolderForm.folderPath = row?.folderPath || ''
  watchFolderForm.folderName = row?.folderName || ''
  watchFolderForm.defaultUserId = row?.defaultUserId || ''
  watchFolderForm.defaultRole = row?.defaultRole || ''
  watchFolderForm.enabled = row?.enabled !== false
}

const watchFolderPayload = () => ({
  folderPath: watchFolderForm.folderPath.trim(),
  folderName: watchFolderForm.folderName.trim(),
  defaultUserId: watchFolderForm.defaultUserId.trim(),
  defaultRole: watchFolderForm.defaultRole.trim(),
  enabled: watchFolderForm.enabled
})

const loadWatchFolders = async () => {
  const deviceId = selectedWatchFolderDevice.value?.id
  if (!deviceId) return
  const seq = ++watchFolderRequestSeq
  watchFolderLoading.value = true
  try {
    const data = await fetchDocumentIntakeDeviceWatchFolders(deviceId)
    if (seq !== watchFolderRequestSeq) return
    watchFolders.value = Array.isArray(data.watchFolders) ? data.watchFolders : []
  } catch (error) {
    if (seq !== watchFolderRequestSeq) return
    watchFolders.value = []
    ElMessage.error(error?.message || '监听目录加载失败')
  } finally {
    if (seq === watchFolderRequestSeq) watchFolderLoading.value = false
  }
}

const openWatchFolders = (row) => {
  if (!row?.id) return
  selectedWatchFolderDevice.value = row
  watchFolders.value = []
  resetWatchFolderForm()
  watchFolderDrawerVisible.value = true
  void loadWatchFolders()
}

const saveWatchFolder = async () => {
  const deviceId = selectedWatchFolderDevice.value?.id
  if (!deviceId) return
  const payload = watchFolderPayload()
  if (!payload.folderPath) {
    ElMessage.warning('请填写目录路径')
    return
  }
  watchFolderSaving.value = true
  try {
    if (watchFolderForm.id) {
      await updateDocumentIntakeWatchFolder(deviceId, watchFolderForm.id, payload)
      ElMessage.success('监听目录已保存')
    } else {
      await createDocumentIntakeDeviceWatchFolder(deviceId, payload)
      ElMessage.success('监听目录已新增')
    }
    resetWatchFolderForm()
    await loadWatchFolders()
  } catch (error) {
    ElMessage.error(error?.message || '监听目录保存失败')
  } finally {
    watchFolderSaving.value = false
  }
}

const toggleWatchFolderStatus = async (row) => {
  const deviceId = selectedWatchFolderDevice.value?.id
  if (!deviceId || !row?.id) return
  const nextEnabled = !row.enabled
  const label = nextEnabled ? '启用' : '停用'
  watchFolderActionLoadingId.value = `${row.id}:status`
  try {
    await updateDocumentIntakeWatchFolderStatus(deviceId, row.id, nextEnabled)
    ElMessage.success(`监听目录已${label}`)
    await Promise.all([loadWatchFolders(), loadOverview()])
  } catch (error) {
    ElMessage.error(error?.message || `监听目录${label}失败`)
  } finally {
    watchFolderActionLoadingId.value = ''
  }
}

const deleteWatchFolder = async (row) => {
  const deviceId = selectedWatchFolderDevice.value?.id
  if (!deviceId || !row?.id) return
  try {
    await ElMessageBox.confirm(`确认删除监听目录 ${row.folderName || row.folderPath || row.id}？`, '删除监听目录', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  watchFolderActionLoadingId.value = `${row.id}:delete`
  try {
    await deleteDocumentIntakeWatchFolder(deviceId, row.id)
    ElMessage.success('监听目录已删除')
    if (watchFolderForm.id === row.id) resetWatchFolderForm()
    await loadWatchFolders()
  } catch (error) {
    ElMessage.error(error?.message || '监听目录删除失败')
  } finally {
    watchFolderActionLoadingId.value = ''
  }
}

const resetEntryResultFilters = () => {
  entryResultFilters.status = ''
  entryResultFilters.targetKind = ''
  entryResultFilters.duplicate = ''
  entryResultFilters.q = ''
  entryResultFilters.user = ''
  entryResultFilters.operatorSource = ''
  entryResultFilters.today = false
  entryResultFilters.lowConfidence = false
  entryResultFilters.deviceId = ''
  entryResultFilters.deviceName = ''
  entryResultFilters.assetId = ''
  entryResultFilters.assetName = ''
  entryResultFilters.batchId = ''
  entryResultFilters.batchLabel = ''
}

const applyOverviewMetric = (item) => {
  if (!item?.action) return
  if (item.action.startsWith('assets-')) {
    resetAssetFilters()
    filters.today = true
    if (item.action === 'assets-duplicate') filters.duplicate = 'true'
    if (item.action === 'assets-unrecognized') filters.status = 'unrecognized'
    activeTab.value = 'assets'
    reloadFromFirstPage()
    return
  }
  if (item.action.startsWith('entry-')) {
    resetEntryResultFilters()
    entryResultFilters.today = true
    if (item.action === 'entry-successful') entryResultFilters.status = 'successful'
    if (item.action === 'entry-low-confidence') entryResultFilters.lowConfidence = true
    if (item.action === 'entry-failed') entryResultFilters.status = 'failed'
    activeTab.value = 'entryResults'
    reloadEntryResultsFromFirstPage()
    return
  }
  if (item.action.startsWith('devices-')) {
    resetDeviceFilters()
    deviceFilters.status = item.action === 'devices-active' ? 'active' : 'offline'
    activeTab.value = 'devices'
    reloadDevicesFromFirstPage()
  }
}

const businessRecordRouteMap = {
  'public.raw_materials': (id) => `/materials/material/detail/${encodeURIComponent(id)}?source=document-intake`,
  raw_materials: (id) => `/materials/material/detail/${encodeURIComponent(id)}?source=document-intake`,
  'scm.inventory_transactions': (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inventory_transactions: (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.v_inventory_transactions': (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_inventory_transactions: (id) => `/materials/inventory-ledger?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.inventory_batches': (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inventory_batches: (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.v_inventory_current': (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_inventory_current: (id) => `/materials/inventory-current?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.warehouses': (id) => `/materials/warehouses?recordId=${encodeURIComponent(id)}&source=document-intake`,
  warehouses: (id) => `/materials/warehouses?recordId=${encodeURIComponent(id)}&source=document-intake`,
  'scm.inventory_drafts': (id) => `/materials/inventory-draft/detail/${encodeURIComponent(id)}?source=document-intake`,
  inventory_drafts: (id) => `/materials/inventory-draft/detail/${encodeURIComponent(id)}?source=document-intake`,
  purchase_demands: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=demands&source=document-intake`,
  purchase_orders: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=orders&source=document-intake`,
  purchase_arrivals: (id) => `/purchase/document/${encodeURIComponent(id)}?appKey=arrivals&source=document-intake`,
  boms: (id) => `/production/app/bom_list?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_sales_bom_production_plan: (id) => `/production/app/plans?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_production_work_orders: (id) => `/production/app/work_orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  v_production_work_order_items: (id) => `/production/app/work_order_items?recordId=${encodeURIComponent(id)}&source=document-intake`,
  production_inspections: (id) => `/quality/app/production_inspections?recordId=${encodeURIComponent(id)}&source=document-intake`,
  inspection_orders: (id) => `/quality/app/inspection_orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  sales_orders: (id) => `/sales/app/orders?recordId=${encodeURIComponent(id)}&source=document-intake`,
  sales_payments: (id) => `/sales/app/payments?recordId=${encodeURIComponent(id)}&source=document-intake`
}

const businessRecordTableKey = (row) => {
  const schema = String(row?.targetSchema || '').trim()
  const table = String(row?.targetTable || '').trim()
  if (schema && table) return `${schema}.${table}`
  return table || schema
}

const businessRecordUrl = (row) => {
  const serverUrl = String(row?.businessRecordUrl || row?.business_record_url || '').trim()
  if (serverUrl) return serverUrl
  const recordId = String(row?.targetRecordId || '').trim()
  if (!recordId) return ''
  if (row?.targetKind === 'data_app' && row?.targetAppId) {
    return `/apps/app/${encodeURIComponent(row.targetAppId)}/record/${encodeURIComponent(recordId)}?source=document-intake`
  }
  const key = businessRecordTableKey(row)
  const routeBuilder = businessRecordRouteMap[key] || businessRecordRouteMap[key.replace(/^[^.]+\./, '')]
  return routeBuilder ? routeBuilder(recordId) : ''
}

const openBusinessRecord = (row) => {
  const url = businessRecordUrl(row)
  if (!url) {
    ElMessage.info('暂未配置该业务表的跳转路径')
    return
  }
  const result = navigateEnterprisePath(url, { tabTitle: '业务记录' })
  if (!result.ok) {
    ElMessage.warning(result.reason === 'module-disabled'
      ? '目标业务模块未启用，无法打开业务记录'
      : '业务记录跳转地址无效')
  }
}

const copyTextToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const copyBusinessRecordId = async (row) => {
  const recordId = String(row?.targetRecordId || '').trim()
  if (!recordId) return
  try {
    await copyTextToClipboard(recordId)
    ElMessage.success('业务记录 ID 已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制记录 ID')
  }
}

const correctionValueLabel = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

const recalculationStatusLabel = (status) => ({
  pending: '待重算',
  recalculating: '重算中',
  completed: '已重算',
  failed: '重算失败',
  skipped: '无需重算'
}[status] || status || '未触发重算')

const refreshActiveList = () => {
  void loadOverview()
  if (activeTab.value === 'devices') {
    void loadDevices()
    return
  }
  if (activeTab.value === 'logs') {
    void loadLogs()
    return
  }
  if (activeTab.value === 'entryResults') {
    void loadEntryResults()
    return
  }
  void loadAssets()
}

const reloadFromFirstPage = () => {
  page.value = 1
  void loadAssets()
}

const reloadDevicesFromFirstPage = () => {
  devicePage.value = 1
  void loadDevices()
}

const reloadLogsFromFirstPage = () => {
  logPage.value = 1
  void loadLogs()
}

const reloadEntryResultsFromFirstPage = () => {
  entryResultPage.value = 1
  void loadEntryResults()
}

const handlePageChange = (nextPage) => {
  page.value = nextPage
  void loadAssets()
}

const handleSizeChange = (nextSize) => {
  pageSize.value = nextSize
  reloadFromFirstPage()
}

const handleDevicePageChange = (nextPage) => {
  devicePage.value = nextPage
  void loadDevices()
}

const handleDeviceSizeChange = (nextSize) => {
  devicePageSize.value = nextSize
  reloadDevicesFromFirstPage()
}

const handleLogPageChange = (nextPage) => {
  logPage.value = nextPage
  void loadLogs()
}

const handleLogSizeChange = (nextSize) => {
  logPageSize.value = nextSize
  reloadLogsFromFirstPage()
}

const handleEntryResultPageChange = (nextPage) => {
  entryResultPage.value = nextPage
  void loadEntryResults()
}

const handleEntryResultSizeChange = (nextSize) => {
  entryResultPageSize.value = nextSize
  reloadEntryResultsFromFirstPage()
}

watch(() => filters.duplicate, reloadFromFirstPage)
watch(() => filters.operatorSource, reloadFromFirstPage)
watch(() => filters.watchFolderSource, reloadFromFirstPage)
watch(() => deviceFilters.status, reloadDevicesFromFirstPage)
watch(() => logFilters.level, reloadLogsFromFirstPage)
watch(() => logFilters.watchFolderSource, reloadLogsFromFirstPage)
watch(() => entryResultFilters.status, reloadEntryResultsFromFirstPage)
watch(() => entryResultFilters.targetKind, reloadEntryResultsFromFirstPage)
watch(() => entryResultFilters.duplicate, reloadEntryResultsFromFirstPage)
watch(activeTab, (tab) => {
  errorMessage.value = ''
  if (tab === 'devices' && devices.value.length === 0) {
    void loadDevices()
  }
  if (tab === 'logs' && logs.value.length === 0) {
    void loadLogs()
  }
  if (tab === 'entryResults' && entryResults.value.length === 0) {
    void loadEntryResults()
  }
})

const formatBytes = (bytes) => {
  const value = Number(bytes || 0)
  if (!value) return '0 B'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

const formatInteger = (value) => {
  const numeric = Number(value || 0)
  if (!Number.isFinite(numeric)) return '0'
  return Math.max(0, Math.floor(numeric)).toLocaleString('zh-CN')
}

const formatTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

const statusLabel = (status) => ({
  uploaded: '已上传',
  duplicate: '重复',
  queued: '排队中',
  parsing: '解析中',
  parsed: '已解析',
  classified: '已识别',
  importing: '入库中',
  imported: '已入库',
  partial_imported: '部分入库',
  unrecognized: '未识别',
  failed: '失败',
  archived: '已归档'
}[status] || status || '-')

const statusTagType = (status) => ({
  duplicate: 'warning',
  failed: 'danger',
  imported: 'success',
  partial_imported: 'warning',
  unrecognized: 'info'
}[status] || '')

const deviceStatusLabel = (status) => ({
  pending: '待绑定',
  active: '在线',
  offline: '离线',
  disabled: '停用'
}[status] || status || '-')

const deviceStatusTagType = (status) => ({
  active: 'success',
  offline: 'warning',
  disabled: 'danger',
  pending: 'info'
}[status] || '')

const logLevelLabel = (level) => ({
  error: '错误',
  warn: '警告',
  warning: '警告',
  info: '信息',
  debug: '调试'
}[String(level || '').toLowerCase()] || level || '-')

const logLevelTagType = (level) => ({
  error: 'danger',
  warn: 'warning',
  warning: 'warning',
  info: 'info',
  debug: ''
}[String(level || '').toLowerCase()] || '')

const entryResultStatusLabel = (status) => ({
  planned: '计划中',
  importing: '入库中',
  imported: '已入库',
  partial: '部分入库',
  failed: '失败',
  skipped_duplicate: '重复跳过',
  archived_only: '仅归档'
}[status] || status || '-')

const entryResultStatusTagType = (status) => ({
  imported: 'success',
  partial: 'warning',
  failed: 'danger',
  skipped_duplicate: 'warning',
  archived_only: 'info',
  planned: 'info'
}[status] || '')

const targetKindLabel = (kind) => ({
  fixed_module_table: '固定模块',
  data_app: '动态应用'
}[kind] || kind || '未识别')

const targetTableLabel = (row) => {
  const schema = row.targetSchema || ''
  const table = row.targetTable || ''
  if (schema && table) return `${schema}.${table}`
  return table || schema || '-'
}

const linkTargetTableLabel = (row) => {
  const schema = row.targetSchema || ''
  const table = row.targetTable || ''
  if (schema && table) return `${schema}.${table}`
  return table || schema || row.targetDocumentType || '-'
}

const assetTargetLabel = (row) => row.targetDocumentType || row.appName || row.targetModule || '-'

const assetFileTypeLabel = (row) => {
  const ext = String(row.fileExt || '').replace(/^\./, '').trim()
  if (ext) return ext.toUpperCase()
  const mime = String(row.mimeType || '').trim()
  if (!mime) return '-'
  const subtype = mime.includes('/') ? mime.split('/').pop() : mime
  return subtype ? subtype.toUpperCase() : mime
}

const assetGeneratedCountLabel = (row) => {
  const count = Number(row.generatedDocumentCount ?? row.businessLinkCount ?? row.documentCount ?? 0)
  return Number.isFinite(count) && count > 0 ? `${count} 条` : '-'
}

const formatConfidence = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  return `${Math.round(numeric * 100)}%`
}

const sourceLabel = (source) => ({
  web_drag_drop: '网页拖拽',
  manual_drag_drop: '桌面拖拽',
  manual_selected_file: '手动选择',
  watch_folder: '监听目录',
  collector_desktop: '采集端'
}[source] || source || '-')

const operatorSourceLabel = (source) => ({
  web_login_user: '网页登录用户',
  device_default_user: '设备默认用户'
}[source] || source || '未记录来源')

const watchFolderSourceLabel = (source) => ({
  local_settings: '本机设置',
  remote_config: '远程下发'
}[source] || source || '未记录目录来源')

const assetSourceFolderLabel = (row) => {
  if (!row?.sourceFolder) return watchFolderSourceLabel(row?.watchFolderSource)
  return `${row.sourceFolder} · ${watchFolderSourceLabel(row.watchFolderSource)}`
}

const logSourceFolderLabel = (row) => {
  if (!row?.sourceFolder && !row?.watchFolderSource) return '-'
  if (!row?.sourceFolder) return watchFolderSourceLabel(row.watchFolderSource)
  return `${row.sourceFolder} · ${watchFolderSourceLabel(row.watchFolderSource)}`
}

onMounted(() => {
  void loadOverview()
  void loadAssets()
})
</script>

<style scoped>
.document-intake-center {
  min-height: 100%;
  padding: 22px 24px 18px;
  background: #f6f8fb;
  color: #1f2937;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
}

.page-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 14px;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(104px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.overview-card {
  min-height: 72px;
  padding: 12px;
  border: 1px solid #d8e0ea;
  border-radius: 6px;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
}

.overview-card span {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-card strong {
  color: #0f172a;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: 0;
}

.overview-card.is-clickable {
  cursor: pointer;
}

.overview-card.is-clickable:hover,
.overview-card.is-clickable:focus-visible {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
  outline: none;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.intake-tabs {
  margin-bottom: 12px;
}

.duplicate-filter {
  flex: 0 0 auto;
}

.device-status-filter {
  flex: 0 0 auto;
}

.log-level-filter {
  flex: 0 0 auto;
}

.entry-status-filter,
.target-kind-filter,
.entry-duplicate-filter {
  flex: 0 0 auto;
}

.keyword-input {
  width: min(360px, 38vw);
}

.trace-input {
  width: min(240px, 28vw);
}

.user-input,
.device-input,
.source-folder-input,
.source-select {
  width: min(190px, 24vw);
}

.server-input {
  width: min(240px, 28vw);
}

.version-input {
  width: 140px;
}

.asset-filter-tag {
  max-width: min(360px, 38vw);
}

.status-select {
  width: 150px;
}

.error-alert {
  margin-bottom: 12px;
}

.asset-table {
  width: 100%;
}

.file-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.file-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stacked-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stacked-cell strong {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stacked-cell span {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  color: #64748b;
  font-size: 13px;
}

.entry-result-detail,
.watch-folder-detail {
  min-height: 360px;
}

.watch-folder-form {
  margin-top: 18px;
}

.watch-folder-owner-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  width: 100%;
}

.muted-inline {
  margin-left: 8px;
  color: #64748b;
}

.detail-section {
  margin-top: 18px;
}

.detail-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.detail-section-header h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0;
}

.detail-section-header span {
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 760px) {
  .document-intake-center {
    padding: 16px;
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .page-header,
  .toolbar,
  .table-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .keyword-input,
  .trace-input,
  .source-folder-input,
  .asset-filter-tag,
  .status-select {
    width: 100%;
  }
}
</style>
