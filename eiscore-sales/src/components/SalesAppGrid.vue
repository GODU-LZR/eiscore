<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
      </div>
    </div>

    <el-card
      shadow="never"
      class="grid-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        ref="gridRef"
        :view-id="app.viewId"
        :api-url="gridApiUrl"
        :write-url="app.writeUrl || ''"
        :include-properties="app.includeProperties !== false"
        write-mode="patch"
        :patch-required-fields="app.patchRequiredFields || []"
        :field-defaults="app.fieldDefaults || {}"
        :default-order="app.defaultOrder || 'id.desc'"
        accept-profile="public"
        content-profile="public"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        :acl-module="app.aclModule"
        :attention-resolver="resolveAttention"
        :row-action-resolver="resolveRowActions"
        :row-filter="rowAttentionFilter"
        :summary-scope="summaryScope"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-delete="canDelete"
        :can-export="canExport"
        :can-config="canConfig"
        :auto-size-columns="false"
        :local-layout-key="gridLocalLayoutKey"
        :enable-row-height-resize="!!gridLocalLayoutKey"
        :default-row-height="35"
        :min-row-height="32"
        :max-row-height="180"
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @view-document="handleViewDocument"
        @row-action="handleRowAction"
        @data-load-error="handleDataLoadError"
        @data-loaded="handleDataLoaded"
        @cell-value-changed="handleSalesCellValueChanged"
      >
        <template #toolbar>
          <GridCompactFilter
            v-model:time-mode="gridTimeMode"
            v-model:day="gridDay"
            v-model:month="gridMonth"
            v-model:year="gridYear"
            v-model:custom-range="gridCustomRange"
            v-model:attention-filter="attentionFilter"
            :time-options="gridTimeModeOptions"
            :time-field="gridTimeField"
            :time-field-label="gridTimeFieldLabel"
            :time-scope-label="gridTimeScopeLabel"
            :attention-options="attentionFilterOptions"
            :filter-summary="gridFilterSummary"
            :has-active-filters="hasActiveGridFilters"
            @shift-period="shiftGridPeriod"
            @reset-period="resetGridPeriod"
            @reset-filters="resetGridFilters"
          />
          <el-button
            v-if="app.key === 'customers' && canEdit"
            type="primary"
            plain
            icon="Refresh"
            :loading="receivableSyncing"
            @click="syncAllCustomerReceivables"
          >
            同步应收余额
          </el-button>
          <el-button
            v-if="app.key === 'orders' && canCreate"
            type="success"
            plain
            icon="Tickets"
            @click="openOrderDialog()"
          >
            从客户建订单
          </el-button>
          <el-button
            v-if="app.key === 'orders' && canCreate"
            type="success"
            plain
            icon="Position"
            :loading="flowActionLoading"
            @click="openBatchPushFlowDialog"
          >
            下推采购需求
          </el-button>
          <el-button
            v-if="['orders', 'shipment_requests'].includes(app.key) && canCreate"
            type="warning"
            plain
            icon="Promotion"
            :loading="flowActionLoading"
            @click="openBatchShipmentFlowDialog"
          >
            {{ app.key === 'shipment_requests' ? '下推销售出库' : '下推出货/出库' }}
          </el-button>
          <el-button
            v-if="app.key === 'opportunities' && canCreate"
            type="primary"
            plain
            icon="TrendCharts"
            @click="openOpportunityDialog()"
          >
            新建商机
          </el-button>
          <el-button
            v-if="app.key === 'follow_ups' && canCreate"
            type="primary"
            plain
            icon="ChatLineSquare"
            @click="openFollowDialog()"
          >
            登记跟进
          </el-button>
          <el-button
            v-if="app.key === 'payments' && canCreate"
            type="warning"
            plain
            icon="Money"
            @click="openPaymentDialog()"
          >
            登记回款
          </el-button>
        </template>
      </eis-data-grid>

      <el-dialog v-model="colConfigVisible" title="列管理" width="600px" append-to-body destroy-on-close @closed="resetForm">
        <div class="column-manager">
          <p class="section-title">固定列显示：</p>
          <div class="col-list">
            <div v-for="col in staticColumnsAll" :key="col.prop" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
              </div>
              <div class="col-actions">
                <el-switch
                  :model-value="isStaticVisible(col.prop)"
                  active-text="显示"
                  inactive-text="隐藏"
                  @change="toggleStaticColumn(col.prop, $event)"
                />
              </div>
            </div>
          </div>

          <p class="section-title">已添加的列：</p>
          <div v-if="extraColumns.length === 0" class="empty-tip">还没有新增列</div>
          
          <div class="col-list">
            <div v-for="(col, index) in extraColumns" :key="index" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
                <el-tag v-if="col.type === 'formula'" size="small" type="warning" effect="plain" style="margin-left:8px">计算</el-tag>
              </div>
              <div class="col-actions">
                <el-button type="primary" link icon="Edit" @click="editColumn(index)">编辑</el-button>
                <el-button type="danger" link icon="Delete" @click="removeColumn(index)">删除</el-button>
              </div>
            </div>
          </div>
          
          <el-divider />
          
          <div class="form-header">
            <p class="section-title">{{ isEditing ? '编辑列' : '新增列' }}：</p>
            <el-button v-if="isEditing" type="info" link size="small" @click="resetForm">取消编辑</el-button>
          </div>

          <el-tabs v-model="addTab" type="border-card" class="add-tabs">
            <el-tab-pane label="普通文字" name="text">
              <div class="form-row">
                <el-input v-model="currentCol.label" placeholder="列名（比如：客户备注）" @keyup.enter="saveColumn" />
                <el-button type="primary" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存放普通文字、数字或日期，直接填就行。</p>
            </el-tab-pane>

            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：渠道类型）" style="margin-bottom: 10px;" />
                <div class="options-config">
                  <div class="option-row" v-for="(opt, idx) in currentCol.options" :key="idx">
                    <el-input v-model="opt.label" placeholder="选项内容" style="flex: 1;" />
                    <el-button type="danger" link @click="removeSelectOption(idx)">删除</el-button>
                  </div>
                  <el-button class="add-opt-btn" type="primary" plain size="small" @click="addSelectOption">
                    + 添加一项
                  </el-button>
                </div>

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加下拉列' }}
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：产品分类）" style="margin-bottom: 10px;" />

                <el-select v-model="currentCol.dependsOn" placeholder="先选哪一列（下拉或联动都可以）" filterable style="width: 100%; margin-bottom: 10px;">
                  <el-option v-for="col in cascaderParentColumns" :key="col.prop" :label="col.label" :value="col.prop" />
                </el-select>

                <div v-if="currentCol.dependsOn && cascaderParentOptions.length === 0" class="hint-text">
                  先给上一级列设置选项，才能配置联动。
                </div>
                <div v-else-if="currentCol.dependsOn" class="cascader-map">
                  <div v-for="opt in cascaderParentOptions" :key="opt.value" class="cascader-node">
                    <div class="cascader-parent-row">
                      <span class="cascader-parent">{{ opt.label }}</span>
                    </div>
                    <div class="cascader-children">
                      <div v-if="getCascaderChildren(opt.value).length > 0" class="cascader-tags">
                        <el-tag
                          v-for="child in getCascaderChildren(opt.value)"
                          :key="child"
                          size="small"
                          closable
                          @close="removeCascaderChild(opt.value, child)"
                        >
                          {{ child }}
                        </el-tag>
                      </div>
                      <div class="cascader-add">
                        <el-input
                          v-model="cascaderInputMap[opt.value]"
                          placeholder="输入一个下级选项"
                          @keyup.enter="addCascaderChild(opt.value)"
                        />
                        <el-button type="primary" plain @click="addCascaderChild(opt.value)">添加</el-button>
                      </div>
                      <div v-if="getCascaderChildren(opt.value).length === 0" class="hint-text">还没有下级选项</div>
                    </div>
                  </div>
                </div>

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加联动列' }}
                </el-button>
                <p class="hint-text">上面改了，下面会自动清空，避免选错。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="地图位置" name="geo">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：位置）" style="margin-bottom: 10px;" />
                <el-switch v-model="currentCol.geoAddress" active-text="同时记录地址" inactive-text="只记经纬度" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加地图列' }}
                </el-button>
                <p class="hint-text">后面可在地图上点选位置。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="文件" name="file">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：附件）" style="margin-bottom: 10px;" />
                <div class="form-row">
                  <div class="field-block">
                    <span class="field-label">最多文件数</span>
                    <el-input-number v-model="currentCol.fileMaxCount" :min="1" :max="50" controls-position="right" />
                  </div>
                  <div class="field-block">
                    <span class="field-label">单个文件大小(兆)</span>
                    <el-input-number v-model="currentCol.fileMaxSizeMb" :min="1" :max="50" controls-position="right" />
                  </div>
                </div>
                <el-input v-model="currentCol.fileAccept" placeholder="允许格式（可不写）" style="margin-top: 10px;" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加文件列' }}
                </el-button>
                <p class="hint-text">可上传多个文件，系统自动保存。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="自动计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：订单毛利）" style="margin-bottom: 10px;" />

                <div class="formula-area">
                  <div class="formula-actions">
                    <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
                    <span class="formula-tip">把需求告诉工作助手，自动生成复杂公式</span>
                  </div>
                  <el-input 
                    v-model="currentCol.expression" 
                    type="textarea" 
                    :rows="3"
                    placeholder="写计算方法（比如：{数量}*{单价}）"
                  />
                  
                  <div class="variable-tags">
                    <span class="tag-tip">点一下插入列名:</span>
                    <div class="tags-wrapper">
                      <el-tag 
                        v-for="col in allAvailableColumns" 
                        :key="col.prop" 
                        size="small" 
                        class="cursor-pointer"
                        @click="insertVariable(col.label)"
                      >
                        {{ col.label }}
                      </el-tag>
                    </div>
                  </div>
                </div>

                <el-button type="warning" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label || !currentCol.expression">
                  {{ isEditing ? '保存计算修改' : '添加计算列' }}
                </el-button>
                <p class="hint-text">计算列会自动算好并保存，<b>不能手动改</b>。</p>
              </div>
            </el-tab-pane>
          </el-tabs>

        </div>
        <template #footer>
          <el-button @click="colConfigVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </el-card>

    <el-drawer
      v-model="detailDrawerVisible"
      :title="detailTitle"
      size="520px"
      append-to-body
      destroy-on-close
      @closed="resetDetailDrawer"
    >
      <div v-if="selectedDetailRow" class="detail-drawer">
        <div class="detail-actions">
          <el-button type="primary" plain icon="Service" @click="openDetailAssistant">AI分析当前记录</el-button>
          <el-button
            v-if="app.key === 'customers' && canCreate"
            plain
            icon="Tickets"
            @click="openOrderDialog(selectedDetailRow)"
          >
            为客户建订单
          </el-button>
          <el-button
            v-if="app.key === 'customers' && canCreate"
            plain
            icon="ChatLineSquare"
            @click="openFollowDialog(selectedDetailRow)"
          >
            登记跟进
          </el-button>
          <el-button
            v-if="app.key === 'customers' && canCreate"
            plain
            icon="TrendCharts"
            @click="openOpportunityDialog(selectedDetailRow)"
          >
            新建商机
          </el-button>
          <el-button
            v-if="app.key === 'orders' && canCreate"
            plain
            icon="Money"
            @click="openPaymentDialog(selectedDetailRow)"
          >
            登记回款
          </el-button>
          <el-button
            v-if="app.key === 'opportunities' && canCreate"
            plain
            icon="Tickets"
            @click="openOrderDialog(selectedDetailRow)"
          >
            转销售订单
          </el-button>
          <el-button plain icon="DocumentCopy" @click="copyDetailSummary">复制摘要</el-button>
        </div>

        <el-descriptions :column="1" border size="small" class="detail-section">
          <el-descriptions-item
            v-for="item in detailItems"
            :key="item.prop"
            :label="item.label"
          >
            {{ item.value }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="detailPropertyItems.length" class="detail-block">
          <div class="detail-block-title">扩展字段</div>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item
              v-for="item in detailPropertyItems"
              :key="item.key"
              :label="item.key"
            >
              {{ item.value }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div v-if="detailRelationSections.length" class="detail-block">
          <div class="detail-block-title">关联记录</div>
          <div v-if="detailBusinessMetrics.length" class="metric-grid">
            <div v-for="metric in detailBusinessMetrics" :key="metric.key" class="metric-item">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div
            v-for="section in detailRelationSections"
            :key="section.key"
            class="relation-section"
          >
            <div class="relation-title">
              <span>{{ section.title }}</span>
              <el-tag size="small" effect="plain">{{ section.rows.length }}</el-tag>
            </div>
            <el-table
              :data="section.rows"
              size="small"
              border
              max-height="220"
              empty-text="暂无数据"
            >
              <el-table-column
                v-for="col in section.columns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                min-width="110"
                show-overflow-tooltip
              />
            </el-table>
          </div>
        </div>
        <el-skeleton v-else-if="detailRelationsLoading" :rows="3" animated />
      </div>
      <el-empty v-else description="暂无记录" />
    </el-drawer>

    <el-dialog
      v-model="businessFlowVisible"
      title="销售订单业务流程"
      width="920px"
      append-to-body
      destroy-on-close
      @closed="resetBusinessFlowDialog"
    >
      <div
        class="business-flow-dialog"
        data-guide="flow-wrapper"
        data-sop-flow="sales-flow-push"
        data-sop-title="销售订单业务下推流程"
        data-sop-desc="按销售订单、采购需求、出货申请、销售出库的链路完成销售订单下推。"
        data-sop-steps="先选择可流转的销售订单|确认下一环节是采购需求、出货申请还是销售出库|检查单据链路是否已有下游记录|点击确认下推并跳转|到下游应用搜索单号复核状态"
        data-sop-risk="销售下推会影响采购需求、出货计划和库存出库。已取消、已删除、已下推或数量异常的订单不要重复下推。"
        v-loading="flowLoading"
      >
        <div class="flow-push-header" data-guide="flow-selection">
          <div>
            <span>已选择销售订单</span>
            <strong>{{ flowSelectedRows.length }}</strong>
          </div>
          <el-radio-group v-model="flowNextStep" size="small">
            <el-radio-button label="purchase_demand">采购需求</el-radio-button>
            <el-radio-button label="shipment_request">出货申请</el-radio-button>
            <el-radio-button label="sales_outbound">销售出库</el-radio-button>
          </el-radio-group>
        </div>
        <div class="flow-chain" data-guide="flow-chain">
          <div
            v-for="node in salesFlowNodes"
            :key="node.key"
            class="flow-step"
            :class="{ active: !!node.docNo, current: node.current }"
          >
            <span class="step-type">{{ node.type }}</span>
            <strong>{{ node.docNo || '未生成' }}</strong>
            <small>{{ node.status || '待流转' }}</small>
          </div>
        </div>
        <div class="flow-actions" data-guide="flow-actions">
          <el-button
            data-guide="flow-confirm"
            data-sop-action="sales-confirm-flow-push"
            data-sop-title="确认销售下推并跳转"
            data-sop-desc="确认当前销售订单链路，并生成采购需求、出货申请或销售出库链路。"
            data-sop-steps="复核已选销售订单数量|确认下一环节是否正确|查看链路中是否已有下游单据|点击确认下推并跳转|跳转后搜索新单据并复核状态"
            data-sop-risk="确认后会生成或关联下游单据，错误下推会影响采购、出货和库存。"
            :type="flowConfirmButtonType"
            :loading="flowActionLoading"
            @click="confirmSalesFlowPush"
          >
            确认下推并跳转
          </el-button>
          <el-button
            type="warning"
            data-sop-action="sales-reverse-flow-push"
            data-sop-title="反审核或撤销销售下推"
            data-sop-desc="撤销销售订单到采购需求的链路，仅在下游未继续生成单据时允许。"
            data-sop-steps="先确认下游采购需求没有继续生成采购订单、到货或入库|点击反审核/撤销下推|等待系统解除链路|回到销售订单和采购需求复核状态"
            data-sop-risk="已有采购订单、到货或入库时不能直接撤销，需要从下游逐级反审核。"
            :disabled="!canReverseSalesDemand"
            :loading="flowActionLoading"
            @click="reverseSalesDemandLink"
          >
            反审核/撤销下推
          </el-button>
        </div>
        <el-alert
          v-if="!canReverseSalesDemand && salesFlowDocs.purchaseDemand"
          data-guide="flow-risk"
          title="采购需求已生成下游单据时不能直接撤销，需要先从采购订单、到货、入库逐级反审核。"
          type="warning"
          show-icon
          :closable="false"
        />
        <div class="flow-doc-panel" data-guide="flow-risk">
          <div class="flow-doc-card">
            <span>首个待下推单据</span>
            <strong>{{ flowPrimaryOrder?.order_no || flowPrimaryOrder?.id || '-' }}</strong>
            <small>{{ flowPrimaryOrder?.customer_name || '-' }} / {{ flowPrimaryOrder?.product_name || '-' }}</small>
          </div>
          <div class="flow-doc-card">
            <span>上一个应用单据</span>
            <strong>销售订单</strong>
            <small>批量下推的链路起点</small>
          </div>
          <div class="flow-doc-card">
            <span>{{ salesDownstreamLabel }}</span>
            <strong>{{ salesDownstreamDocNo }}</strong>
            <small>{{ salesDownstreamStatus }}</small>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="quickDialogVisible"
      :title="quickDialogTitle"
      width="620px"
      append-to-body
      destroy-on-close
      @closed="resetQuickDialog"
    >
      <el-form
        v-if="quickMode === 'order'"
        class="quick-form"
        label-width="96px"
        :model="orderForm"
      >
        <el-form-item label="客户">
          <el-select
            v-model="orderForm.customer_id"
            filterable
            clearable
            :loading="quickLoading"
            placeholder="选择客户"
            style="width: 100%;"
          >
            <el-option
              v-for="customer in quickCustomers"
              :key="customer.id"
              :label="`${customer.name} / ${customer.customer_no}`"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="orderForm.product_name" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="BOM成品">
          <el-select
            v-model="orderForm.product_material_id"
            filterable
            clearable
            :loading="quickLoading"
            placeholder="选择后可进入BOM-MRP和生产计划"
            style="width: 100%;"
          >
            <el-option
              v-for="material in quickBomProducts"
              :key="material.parent_material_id"
              :label="`${material.parent_material_code} / ${material.parent_material_name}`"
              :value="material.parent_material_id"
            />
          </el-select>
        </el-form-item>
        <div class="quick-form-row">
          <el-form-item label="数量">
            <el-input-number v-model="orderForm.quantity" :min="0" :precision="2" controls-position="right" />
          </el-form-item>
          <el-form-item label="单位">
            <el-input v-model="orderForm.unit" placeholder="箱" />
          </el-form-item>
          <el-form-item label="单价">
            <el-input-number v-model="orderForm.unit_price" :min="0" :precision="2" controls-position="right" />
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="订单日期">
            <el-date-picker v-model="orderForm.order_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>
          <el-form-item label="交付日期">
            <el-date-picker v-model="orderForm.delivery_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="订单状态">
            <el-select v-model="orderForm.order_status" style="width: 100%;">
              <el-option v-for="status in orderStatusOptions" :key="status" :label="status" :value="status" />
            </el-select>
          </el-form-item>
          <el-form-item label="负责人">
            <el-input v-model="orderForm.owner_name" placeholder="销售负责人" />
          </el-form-item>
        </div>
        <div class="amount-preview">
          <span>订单金额</span>
          <strong>{{ formatAmount(orderTotalAmount) }}</strong>
        </div>
      </el-form>

      <el-form
        v-else-if="quickMode === 'payment'"
        class="quick-form"
        label-width="96px"
        :model="paymentForm"
      >
        <el-form-item label="订单">
          <el-select
            v-model="paymentForm.order_id"
            filterable
            clearable
            :loading="quickLoading"
            placeholder="选择订单"
            style="width: 100%;"
          >
            <el-option
              v-for="order in quickOrders"
              :key="order.id"
              :label="`${order.order_no} / ${order.customer_name} / ${formatAmount(order.total_amount)}`"
              :value="order.id"
            />
          </el-select>
        </el-form-item>
        <div v-if="selectedQuickOrder" class="quick-info">
          <div><span>客户</span><strong>{{ selectedQuickOrder.customer_name }}</strong></div>
          <div><span>产品</span><strong>{{ selectedQuickOrder.product_name }}</strong></div>
          <div><span>订单金额</span><strong>{{ formatAmount(selectedQuickOrder.total_amount) }}</strong></div>
          <div><span>已回款</span><strong>{{ formatAmount(selectedQuickOrderPaidAmount) }}</strong></div>
          <div><span>未回款</span><strong>{{ formatAmount(selectedQuickOrderRemainAmount) }}</strong></div>
        </div>
        <el-form-item label="客户名称" v-else>
          <el-input v-model="paymentForm.customer_name" placeholder="未选择订单时手工填写客户名称" />
        </el-form-item>
        <div class="quick-form-row">
          <el-form-item label="回款金额">
            <el-input-number v-model="paymentForm.amount" :min="0" :precision="2" controls-position="right" />
          </el-form-item>
          <el-form-item label="回款日期">
            <el-date-picker v-model="paymentForm.payment_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="回款方式">
            <el-select v-model="paymentForm.payment_method" style="width: 100%;">
              <el-option v-for="method in paymentMethodOptions" :key="method" :label="method" :value="method" />
            </el-select>
          </el-form-item>
          <el-form-item label="核销状态">
            <el-select v-model="paymentForm.verify_status" style="width: 100%;">
              <el-option v-for="status in paymentStatusOptions" :key="status" :label="status" :value="status" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="经办人">
          <el-input v-model="paymentForm.handler_name" placeholder="经办人" />
          </el-form-item>
        </el-form>

      <el-form
        v-else-if="quickMode === 'opportunity'"
        class="quick-form"
        label-width="96px"
        :model="opportunityForm"
      >
        <el-form-item label="客户">
          <el-select
            v-model="opportunityForm.customer_id"
            filterable
            clearable
            :loading="quickLoading"
            placeholder="选择客户"
            style="width: 100%;"
          >
            <el-option
              v-for="customer in quickCustomers"
              :key="customer.id"
              :label="`${customer.name} / ${customer.customer_no}`"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="商机名称">
          <el-input v-model="opportunityForm.opportunity_name" placeholder="请输入商机名称" />
        </el-form-item>
        <div class="quick-form-row">
          <el-form-item label="预计金额">
            <el-input-number v-model="opportunityForm.expected_amount" :min="0" :precision="2" controls-position="right" />
          </el-form-item>
          <el-form-item label="预计成交">
            <el-date-picker v-model="opportunityForm.expected_close_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="阶段">
            <el-select v-model="opportunityForm.stage" style="width: 100%;">
              <el-option v-for="stage in opportunityStageOptions" :key="stage" :label="stage" :value="stage" />
            </el-select>
          </el-form-item>
          <el-form-item label="赢率">
            <el-input-number v-model="opportunityForm.probability" :min="0" :max="100" :precision="0" controls-position="right" />
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="负责人">
            <el-input v-model="opportunityForm.owner_name" placeholder="销售负责人" />
          </el-form-item>
          <el-form-item label="下次动作">
            <el-input v-model="opportunityForm.next_action" placeholder="下一步推进动作" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input
            v-model="opportunityForm.remark"
            type="textarea"
            :rows="3"
            placeholder="记录需求、预算、竞争情况和成交阻碍"
          />
        </el-form-item>
      </el-form>

      <el-form
        v-else-if="quickMode === 'follow'"
        class="quick-form"
        label-width="96px"
        :model="followForm"
      >
        <el-form-item label="客户">
          <el-select
            v-model="followForm.customer_id"
            filterable
            clearable
            :loading="quickLoading"
            placeholder="选择客户"
            style="width: 100%;"
          >
            <el-option
              v-for="customer in quickCustomers"
              :key="customer.id"
              :label="`${customer.name} / ${customer.customer_no}`"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <div class="quick-form-row">
          <el-form-item label="跟进日期">
            <el-date-picker v-model="followForm.follow_date" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>
          <el-form-item label="下次跟进">
            <el-date-picker v-model="followForm.next_follow_at" type="date" value-format="YYYY-MM-DD" style="width: 100%;" />
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="跟进方式">
            <el-select v-model="followForm.follow_type" style="width: 100%;">
              <el-option v-for="type in followTypeOptions" :key="type" :label="type" :value="type" />
            </el-select>
          </el-form-item>
          <el-form-item label="跟进结果">
            <el-select v-model="followForm.follow_result" style="width: 100%;">
              <el-option v-for="result in followResultOptions" :key="result" :label="result" :value="result" />
            </el-select>
          </el-form-item>
        </div>
        <div class="quick-form-row">
          <el-form-item label="联系人">
            <el-input v-model="followForm.contact_name" placeholder="联系人" />
          </el-form-item>
          <el-form-item label="负责人">
            <el-input v-model="followForm.owner_name" placeholder="销售负责人" />
          </el-form-item>
        </div>
        <el-form-item label="跟进纪要">
          <el-input
            v-model="followForm.follow_content"
            type="textarea"
            :rows="4"
            placeholder="记录客户诉求、报价反馈、风险和下一步动作"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="quickDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="quickSubmitting" @click="submitQuickDialog">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { buildGridAgentContext, buildGridLoadState, enrichLoadedDataStats } from '@shared/eis-grid-agent-context'
import GridCompactFilter from '@shared/eis-grid-compact-filter.vue'
import { useEisGridAppFilters } from '@shared/use-eis-grid-app-filters'
import { findSalesApp, CUSTOMER_COLUMNS } from '@/utils/sales-apps'
import {
  buildSalesAttentionSummary,
  getSalesRecordAttention,
  matchesSalesAttentionFilter
} from '@/utils/sales-attention'
import { getRealtimeClient } from '@/utils/realtime'
import { hasPerm } from '@/utils/permission'

const props = defineProps({
  appKey: { type: String, default: 'customers' },
  appConfig: { type: Object, default: null }
})

const router = useRouter()
const gridRef = ref(null)
const lastLoadedRows = ref([])
const lastSearchText = ref('')
const lastGridLoadState = ref(buildGridLoadState())
const attentionFilter = ref('all')
const colConfigVisible = ref(false)
const detailDrawerVisible = ref(false)
const selectedDetailRow = ref(null)
const detailRelations = ref({})
const detailRelationsLoading = ref(false)
const businessFlowVisible = ref(false)
const flowLoading = ref(false)
const flowActionLoading = ref(false)
const flowSelectedRows = ref([])
const flowNextStep = ref('purchase_demand')
const salesFlowDocs = ref({})
const salesFlowRelationLinks = ref([])
const quickDialogVisible = ref(false)
const quickMode = ref('')
const quickLoading = ref(false)
const quickSubmitting = ref(false)
const currentOrderSource = ref(null)
const quickCustomers = ref([])
const quickBomProducts = ref([])
const quickOrders = ref([])
const quickOrderPayments = ref([])
const receivableSyncing = ref(false)
const addTab = ref('text') 
let realtimeUnsub = null
let realtimeTimer = null
let fieldLabelRetryTimer = null
let fieldLabelWarned = false

const todayText = () => new Date().toISOString().slice(0, 10)
const nextDocNo = (prefix) => `${prefix}${Date.now().toString().slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`
const addDaysText = (days) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const orderStatusOptions = ['草稿', '已确认', '生产中', '已发货', '已完成', '已取消']
const paymentMethodOptions = ['银行转账', '承兑汇票', '现金', '其他']
const paymentStatusOptions = ['待核销', '部分核销', '已核销']
const followTypeOptions = ['电话沟通', '微信沟通', '上门拜访', '视频会议', '展会接洽', '其他']
const followResultOptions = ['待跟进', '有意向', '报价中', '样品确认', '已成交', '暂缓', '无效']
const opportunityStageOptions = ['初步接洽', '需求确认', '方案报价', '商务谈判', '赢单', '输单', '搁置']
const DOC_TYPES = Object.freeze({
  SALES_ORDER: 'sales_order',
  PURCHASE_DEMAND: 'purchase_demand',
  PURCHASE_ORDER: 'purchase_order',
  PURCHASE_ARRIVAL: 'purchase_arrival',
  INVENTORY_INBOUND: 'inventory_inbound',
  SALES_SHIPMENT: 'sales_shipment',
  INVENTORY_OUTBOUND: 'inventory_outbound'
})
const RELATION_TYPES = Object.freeze({
  SALES_TO_PURCHASE_DEMAND: 'sales_to_purchase_demand',
  DEMAND_TO_ORDER: 'demand_to_order',
  ORDER_TO_ARRIVAL: 'order_to_arrival',
  ARRIVAL_TO_INBOUND: 'arrival_to_inbound',
  SALES_TO_SHIPMENT_REQUEST: 'sales_to_shipment_request',
  SHIPMENT_REQUEST_TO_SALES_OUTBOUND: 'shipment_request_to_sales_outbound',
  SALES_TO_OUTBOUND: 'sales_to_outbound'
})

const orderForm = reactive({
  customer_id: '',
  product_material_id: null,
  product_name: '',
  quantity: 1,
  unit: '箱',
  unit_price: 0,
  order_date: todayText(),
  delivery_date: addDaysText(7),
  order_status: '已确认',
  owner_name: ''
})

const paymentForm = reactive({
  order_id: '',
  customer_name: '',
  amount: 0,
  payment_date: todayText(),
  payment_method: '银行转账',
  verify_status: '待核销',
  handler_name: ''
})

const opportunityForm = reactive({
  customer_id: '',
  opportunity_name: '',
  expected_amount: 0,
  stage: '初步接洽',
  probability: 20,
  expected_close_date: addDaysText(14),
  owner_name: '',
  next_action: '',
  remark: ''
})

const followForm = reactive({
  customer_id: '',
  contact_name: '',
  follow_date: todayText(),
  follow_type: '电话沟通',
  follow_result: '待跟进',
  next_follow_at: addDaysText(3),
  owner_name: '',
  follow_content: ''
})

const app = computed(() => props.appConfig || findSalesApp(props.appKey) || {
  key: 'customers',
  name: '客户档案',
  desc: '客户基础资料、负责人、信用额度与应收余额',
  route: '/app/customers',
  apiUrl: '/sales_customers',
  viewId: 'sales_customers',
  configKey: 'sales_customers_cols',
  staticColumns: CUSTOMER_COLUMNS,
  summaryConfig: { label: '总计', rules: {}, expressions: {} },
  defaultExtraColumns: []
})

const opPerms = computed(() => app.value?.ops || {})
const enableRealtime = computed(() => app.value?.enableRealtime === true)
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))
const attentionRows = computed(() => lastLoadedRows.value)
const attentionSummary = computed(() => buildSalesAttentionSummary(app.value?.key, attentionRows.value))
const attentionTodoCount = computed(() => attentionRows.value.filter((row) => matchesSalesAttentionFilter(app.value?.key, row, 'todo')).length)
const attentionFilterOptions = computed(() => [
  { value: 'all', label: `全部 ${attentionSummary.value.total}` },
  { value: 'critical', label: `紧急 ${attentionSummary.value.counts.critical}` },
  { value: 'warning', label: `预警 ${attentionSummary.value.counts.warning}` },
  { value: 'focus', label: `重点 ${attentionSummary.value.counts.focus}` },
  { value: 'todo', label: `待处理 ${attentionTodoCount.value}` }
])
const resolveAttention = (row) => getSalesRecordAttention(app.value?.key, row, {
  role: 'sales',
  page: app.value?.key,
  device: 'desktop',
  task: 'monitor'
})
const rowAttentionFilter = (row) => matchesSalesAttentionFilter(app.value?.key, row, attentionFilter.value)
const resolveRowActions = (row) => {
  if (!row) return []
  if (app.value.key === 'customers') {
    const actions = []
    if (canCreate.value) {
      actions.push({ key: 'create-order', label: '建订单', type: 'success', icon: 'Tickets' })
      actions.push({ key: 'create-follow', label: '跟进', type: 'primary', icon: 'ChatLineSquare' })
      actions.push({ key: 'create-opportunity', label: '商机', type: 'primary', icon: 'TrendCharts' })
    }
    return actions
  }
  if (app.value.key === 'orders') {
    const actions = []
    if (canCreate.value) {
      actions.push({ key: 'create-payment', label: '回款', type: 'warning', icon: 'Money' })
      actions.push({ key: 'push-purchase', label: '采购', type: 'success', icon: 'Position' })
      actions.push({ key: 'push-shipment', label: '出货', type: 'warning', icon: 'Promotion' })
    }
    return actions
  }
  if (app.value.key === 'shipment_requests') {
    return canCreate.value
      ? [{ key: 'push-outbound', label: '出库', type: 'warning', icon: 'Promotion' }]
      : []
  }
  if (app.value.key === 'opportunities') {
    return canCreate.value
      ? [{ key: 'create-order', label: '转订单', type: 'success', icon: 'Tickets' }]
      : []
  }
  return []
}
const quickDialogTitle = computed(() => {
  if (quickMode.value === 'order') return '从客户新建销售订单'
  if (quickMode.value === 'payment') return '登记销售回款'
  if (quickMode.value === 'opportunity') return '新建销售商机'
  if (quickMode.value === 'follow') return '登记客户跟进'
  return '销售快捷操作'
})
const selectedQuickCustomer = computed(() => {
  return quickCustomers.value.find((customer) => customer.id === orderForm.customer_id) || null
})
const selectedQuickBomProduct = computed(() => {
  const selectedId = normalizeId(orderForm.product_material_id)
  if (!selectedId) return null
  return quickBomProducts.value.find((material) => normalizeId(material.parent_material_id) === selectedId) || null
})
const selectedQuickOrder = computed(() => {
  return quickOrders.value.find((order) => order.id === paymentForm.order_id) || null
})
const selectedFollowCustomer = computed(() => {
  return quickCustomers.value.find((customer) => customer.id === followForm.customer_id) || null
})
const selectedOpportunityCustomer = computed(() => {
  return quickCustomers.value.find((customer) => customer.id === opportunityForm.customer_id) || null
})
const orderTotalAmount = computed(() => {
  return toAmount(orderForm.quantity) * toAmount(orderForm.unit_price)
})
const selectedQuickOrderPaidAmount = computed(() => {
  const order = selectedQuickOrder.value
  if (!order) return 0
  return quickOrderPayments.value
    .filter((payment) => {
      if (paymentForm.order_id) return payment.order_id === paymentForm.order_id
      return payment.order_no && payment.order_no === order.order_no
    })
    .reduce((sum, payment) => sum + toAmount(payment.amount), 0)
})
const selectedQuickOrderRemainAmount = computed(() => {
  const order = selectedQuickOrder.value
  if (!order) return 0
  return Math.max(toAmount(order.total_amount) - selectedQuickOrderPaidAmount.value, 0)
})
const flowPrimaryOrder = computed(() => flowSelectedRows.value[0] || selectedDetailRow.value || null)
const salesFlowNodes = computed(() => {
  const order = flowPrimaryOrder.value || {}
  const docs = salesFlowDocs.value || {}
  return [
    { key: 'so', type: '销售订单', docNo: order.order_no, status: order.order_status, current: true },
    { key: 'pr', type: '采购需求', docNo: docs.purchaseDemand?.demand_no, status: docs.purchaseDemand?.demand_status },
    { key: 'po', type: '采购订单', docNo: docs.purchaseOrder?.order_no, status: docs.purchaseOrder?.order_status },
    { key: 'pa', type: '到货/检验', docNo: docs.purchaseArrival?.arrival_no, status: docs.purchaseArrival?.arrival_status },
    { key: 'in', type: '采购入库', docNo: docs.inventoryInbound?.inbound_no || docs.inventoryInbound?.docNo, status: docs.inventoryInbound?.status },
    { key: 'ship', type: '出货申请', docNo: docs.salesShipment?.shipment_no || docs.salesShipment?.docNo, status: docs.salesShipment?.status },
    { key: 'out', type: '销售出库', docNo: docs.salesOutbound?.outbound_no || docs.salesOutbound?.docNo, status: docs.salesOutbound?.status }
  ]
})
const flowConfirmButtonType = computed(() => (flowNextStep.value === 'purchase_demand' ? 'success' : 'warning'))
const salesDownstreamLabel = computed(() => {
  if (flowNextStep.value === 'shipment_request') return '下游出货申请'
  if (flowNextStep.value === 'sales_outbound') return '下游销售出库'
  return '下游采购需求'
})
const salesDownstreamDocNo = computed(() => {
  const docs = salesFlowDocs.value || {}
  if (flowNextStep.value === 'shipment_request') return docs.salesShipment?.shipment_no || docs.salesShipment?.docNo || '未生成'
  if (flowNextStep.value === 'sales_outbound') return docs.salesOutbound?.outbound_no || docs.salesOutbound?.docNo || '未生成'
  return docs.purchaseDemand?.demand_no || '未生成'
})
const salesDownstreamStatus = computed(() => {
  const docs = salesFlowDocs.value || {}
  if (flowNextStep.value === 'shipment_request') return docs.salesShipment?.status || '可下推生成'
  if (flowNextStep.value === 'sales_outbound') return docs.salesOutbound?.status || '可生成出库链路'
  return docs.purchaseDemand?.demand_status || '可下推生成'
})
const canReverseSalesDemand = computed(() => {
  return flowSelectedRows.value.length === 1
    && Boolean(salesFlowDocs.value?.purchaseDemand)
    && !salesFlowDocs.value?.purchaseOrder
    && hasPerm('op:business_flow.reverse')
})

const staticHidden = ref([])
const staticColumnsAll = computed(() => app.value.staticColumns || CUSTOMER_COLUMNS)
const staticColumns = computed(() =>
  staticColumnsAll.value.filter(col => !staticHidden.value.includes(col.prop))
)
const {
  gridTimeModeOptions,
  gridTimeMode,
  gridDay,
  gridMonth,
  gridYear,
  gridCustomRange,
  gridTimeField,
  gridTimeFieldLabel,
  gridTimeScopeLabel,
  gridApiUrl,
  gridLocalLayoutKey,
  hasActiveGridFilters,
  gridFilterSummary,
  resetGridPeriod,
  resetGridFilters,
  shiftGridPeriod
} = useEisGridAppFilters({
  app,
  staticColumns: staticColumnsAll,
  moduleName: 'sales',
  fallbackApiUrl: '/sales_customers',
  attentionFilter,
  attentionFilterOptions
})
const summaryScope = computed(() => attentionFilter.value === 'all' && gridTimeMode.value === 'infinite' ? 'server' : 'loaded')
const summaryConfig = computed(() => app.value.summaryConfig || { label: '总计', rules: {}, expressions: {} })
const detailColumns = computed(() => {
  const seen = new Set()
  return [...staticColumnsAll.value, ...extraColumns.value]
    .filter((col) => {
      if (!col?.prop || seen.has(col.prop)) return false
      seen.add(col.prop)
      return true
    })
})
const detailTitle = computed(() => {
  const row = selectedDetailRow.value
  if (!row) return `${app.value.name}详情`
  return `${app.value.name} - ${getRowDisplayName(row)}`
})
const detailItems = computed(() => {
  const row = selectedDetailRow.value
  if (!row) return []
  return detailColumns.value
    .filter(col => col.type !== 'file' && col.type !== 'geo')
    .map(col => ({
      label: col.label,
      prop: col.prop,
      value: formatDetailValue(getRowValue(row, col.prop))
    }))
})
const detailPropertyItems = computed(() => {
  const row = selectedDetailRow.value
  const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {}
  const visibleProps = new Set(detailColumns.value.map(col => col.prop))
  return Object.entries(properties)
    .filter(([key]) => !visibleProps.has(key))
    .map(([key, value]) => ({ key, value: formatDetailValue(value) }))
})
const detailRelationSections = computed(() => {
  const relations = detailRelations.value || {}
  const sections = []
  if (Array.isArray(relations.orders)) {
    sections.push({
      key: 'orders',
      title: '相关订单',
      rows: relations.orders.map(mapOrderRelation),
      columns: [
        { label: '订单号', prop: 'order_no' },
        { label: '产品', prop: 'product_name' },
        { label: '金额', prop: 'total_amount' },
        { label: '状态', prop: 'order_status' }
      ]
    })
  }
  if (Array.isArray(relations.payments)) {
    sections.push({
      key: 'payments',
      title: '相关回款',
      rows: relations.payments.map(mapPaymentRelation),
      columns: [
        { label: '回款单号', prop: 'payment_no' },
        { label: '订单号', prop: 'order_no' },
        { label: '金额', prop: 'amount' },
        { label: '核销状态', prop: 'verify_status' }
      ]
    })
  }
  if (Array.isArray(relations.followUps)) {
    sections.push({
      key: 'followUps',
      title: '跟进记录',
      rows: relations.followUps.map(mapFollowRelation),
      columns: [
        { label: '跟进编号', prop: 'follow_no' },
        { label: '日期', prop: 'follow_date' },
        { label: '方式', prop: 'follow_type' },
        { label: '结果', prop: 'follow_result' },
        { label: '下次跟进', prop: 'next_follow_at' }
      ]
    })
  }
  if (Array.isArray(relations.opportunities)) {
    sections.push({
      key: 'opportunities',
      title: '相关商机',
      rows: relations.opportunities.map(mapOpportunityRelation),
      columns: [
        { label: '商机编号', prop: 'opportunity_no' },
        { label: '商机名称', prop: 'opportunity_name' },
        { label: '预计金额', prop: 'expected_amount' },
        { label: '阶段', prop: 'stage' }
      ]
    })
  }
  if (relations.order) {
    sections.push({
      key: 'order',
      title: '对应订单',
      rows: [mapOrderRelation(relations.order)],
      columns: [
        { label: '订单号', prop: 'order_no' },
        { label: '客户', prop: 'customer_name' },
        { label: '产品', prop: 'product_name' },
        { label: '金额', prop: 'total_amount' }
      ]
    })
  }
  if (relations.customer) {
    sections.push({
      key: 'customer',
      title: '对应客户',
      rows: [mapCustomerRelation(relations.customer)],
      columns: [
        { label: '客户编码', prop: 'customer_no' },
        { label: '客户名称', prop: 'name' },
        { label: '等级', prop: 'level' },
        { label: '应收余额', prop: 'receivable_balance' }
      ]
    })
  }
  if (relations.opportunity) {
    sections.push({
      key: 'opportunity',
      title: '对应商机',
      rows: [mapOpportunityRelation(relations.opportunity)],
      columns: [
        { label: '商机编号', prop: 'opportunity_no' },
        { label: '商机名称', prop: 'opportunity_name' },
        { label: '预计金额', prop: 'expected_amount' },
        { label: '阶段', prop: 'stage' }
      ]
    })
  }
  return sections.filter(section => section.rows.length > 0)
})
const detailBusinessMetrics = computed(() => {
  const relations = detailRelations.value || {}
  const row = selectedDetailRow.value
  if (!row) return []
  const relationOrders = Array.isArray(relations.orders)
    ? relations.orders
    : (relations.order ? [relations.order] : [])
  const relationPayments = Array.isArray(relations.payments) ? relations.payments : []
  const orderAmount = relationOrders
    .filter(isOrderActive)
    .reduce((sum, item) => sum + toAmount(item.total_amount), 0)
  const paymentAmount = relationPayments
    .filter((item) => item?.status !== 'deleted')
    .reduce((sum, item) => sum + toAmount(item.amount), 0)
  const receivable = Math.max(orderAmount - paymentAmount, toAmount(row.receivable_balance))
  const paymentRate = orderAmount ? Math.round((paymentAmount / orderAmount) * 1000) / 10 : 0
  if (app.value.key === 'customers') {
    return [
      { key: 'orderAmount', label: '累计订单', value: formatAmount(orderAmount) },
      { key: 'paymentAmount', label: '累计回款', value: formatAmount(paymentAmount) },
      { key: 'receivable', label: '应收余额', value: formatAmount(receivable) },
      { key: 'paymentRate', label: '回款率', value: `${paymentRate}%` }
    ]
  }
  if (app.value.key === 'orders') {
    return [
      { key: 'orderAmount', label: '订单金额', value: formatAmount(row.total_amount) },
      { key: 'paymentAmount', label: '已回款', value: formatAmount(paymentAmount) },
      { key: 'remain', label: '未回款', value: formatAmount(Math.max(toAmount(row.total_amount) - paymentAmount, 0)) },
      { key: 'paymentRate', label: '回款率', value: `${toAmount(row.total_amount) ? Math.round((paymentAmount / toAmount(row.total_amount)) * 1000) / 10 : 0}%` }
    ]
  }
  if (app.value.key === 'opportunities') {
    return [
      { key: 'expectedAmount', label: '预计金额', value: formatAmount(row.expected_amount) },
      { key: 'probability', label: '赢率', value: `${toAmount(row.probability)}%` },
      { key: 'weightedAmount', label: '加权金额', value: formatAmount(toAmount(row.expected_amount) * toAmount(row.probability) / 100) },
      { key: 'stage', label: '当前阶段', value: formatDetailValue(row.stage) }
    ]
  }
  if (app.value.key === 'follow_ups') {
    return [
      { key: 'followDate', label: '跟进日期', value: formatDetailValue(row.follow_date) },
      { key: 'followResult', label: '跟进结果', value: formatDetailValue(row.follow_result) },
      { key: 'nextFollow', label: '下次跟进', value: formatDetailValue(row.next_follow_at) },
      { key: 'owner', label: '负责人', value: formatDetailValue(row.owner_name) }
    ]
  }
  return []
})

const extraColumns = ref([])
const hasSyncedFieldAcl = ref(false)

const isEditing = ref(false)
const editingIndex = ref(-1)

const currentCol = reactive({
  label: '',
  prop: '',
  expression: '',
  options: [],
  dependsOn: '',
  cascaderMap: {},
  geoAddress: true,
  fileMaxSizeMb: 20,
  fileMaxCount: 3,
  fileAccept: ''
})

const allAvailableColumns = computed(() => {
  const all = [...staticColumns.value, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.value.length + editingIndex.value))
  }
  return all
})

const isSelectColumnConfig = (col) => {
  if (!col) return false
  if (Array.isArray(col.options) && col.options.length > 0) return true
  return false
}

const isCascaderColumnConfig = (col) => {
  if (!col) return false
  if (col.type !== 'cascader') return false
  if (col.cascaderOptions && Object.keys(col.cascaderOptions).length > 0) return true
  return false
}

const cascaderParentColumns = computed(() => {
  return allAvailableColumns.value.filter(col => isSelectColumnConfig(col) || isCascaderColumnConfig(col) || col.type === 'cascader')
})

const normalizeCascaderOption = (opt) => {
  if (opt === null || opt === undefined) return null
  if (typeof opt === 'string' || typeof opt === 'number') {
    const text = String(opt)
    return { label: text, value: text }
  }
  const label = opt.label ?? opt.value ?? ''
  const value = opt.value ?? opt.label ?? ''
  const labelText = String(label || value)
  const valueText = String(value || label)
  return { label: labelText, value: valueText }
}

const cascaderParentOptions = computed(() => {
  const parentCol = cascaderParentColumns.value.find(col => col.prop === currentCol.dependsOn)
  if (!parentCol) return []
  if (Array.isArray(parentCol.options)) {
    return parentCol.options
      .map(normalizeCascaderOption)
      .filter(opt => opt && opt.label !== '')
  }
  if (parentCol.type === 'cascader' && parentCol.cascaderOptions) {
    const list = []
    const seen = new Set()
    Object.values(parentCol.cascaderOptions).forEach((items) => {
      if (!Array.isArray(items)) return
      items.forEach((item) => {
        const normalized = normalizeCascaderOption(item)
        if (!normalized) return
        if (normalized.label === '') return
        const key = String(normalized.value)
        if (seen.has(key)) return
        seen.add(key)
        list.push(normalized)
      })
    })
    return list
  }
  return []
})

const cascaderInputMap = reactive({})

const syncCascaderMap = () => {
  const keys = cascaderParentOptions.value.map(opt => String(opt.value))
  Object.keys(currentCol.cascaderMap).forEach((key) => {
    if (!keys.includes(key)) delete currentCol.cascaderMap[key]
  })
  keys.forEach((key) => {
    if (!Array.isArray(currentCol.cascaderMap[key])) {
      currentCol.cascaderMap[key] = []
    }
    if (!(key in cascaderInputMap)) cascaderInputMap[key] = ''
  })
  Object.keys(cascaderInputMap).forEach((key) => {
    if (!keys.includes(key)) delete cascaderInputMap[key]
  })
}

watch([() => currentCol.dependsOn, cascaderParentOptions], () => {
  syncCascaderMap()
})

const cloneColumns = (cols) => JSON.parse(JSON.stringify(cols || []))

const loadColumnsConfig = async () => {
  const configKey = app.value.configKey || 'sales_customers_cols'
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
      if (extraColumns.value.length > 0) {
        await saveColumnsConfig()
      }
    }
    syncAiContext()
  } catch (e) {
    console.warn('load sales columns config failed', e)
    ElMessage.warning(getErrorMessage(e, '列配置加载失败'))
    extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
    syncAiContext()
  }
}

const loadStaticColumnsConfig = async () => {
  const configKey = `${app.value.configKey || 'sales_customers_cols'}_static_hidden`
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const hidden = Array.isArray(res) && res.length ? res[0].value : []
    const props = new Set(staticColumnsAll.value.map(col => col.prop).filter(Boolean))
    staticHidden.value = Array.isArray(hidden)
      ? hidden.filter(prop => props.has(prop))
      : []
  } catch (e) {
    staticHidden.value = []
  }
}

const saveStaticColumnsConfig = async () => {
  const configKey = `${app.value.configKey || 'sales_customers_cols'}_static_hidden`
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: staticHidden.value }
  })
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rawRows)
    ? payload.rawRows
    : (Array.isArray(payload?.rows) ? payload.rows : [])
  const visibleRows = Array.isArray(payload?.rows) ? payload.rows : rows
  lastLoadedRows.value = rows.filter(isRowActive)
  lastSearchText.value = payload?.searchText || ''
  lastGridLoadState.value = buildGridLoadState(payload, rows, visibleRows)
  syncAiContext(visibleRows.filter(isRowActive), { searchText: lastSearchText.value })
}

const handleDataLoadError = () => {
  lastLoadedRows.value = []
  lastGridLoadState.value = buildGridLoadState()
  syncAiContext([], { searchText: lastSearchText.value })
}

const handleSalesCellValueChanged = (params) => {
  const row = params?.data || params?.node?.data
  const field = params?.colDef?.field || ''
  if (!row) return
  if (row?.id) {
    const index = lastLoadedRows.value.findIndex((item) => String(item?.id) === String(row.id))
    if (index >= 0) {
      const next = [...lastLoadedRows.value]
      next.splice(index, 1, row)
      lastLoadedRows.value = next
    }
  }
  if (app.value.key === 'orders') {
    if (['quantity', 'unit_price', 'total_amount', 'order_status', 'customer_id', 'customer_name'].includes(field)) {
      setTimeout(() => syncCustomerReceivableFromRow(row), 350)
    }
    return
  }
  if (app.value.key === 'payments') {
    if (['amount', 'customer_id', 'customer_name', 'order_id', 'order_no'].includes(field)) {
      setTimeout(() => syncCustomerReceivableFromRow(row), 350)
    }
    return
  }
  if (app.value.key === 'follow_ups') {
    if (['follow_date', 'customer_id', 'customer_name'].includes(field)) {
      setTimeout(() => syncCustomerLastFollowFromRow(row), 350)
    }
  }
}

const addCount = (target, key) => {
  const text = key === null || key === undefined || key === '' ? '未设置' : String(key)
  target[text] = (target[text] || 0) + 1
}

const toAmount = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const normalizeId = (value) => {
  if (value === null || value === undefined || value === '') return ''
  return String(value)
}

const getRequestDetail = (error) => {
  return String(error?.response?.data?.message || error?.response?.data?.details || error?.message || '')
}

const getErrorMessage = (error, fallback = '操作失败') => {
  const detail = getRequestDetail(error)
  return detail ? `${fallback}：${detail}` : fallback
}

const isMissingColumnError = (error, columnName) => {
  const detail = getRequestDetail(error).toLowerCase()
  const column = String(columnName || '').toLowerCase()
  return Boolean(column) && detail.includes(column) && (
    detail.includes('column') ||
    detail.includes('could not find') ||
    detail.includes('schema cache') ||
    detail.includes('does not exist')
  )
}

const getDateTime = (value) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

const isOrderActive = (row) => row?.order_status !== '已取消' && row?.status !== 'deleted'
const isRowActive = (row) => row?.status !== 'deleted'

const getCustomerKey = (row) => {
  if (!row) return ''
  return row.customer_id || row.id || row.customer_name || row.name || ''
}

const loadReceivableSourceRows = async () => {
  const [customerRows, orderRows, paymentRows] = await Promise.all([
    request({
      url: '/sales_customers?select=id,name,receivable_balance,status&status=neq.deleted&order=created_at.desc&limit=500',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    }),
    request({
      url: '/sales_orders?select=id,customer_id,customer_name,total_amount,order_status,status&status=neq.deleted&limit=1000',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    }),
    request({
      url: '/sales_payments?select=id,customer_id,customer_name,amount,status&status=neq.deleted&limit=1000',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
  ])
  return {
    customers: Array.isArray(customerRows) ? customerRows : [],
    orders: Array.isArray(orderRows) ? orderRows : [],
    payments: Array.isArray(paymentRows) ? paymentRows : []
  }
}

const calculateCustomerReceivable = (customer, rows) => {
  const customerId = customer?.id || ''
  const customerName = customer?.name || ''
  const orderAmount = rows.orders
    .filter((row) => isOrderActive(row))
    .filter((row) => (customerId && row.customer_id === customerId) || (!row.customer_id && row.customer_name === customerName) || row.customer_name === customerName)
    .reduce((sum, row) => sum + toAmount(row.total_amount), 0)
  const paymentAmount = rows.payments
    .filter((row) => row?.status !== 'deleted')
    .filter((row) => (customerId && row.customer_id === customerId) || (!row.customer_id && row.customer_name === customerName) || row.customer_name === customerName)
    .reduce((sum, row) => sum + toAmount(row.amount), 0)
  return Math.max(orderAmount - paymentAmount, 0)
}

const syncCustomerReceivableBalance = async (customer) => {
  if (!customer?.id && !customer?.name) return null
  const rows = await loadReceivableSourceRows()
  const target = rows.customers.find((item) => {
    if (customer.id && item.id === customer.id) return true
    return customer.name && item.name === customer.name
  }) || customer
  if (!target?.id) return null
  const receivableBalance = calculateCustomerReceivable(target, rows)
  await request({
    url: `/sales_customers?id=eq.${safeEq(target.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { receivable_balance: receivableBalance }
  })
  return receivableBalance
}

const syncCustomerReceivableFromRow = async (row) => {
  const key = getCustomerKey(row)
  if (!key) return
  try {
    await syncCustomerReceivableBalance({
      id: row?.customer_id || row?.id || '',
      name: row?.customer_name || row?.name || ''
    })
  } catch (e) {
    console.warn('sync customer receivable failed', e)
  }
}

const syncCustomerLastFollowFromRow = async (row) => {
  if (!row?.follow_date) return
  const customerId = row?.customer_id || ''
  const customerName = row?.customer_name || row?.name || ''
  if (!customerId && !customerName) return
  try {
    const customerParam = customerId
      ? `id=eq.${safeEq(customerId)}`
      : `name=eq.${safeEq(customerName)}`
    const customers = await request({
      url: `/sales_customers?${customerParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const customer = Array.isArray(customers) ? customers[0] : null
    if (!customer?.id || customer.status === 'deleted') return
    const currentTime = getDateTime(customer.last_follow_up_at)
    const nextTime = getDateTime(row.follow_date)
    if (currentTime && currentTime > nextTime) return
    await request({
      url: `/sales_customers?id=eq.${safeEq(customer.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { last_follow_up_at: row.follow_date }
    })
  } catch (e) {
    console.warn('sync customer last follow failed', e)
  }
}

const syncAllCustomerReceivables = async () => {
  receivableSyncing.value = true
  try {
    const rows = await loadReceivableSourceRows()
    const payload = rows.customers.map((customer) => ({
      id: customer.id,
      receivable_balance: calculateCustomerReceivable(customer, rows)
    }))
    if (payload.length) {
      await request({
        url: '/sales_customers',
        method: 'post',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public',
          'Prefer': 'resolution=merge-duplicates'
        },
        data: payload
      })
    }
    if (gridRef.value?.loadData) await gridRef.value.loadData()
    ElMessage.success(`已同步 ${payload.length} 个客户应收余额`)
  } catch (e) {
    console.error(e)
    ElMessage.error('应收余额同步失败')
  } finally {
    receivableSyncing.value = false
  }
}

const buildDataStats = (rows) => {
  const stats = { totalCount: 0, sampleSize: 0, statusCounts: {}, ownerCounts: {}, regionCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  stats.sampleSize = rows.length

  if (app.value.key === 'customers') {
    stats.levelCounts = {}
    stats.totalCreditLimit = 0
    stats.totalReceivableBalance = 0
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.customer_status || row?.status)
      addCount(stats.levelCounts, row?.level)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      addCount(stats.regionCounts, row?.region || row?.properties?.region)
      stats.totalCreditLimit += toAmount(row?.credit_limit)
      stats.totalReceivableBalance += toAmount(row?.receivable_balance)
    })
    return stats
  }

  if (app.value.key === 'orders') {
    stats.totalQuantity = 0
    stats.totalAmount = 0
    stats.deliveryRiskCounts = {}
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.order_status || row?.status)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      addCount(stats.deliveryRiskCounts, row?.properties?.delivery_risk || row?.properties?.交付风险)
      stats.totalQuantity += toAmount(row?.quantity)
      stats.totalAmount += toAmount(row?.total_amount)
    })
    return stats
  }

  if (app.value.key === 'payments') {
    stats.totalAmount = 0
    stats.methodCounts = {}
    stats.handlerCounts = {}
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.verify_status || row?.status)
      addCount(stats.methodCounts, row?.payment_method)
      addCount(stats.handlerCounts, row?.handler_name || row?.properties?.handler_name)
      stats.totalAmount += toAmount(row?.amount)
    })
    return stats
  }

  if (app.value.key === 'opportunities') {
    stats.totalExpectedAmount = 0
    stats.totalWeightedAmount = 0
    stats.stageCounts = {}
    stats.overdueOpportunityCount = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.stage || row?.status)
      addCount(stats.stageCounts, row?.stage)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      const expectedAmount = toAmount(row?.expected_amount)
      stats.totalExpectedAmount += expectedAmount
      stats.totalWeightedAmount += expectedAmount * toAmount(row?.probability) / 100
      if (row?.expected_close_date && !['赢单', '输单', '搁置'].includes(row.stage) && getDateTime(row.expected_close_date) < today.getTime()) {
        stats.overdueOpportunityCount += 1
      }
    })
    return stats
  }

  if (app.value.key === 'follow_ups') {
    stats.resultCounts = {}
    stats.typeCounts = {}
    stats.overdueFollowCount = 0
    stats.upcomingFollowCount = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcomingLimit = today.getTime() + 3 * 24 * 60 * 60 * 1000
    rows.forEach((row) => {
      addCount(stats.statusCounts, row?.follow_result || row?.status)
      addCount(stats.resultCounts, row?.follow_result)
      addCount(stats.typeCounts, row?.follow_type)
      addCount(stats.ownerCounts, row?.owner_name || row?.properties?.owner_name)
      const nextTime = getDateTime(row?.next_follow_at)
      if (nextTime && nextTime < today.getTime() && !['已成交', '无效'].includes(row?.follow_result)) {
        stats.overdueFollowCount += 1
      } else if (nextTime && nextTime <= upcomingLimit && !['已成交', '无效'].includes(row?.follow_result)) {
        stats.upcomingFollowCount += 1
      }
    })
    return stats
  }

  rows.forEach((row) => {
    addCount(stats.statusCounts, row?.properties?.status || row?.status)
    addCount(stats.ownerCounts, row?.owner_name || row?.handler_name || row?.properties?.owner_name)
    addCount(stats.regionCounts, row?.region || row?.properties?.region)
  })
  return stats
}

const buildDataSample = (rows, columns, limit = 50) => {
  if (!Array.isArray(rows)) return []
  const sample = rows.slice(0, limit)
  return sample.map((row) => {
    const item = {}
    columns.forEach((col) => {
      const prop = col.prop
      if (!prop) return
      if (col.type === 'file' || col.type === 'geo') return
      const value = row?.[prop] ?? row?.properties?.[prop]
      if (value !== undefined && value !== null && value !== '') {
        item[prop] = value
      }
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}

const getRowValue = (row, prop) => {
  if (!row || !prop) return undefined
  return row[prop] ?? row.properties?.[prop]
}

const formatDetailValue = (value) => {
  if (value === undefined || value === null || value === '') return '-'
  if (Array.isArray(value)) return value.map(formatDetailValue).join('、')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const formatAmount = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return formatDetailValue(value)
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const mapOrderRelation = (row) => ({
  order_no: formatDetailValue(row?.order_no),
  customer_name: formatDetailValue(row?.customer_name),
  product_name: formatDetailValue(row?.product_name),
  total_amount: formatAmount(row?.total_amount),
  order_status: formatDetailValue(row?.order_status)
})

const mapPaymentRelation = (row) => ({
  payment_no: formatDetailValue(row?.payment_no),
  order_no: formatDetailValue(row?.order_no),
  amount: formatAmount(row?.amount),
  verify_status: formatDetailValue(row?.verify_status)
})

const mapFollowRelation = (row) => ({
  follow_no: formatDetailValue(row?.follow_no),
  follow_date: formatDetailValue(row?.follow_date),
  follow_type: formatDetailValue(row?.follow_type),
  follow_result: formatDetailValue(row?.follow_result),
  next_follow_at: formatDetailValue(row?.next_follow_at)
})

const mapOpportunityRelation = (row) => ({
  opportunity_no: formatDetailValue(row?.opportunity_no),
  opportunity_name: formatDetailValue(row?.opportunity_name),
  expected_amount: formatAmount(row?.expected_amount),
  stage: formatDetailValue(row?.stage),
  probability: `${formatDetailValue(row?.probability)}%`
})

const mapCustomerRelation = (row) => ({
  customer_no: formatDetailValue(row?.customer_no),
  name: formatDetailValue(row?.name),
  level: formatDetailValue(row?.level),
  receivable_balance: formatAmount(row?.receivable_balance)
})

const getRowDisplayName = (row) => {
  if (!row) return '未选择记录'
  return row.name || row.opportunity_name || row.customer_name || row.order_no || row.payment_no || row.follow_no || row.opportunity_no || row.customer_no || row.id || '未命名记录'
}

const buildDetailSummary = () => {
  const row = selectedDetailRow.value
  if (!row) return ''
  const lines = [
    `${app.value.name}：${getRowDisplayName(row)}`
  ]
  detailItems.value.forEach((item) => {
    if (item.value !== '-') lines.push(`${item.label}：${item.value}`)
  })
  if (detailPropertyItems.value.length) {
    lines.push('扩展字段：')
    detailPropertyItems.value.forEach((item) => {
      lines.push(`${item.key}：${item.value}`)
    })
  }
  if (detailRelationSections.value.length) {
    lines.push('关联记录：')
    detailRelationSections.value.forEach((section) => {
      lines.push(`${section.title}：${section.rows.length} 条`)
      section.rows.slice(0, 5).forEach((item) => {
        lines.push(Object.values(item).filter(value => value !== '-').join(' / '))
      })
    })
  }
  return lines.join('\n')
}

const safeFilterValue = (value) => encodeURIComponent(String(value))
  .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
const safeEq = (value) => safeFilterValue(value)

const activeLinkQuery = (sourceType, sourceId, sourceNo) => {
  const clauses = []
  if (sourceId) clauses.push(`source_doc_id.eq.${safeEq(sourceId)}`)
  if (sourceNo) clauses.push(`source_doc_no.eq.${safeEq(sourceNo)}`)
  const orPart = clauses.length ? `&or=(${clauses.join(',')})` : ''
  return `source_doc_type=eq.${safeEq(sourceType)}&status=eq.active${orPart}&order=created_at.asc`
}

const loadRowsByIdsOrNos = async ({ table, idField = 'id', noField, ids = [], nos = [], select = '*' }) => {
  const clauses = []
  const cleanIds = ids.filter(Boolean).map(safeEq)
  const cleanNos = nos.filter(Boolean).map(safeEq)
  if (cleanIds.length) clauses.push(`${idField}.in.(${cleanIds.join(',')})`)
  if (noField && cleanNos.length) clauses.push(`${noField}.in.(${cleanNos.join(',')})`)
  if (!clauses.length) return []
  const rows = await request({
    url: `/${table}?or=(${clauses.join(',')})&select=${select}&limit=50`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  })
  return Array.isArray(rows) ? rows : []
}

const pickFirstByLinkTarget = (rows, link, noField) => {
  if (!link) return null
  return rows.find((row) => {
    if (link.target_doc_id && row.id === link.target_doc_id) return true
    return noField && link.target_doc_no && row[noField] === link.target_doc_no
  }) || rows[0] || null
}

const normalizeApiBaseUrl = (url) => String(url || '').split('?')[0] || String(url || '')

const loadSelectedDetailRow = async () => {
  const row = selectedDetailRow.value
  if (!row?.id) return row
  const baseUrl = normalizeApiBaseUrl(app.value.apiUrl)
  if (!baseUrl) return row
  try {
    const rows = await request({
      url: `${baseUrl}?id=eq.${safeEq(row.id)}&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' },
      silentError: true
    })
    const latest = Array.isArray(rows) ? rows[0] : null
    if (latest) {
      selectedDetailRow.value = latest
      return latest
    }
  } catch (e) {
    console.warn('reload selected sales detail failed', e)
  }
  return row
}

const refreshSelectedDetail = async () => {
  if (!selectedDetailRow.value) return
  const row = await loadSelectedDetailRow()
  await loadDetailRelations(row)
}

const loadCustomerRelations = async (row) => {
  const params = row.id
    ? `customer_id=eq.${safeEq(row.id)}`
    : `customer_name=eq.${safeEq(row.name || row.customer_name || '')}`
  const [orders, payments, followUps, opportunities] = await Promise.all([
    request({
      url: `/sales_orders?${params}&status=neq.deleted&order=order_date.desc&limit=8`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    }),
    request({
      url: `/sales_payments?${params}&status=neq.deleted&order=payment_date.desc&limit=8`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    }),
    request({
      url: `/sales_follow_ups?${params}&status=neq.deleted&order=follow_date.desc&limit=8`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    }),
    request({
      url: `/sales_opportunities?${params}&status=neq.deleted&order=expected_close_date.asc&limit=8`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
  ])
  return {
    orders: Array.isArray(orders) ? orders : [],
    payments: Array.isArray(payments) ? payments : [],
    followUps: Array.isArray(followUps) ? followUps : [],
    opportunities: Array.isArray(opportunities) ? opportunities : []
  }
}

const loadFollowRelations = async (row) => {
  let customer = null
  if (row.customer_id || row.customer_name) {
    const customerParam = row.customer_id
      ? `id=eq.${safeEq(row.customer_id)}`
      : `name=eq.${safeEq(row.customer_name)}`
    const customers = await request({
      url: `/sales_customers?${customerParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    customer = Array.isArray(customers) ? customers[0] : null
  }
  return { customer }
}

const loadOpportunityRelations = async (row) => {
  let customer = null
  let orders = []
  if (row.customer_id || row.customer_name) {
    const customerParam = row.customer_id
      ? `id=eq.${safeEq(row.customer_id)}`
      : `name=eq.${safeEq(row.customer_name)}`
    const customers = await request({
      url: `/sales_customers?${customerParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    customer = Array.isArray(customers) ? customers[0] : null
  }
  if (row.id || row.opportunity_no) {
    const opportunityParam = row.id
      ? `properties->>商机ID=eq.${safeEq(row.id)}`
      : `properties->>商机编号=eq.${safeEq(row.opportunity_no)}`
    try {
      const rows = await request({
        url: `/sales_orders?${opportunityParam}&status=neq.deleted&order=order_date.desc&limit=8`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      orders = Array.isArray(rows) ? rows : []
    } catch (e) {
      orders = []
    }
  }
  return { customer, orders }
}

const loadOrderRelations = async (row) => {
  const params = row.id
    ? `order_id=eq.${safeEq(row.id)}`
    : `order_no=eq.${safeEq(row.order_no || '')}`
  const payments = await request({
    url: `/sales_payments?${params}&status=neq.deleted&order=payment_date.desc&limit=8`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  let customer = null
  let opportunity = null
  if (row.customer_id || row.customer_name) {
    const customerParam = row.customer_id
      ? `id=eq.${safeEq(row.customer_id)}`
      : `name=eq.${safeEq(row.customer_name)}`
    const customers = await request({
      url: `/sales_customers?${customerParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    customer = Array.isArray(customers) ? customers[0] : null
  }
  if (row.properties?.商机ID || row.properties?.商机编号) {
    const opportunityParam = row.properties?.商机ID
      ? `id=eq.${safeEq(row.properties.商机ID)}`
      : `opportunity_no=eq.${safeEq(row.properties.商机编号)}`
    const opportunities = await request({
      url: `/sales_opportunities?${opportunityParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    opportunity = Array.isArray(opportunities) ? opportunities[0] : null
  }
  return { payments: Array.isArray(payments) ? payments : [], customer, opportunity }
}

const loadPaymentRelations = async (row) => {
  let order = null
  let customer = null
  if (row.order_id || row.order_no) {
    const orderParam = row.order_id
      ? `id=eq.${safeEq(row.order_id)}`
      : `order_no=eq.${safeEq(row.order_no)}`
    const orders = await request({
      url: `/sales_orders?${orderParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    order = Array.isArray(orders) ? orders[0] : null
  }
  if (row.customer_id || row.customer_name) {
    const customerParam = row.customer_id
      ? `id=eq.${safeEq(row.customer_id)}`
      : `name=eq.${safeEq(row.customer_name)}`
    const customers = await request({
      url: `/sales_customers?${customerParam}&status=neq.deleted&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    customer = Array.isArray(customers) ? customers[0] : null
  }
  return { order, customer }
}

const loadDetailRelations = async (row) => {
  detailRelations.value = {}
  if (!row) return
  detailRelationsLoading.value = true
  try {
    if (app.value.key === 'customers') {
      detailRelations.value = await loadCustomerRelations(row)
    } else if (app.value.key === 'follow_ups') {
      detailRelations.value = await loadFollowRelations(row)
    } else if (app.value.key === 'opportunities') {
      detailRelations.value = await loadOpportunityRelations(row)
    } else if (app.value.key === 'orders') {
      detailRelations.value = await loadOrderRelations(row)
    } else if (app.value.key === 'payments') {
      detailRelations.value = await loadPaymentRelations(row)
    }
  } catch (e) {
    console.warn('load sales detail relations failed', e)
    ElMessage.warning('关联记录加载失败')
  } finally {
    detailRelationsLoading.value = false
  }
}

const resetBusinessFlowDialog = () => {
  flowSelectedRows.value = []
  flowNextStep.value = 'purchase_demand'
  salesFlowDocs.value = {}
  salesFlowRelationLinks.value = []
  flowLoading.value = false
  flowActionLoading.value = false
}

const findActiveDocumentLink = async ({ sourceType, sourceId, sourceNo, relationType }) => {
  const rows = await request({
    url: `/document_links?${activeLinkQuery(sourceType, sourceId, sourceNo)}&relation_type=eq.${safeEq(relationType)}&select=*&limit=1`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

const loadSalesBusinessFlow = async (sourceOrder = null) => {
  const order = sourceOrder || flowPrimaryOrder.value
  if (!order?.id && !order?.order_no) return
  flowLoading.value = true
  try {
    const salesDemandLinks = await request({
      url: `/document_links?${activeLinkQuery(DOC_TYPES.SALES_ORDER, order.id, order.order_no)}&select=*`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' },
      silentError: true
    }).catch(() => [])
    const purchaseDemandLinks = Array.isArray(salesDemandLinks)
      ? salesDemandLinks.filter((link) => link.relation_type === RELATION_TYPES.SALES_TO_PURCHASE_DEMAND)
      : []
    const firstSalesDemandLink = purchaseDemandLinks[0] || null
    const demands = await loadRowsByIdsOrNos({
      table: 'purchase_demands',
      noField: 'demand_no',
      ids: purchaseDemandLinks.map((link) => link.target_doc_id),
      nos: purchaseDemandLinks.map((link) => link.target_doc_no)
    })
    const purchaseDemand = pickFirstByLinkTarget(demands, firstSalesDemandLink, 'demand_no')

    let purchaseOrder = null
    let purchaseArrival = null
    let inventoryInbound = null
    let salesShipment = null
    let salesOutbound = null
    let demandOrderLinks = []
    let orderArrivalLinks = []
    let arrivalInboundLinks = []
    let salesShipmentLinks = []
    let shipmentOutboundLinks = []
    let directOutboundLinks = []

    if (purchaseDemand) {
      demandOrderLinks = await request({
        url: `/document_links?${activeLinkQuery(DOC_TYPES.PURCHASE_DEMAND, purchaseDemand.id, purchaseDemand.demand_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      const orders = await loadRowsByIdsOrNos({
        table: 'purchase_orders',
        noField: 'order_no',
        ids: demandOrderLinks.map((link) => link.target_doc_id),
        nos: demandOrderLinks.map((link) => link.target_doc_no)
      })
      purchaseOrder = pickFirstByLinkTarget(orders, demandOrderLinks[0], 'order_no')
    }

    if (purchaseOrder) {
      orderArrivalLinks = await request({
        url: `/document_links?${activeLinkQuery(DOC_TYPES.PURCHASE_ORDER, purchaseOrder.id, purchaseOrder.order_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      const arrivals = await loadRowsByIdsOrNos({
        table: 'purchase_arrivals',
        noField: 'arrival_no',
        ids: orderArrivalLinks.map((link) => link.target_doc_id),
        nos: orderArrivalLinks.map((link) => link.target_doc_no)
      })
      purchaseArrival = pickFirstByLinkTarget(arrivals, orderArrivalLinks[0], 'arrival_no')
    }

    if (purchaseArrival) {
      arrivalInboundLinks = await request({
        url: `/document_links?${activeLinkQuery(DOC_TYPES.PURCHASE_ARRIVAL, purchaseArrival.id, purchaseArrival.arrival_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      const link = arrivalInboundLinks[0]
      if (link) {
        inventoryInbound = {
          id: link.target_doc_id,
          inbound_no: link.target_doc_no,
          docNo: link.target_doc_no,
          status: link.status === 'active' ? '已入库' : link.status
        }
      }
    }

    salesShipmentLinks = Array.isArray(salesDemandLinks)
      ? salesDemandLinks.filter((link) => link.relation_type === RELATION_TYPES.SALES_TO_SHIPMENT_REQUEST)
      : []
    const shipmentLink = salesShipmentLinks[0]
    if (shipmentLink) {
      salesShipment = {
        id: shipmentLink.target_doc_id,
        shipment_no: shipmentLink.target_doc_no,
        docNo: shipmentLink.target_doc_no,
        status: shipmentLink.payload?.status || '待仓储确认',
        payload: shipmentLink.payload || {}
      }
      shipmentOutboundLinks = await request({
        url: `/document_links?${activeLinkQuery(DOC_TYPES.SALES_SHIPMENT, shipmentLink.target_doc_id, shipmentLink.target_doc_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      const outboundLink = Array.isArray(shipmentOutboundLinks)
        ? shipmentOutboundLinks.find((link) => link.relation_type === RELATION_TYPES.SHIPMENT_REQUEST_TO_SALES_OUTBOUND)
        : null
      if (outboundLink) {
        salesOutbound = {
          id: outboundLink.target_doc_id,
          outbound_no: outboundLink.target_doc_no,
          docNo: outboundLink.target_doc_no,
          status: outboundLink.payload?.status || '待仓储补录'
        }
      }
    }
    directOutboundLinks = Array.isArray(salesDemandLinks)
      ? salesDemandLinks.filter((link) => link.relation_type === RELATION_TYPES.SALES_TO_OUTBOUND)
      : []
    if (!salesOutbound && directOutboundLinks[0]) {
      salesOutbound = {
        id: directOutboundLinks[0].target_doc_id,
        outbound_no: directOutboundLinks[0].target_doc_no,
        docNo: directOutboundLinks[0].target_doc_no,
        status: directOutboundLinks[0].payload?.status || '待仓储补录'
      }
    }

    salesFlowDocs.value = { purchaseDemand, purchaseOrder, purchaseArrival, inventoryInbound, salesShipment, salesOutbound }
    salesFlowRelationLinks.value = [
      ...(salesDemandLinks || []),
      ...(demandOrderLinks || []),
      ...(orderArrivalLinks || []),
      ...(arrivalInboundLinks || []),
      ...(salesShipmentLinks || []),
      ...(shipmentOutboundLinks || []),
      ...(directOutboundLinks || [])
    ]
  } catch (e) {
    console.warn('load sales business flow failed', e)
    ElMessage.warning('业务流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const openBusinessFlowDialog = async () => {
  if (!selectedDetailRow.value) return
  flowSelectedRows.value = [selectedDetailRow.value]
  businessFlowVisible.value = true
  await loadSalesBusinessFlow(selectedDetailRow.value)
}

const getSelectedSalesOrders = () => {
  const rows = gridRef.value?.getSelectedRows?.() || []
  return rows.filter((row) => row?.id || row?.order_no)
}

const openBatchPushFlowDialog = async () => {
  const rows = getSelectedSalesOrders()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的销售订单')
    return
  }
  const invalidRows = rows.filter((row) => !isOrderActive(row))
  if (invalidRows.length) {
    ElMessage.warning('已取消或已删除的销售订单不能下推采购需求')
    return
  }
  flowSelectedRows.value = rows
  businessFlowVisible.value = true
  await loadSalesBusinessFlow(rows[0])
}

const openBatchShipmentFlowDialog = async () => {
  const rows = getSelectedSalesOrders()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推出货的销售订单')
    return
  }
  const invalidRows = rows.filter((row) => !isOrderActive(row))
  if (invalidRows.length) {
    ElMessage.warning('已取消或已删除的销售订单不能下推出货')
    return
  }
  flowSelectedRows.value = rows
  flowNextStep.value = app.value.key === 'shipment_requests' ? 'sales_outbound' : 'shipment_request'
  businessFlowVisible.value = true
  await loadSalesBusinessFlow(rows[0])
}

const openSalesFlowDialogForRow = async (row, nextStep = 'purchase_demand') => {
  if (!row?.id && !row?.order_no) {
    ElMessage.warning('该销售订单缺少业务编号，不能下推')
    return
  }
  if (!isOrderActive(row)) {
    ElMessage.warning('已取消或已删除的销售订单不能下推')
    return
  }
  flowSelectedRows.value = [row]
  flowNextStep.value = nextStep
  businessFlowVisible.value = true
  await loadSalesBusinessFlow(row)
}

const createDocumentLink = async ({ source, target, relationType, quantity = null, amount = null, payload = {} }) => {
  const linkPayload = {
    source_doc_type: source.docType,
    source_doc_id: source.docId || null,
    source_doc_no: source.docNo || '',
    target_doc_type: target.docType,
    target_doc_id: target.docId || null,
    target_doc_no: target.docNo || '',
    relation_type: relationType,
    quantity,
    amount,
    status: 'active',
    payload
  }
  await request({
    url: '/document_links',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'resolution=merge-duplicates' },
    data: linkPayload,
    silentError: true
  }).catch(() => null)
}

const writeDocumentAudit = async ({ actionType, source, target, reason = '', payload = {} }) => {
  await request({
    url: '/document_flow_audits',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: {
      action_type: actionType,
      source_doc_type: source?.docType || '',
      source_doc_id: source?.docId || null,
      source_doc_no: source?.docNo || '',
      target_doc_type: target?.docType || '',
      target_doc_id: target?.docId || null,
      target_doc_no: target?.docNo || '',
      reason,
      actor_username: 'sales',
      payload
    },
    silentError: true
  }).catch(() => null)
}

const loadQuickCustomers = async () => {
  const rows = await request({
    url: '/sales_customers?select=*&status=neq.deleted&order=created_at.desc&limit=200',
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  quickCustomers.value = Array.isArray(rows) ? rows : []
}

const loadQuickBomProducts = async () => {
  try {
    const rows = await request({
      url: '/v_boms?select=id,bom_no,parent_material_id,parent_material_code,parent_material_name,unit,status&status=eq.启用&order=parent_material_code.asc',
      method: 'get',
      headers: { 'Accept-Profile': 'scm' },
      silentError: true
    })
    quickBomProducts.value = Array.isArray(rows) ? rows : []
  } catch (e) {
    quickBomProducts.value = []
    console.warn('load quick bom products failed', e)
  }
}

const loadQuickOrders = async () => {
  const rows = await request({
    url: `/sales_orders?select=*&status=neq.deleted&order_status=neq.${safeEq('已取消')}&order=order_date.desc&limit=200`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  quickOrders.value = Array.isArray(rows) ? rows : []
}

const loadQuickOrderPayments = async () => {
  const rows = await request({
    url: '/sales_payments?select=*&status=neq.deleted&order=payment_date.desc&limit=200',
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  quickOrderPayments.value = Array.isArray(rows) ? rows : []
}

const resetOrderForm = (source = null) => {
  currentOrderSource.value = source?.opportunity_no ? source : null
  orderForm.customer_id = source?.customer_id || (source?.opportunity_no ? '' : source?.id) || ''
  orderForm.product_material_id = source?.product_material_id || null
  orderForm.product_name = source?.product_name || source?.opportunity_name || ''
  orderForm.quantity = 1
  orderForm.unit = '箱'
  orderForm.unit_price = toAmount(source?.expected_amount || 0)
  orderForm.order_date = todayText()
  orderForm.delivery_date = addDaysText(7)
  orderForm.order_status = '已确认'
  orderForm.owner_name = source?.owner_name || ''
}

const resetPaymentForm = (source = null) => {
  paymentForm.order_id = source?.id || source?.order_id || ''
  paymentForm.customer_name = source?.customer_name || source?.name || ''
  paymentForm.amount = toAmount(source?.total_amount || source?.amount || 0)
  paymentForm.payment_date = todayText()
  paymentForm.payment_method = '银行转账'
  paymentForm.verify_status = '待核销'
  paymentForm.handler_name = source?.owner_name || source?.handler_name || ''
}

const resetFollowForm = (source = null) => {
  followForm.customer_id = source?.id || source?.customer_id || ''
  followForm.contact_name = source?.contact_name || ''
  followForm.follow_date = todayText()
  followForm.follow_type = '电话沟通'
  followForm.follow_result = '待跟进'
  followForm.next_follow_at = addDaysText(3)
  followForm.owner_name = source?.owner_name || ''
  followForm.follow_content = ''
}

const resetOpportunityForm = (source = null) => {
  opportunityForm.customer_id = source?.id || source?.customer_id || ''
  opportunityForm.opportunity_name = source?.opportunity_name || source?.name || ''
  opportunityForm.expected_amount = toAmount(source?.expected_amount || 0)
  opportunityForm.stage = source?.stage || '初步接洽'
  opportunityForm.probability = toAmount(source?.probability || 20)
  opportunityForm.expected_close_date = source?.expected_close_date || addDaysText(14)
  opportunityForm.owner_name = source?.owner_name || ''
  opportunityForm.next_action = source?.next_action || ''
  opportunityForm.remark = source?.remark || ''
}

const openOrderDialog = async (source = null) => {
  quickMode.value = 'order'
  quickDialogVisible.value = true
  resetOrderForm(source)
  quickLoading.value = true
  try {
    await loadQuickCustomers()
    await loadQuickBomProducts()
    if (source?.name && !orderForm.customer_id) {
      const matched = quickCustomers.value.find((customer) => customer.name === source.name)
      if (matched) orderForm.customer_id = matched.id
    }
  } catch (e) {
    console.warn('load quick customers failed', e)
    ElMessage.warning('客户列表加载失败')
  } finally {
    quickLoading.value = false
  }
}

const openFollowDialog = async (source = null) => {
  quickMode.value = 'follow'
  quickDialogVisible.value = true
  resetFollowForm(source)
  quickLoading.value = true
  try {
    await loadQuickCustomers()
    if (source?.name && !followForm.customer_id) {
      const matched = quickCustomers.value.find((customer) => customer.name === source.name)
      if (matched) followForm.customer_id = matched.id
    }
  } catch (e) {
    console.warn('load quick customers failed', e)
    ElMessage.warning('客户列表加载失败')
  } finally {
    quickLoading.value = false
  }
}

const openOpportunityDialog = async (source = null) => {
  quickMode.value = 'opportunity'
  quickDialogVisible.value = true
  resetOpportunityForm(source)
  quickLoading.value = true
  try {
    await loadQuickCustomers()
    if (source?.name && !opportunityForm.customer_id) {
      const matched = quickCustomers.value.find((customer) => customer.name === source.name)
      if (matched) opportunityForm.customer_id = matched.id
    }
  } catch (e) {
    console.warn('load quick customers failed', e)
    ElMessage.warning('客户列表加载失败')
  } finally {
    quickLoading.value = false
  }
}

const openPaymentDialog = async (source = null) => {
  quickMode.value = 'payment'
  quickDialogVisible.value = true
  resetPaymentForm(source)
  quickLoading.value = true
  try {
    await Promise.all([loadQuickOrders(), loadQuickOrderPayments()])
    if (source?.order_no && !paymentForm.order_id) {
      const matched = quickOrders.value.find((order) => order.order_no === source.order_no)
      if (matched) paymentForm.order_id = matched.id
    }
  } catch (e) {
    console.warn('load quick orders failed', e)
    ElMessage.warning('订单列表加载失败')
  } finally {
    quickLoading.value = false
  }
}

const findExistingPurchaseDemandForOrder = async (order) => {
  if (!order?.id && !order?.order_no) return null
  const links = await request({
    url: `/document_links?${activeLinkQuery(DOC_TYPES.SALES_ORDER, order.id, order.order_no)}&select=*`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  const demandLink = Array.isArray(links)
    ? links.find((link) => link.relation_type === RELATION_TYPES.SALES_TO_PURCHASE_DEMAND)
    : null
  if (!demandLink) return null
  const demands = await loadRowsByIdsOrNos({
    table: 'purchase_demands',
    noField: 'demand_no',
    ids: [demandLink.target_doc_id],
    nos: [demandLink.target_doc_no]
  })
  return pickFirstByLinkTarget(demands, demandLink, 'demand_no')
}

const getSalesOrderSourceDoc = (order) => ({
  docType: DOC_TYPES.SALES_ORDER,
  docId: order?.id || null,
  docNo: order?.order_no || ''
})

const findExistingShipmentForOrder = async (order) => {
  const link = await findActiveDocumentLink({
    sourceType: DOC_TYPES.SALES_ORDER,
    sourceId: order.id,
    sourceNo: order.order_no,
    relationType: RELATION_TYPES.SALES_TO_SHIPMENT_REQUEST
  })
  if (!link) return null
  return {
    id: link.target_doc_id,
    shipment_no: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.payload?.status || '待仓储确认',
    payload: link.payload || {}
  }
}

const findExistingOutboundForOrder = async (order, shipment = null) => {
  if (shipment?.id || shipment?.shipment_no || shipment?.docNo) {
    const shipmentLink = await findActiveDocumentLink({
      sourceType: DOC_TYPES.SALES_SHIPMENT,
      sourceId: shipment.id,
      sourceNo: shipment.shipment_no || shipment.docNo,
      relationType: RELATION_TYPES.SHIPMENT_REQUEST_TO_SALES_OUTBOUND
    })
    if (shipmentLink) {
      return {
        id: shipmentLink.target_doc_id,
        outbound_no: shipmentLink.target_doc_no,
        docNo: shipmentLink.target_doc_no,
        status: shipmentLink.payload?.status || '待仓储补录'
      }
    }
  }
  const directLink = await findActiveDocumentLink({
    sourceType: DOC_TYPES.SALES_ORDER,
    sourceId: order.id,
    sourceNo: order.order_no,
    relationType: RELATION_TYPES.SALES_TO_OUTBOUND
  })
  if (!directLink) return null
  return {
    id: directLink.target_doc_id,
    outbound_no: directLink.target_doc_no,
    docNo: directLink.target_doc_no,
    status: directLink.payload?.status || '待仓储补录'
  }
}

const patchSalesOrderProperties = async (order, nextProperties, nextStatus = null) => {
  const data = {
    properties: {
      ...(order.properties || {}),
      ...nextProperties
    }
  }
  if (nextStatus) data.order_status = nextStatus
  await request({
    url: `/sales_orders?id=eq.${safeEq(order.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data,
    silentError: true
  }).catch(() => null)
}

const pushSingleOrderToShipmentRequest = async (order) => {
  if (!order?.id) throw new Error('销售订单缺少主键，不能下推出货申请')
  if (!isOrderActive(order)) throw new Error(`销售订单 ${order.order_no || order.id} 已取消或已删除`)
  const existingShipment = await findExistingShipmentForOrder(order)
  if (existingShipment) return { skipped: true, shipment: existingShipment }
  const quantity = toAmount(order.quantity)
  if (quantity <= 0) throw new Error(`销售订单 ${order.order_no || order.id} 数量必须大于 0`)
  const shipmentNo = nextDocNo('SHIP')
  const sourceDoc = getSalesOrderSourceDoc(order)
  const targetDoc = { docType: DOC_TYPES.SALES_SHIPMENT, docId: null, docNo: shipmentNo }
  await createDocumentLink({
    source: sourceDoc,
    target: targetDoc,
    relationType: RELATION_TYPES.SALES_TO_SHIPMENT_REQUEST,
    quantity,
    amount: toAmount(order.total_amount),
    payload: {
      status: '待仓储确认',
      customer_name: order.customer_name || '',
      product_name: order.product_name || '',
      product_material_id: order.product_material_id || order.properties?.product_material_id || null,
      product_material_code: order.properties?.product_material_code || '',
      unit: order.unit || '',
      delivery_date: order.delivery_date || null
    }
  })
  await writeDocumentAudit({
    actionType: 'push_sales_order_to_shipment_request',
    source: sourceDoc,
    target: targetDoc,
    payload: { quantity, customer_name: order.customer_name || '', product_name: order.product_name || '' }
  })
  await patchSalesOrderProperties(order, {
    shipment_no: shipmentNo,
    shipment_status: '待仓储确认',
    shipment_pushed_at: new Date().toISOString(),
    workflow_status: 'running',
    workflow_key: 'sales_to_shipment_outbound'
  })
  return { skipped: false, shipment: { shipment_no: shipmentNo, status: '待仓储确认' } }
}

const pushSingleOrderToSalesOutbound = async (order) => {
  if (!order?.id) throw new Error('销售订单缺少主键，不能下推销售出库')
  if (!isOrderActive(order)) throw new Error(`销售订单 ${order.order_no || order.id} 已取消或已删除`)
  const shipmentResult = await pushSingleOrderToShipmentRequest(order)
  const shipment = shipmentResult.shipment
  const existingOutbound = await findExistingOutboundForOrder(order, shipment)
  if (existingOutbound) return { skipped: true, outbound: existingOutbound }
  const quantity = toAmount(order.quantity)
  if (quantity <= 0) throw new Error(`销售订单 ${order.order_no || order.id} 数量必须大于 0`)
  const outboundNo = nextDocNo('SOUT')
  const sourceDoc = {
    docType: DOC_TYPES.SALES_SHIPMENT,
    docId: shipment?.id || null,
    docNo: shipment?.shipment_no || shipment?.docNo || ''
  }
  const targetDoc = { docType: DOC_TYPES.INVENTORY_OUTBOUND, docId: null, docNo: outboundNo }
  await createDocumentLink({
    source: sourceDoc,
    target: targetDoc,
    relationType: RELATION_TYPES.SHIPMENT_REQUEST_TO_SALES_OUTBOUND,
    quantity,
    amount: toAmount(order.total_amount),
    payload: {
      status: '待仓储补录',
      io_type: '销售出库',
      sales_order_id: order.id,
      sales_order_no: order.order_no || '',
      customer_name: order.customer_name || '',
      product_name: order.product_name || '',
      product_material_id: order.product_material_id || order.properties?.product_material_id || null,
      product_material_code: order.properties?.product_material_code || '',
      unit: order.unit || ''
    }
  })
  await createDocumentLink({
    source: getSalesOrderSourceDoc(order),
    target: targetDoc,
    relationType: RELATION_TYPES.SALES_TO_OUTBOUND,
    quantity,
    amount: toAmount(order.total_amount),
    payload: {
      status: '待仓储补录',
      io_type: '销售出库',
      shipment_no: shipment?.shipment_no || shipment?.docNo || ''
    }
  })
  await writeDocumentAudit({
    actionType: 'push_sales_order_to_sales_outbound',
    source: getSalesOrderSourceDoc(order),
    target: targetDoc,
    payload: { quantity, io_type: '销售出库', customer_name: order.customer_name || '', product_name: order.product_name || '' }
  })
  await patchSalesOrderProperties(order, {
    shipment_no: shipment?.shipment_no || shipment?.docNo || '',
    sales_outbound_no: outboundNo,
    sales_outbound_status: '待仓储补录',
    sales_outbound_pushed_at: new Date().toISOString(),
    workflow_status: 'running',
    workflow_key: 'sales_to_shipment_outbound'
  }, order.order_status === '草稿' ? '已确认' : null)
  return { skipped: false, outbound: { outbound_no: outboundNo, status: '待仓储补录' } }
}

const pushSingleOrderToPurchaseDemand = async (order) => {
  if (!order?.id) throw new Error('销售订单缺少主键，不能下推')
  if (!isOrderActive(order)) throw new Error(`销售订单 ${order.order_no || order.id} 已取消或已删除`)
  const existingDemand = await findExistingPurchaseDemandForOrder(order)
  if (existingDemand) return { skipped: true, demand: existingDemand }

  const quantity = toAmount(order.quantity)
  if (quantity <= 0) throw new Error(`销售订单 ${order.order_no || order.id} 数量必须大于 0`)

  const demandPayload = {
    demand_no: `PR${Date.now().toString().slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
    material_no: order.properties?.product_material_code || '',
    material_name: order.product_name || '待录入物料',
    quantity,
    unit: order.unit || '箱',
    required_date: order.delivery_date || null,
    source_dept: '销售订单',
    requester_name: order.owner_name || '',
    preferred_supplier: '',
    demand_status: '待采购',
    status: 'active',
    properties: {
      source_type: 'sales_order',
      source_order_id: order.id,
      source_order_no: order.order_no || '',
      source_order_nos: order.order_no || '',
      audit_status: '未提交',
      workflow_status: 'not_started',
      workflow_key: 'sales_to_purchase_inbound',
      customer_name: order.customer_name || '',
      product_name: order.product_name || '',
      product_material_id: order.product_material_id || order.properties?.product_material_id || null,
      product_material_code: order.properties?.product_material_code || ''
    }
  }
  const createdRows = await request({
    url: '/purchase_demands',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
    data: demandPayload
  })
  const demand = Array.isArray(createdRows) ? createdRows[0] : createdRows
  const sourceDoc = { docType: DOC_TYPES.SALES_ORDER, docId: order.id, docNo: order.order_no || '' }
  const targetDoc = { docType: DOC_TYPES.PURCHASE_DEMAND, docId: demand?.id || null, docNo: demand?.demand_no || demandPayload.demand_no }
  await createDocumentLink({
    source: sourceDoc,
    target: targetDoc,
    relationType: RELATION_TYPES.SALES_TO_PURCHASE_DEMAND,
    quantity,
    amount: toAmount(order.total_amount),
    payload: { product_name: order.product_name || '', customer_name: order.customer_name || '' }
  })
  await writeDocumentAudit({
    actionType: 'push_sales_order_to_purchase_demand',
    source: sourceDoc,
    target: targetDoc,
    payload: { quantity, product_name: order.product_name || '' }
  })
  await request({
    url: `/sales_orders?id=eq.${safeEq(order.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: {
      properties: {
        ...(order.properties || {}),
        purchase_pushed_at: new Date().toISOString(),
        audit_status: order.properties?.audit_status || '已审核',
        workflow_status: 'running',
        workflow_key: 'sales_to_purchase_inbound',
        purchase_demand_id: demand?.id || null,
        purchase_demand_no: demand?.demand_no || demandPayload.demand_no
      }
    }
  })
  return { skipped: false, demand }
}

const jumpToPurchaseDemandPage = () => {
  window.location.href = '/purchase/app/demands'
}

const jumpToShipmentPage = () => {
  window.location.href = '/sales/app/shipment_requests'
}

const jumpToSalesOutboundPage = () => {
  window.location.href = '/materials/inventory-stock-out?ioType=销售出库'
}

const pushOrderToPurchaseDemand = async () => {
  if (flowNextStep.value !== 'purchase_demand') {
    ElMessage.warning('请选择要下推的下一流程')
    return
  }
  const rows = flowSelectedRows.value.length ? flowSelectedRows.value : getSelectedSalesOrders()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的销售订单')
    return
  }

  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleOrderToPurchaseDemand(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(getErrorMessage(error, `销售订单 ${row.order_no || row.id} 下推失败`))
      }
    }
    await gridRef.value?.loadData?.()
    if (flowPrimaryOrder.value) await loadSalesBusinessFlow(flowPrimaryOrder.value)

    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('batch push sales orders failed', errors)
      return
    }
    ElMessage.success(`已下推 ${createdCount} 单，跳过已下推 ${skippedCount} 单`)
    businessFlowVisible.value = false
    jumpToPurchaseDemandPage()
  } finally {
    flowActionLoading.value = false
  }
}

const pushOrdersToShipmentRequest = async () => {
  if (flowNextStep.value !== 'shipment_request') {
    ElMessage.warning('请选择要下推的下一流程')
    return
  }
  const rows = flowSelectedRows.value.length ? flowSelectedRows.value : getSelectedSalesOrders()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的销售订单')
    return
  }
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleOrderToShipmentRequest(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(getErrorMessage(error, `销售订单 ${row.order_no || row.id} 下推失败`))
      }
    }
    await gridRef.value?.loadData?.()
    if (flowPrimaryOrder.value) await loadSalesBusinessFlow(flowPrimaryOrder.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('batch push sales shipments failed', errors)
      return
    }
    ElMessage.success(`已下推出货申请 ${createdCount} 单，跳过 ${skippedCount} 单`)
    businessFlowVisible.value = false
    jumpToShipmentPage()
  } finally {
    flowActionLoading.value = false
  }
}

const pushOrdersToSalesOutbound = async () => {
  if (flowNextStep.value !== 'sales_outbound') {
    ElMessage.warning('请选择要下推的下一流程')
    return
  }
  const rows = flowSelectedRows.value.length ? flowSelectedRows.value : getSelectedSalesOrders()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的销售订单')
    return
  }
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleOrderToSalesOutbound(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(getErrorMessage(error, `销售订单 ${row.order_no || row.id} 下推失败`))
      }
    }
    await gridRef.value?.loadData?.()
    if (flowPrimaryOrder.value) await loadSalesBusinessFlow(flowPrimaryOrder.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('batch push sales outbound failed', errors)
      return
    }
    ElMessage.success(`已生成销售出库链路 ${createdCount} 单，跳过 ${skippedCount} 单`)
    businessFlowVisible.value = false
    jumpToSalesOutboundPage()
  } finally {
    flowActionLoading.value = false
  }
}

const confirmSalesFlowPush = () => {
  if (flowNextStep.value === 'shipment_request') return pushOrdersToShipmentRequest()
  if (flowNextStep.value === 'sales_outbound') return pushOrdersToSalesOutbound()
  return pushOrderToPurchaseDemand()
}

const reverseSalesDemandLink = async () => {
  const order = flowPrimaryOrder.value
  const demand = salesFlowDocs.value?.purchaseDemand
  if (!order?.id || !demand?.id) return
  if (!canReverseSalesDemand.value) {
    ElMessage.warning('当前链路不允许直接反审核')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `确认撤销销售订单 ${order.order_no || order.id} 下推到采购需求 ${demand.demand_no || demand.id} 的关联？`,
      '反审核/撤销下推',
      {
        confirmButtonText: '确认撤销',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '请填写反审核原因'
      }
    )
    const reason = String(result?.value || '').trim()
    flowActionLoading.value = true
    const activeLink = salesFlowRelationLinks.value.find((link) => link.relation_type === RELATION_TYPES.SALES_TO_PURCHASE_DEMAND)
    if (activeLink?.id) {
      await request({
        url: `/document_links?id=eq.${safeEq(activeLink.id)}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { status: 'reversed', reversed_by: 'sales', reversed_at: new Date().toISOString(), reverse_reason: reason }
      })
    }
    await request({
      url: `/purchase_demands?id=eq.${safeEq(demand.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: {
        demand_status: '已关闭',
        status: 'disabled',
        properties: {
          ...(demand.properties || {}),
          audit_status: '已反审核',
          reverse_audit_reason: reason,
          reverse_audit_at: new Date().toISOString()
        }
      }
    })
    await writeDocumentAudit({
      actionType: 'reverse_sales_order_purchase_demand',
      source: { docType: DOC_TYPES.SALES_ORDER, docId: order.id, docNo: order.order_no || '' },
      target: { docType: DOC_TYPES.PURCHASE_DEMAND, docId: demand.id, docNo: demand.demand_no || '' },
      reason
    })
    ElMessage.success('已撤销下推关联')
    await loadSalesBusinessFlow()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('撤销下推失败')
  } finally {
    flowActionLoading.value = false
  }
}

const resetQuickDialog = () => {
  quickMode.value = ''
  quickSubmitting.value = false
  currentOrderSource.value = null
}

const submitQuickOrder = async () => {
  const customer = selectedQuickCustomer.value
  const bomProduct = selectedQuickBomProduct.value
  if (!customer) {
    ElMessage.warning('请选择客户')
    return
  }
  if (!orderForm.product_name?.trim()) {
    ElMessage.warning('请输入产品名称')
    return
  }
  const payload = {
    order_no: `SO${Date.now().toString().slice(-8)}`,
    customer_id: customer.id,
    customer_name: customer.name,
    product_name: orderForm.product_name.trim(),
    quantity: toAmount(orderForm.quantity),
    unit: orderForm.unit || '箱',
    unit_price: toAmount(orderForm.unit_price),
    total_amount: orderTotalAmount.value,
    order_date: orderForm.order_date || todayText(),
    delivery_date: orderForm.delivery_date || null,
    order_status: orderForm.order_status || '已确认',
    owner_name: orderForm.owner_name || customer.owner_name || '',
    status: 'active',
    properties: {
      来源: currentOrderSource.value?.opportunity_no ? '商机转订单' : '快捷建单',
      bom_enabled: Boolean(bomProduct?.parent_material_id),
      bom_no: bomProduct?.bom_no || null,
      product_material_code: bomProduct?.parent_material_code || null
    }
  }
  if (bomProduct?.parent_material_id) {
    payload.product_material_id = bomProduct.parent_material_id
  }
  if (currentOrderSource.value?.id && currentOrderSource.value?.opportunity_no) {
    payload.properties.商机ID = currentOrderSource.value.id
    payload.properties.商机编号 = currentOrderSource.value.opportunity_no
  }
  try {
    await request({
      url: '/sales_orders',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: payload,
      silentError: Boolean(payload.product_material_id)
    })
  } catch (e) {
    if (!isMissingColumnError(e, 'product_material_id')) throw e
    const fallbackPayload = { ...payload }
    delete fallbackPayload.product_material_id
    fallbackPayload.properties = {
      ...(fallbackPayload.properties || {}),
      product_material_id: bomProduct?.parent_material_id || null
    }
    await request({
      url: '/sales_orders',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: fallbackPayload
    })
  }
  await syncCustomerReceivableFromRow(payload)
  if (currentOrderSource.value?.id && currentOrderSource.value?.opportunity_no) {
    await request({
      url: `/sales_opportunities?id=eq.${safeEq(currentOrderSource.value.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { stage: '赢单', probability: 100 }
    })
  }
  ElMessage.success('销售订单已创建')
}

const submitQuickPayment = async () => {
  const order = selectedQuickOrder.value
  const customerName = order?.customer_name || paymentForm.customer_name?.trim()
  if (order && !isOrderActive(order)) {
    ElMessage.warning('已取消或已删除的订单不能登记回款')
    return
  }
  if (!customerName) {
    ElMessage.warning('请选择订单或填写客户名称')
    return
  }
  if (toAmount(paymentForm.amount) <= 0) {
    ElMessage.warning('回款金额必须大于 0')
    return
  }
  const payload = {
    payment_no: `PAY${Date.now().toString().slice(-8)}`,
    order_id: order?.id || null,
    order_no: order?.order_no || '',
    customer_id: order?.customer_id || null,
    customer_name: customerName,
    amount: toAmount(paymentForm.amount),
    payment_date: paymentForm.payment_date || todayText(),
    payment_method: paymentForm.payment_method || '银行转账',
    verify_status: paymentForm.verify_status || '待核销',
    handler_name: paymentForm.handler_name || order?.owner_name || '',
    status: 'active',
    properties: {
      来源: '快捷登记回款'
    }
  }
  await request({
    url: '/sales_payments',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: payload
  })
  await syncCustomerReceivableFromRow(payload)
  ElMessage.success('回款记录已创建')
}

const submitQuickOpportunity = async () => {
  const customer = selectedOpportunityCustomer.value
  if (!customer) {
    ElMessage.warning('请选择客户')
    return
  }
  if (!opportunityForm.opportunity_name?.trim()) {
    ElMessage.warning('请输入商机名称')
    return
  }
  const payload = {
    opportunity_no: `OPP${Date.now().toString().slice(-8)}`,
    opportunity_name: opportunityForm.opportunity_name.trim(),
    customer_id: customer.id,
    customer_name: customer.name,
    expected_amount: toAmount(opportunityForm.expected_amount),
    stage: opportunityForm.stage || '初步接洽',
    probability: toAmount(opportunityForm.probability),
    expected_close_date: opportunityForm.expected_close_date || null,
    owner_name: opportunityForm.owner_name || customer.owner_name || '',
    next_action: opportunityForm.next_action || '',
    remark: opportunityForm.remark || '',
    status: 'active',
    properties: {
      来源: '快捷新建商机'
    }
  }
  await request({
    url: '/sales_opportunities',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: payload
  })
  ElMessage.success('销售商机已创建')
}

const submitQuickFollow = async () => {
  const customer = selectedFollowCustomer.value
  if (!customer) {
    ElMessage.warning('请选择客户')
    return
  }
  if (!followForm.follow_content?.trim()) {
    ElMessage.warning('请输入跟进纪要')
    return
  }
  const payload = {
    follow_no: `FU${Date.now().toString().slice(-8)}`,
    customer_id: customer.id,
    customer_name: customer.name,
    contact_name: followForm.contact_name || customer.contact_name || '',
    follow_date: followForm.follow_date || todayText(),
    follow_type: followForm.follow_type || '电话沟通',
    follow_result: followForm.follow_result || '待跟进',
    next_follow_at: followForm.next_follow_at || null,
    owner_name: followForm.owner_name || customer.owner_name || '',
    follow_content: followForm.follow_content.trim(),
    status: 'active',
    properties: {
      来源: '快捷登记跟进'
    }
  }
  await request({
    url: '/sales_follow_ups',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: payload
  })
  await request({
    url: `/sales_customers?id=eq.${safeEq(customer.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: {
      last_follow_up_at: payload.follow_date,
      customer_status: payload.follow_result === '已成交' ? '已成交' : customer.customer_status
    }
  })
  ElMessage.success('客户跟进已创建')
}

const submitQuickDialog = async () => {
  if (!quickMode.value) return
  quickSubmitting.value = true
  try {
    if (quickMode.value === 'order') {
      await submitQuickOrder()
    } else if (quickMode.value === 'payment') {
      await submitQuickPayment()
    } else if (quickMode.value === 'opportunity') {
      await submitQuickOpportunity()
    } else if (quickMode.value === 'follow') {
      await submitQuickFollow()
    }
    quickDialogVisible.value = false
    if (gridRef.value?.loadData) await gridRef.value.loadData()
    if (selectedDetailRow.value) await refreshSelectedDetail()
  } catch (e) {
    console.error(e)
    ElMessage.error(getErrorMessage(e, '保存失败'))
  } finally {
    quickSubmitting.value = false
  }
}

const buildImportMeta = () => {
  if (app.value.key === 'customers') {
    return {
      importRequiredFields: ['name'],
      importDefaults: {
        level: '普通客户',
        customer_status: '跟进中',
        credit_limit: 0,
        receivable_balance: 0
      },
      importGeneratedFields: [
        { prop: 'customer_no', prefix: 'CUST-' }
      ],
      importTips: ['客户编码 customer_no 未提供时系统会自动生成。']
    }
  }

  if (app.value.key === 'orders') {
    return {
      importRequiredFields: ['customer_name', 'product_name'],
      importDefaults: {
        quantity: 1,
        unit: '箱',
        unit_price: 0,
        order_date: new Date().toISOString().slice(0, 10),
        order_status: '草稿'
      },
      importGeneratedFields: [
        { prop: 'order_no', prefix: 'SO-' }
      ],
      importTips: ['订单号 order_no 未提供时系统会自动生成。', 'total_amount 建议按 quantity * unit_price 填写。']
    }
  }

  if (app.value.key === 'payments') {
    return {
      importRequiredFields: ['customer_name', 'amount'],
      importDefaults: {
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: '银行转账',
        verify_status: '待核销'
      },
      importGeneratedFields: [
        { prop: 'payment_no', prefix: 'PAY-' }
      ],
      importTips: ['回款单号 payment_no 未提供时系统会自动生成。', 'amount 必须填写大于 0 的回款金额。']
    }
  }

  if (app.value.key === 'opportunities') {
    return {
      importRequiredFields: ['opportunity_name', 'customer_name'],
      importDefaults: {
        expected_amount: 0,
        stage: '初步接洽',
        probability: 20,
        expected_close_date: new Date().toISOString().slice(0, 10)
      },
      importGeneratedFields: [
        { prop: 'opportunity_no', prefix: 'OPP-' }
      ],
      importTips: ['商机编号 opportunity_no 未提供时系统会自动生成。', 'probability 表示成交概率，范围 0 到 100。']
    }
  }

  if (app.value.key === 'follow_ups') {
    return {
      importRequiredFields: ['customer_name', 'follow_content'],
      importDefaults: {
        follow_date: new Date().toISOString().slice(0, 10),
        follow_type: '电话沟通',
        follow_result: '待跟进'
      },
      importGeneratedFields: [
        { prop: 'follow_no', prefix: 'FU-' }
      ],
      importTips: ['跟进编号 follow_no 未提供时系统会自动生成。', 'next_follow_at 用于形成后续跟进待办。']
    }
  }

  return {}
}

const syncAiContext = (rows = lastLoadedRows.value, overrides = {}) => {
  const allStaticColumns = staticColumnsAll.value || []
  const columns = [...allStaticColumns, ...extraColumns.value].map(col => ({
    label: col.label,
    prop: col.prop,
    type: col.type || 'text',
    options: col.options || [],
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || null,
    expression: col.expression || ''
  }))
  const dataStats = enrichLoadedDataStats(buildDataStats(rows), lastGridLoadState.value, rows)
  const dataSample = buildDataSample(rows, columns, 40)
  const fileColumns = columns.filter(col => col.type === 'file')
  const importMeta = buildImportMeta()
  const apiUrl = app.value.writeUrl || normalizeApiBaseUrl(app.value.apiUrl)
  const dataScope = (overrides.searchText ?? lastSearchText.value) ? '当前搜索结果' : '当前列表数据'
  const importTarget = {
    apiUrl,
    profile: 'public',
    viewId: app.value.viewId,
    requiredFields: importMeta.importRequiredFields || [],
    defaults: importMeta.importDefaults || {},
    generatedFields: importMeta.importGeneratedFields || []
  }
  pushAiContext({
    app: 'sales',
    view: app.value.key,
    viewId: app.value.viewId,
    apiUrl,
    profile: 'public',
    columns,
    staticColumns: allStaticColumns,
    visibleStaticColumns: staticColumns.value,
    extraColumns: extraColumns.value,
    summaryConfig: summaryConfig.value,
    fileColumns,
    dataStats,
    dataSample,
    aiQuickActions: buildAiQuickActions(),
    dataScope,
    searchText: overrides.searchText ?? lastSearchText.value ?? '',
    gridAgent: buildGridAgentContext({
      app: 'sales',
      view: app.value.key,
      viewId: app.value.viewId,
      apiUrl,
      writeUrl: apiUrl,
      profile: 'public',
      contentProfile: 'public',
      defaultOrder: app.value.defaultOrder || 'id.desc',
      columns,
      staticColumns: allStaticColumns,
      extraColumns: extraColumns.value,
      summaryConfig: summaryConfig.value,
      searchText: overrides.searchText ?? lastSearchText.value ?? '',
      dataScope,
      loadState: lastGridLoadState.value,
      allowImport: overrides.allowImport !== undefined ? overrides.allowImport : true,
      importTarget,
      summaryScope: summaryScope.value
    }),
    aiScene: overrides.aiScene || 'grid_chat',
    allowFormula: !!overrides.allowFormula,
    allowFormulaOnce: !!overrides.allowFormulaOnce,
    allowImport: overrides.allowImport !== undefined ? overrides.allowImport : true,
    ...importMeta,
    importTarget
  })
}

const saveColumnsConfig = async () => {
  const configKey = app.value.configKey || 'sales_customers_cols'
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: extraColumns.value }
  })
}

const syncFieldAclForColumns = async (columnProps = null) => {
  const moduleName = app.value.aclModule
  if (!moduleName) return
  if (hasSyncedFieldAcl.value && !columnProps) return
  const props = Array.isArray(columnProps) && columnProps.length
    ? columnProps
    : [...staticColumnsAll.value, ...extraColumns.value].map(col => col.prop).filter(Boolean)
  if (props.length === 0) return
  const uniqueProps = Array.from(new Set(props))
  try {
    await request({
      url: '/rpc/ensure_field_acl',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { module_name: moduleName, field_codes: uniqueProps }
    })
    if (!columnProps) hasSyncedFieldAcl.value = true
  } catch (e) {
    console.warn('sync field acl failed', e)
  }
}

const syncFieldLabels = async () => {
  const moduleName = app.value.aclModule
  if (!moduleName) return
  const cols = [...staticColumnsAll.value, ...extraColumns.value]
  const payload = cols
    .filter(col => col?.prop && col?.label)
    .map(col => ({
      module: moduleName,
      field_code: col.prop,
      field_label: col.label
    }))
  if (payload.length === 0) return
  try {
    await request({
      url: '/field_label_overrides',
      method: 'post',
      headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: payload
    })
    fieldLabelWarned = false
  } catch (e) {
    console.warn('sync field labels failed', e)
    if (!fieldLabelWarned) {
      fieldLabelWarned = true
      ElMessage.warning('列权限名称同步失败，正在重试...')
    }
    if (!fieldLabelRetryTimer) {
      fieldLabelRetryTimer = setTimeout(() => {
        fieldLabelRetryTimer = null
        syncFieldLabels()
      }, 2000)
    }
  }
}

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

const buildFormulaPrompt = () => {
  const label = currentCol.label || '计算列'
  const variables = allAvailableColumns.value.map(col => col.label).join('、')
  return [
    '请帮我生成表格“自动计算”公式。',
    `目标列：${label}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{数量}*{单价}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

const openAiFormula = () => {
  syncAiContext(lastLoadedRows.value, { aiScene: 'column_formula', allowFormulaOnce: true })
  pushAiCommand({
    id: `formula_${Date.now()}`,
    type: 'open-worker',
    prompt: buildFormulaPrompt()
  })
}

const openAssistantWithPrompt = (prompt, scene = 'grid_chat', options = {}) => {
  syncAiContext(lastLoadedRows.value, {
    aiScene: scene,
    allowImport: options.allowImport !== undefined ? options.allowImport : true
  })
  pushAiCommand({
    id: `sales_${app.value.key}_${scene}_${Date.now()}`,
    type: 'open-worker',
    prompt
  })
}

const buildImportTemplatePrompt = () => {
  const importMeta = buildImportMeta()
  const columns = [...staticColumns.value, ...extraColumns.value]
    .map(col => `${col.label}(${col.prop})`)
    .join('、')
  return [
    `请为销售模块“${app.value.name}”生成 3 行演示导入数据。`,
    '必须输出 ```data-import``` 代码块，不要输出其他格式。',
    `可用字段：${columns || '无'}。`,
    `必填字段：${(importMeta.importRequiredFields || []).join('、') || '无'}。`,
    `可省略并由系统自动生成的字段：${(importMeta.importGeneratedFields || []).map(item => item.prop).join('、') || '无'}。`,
    `默认值：${JSON.stringify(importMeta.importDefaults || {})}。`
  ].join('\n')
}

const buildRiskPrompt = () => {
  const riskFocusMap = {
    customers: '请重点检查应收余额、信用额度、客户等级、客户状态和销售负责人。',
    follow_ups: '请重点检查逾期未跟进、下次跟进日期、跟进结果、负责人和客户意向。',
    opportunities: '请重点检查商机阶段、预计成交日期、预计金额、赢率、下次动作和负责人。',
    orders: '请重点检查订单状态、交付日期、订单金额、交付风险和销售负责人。',
    payments: '请重点检查核销状态、回款金额、回款方式、回款日期和经办人。'
  }
  return [
    `请基于当前“${app.value.name}”表格上下文，输出需要关注的销售风险。`,
    riskFocusMap[app.value.key] || '请重点检查异常状态、金额字段和负责人。',
    '输出要短，按“风险点、影响、建议动作”的结构给我。'
  ].join('\n')
}

const buildSummaryPrompt = () => {
  return [
    `请基于当前“${app.value.name}”表格上下文和 dataStats，输出一段业务统计摘要。`,
    '直接使用上下文里的统计值，不要编造表格里没有的数据。',
    '输出要适合在演示时口播，控制在 5 条以内。'
  ].join('\n')
}

const buildDemoPrompt = () => {
  return [
    `请帮我准备“${app.value.name}”页面的演示讲解话术。`,
    '说明这个页面能解决什么业务问题、可以怎么新增/编辑/导入数据、工作助手能帮什么。',
    '输出分步骤，语言要适合给客户现场演示。'
  ].join('\n')
}

const buildAiQuickActions = () => [
  {
    key: 'summary',
    label: '统计摘要',
    scene: 'sales_summary',
    prompt: buildSummaryPrompt()
  },
  {
    key: 'demo',
    label: '演示讲解',
    scene: 'sales_demo',
    prompt: buildDemoPrompt()
  },
  {
    key: 'importTemplate',
    label: '导入模板',
    scene: 'grid_import',
    prompt: buildImportTemplatePrompt()
  },
  {
    key: 'risk',
    label: '风险提醒',
    scene: 'sales_risk',
    prompt: buildRiskPrompt()
  }
]

const addSelectOption = () => {
  currentCol.options.push({ label: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

const handleViewDocument = (row) => {
  if (!row?.id) return
  selectedDetailRow.value = row
  detailDrawerVisible.value = true
  loadDetailRelations(row)
  syncAiContext(lastLoadedRows.value, { aiScene: 'record_detail', allowImport: false })
}

const handleRowAction = ({ action, row }) => {
  if (!action || action.disabled || !row) return
  if (action.key === 'create-order') {
    openOrderDialog(row)
    return
  }
  if (action.key === 'create-follow') {
    openFollowDialog(row)
    return
  }
  if (action.key === 'create-opportunity') {
    openOpportunityDialog(row)
    return
  }
  if (action.key === 'create-payment') {
    openPaymentDialog(row)
    return
  }
  if (action.key === 'push-purchase') {
    openSalesFlowDialogForRow(row, 'purchase_demand')
    return
  }
  if (action.key === 'push-shipment') {
    openSalesFlowDialogForRow(row, 'shipment_request')
    return
  }
  if (action.key === 'push-outbound') {
    openSalesFlowDialogForRow(row, 'sales_outbound')
  }
}

const openDetailAssistant = () => {
  if (!selectedDetailRow.value) return
  const prompt = [
    `请分析当前销售模块“${app.value.name}”记录。`,
    '请基于下面这条记录及关联记录，给出摘要、风险点和下一步建议。',
    buildDetailSummary()
  ].join('\n')
  openAssistantWithPrompt(prompt, 'record_detail', { allowImport: false })
}

const copyDetailSummary = async () => {
  const summary = buildDetailSummary()
  if (!summary) return
  try {
    await navigator.clipboard.writeText(summary)
    ElMessage.success('摘要已复制')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}

const resetDetailDrawer = () => {
  selectedDetailRow.value = null
  detailRelations.value = {}
  detailRelationsLoading.value = false
}

const scheduleGridReload = () => {
  if (realtimeTimer) return
  realtimeTimer = setTimeout(() => {
    realtimeTimer = null
    if (gridRef.value?.loadData) {
      gridRef.value.loadData()
    }
  }, 600)
}

const parseRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch (e) {
      return null
    }
  }
  return event.payload && typeof event.payload === 'object' ? event.payload : null
}

const handleRealtimeEvent = (event) => {
  const payload = parseRealtimePayload(event)
  if (!payload) return
  const tableName = normalizeApiBaseUrl(app.value.writeUrl || app.value.apiUrl).replace(/^\//, '')
  if (payload.schema === 'public' && payload.table === tableName) {
    scheduleGridReload()
  }
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({
        label: opt.label ?? opt.value ?? ''
      }))
    : []
  currentCol.dependsOn = col.dependsOn || ''
  currentCol.cascaderMap = normalizeCascaderMap(col.cascaderOptions)
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
  currentCol.geoAddress = col.geoAddress !== false
  currentCol.fileMaxSizeMb = col.fileMaxSizeMb || 20
  currentCol.fileMaxCount = col.fileMaxCount || 3
  currentCol.fileAccept = col.fileAccept || ''
  
  isEditing.value = true
  editingIndex.value = index
  
  if (col.type === 'formula') addTab.value = 'formula'
  else if (col.type === 'select' || col.type === 'dropdown') addTab.value = 'select'
  else if (col.type === 'cascader') addTab.value = 'cascader'
  else if (col.type === 'geo') addTab.value = 'geo'
  else if (col.type === 'file') addTab.value = 'file'
  else addTab.value = 'text'

  syncCascaderMap()
}

const resetForm = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentCol.label = ''
  currentCol.prop = ''
  currentCol.expression = ''
  currentCol.options = []
  currentCol.dependsOn = ''
  currentCol.cascaderMap = {}
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
  currentCol.geoAddress = true
  currentCol.fileMaxSizeMb = 20
  currentCol.fileMaxCount = 3
  currentCol.fileAccept = ''
  addTab.value = 'text'
  if (!colConfigVisible.value) {
    syncAiContext(lastLoadedRows.value, { aiScene: 'grid_chat', allowFormula: false })
  }
}

const getCascaderChildren = (key) => {
  const list = currentCol.cascaderMap[String(key)] || []
  return Array.isArray(list) ? list : []
}

const addCascaderChild = (key) => {
  const mapKey = String(key)
  const raw = cascaderInputMap[mapKey]
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  if (!text) return
  const list = currentCol.cascaderMap[mapKey] || []
  if (!list.includes(text)) {
    list.push(text)
  }
  currentCol.cascaderMap[mapKey] = list
  cascaderInputMap[mapKey] = ''
}

const removeCascaderChild = (key, child) => {
  const mapKey = String(key)
  const list = currentCol.cascaderMap[mapKey] || []
  currentCol.cascaderMap[mapKey] = list.filter(item => item !== child)
}

const normalizeCascaderMap = (map) => {
  const result = {}
  if (!map || typeof map !== 'object') return result
  Object.entries(map).forEach(([key, list]) => {
    if (!Array.isArray(list)) return
    const normalized = list
      .map(item => {
        if (item === null || item === undefined) return ''
        if (typeof item === 'string' || typeof item === 'number') return String(item)
        const label = item.label ?? item.value ?? ''
        return String(label)
      })
      .filter(Boolean)
    result[String(key)] = normalized
  })
  return result
}

const saveColumn = async () => {
  if (!currentCol.label) return
  
  const type = addTab.value
  
  const colConfig = {
    label: currentCol.label,
    type: type
  }

  if (isEditing.value) {
    colConfig.prop = currentCol.prop
  } else {
    colConfig.prop = 'field_' + Math.floor(Math.random() * 10000)
  }

  if (type === 'formula') {
    colConfig.expression = currentCol.expression
  } else if (type === 'select') {
    colConfig.type = 'select'
    const toText = (val) => (val === null || val === undefined) ? '' : String(val)
    const cleanOptions = currentCol.options
      .map(opt => {
        const text = toText(opt.label).trim()
        return {
          label: text,
          value: text
        }
      })
      .filter(opt => opt.label)
    if (cleanOptions.length === 0) {
      ElMessage.warning('请至少添加一个选项')
      return
    }
    colConfig.options = cleanOptions
  } else if (type === 'cascader') {
    if (!currentCol.dependsOn) {
      ElMessage.warning('请选择上一级列')
      return
    }
    const parentCol = cascaderParentColumns.value.find(col => col.prop === currentCol.dependsOn)
    if (!parentCol) {
      ElMessage.warning('上一级必须是下拉或联动列')
      return
    }
    colConfig.dependsOn = currentCol.dependsOn
    const cascaderOptions = {}
    cascaderParentOptions.value.forEach((opt) => {
      const valueKey = String(opt.value)
      const labelKey = String(opt.label)
      const list = currentCol.cascaderMap[valueKey] || currentCol.cascaderMap[labelKey] || []
      const normalizedList = list.map(item => ({ label: item, value: item }))
      cascaderOptions[valueKey] = normalizedList
      if (labelKey !== valueKey && !(labelKey in cascaderOptions)) {
        cascaderOptions[labelKey] = normalizedList
      }
    })
    const hasAny = Object.values(cascaderOptions).some(list => Array.isArray(list) && list.length > 0)
    if (!hasAny) {
      ElMessage.warning('请至少给一个上一级配置下级选项')
      return
    }
    colConfig.cascaderOptions = cascaderOptions
  } else if (type === 'geo') {
    colConfig.geoAddress = !!currentCol.geoAddress
  } else if (type === 'file') {
    colConfig.fileMaxSizeMb = Math.max(1, Number(currentCol.fileMaxSizeMb) || 20)
    colConfig.fileMaxCount = Math.max(1, Number(currentCol.fileMaxCount) || 3)
    colConfig.fileAccept = currentCol.fileAccept?.trim() || ''
  }

  const previousColumns = cloneColumns(extraColumns.value)
  const wasEditing = isEditing.value
  try {
    if (wasEditing) {
      extraColumns.value[editingIndex.value] = colConfig
    } else {
      extraColumns.value.push(colConfig)
    }
    await saveColumnsConfig()
    ElMessage.success(wasEditing ? '列配置已更新' : '列已添加')
    // 配置初始化与列权限同步已移至后端/SQL 脚本
    syncAiContext()
    resetForm()
  } catch (e) {
    extraColumns.value = previousColumns
    ElMessage.error(getErrorMessage(e, '列配置保存失败'))
  }
}

const removeColumn = async (index) => {
  const previousColumns = cloneColumns(extraColumns.value)
  extraColumns.value.splice(index, 1)
  try {
    await saveColumnsConfig()
    syncAiContext()
    if (isEditing.value && editingIndex.value === index) {
      resetForm()
    }
    ElMessage.success('列已删除')
  } catch (e) {
    extraColumns.value = previousColumns
    ElMessage.error(getErrorMessage(e, '列配置保存失败'))
  }
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const isStaticVisible = (prop) => !staticHidden.value.includes(prop)
const toggleStaticColumn = async (prop, visible) => {
  const previousHidden = [...staticHidden.value]
  const has = staticHidden.value.includes(prop)
  if (visible && has) {
    staticHidden.value = staticHidden.value.filter(item => item !== prop)
  }
  if (!visible && !has) {
    staticHidden.value = [...staticHidden.value, prop]
  }
  try {
    await saveStaticColumnsConfig()
    syncAiContext()
  } catch (e) {
    staticHidden.value = previousHidden
    ElMessage.error(getErrorMessage(e, '固定列配置保存失败'))
  }
}

const handleCreate = async () => {
  if (app.value.key === 'orders') {
    await openOrderDialog()
    return
  }
  if (app.value.key === 'opportunities') {
    await openOpportunityDialog()
    return
  }
  if (app.value.key === 'follow_ups') {
    await openFollowDialog()
    return
  }
  if (app.value.key === 'payments') {
    await openPaymentDialog()
    return
  }
  try {
    const payload = typeof app.value.createPayload === 'function'
      ? app.value.createPayload()
      : { name: '新记录', properties: {} }
    await request({
      url: app.value.writeUrl || normalizeApiBaseUrl(app.value.apiUrl),
      method: 'post',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data: payload
    })
    if(gridRef.value) await gridRef.value.loadData()
    ElMessage.success('已创建新行')
  } catch(e) {
    console.error(e)
    ElMessage.error(getErrorMessage(e, '创建失败'))
  }
}

const goApps = () => {
  router.push('/apps')
}

watch(selectedQuickCustomer, (customer) => {
  if (!customer || quickMode.value !== 'order') return
  if (!orderForm.owner_name) orderForm.owner_name = customer.owner_name || ''
})

watch(selectedQuickBomProduct, (material) => {
  if (!material || quickMode.value !== 'order') return
  orderForm.product_name = material.parent_material_name || orderForm.product_name
  orderForm.unit = material.unit || orderForm.unit || '盒'
})

watch(selectedFollowCustomer, (customer) => {
  if (!customer || quickMode.value !== 'follow') return
  followForm.contact_name = customer.contact_name || followForm.contact_name || ''
  if (!followForm.owner_name) followForm.owner_name = customer.owner_name || ''
})

watch(selectedOpportunityCustomer, (customer) => {
  if (!customer || quickMode.value !== 'opportunity') return
  if (!opportunityForm.opportunity_name) opportunityForm.opportunity_name = `${customer.name} 新商机`
  if (!opportunityForm.owner_name) opportunityForm.owner_name = customer.owner_name || ''
})

watch(selectedQuickOrder, (order) => {
  if (!order || quickMode.value !== 'payment') return
  paymentForm.customer_name = order.customer_name || ''
  if (!paymentForm.handler_name) paymentForm.handler_name = order.owner_name || ''
  const remain = selectedQuickOrderRemainAmount.value
  if (remain > 0) paymentForm.amount = remain
  paymentForm.verify_status = remain > 0 && remain <= toAmount(paymentForm.amount) ? '已核销' : '部分核销'
})

watch(() => paymentForm.amount, (amount) => {
  const order = selectedQuickOrder.value
  if (!order || quickMode.value !== 'payment') return
  const totalAfterPayment = selectedQuickOrderPaidAmount.value + toAmount(amount)
  paymentForm.verify_status = totalAfterPayment >= toAmount(order.total_amount) ? '已核销' : '部分核销'
})

watch([attentionFilter, gridApiUrl], () => {
  gridRef.value?.loadData?.()
})
 
onMounted(() => {
  loadStaticColumnsConfig().then(loadColumnsConfig)
  if (enableRealtime.value) {
    const realtime = getRealtimeClient()
    realtimeUnsub = realtime.subscribe(handleRealtimeEvent)
  }
})

const handleApplyFormula = (event) => {
  const formula = event?.detail?.formula
  if (!formula) return
  if (!colConfigVisible.value || addTab.value !== 'formula') return
  currentCol.expression = formula
}

const handleImportDone = (event) => {
  const viewId = event?.detail?.viewId
  if (viewId && viewId !== app.value.viewId) return
  if (gridRef.value && typeof gridRef.value.loadData === 'function') {
    gridRef.value.loadData()
  }
}

onMounted(() => {
  window.addEventListener('eis-ai-apply-formula', handleApplyFormula)
  window.addEventListener('eis-grid-imported', handleImportDone)
})

onUnmounted(() => {
  window.removeEventListener('eis-ai-apply-formula', handleApplyFormula)
  window.removeEventListener('eis-grid-imported', handleImportDone)
  if (realtimeUnsub) realtimeUnsub()
  realtimeUnsub = null
  if (realtimeTimer) {
    clearTimeout(realtimeTimer)
    realtimeTimer = null
  }
  if (fieldLabelRetryTimer) {
    clearTimeout(fieldLabelRetryTimer)
    fieldLabelRetryTimer = null
  }
})
</script>

<style scoped>
.app-container {
  padding: 20px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.attention-filter {
  flex: 0 0 auto;
}

.attention-filter :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  line-height: 1;
}

.grid-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.detail-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-section {
  margin-top: 2px;
}

.detail-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-block-title {
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(108px, 1fr));
  gap: 8px;
}

.metric-item {
  min-width: 0;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #f8fafc;
}

.metric-item span {
  display: block;
  font-size: 12px;
  color: #909399;
}

.metric-item strong {
  display: block;
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  color: #303133;
}

.quick-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 12px;
}

.quick-form-row:has(.el-form-item:nth-child(3)) {
  grid-template-columns: 1fr 120px 1fr;
}

.quick-form :deep(.el-input-number) {
  width: 100%;
}

.amount-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 13px;
  color: #606266;
}

.amount-preview strong {
  font-size: 18px;
  color: #303133;
}

.quick-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin: -4px 0 16px 96px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #f8fafc;
}

.quick-info div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quick-info span {
  font-size: 12px;
  color: #909399;
}

.quick-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #303133;
}
	
.column-manager { padding: 0 5px; }
.section-title { font-weight: bold; margin-bottom: 10px; color: #303133; font-size: 14px; }
.empty-tip { color: #909399; font-size: 12px; margin-bottom: 10px; font-style: italic; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

.col-list { 
  max-height: 180px; 
  overflow-y: auto; 
  margin-bottom: 20px; 
  border: 1px solid #ebeef5; 
  padding: 5px; 
  border-radius: 4px; 
  background-color: #fafafa;
}
.col-item { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 6px 10px; 
  border-bottom: 1px solid #ebeef5; 
  background-color: #fff;
}
.col-item:last-child { border-bottom: none; }
.col-info { display: flex; align-items: center; }
.col-label { font-size: 13px; font-weight: 500; }
.col-actions { display: flex; align-items: center; }

.add-tabs { margin-top: 5px; box-shadow: none; border: 1px solid #dcdfe6; }
.form-row { display: flex; gap: 10px; }
.form-col { display: flex; flex-direction: column; }

.field-block { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.field-label { font-size: 12px; color: #606266; }
.field-block .el-input-number { width: 100%; }

.formula-area { 
  background-color: #f5f7fa; 
  padding: 10px; 
  border-radius: 4px; 
  border: 1px solid #dcdfe6; 
}
.formula-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.formula-tip {
  font-size: 12px;
  color: #909399;
}
.options-config {
  margin-top: 8px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}
.option-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.add-opt-btn { width: 100%; }
.cascader-map {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.cascader-node {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
}
.cascader-parent-row {
  display: inline-block;
  margin-bottom: 6px;
}
.cascader-parent {
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  padding: 6px 8px;
  border-radius: 4px;
  text-align: center;
  border: 1px solid #e4e7ed;
}
.cascader-children {
  padding-left: 12px;
  border-left: 2px dashed #e4e7ed;
}
.cascader-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.cascader-add {
  display: flex;
  gap: 8px;
  align-items: center;
}
.cascader-add :deep(.el-input) { flex: 1; }
.variable-tags { margin-top: 8px; }
.tag-tip { font-size: 12px; color: #909399; display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.cursor-pointer:hover { opacity: 0.8; transform: translateY(-1px); transition: transform 0.1s; }

.hint-text { font-size: 12px; color: #909399; margin-top: 8px; line-height: 1.4; }

.business-flow-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.flow-push-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #f8fafc;
}

.flow-push-header span {
  color: #606266;
  font-size: 13px;
  margin-right: 8px;
}

.flow-push-header strong {
  color: #303133;
  font-size: 18px;
}

.flow-chain {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.flow-step {
  position: relative;
  min-height: 86px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px;
}

.flow-step:not(:last-child)::after {
  content: "→";
  position: absolute;
  right: -18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--el-color-primary);
  font-weight: 700;
}

.flow-step.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.flow-step.current {
  border-color: #67c23a;
  background: #f0f9eb;
}

.step-type {
  font-size: 12px;
  color: #909399;
}

.flow-step strong {
  font-size: 15px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-step small {
  color: #606266;
}

.flow-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.flow-doc-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.flow-doc-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  min-width: 0;
}

.flow-doc-card span,
.flow-doc-card small {
  display: block;
  color: #909399;
  font-size: 12px;
}

.flow-doc-card strong {
  display: block;
  margin: 5px 0;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .app-container {
    padding: 12px;
  }

  .app-header {
    align-items: stretch;
    flex-direction: column;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .quick-form-row,
  .quick-form-row:has(.el-form-item:nth-child(3)),
  .quick-info,
  .metric-grid,
  .flow-chain,
  .flow-doc-panel {
    grid-template-columns: 1fr;
  }

  .quick-info {
    margin-left: 0;
  }
}
</style>
