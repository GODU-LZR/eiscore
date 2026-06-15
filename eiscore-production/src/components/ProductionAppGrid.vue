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
        :write-mode="app.writeMode || 'patch'"
        :patch-required-fields="app.patchRequiredFields || []"
        :field-defaults="app.fieldDefaults || {}"
        :default-order="app.defaultOrder || defaultOrder"
        accept-profile="scm"
        content-profile="scm"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        :acl-module="app.aclModule"
        :show-status-col="app.showStatusCol !== false"
        :show-action-col="app.showActionCol !== false"
        :attention-resolver="resolveAttention"
        :row-action-resolver="resolveRowActions"
        :row-filter="rowAttentionFilter"
        :summary-scope="summaryScope"
        :initial-search="initialSearch"
        :can-create="canCreateRows"
        :can-edit="canEditRows"
        :can-delete="canDeleteRows"
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
        @cell-value-changed="handleGridCellValueChanged"
        @data-load-error="handleDataLoadError"
        @data-loaded="handleDataLoaded"
        @selection-changed="handleSelectionChanged"
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
            v-if="app.key === 'bom_list'"
            data-sop-action="production-open-bom-workbench"
            data-sop-title="打开配方工作台"
            data-sop-desc="进入配方工作台维护产品 BOM、用量和工艺相关资料。"
            data-sop-steps="先确认当前应用是产品配方|点击打开配方工作台|选择产品或配方版本|维护物料用量、单位、损耗和备注|保存后回到生产建议或工单复核用料"
            data-sop-risk="配方错误会影响领料、成本和生产数量，保存前必须复核版本和物料编码。"
            type="primary"
            plain
            icon="Connection"
            @click="openBomWorkbench"
          >
            打开配方工作台
          </el-button>
          <el-button
            v-if="app.key === 'plans' && canGenerateWorkOrder"
            data-sop-action="production-generate-work-orders"
            data-sop-title="生产建议生成生产工单"
            data-sop-desc="把生产建议批量生成或更新生产工单。"
            data-sop-steps="先筛选待生成工单或紧急生产建议|复核产品、计划数量、交付日期、BOM 和优先级|点击生成/更新生产工单|生成后进入生产工单应用搜索并复核工单状态"
            data-sop-risk="工单会驱动领料、生产检验和入库。数量、BOM 或交期错误会影响后续全流程。"
            type="success"
            plain
            icon="Plus"
            :loading="generatingWorkOrders"
            @click="createWorkOrdersFromPlan"
          >
            生成/更新生产工单
          </el-button>
          <el-button
            v-if="app.key === 'work_orders' && canEditRows"
            data-sop-action="production-edit-work-order"
            data-sop-title="处理生产工单"
            data-sop-desc="打开生产工单处理抽屉，维护状态、优先级、计划数量和排产日期。"
            data-sop-steps="先只选中一张生产工单|复核工单号、产品、计划数量、优先级和交期|点击处理工单打开抽屉|维护工单状态、计划日期和备注|保存后检查关注等级是否下降"
            data-sop-risk="工单状态会影响生产执行、领料、检验和入库，不要批量误改。"
            type="primary"
            plain
            icon="Edit"
            :disabled="selectedRows.length !== 1"
            @click="openWorkOrderDrawer()"
          >
            处理工单
          </el-button>
          <el-button
            v-if="app.key === 'work_orders' && canEditRows"
            data-sop-action="production-push-work-order"
            data-sop-title="生产工单业务下推"
            data-sop-desc="把生产工单下推到生产检验或生产入库等后续环节。"
            data-sop-steps="先勾选需要下推的生产工单|复核工单状态、计划数量、完工数量和质量要求|点击业务下推打开确认窗|选择下一环节并确认|跳转后复核生成单据"
            data-sop-risk="业务下推会生成后续单据。未生产、未检验或数量不正确的工单不要直接下推。"
            type="success"
            plain
            icon="Position"
            :disabled="selectedRows.length < 1"
            :loading="flowActionLoading"
            @click="openWorkOrderPushFlowDialog"
          >
            业务下推
          </el-button>
          <el-button
            v-if="app.key === 'work_order_items' && canEditRows"
            data-sop-action="production-register-issue"
            data-sop-title="登记领料"
            data-sop-desc="打开领料登记抽屉，记录工单用料实际领用数量。"
            data-sop-steps="先只选中一条工单用料明细|复核物料编码、需求数量、已领数量和库存情况|点击登记领料打开抽屉|填写本次领料数量和备注|保存后复核缺料数量和领料状态"
            data-sop-risk="领料数量会影响库存和生产成本。批次、数量或物料错误会造成账实不符。"
            type="primary"
            plain
            icon="EditPen"
            :disabled="selectedRows.length !== 1"
            @click="openIssueDrawer()"
          >
            登记领料
          </el-button>
          <el-button
            v-if="app.key === 'work_order_items' && canEditRows"
            data-sop-action="production-push-issue-outbound"
            data-sop-title="领料明细下推出库"
            data-sop-desc="把已确认的工单用料明细下推到仓储出库。"
            data-sop-steps="先勾选需要出库的工单用料明细|复核物料、需求数量、已领数量、缺料数量、仓库和批次|点击下推领料出库打开确认窗|确认后跳转仓储出库复核出库单"
            data-sop-risk="出库会影响库存账。缺料、批次不清或数量未确认时不要直接下推。"
            type="warning"
            plain
            icon="Position"
            :disabled="selectedRows.length < 1"
            :loading="flowActionLoading"
            @click="openIssuePushFlowDialog"
          >
            下推领料出库
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
                <el-input v-model="currentCol.label" placeholder="列名（比如：班组）" @keyup.enter="saveColumn" />
                <el-button type="primary" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存放普通文字、数字或日期。</p>
            </el-tab-pane>

            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：产线）" style="margin-bottom: 10px;" />
                <div class="options-config">
                  <div v-for="(opt, idx) in currentCol.options" :key="idx" class="option-row">
                    <el-input v-model="opt.label" placeholder="选项内容" style="flex: 1;" />
                    <el-button type="danger" link @click="removeSelectOption(idx)">删除</el-button>
                  </div>
                  <el-button class="add-opt-btn" type="primary" plain size="small" @click="addSelectOption">+ 添加一项</el-button>
                </div>
                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加下拉列' }}
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：工序）" style="margin-bottom: 10px;" />

                <el-select
                  v-model="currentCol.dependsOn"
                  placeholder="先选哪一列（下拉或联动都可以）"
                  filterable
                  style="width: 100%; margin-bottom: 10px;"
                >
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

                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加联动列' }}
                </el-button>
                <p class="hint-text">上面改了，下面会自动清空，避免选错。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="地图位置" name="geo">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：生产位置）" style="margin-bottom: 10px;" />
                <el-switch v-model="currentCol.geoAddress" active-text="同时记录地址" inactive-text="只记经纬度" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加地图列' }}
                </el-button>
                <p class="hint-text">后面可在地图上点选位置。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="文件" name="file">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：工艺附件）" style="margin-bottom: 10px;" />
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
                <el-input v-model="currentCol.fileAccept" placeholder="允许格式（可不写，比如 .pdf,.xlsx,image/*）" style="margin-top: 10px;" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加文件列' }}
                </el-button>
                <p class="hint-text">可上传工艺图纸、作业指导书、质检记录等文件。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="自动计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：完成率）" style="margin-bottom: 10px;" />
                <div class="formula-area">
                  <div class="formula-actions">
                    <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
                    <span class="formula-tip">把需求告诉工作助手，自动生成复杂公式</span>
                  </div>
                  <el-input
                    v-model="currentCol.expression"
                    type="textarea"
                    :rows="3"
                    placeholder="写计算方法（比如：{已领数量}/{需求数量}）"
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
                <el-button type="warning" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label || !currentCol.expression" @click="saveColumn">
                  {{ isEditing ? '保存计算修改' : '添加计算列' }}
                </el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        <template #footer>
          <el-button @click="colConfigVisible = false">关闭</el-button>
        </template>
      </el-dialog>

      <el-drawer
        v-model="workOrderDrawer.visible"
        title="处理生产工单"
        size="430px"
        append-to-body
        destroy-on-close
      >
        <div v-if="activeWorkOrder" class="business-drawer" data-guide="form-wrapper">
          <div class="drawer-summary">
            <span>当前工单</span>
            <strong>{{ activeWorkOrder.work_order_no }}</strong>
            <em>{{ activeWorkOrder.product_material_name || activeWorkOrder.product_material_code }}</em>
          </div>
          <el-form :model="workOrderDrawer.form" label-width="96px" class="business-form" data-guide="form-fields">
            <el-form-item label="工单状态">
              <el-select v-model="workOrderDrawer.form.work_order_status" style="width: 100%">
                <el-option v-for="item in workOrderStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="workOrderDrawer.form.priority" style="width: 100%">
                <el-option v-for="item in priorityOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="计划数量">
              <el-input-number v-model="workOrderDrawer.form.planned_qty" :min="0" :precision="3" controls-position="right" style="width: 100%" />
            </el-form-item>
            <el-form-item label="单位">
              <el-input v-model.trim="workOrderDrawer.form.unit" placeholder="盒/箱/千克" />
            </el-form-item>
            <el-form-item label="计划开始">
              <el-date-picker v-model="workOrderDrawer.form.planned_start_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="计划完成">
              <el-date-picker v-model="workOrderDrawer.form.planned_finish_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="workOrderDrawer.form.remark" type="textarea" :rows="4" placeholder="写清楚排产说明、异常原因或交付要求" />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <div data-guide="form-actions">
          <el-button @click="workOrderDrawer.visible = false">取消</el-button>
          <el-button type="primary" :loading="workOrderDrawer.saving" @click="saveWorkOrder">
            保存工单
          </el-button>
          </div>
        </template>
      </el-drawer>

      <el-drawer
        v-model="issueDrawer.visible"
        title="登记领料"
        size="430px"
        append-to-body
        destroy-on-close
      >
        <div v-if="activeIssueRow" class="business-drawer" data-guide="form-wrapper">
          <div class="drawer-summary">
            <span>当前用料</span>
            <strong>{{ activeIssueRow.component_material_name || activeIssueRow.component_material_code }}</strong>
            <em>{{ activeIssueRow.work_order_no }} · 需求 {{ formatQty(activeIssueRow.required_qty) }} {{ activeIssueRow.unit }}</em>
          </div>
          <el-form :model="issueDrawer.form" label-width="96px" class="business-form" data-guide="form-fields">
            <el-form-item label="需求数量">
              <el-input :model-value="`${formatQty(activeIssueRow.required_qty)} ${activeIssueRow.unit || ''}`" disabled />
            </el-form-item>
            <el-form-item label="已领数量">
              <el-input-number v-model="issueDrawer.form.issued_qty" :min="0" :precision="3" controls-position="right" style="width: 100%" />
            </el-form-item>
            <el-form-item label="缺料数量">
              <el-input :model-value="`${formatQty(issueShortageQty)} ${activeIssueRow.unit || ''}`" disabled />
            </el-form-item>
            <el-form-item label="领料状态">
              <el-select v-model="issueDrawer.form.issue_status" style="width: 100%">
                <el-option v-for="item in issueStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="issueDrawer.form.remark" type="textarea" :rows="4" placeholder="记录领料批次、缺料原因或补料说明" />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <div data-guide="form-actions">
          <el-button @click="issueDrawer.visible = false">取消</el-button>
          <el-button type="primary" :loading="issueDrawer.saving" @click="saveIssue">
            保存领料
          </el-button>
          </div>
        </template>
      </el-drawer>

      <el-dialog
        v-model="flowDialogVisible"
        title="生产业务流程"
        width="920px"
        append-to-body
        destroy-on-close
        @closed="resetFlowDialog"
      >
        <div
          class="business-flow-dialog"
          data-guide="flow-wrapper"
          data-sop-flow="production-flow-push"
          data-sop-title="生产业务下推流程"
          data-sop-desc="按生产工单、质量检验、生产入库、领料出库的链路完成生产单据流转。"
          data-sop-steps="先勾选可流转的生产工单或领料明细|确认下一环节和已选数量|检查单据链路是否已有下游记录|阅读库存和质检限制|点击确认下推并跳转|到下游应用搜索单号复核状态"
          data-sop-risk="生产下推会影响质量检验、库存出入库和生产闭环。未生产、未检验、数量不清或批次不清时不要直接下推。"
          v-loading="flowLoading"
        >
          <div class="flow-push-header" data-guide="flow-selection">
            <div>
              <span>{{ flowSelectedLabel }}</span>
              <strong>{{ flowSelectedRows.length }}</strong>
            </div>
            <el-radio-group v-model="flowNextStep" size="small">
              <el-radio-button
                v-for="option in flowNextStepOptions"
                :key="option.value"
                :label="option.value"
              >
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <div class="flow-chain" data-guide="flow-chain">
            <div
              v-for="node in productionFlowNodes"
              :key="node.key"
              class="flow-step"
              :class="{ active: !!node.docNo, current: node.current }"
            >
              <span class="step-type">{{ node.type }}</span>
              <strong>{{ node.docNo || '未生成' }}</strong>
              <small>{{ node.status || '待流转' }}</small>
            </div>
          </div>

          <el-alert
            class="flow-tip"
            data-guide="flow-risk"
            title="生产检验会创建质量检验单；生产领料和生产入库先生成跨模块链路，实际库存过账仍需在仓储单据补充仓库、库位和批次后执行。"
            type="info"
            show-icon
            :closable="false"
          />

          <div class="flow-actions" data-guide="flow-actions">
            <el-button
              data-guide="flow-confirm"
              data-sop-action="production-confirm-flow-push"
              data-sop-title="确认生产下推并跳转"
              data-sop-desc="确认当前生产单据链路，并生成质量检验、生产入库或领料出库链路。"
              data-sop-steps="复核已选工单或用料明细数量|确认下一环节是否正确|查看链路中是否已有下游单据|点击确认下推并跳转|跳转后搜索新单据并复核状态"
              data-sop-risk="确认后会生成或关联下游单据，错误下推会影响质量检验、库存出入库和生产闭环。"
              type="success"
              :loading="flowActionLoading"
              @click="confirmProductionPush"
            >
              确认下推并跳转
            </el-button>
          </div>

          <div class="flow-doc-panel">
            <div class="flow-doc-card">
              <span>{{ flowPrimaryLabel }}</span>
              <strong>{{ flowPrimaryDocNo }}</strong>
              <small>{{ flowPrimarySummary }}</small>
            </div>
            <div class="flow-doc-card">
              <span>当前链路节点</span>
              <strong>{{ app.name }}</strong>
              <small>{{ app.key === 'work_order_items' ? '工单用料明细' : '生产工单' }}</small>
            </div>
            <div class="flow-doc-card">
              <span>{{ flowDownstreamLabel }}</span>
              <strong>{{ flowDownstreamDocNo }}</strong>
              <small>{{ flowDownstreamStatus }}</small>
            </div>
          </div>
        </div>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { pushAiCommand, pushAiContext } from '@/utils/ai-context'
import { buildGridAgentContext, buildGridLoadState, enrichLoadedDataStats } from '@shared/eis-grid-agent-context'
import GridCompactFilter from '@shared/eis-grid-compact-filter.vue'
import { useEisGridAppFilters } from '@shared/use-eis-grid-app-filters'
import {
  findProductionApp,
  ISSUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  WORK_ORDER_COLUMNS,
  WORK_ORDER_STATUS_OPTIONS
} from '@/utils/production-apps'
import {
  buildProductionAttentionSummary,
  getProductionRecordAttention,
  matchesProductionAttentionFilter
} from '@/utils/production-attention'
import { hasPerm } from '@/utils/permission'

const props = defineProps({
  appKey: { type: String, default: 'work_orders' },
  appConfig: { type: Object, default: null }
})

const router = useRouter()
const route = useRoute()
const gridRef = ref(null)
const lastLoadedRows = ref([])
const lastSearchText = ref('')
const lastGridLoadState = ref(buildGridLoadState())
const attentionFilter = ref('all')
const colConfigVisible = ref(false)
const extraColumns = ref([])
const staticHidden = ref([])
const addTab = ref('text')
const isEditing = ref(false)
const editingIndex = ref(-1)
const generatingWorkOrders = ref(false)
const selectedRows = ref([])
const flowDialogVisible = ref(false)
const flowLoading = ref(false)
const flowActionLoading = ref(false)
const flowSelectedRows = ref([])
const flowNextStep = ref('quality_inspection')
const flowDocs = ref({})
const flowLinks = ref([])
const flowSourceMode = ref('work_orders')

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

const workOrderStatusOptions = WORK_ORDER_STATUS_OPTIONS
const priorityOptions = PRIORITY_OPTIONS
const issueStatusOptions = ISSUE_STATUS_OPTIONS
const DOC_TYPES = Object.freeze({
  PRODUCTION_PLAN: 'production_order',
  WORK_ORDER: 'work_order',
  WORK_ORDER_ITEM: 'work_order_item',
  QUALITY_INSPECTION: 'quality_inspection',
  INVENTORY_INBOUND: 'inventory_inbound',
  INVENTORY_OUTBOUND: 'inventory_outbound'
})
const RELATION_TYPES = Object.freeze({
  PRODUCTION_PLAN_TO_WORK_ORDER: 'production_plan_to_work_order',
  WORK_ORDER_TO_ISSUE: 'work_order_to_issue',
  WORK_ORDER_TO_QUALITY_INSPECTION: 'work_order_to_quality_inspection',
  WORK_ORDER_TO_PRODUCTION_INBOUND: 'work_order_to_production_inbound',
  WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND: 'work_order_item_to_material_outbound'
})

const workOrderDrawer = reactive({
  visible: false,
  saving: false,
  row: null,
  form: {
    work_order_status: '待排产',
    priority: '普通',
    planned_qty: 0,
    unit: '',
    planned_start_date: '',
    planned_finish_date: '',
    remark: ''
  }
})

const issueDrawer = reactive({
  visible: false,
  saving: false,
  row: null,
  form: {
    issued_qty: 0,
    shortage_qty: 0,
    issue_status: '未领料',
    remark: ''
  }
})

const app = computed(() => props.appConfig || findProductionApp(props.appKey) || findProductionApp('work_orders'))
const initialSearch = computed(() => String(route.query.q || ''))
const defaultOrder = computed(() => {
  if (app.value.key === 'plans') return 'product_material_code.asc'
  if (app.value.key === 'work_order_items') return 'work_order_no.asc,line_no.asc'
  return 'created_at.desc'
})
const opPerms = computed(() => app.value?.ops || {})
const canGenerateWorkOrder = computed(() => hasPerm('op:production_work_order.create'))
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))
const canCreateRows = computed(() => app.value.canCreateRows !== false && canCreate.value)
const canEditRows = computed(() => app.value.canEditRows !== false && canEdit.value)
const canDeleteRows = computed(() => app.value.canDeleteRows !== false && canDelete.value)
const canPushWorkOrder = computed(() => app.value.key === 'work_orders' && canEditRows.value)
const canPushIssue = computed(() => app.value.key === 'work_order_items' && canEditRows.value)

const staticColumnsAll = computed(() => app.value.staticColumns || WORK_ORDER_COLUMNS)
const staticColumns = computed(() => staticColumnsAll.value.filter(col => !staticHidden.value.includes(col.prop)))
const summaryConfig = computed(() => app.value.summaryConfig || { label: '总计', rules: {}, expressions: {} })
const activeWorkOrder = computed(() => workOrderDrawer.row)
const activeIssueRow = computed(() => issueDrawer.row)
const flowPrimaryRow = computed(() => flowSelectedRows.value[0] || null)
const isIssueFlow = computed(() => flowSourceMode.value === 'work_order_items' || app.value.key === 'work_order_items')
const flowSelectedLabel = computed(() => (isIssueFlow.value ? '已选择领料明细' : '已选择生产工单'))
const flowNextStepOptions = computed(() => {
  if (isIssueFlow.value) {
    return [{ label: '生产领料出库', value: 'material_outbound' }]
  }
  return [
    { label: '生产检验', value: 'quality_inspection' },
    { label: '生产入库', value: 'production_inbound' }
  ]
})
const productionFlowNodes = computed(() => {
  const row = flowPrimaryRow.value || {}
  const docs = flowDocs.value || {}
  const workOrderNo = row.work_order_no || docs.workOrder?.work_order_no
  return [
    { key: 'wo', type: '生产工单', docNo: workOrderNo, status: row.work_order_status || docs.workOrder?.work_order_status, current: !isIssueFlow.value },
    { key: 'issue', type: '生产领料', docNo: docs.materialOutbound?.outbound_no || docs.materialOutbound?.docNo || (isIssueFlow.value ? `${row.work_order_no || ''}-${row.line_no || row.id || ''}` : ''), status: docs.materialOutbound?.status || row.issue_status, current: isIssueFlow.value },
    { key: 'qc', type: '生产检验', docNo: docs.qualityInspection?.doc_no, status: docs.qualityInspection?.result },
    { key: 'in', type: '生产入库', docNo: docs.productionInbound?.inbound_no || docs.productionInbound?.docNo, status: docs.productionInbound?.status }
  ]
})
const flowPrimaryLabel = computed(() => (isIssueFlow.value ? '首个待下推用料' : '首个待下推工单'))
const flowPrimaryDocNo = computed(() => {
  const row = flowPrimaryRow.value || {}
  if (isIssueFlow.value) return row.work_order_no ? `${row.work_order_no}-${row.line_no || row.id || ''}` : row.id || '-'
  return row.work_order_no || row.id || '-'
})
const flowPrimarySummary = computed(() => {
  const row = flowPrimaryRow.value || {}
  if (isIssueFlow.value) return `${row.component_material_name || row.component_material_code || '-'} / ${formatQty(row.required_qty)} ${row.unit || ''}`
  return `${row.product_material_name || row.product_material_code || '-'} / ${formatQty(row.planned_qty)} ${row.unit || ''}`
})
const flowDownstreamLabel = computed(() => {
  if (flowNextStep.value === 'quality_inspection') return '下游生产检验'
  if (flowNextStep.value === 'production_inbound') return '下游生产入库'
  return '下游领料出库'
})
const flowDownstreamDocNo = computed(() => {
  const docs = flowDocs.value || {}
  if (flowNextStep.value === 'quality_inspection') return docs.qualityInspection?.doc_no || '未生成'
  if (flowNextStep.value === 'production_inbound') return docs.productionInbound?.inbound_no || docs.productionInbound?.docNo || '未生成'
  return docs.materialOutbound?.outbound_no || docs.materialOutbound?.docNo || '未生成'
})
const flowDownstreamStatus = computed(() => {
  const docs = flowDocs.value || {}
  if (flowNextStep.value === 'quality_inspection') return docs.qualityInspection?.result || '可下推生成'
  if (flowNextStep.value === 'production_inbound') return docs.productionInbound?.status || '可生成入库链路'
  return docs.materialOutbound?.status || '可生成出库链路'
})
const issueShortageQty = computed(() => {
  const required = Number(activeIssueRow.value?.required_qty || 0)
  const issued = Number(issueDrawer.form.issued_qty || 0)
  return Math.max(required - issued, 0)
})
const attentionRows = computed(() => lastLoadedRows.value)
const attentionSummary = computed(() => buildProductionAttentionSummary(app.value?.key, attentionRows.value))
const attentionTodoCount = computed(() => attentionRows.value.filter((row) => matchesProductionAttentionFilter(app.value?.key, row, 'todo')).length)
const attentionFilterOptions = computed(() => [
  { value: 'all', label: `全部 ${attentionSummary.value.total}` },
  { value: 'critical', label: `紧急 ${attentionSummary.value.counts.critical}` },
  { value: 'warning', label: `预警 ${attentionSummary.value.counts.warning}` },
  { value: 'focus', label: `重点 ${attentionSummary.value.counts.focus}` },
  { value: 'todo', label: `待处理 ${attentionTodoCount.value}` }
])
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
  moduleName: 'production',
  fallbackApiUrl: '/v_production_work_orders',
  attentionFilter,
  attentionFilterOptions
})
const resolveAttention = (row) => getProductionRecordAttention(app.value?.key, row, {
  role: 'production_supervisor',
  page: app.value?.key,
  device: 'desktop',
  task: 'monitor'
})
const rowAttentionFilter = (row) => matchesProductionAttentionFilter(app.value?.key, row, attentionFilter.value)
const summaryScope = computed(() => attentionFilter.value === 'all' && gridTimeMode.value === 'infinite' ? 'server' : 'loaded')
const resolveRowActions = (row) => {
  if (!row) return []
  if (app.value?.key === 'work_orders') {
    const actions = []
    if (canEditRows.value) {
      actions.push({
        key: 'edit-work-order',
        label: '处理',
        type: 'primary',
        icon: 'Edit',
        title: '处理生产工单',
        sopAction: 'production-row-edit-work-order',
        sopTitle: '单行处理生产工单',
        sopDesc: '打开当前生产工单的处理抽屉。',
        sopSteps: [
          '确认当前行是要处理的生产工单。',
          '点击“处理”打开工单处理抽屉。',
          '复核工单状态、优先级、计划数量、开始日期和完成日期。',
          '保存后检查表格关注等级、工单状态和计划日期是否正确。'
        ],
        sopRisk: '工单状态会影响领料、生产检验和入库，不要误改其他工单。'
      })
    }
    if (canPushWorkOrder.value) {
      actions.push({
        key: 'push-work-order',
        label: '下推',
        type: 'success',
        icon: 'Position',
        title: '下推生产检验或生产入库',
        sopAction: 'production-row-push-work-order',
        sopTitle: '单行生产工单下推',
        sopDesc: '把当前生产工单下推到生产检验或生产入库。',
        sopSteps: [
          '确认当前行是要流转的生产工单。',
          '复核工单状态、数量、完工情况和质量要求。',
          '点击“下推”打开业务流转确认窗。',
          '选择下一环节并确认，跳转后复核生成单据。'
        ],
        sopRisk: '未生产、未检验或数量错误的工单不能直接下推。'
      })
    }
    return actions
  }
  if (app.value?.key === 'work_order_items') {
    const actions = []
    if (canEditRows.value) {
      actions.push({
        key: 'edit-issue',
        label: '领料',
        type: 'primary',
        icon: 'Edit',
        title: '登记生产领料',
        sopAction: 'production-row-register-issue',
        sopTitle: '单行登记领料',
        sopDesc: '登记当前工单用料明细的实际领料情况。',
        sopSteps: [
          '确认当前行是要领料的物料明细。',
          '复核物料编码、需求数量、已领数量和库存情况。',
          '点击“领料”打开登记抽屉。',
          '填写本次领料数量和备注，保存后复核缺料数量。'
        ],
        sopRisk: '领料数量会影响库存和成本，不能登记到错误物料或错误工单。'
      })
    }
    if (canPushIssue.value) {
      actions.push({
        key: 'push-issue',
        label: '下推',
        type: 'warning',
        icon: 'Position',
        title: '下推生产领料出库',
        sopAction: 'production-row-push-issue-outbound',
        sopTitle: '单行领料下推出库',
        sopDesc: '把当前工单用料明细下推到仓储出库。',
        sopSteps: [
          '确认当前行是要出库的领料明细。',
          '复核物料、需求数量、已领数量、仓库和批次。',
          '点击“下推”打开业务流转确认窗。',
          '确认后跳转仓储出库，复核出库单和库存影响。'
        ],
        sopRisk: '出库会影响库存账，缺料或批次不清时不要直接下推。'
      })
    }
    return actions
  }
  return []
}
const allAvailableColumns = computed(() => {
  const all = [...staticColumns.value, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.value.length + editingIndex.value))
  }
  return all
})

const isSelectColumnConfig = (col) => {
  if (!col) return false
  if (col.type === 'select' || col.type === 'dropdown') return true
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
        if (!normalized || normalized.label === '') return
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

const getConfigKey = () => app.value.configKey || `${app.value.viewId || app.value.key}_cols`

const loadColumnsConfig = async () => {
  const configKey = getConfigKey()
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (Array.isArray(res) && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
      if (extraColumns.value.length > 0) {
        await saveColumnsConfig()
      }
    }
    syncAiContext()
  } catch (e) {
    extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
  }
}

const loadStaticColumnsConfig = async () => {
  const configKey = `${getConfigKey()}_static_hidden`
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const hidden = Array.isArray(res) && res.length ? res[0].value : []
    const props = new Set(staticColumnsAll.value.map(col => col.prop).filter(Boolean))
    staticHidden.value = Array.isArray(hidden) ? hidden.filter(prop => props.has(prop)) : []
  } catch (e) {
    staticHidden.value = []
  }
}

const saveStaticColumnsConfig = async () => {
  const configKey = `${getConfigKey()}_static_hidden`
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: staticHidden.value }
  })
}

const saveColumnsConfig = async () => {
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: getConfigKey(), value: extraColumns.value }
  })
}

const buildDataStats = (rows) => {
  const stats = { totalCount: 0, statusCounts: {}, productCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  rows.forEach((row) => {
    const status = row?.work_order_status || row?.plan_status || row?.issue_status || row?.status || '未设置'
    stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1
    const product = row?.product_material_code || row?.product_material_name
    if (product) stats.productCounts[product] = (stats.productCounts[product] || 0) + 1
  })
  return stats
}

const buildDataSample = (rows, columns, limit = 50) => {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit).map((row) => {
    const item = {}
    columns.forEach((col) => {
      const prop = col.prop
      if (!prop || col.type === 'file' || col.type === 'geo') return
      const value = row?.[prop] ?? row?.properties?.[prop]
      if (value !== undefined && value !== null && value !== '') item[prop] = value
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}

const syncAiContext = (rows = lastLoadedRows.value, overrides = {}) => {
  const columns = [...staticColumns.value, ...extraColumns.value].map(col => ({
    label: col.label,
    prop: col.prop,
    type: col.type || 'text',
    options: col.options || [],
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || null,
    expression: col.expression || ''
  }))
  const fileColumns = columns.filter(col => col.type === 'file')
  const dataStats = enrichLoadedDataStats(buildDataStats(rows), lastGridLoadState.value, rows)
  const dataScope = (overrides.searchText ?? lastSearchText.value) ? '当前搜索结果' : '当前列表数据'
  const importTarget = {
    apiUrl: app.value.writeUrl || app.value.apiUrl,
    profile: 'scm',
    viewId: app.value.viewId
  }
  pushAiContext({
    app: 'production',
    view: app.value.key,
    viewId: app.value.viewId,
    apiUrl: app.value.apiUrl,
    profile: 'scm',
    columns,
    staticColumns: staticColumns.value,
    extraColumns: extraColumns.value,
    summaryConfig: summaryConfig.value,
    fileColumns,
    dataStats,
    dataSample: buildDataSample(rows, columns, 40),
    dataScope,
    searchText: overrides.searchText ?? lastSearchText.value ?? '',
    gridAgent: buildGridAgentContext({
      app: 'production',
      view: app.value.key,
      viewId: app.value.viewId,
      apiUrl: app.value.apiUrl,
      writeUrl: app.value.writeUrl || app.value.apiUrl,
      profile: 'scm',
      contentProfile: 'scm',
      defaultOrder: app.value.defaultOrder || defaultOrder.value || 'id.desc',
      columns,
      staticColumns: staticColumns.value,
      extraColumns: extraColumns.value,
      summaryConfig: summaryConfig.value,
      searchText: overrides.searchText ?? lastSearchText.value ?? '',
      dataScope,
      loadState: lastGridLoadState.value,
      allowImport: false,
      importTarget,
      summaryScope: summaryScope.value
    }),
    aiScene: overrides.aiScene || 'grid_chat',
    allowFormula: !!overrides.allowFormula,
    allowFormulaOnce: !!overrides.allowFormulaOnce,
    allowImport: false,
    importTarget
  })
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rawRows)
    ? payload.rawRows
    : (Array.isArray(payload?.rows) ? payload.rows : [])
  const visibleRows = Array.isArray(payload?.rows) ? payload.rows : rows
  lastLoadedRows.value = rows
  lastSearchText.value = payload?.searchText || ''
  lastGridLoadState.value = buildGridLoadState(payload, rows, visibleRows)
  syncAiContext(visibleRows, { searchText: lastSearchText.value })
}

const handleDataLoadError = () => {
  lastLoadedRows.value = []
  lastGridLoadState.value = buildGridLoadState()
  syncAiContext([], { searchText: lastSearchText.value })
}

const handleGridCellValueChanged = (params) => {
  const row = params?.node?.data
  if (!row?.id) return
  const index = lastLoadedRows.value.findIndex((item) => String(item?.id) === String(row.id))
  if (index >= 0) {
    const next = [...lastLoadedRows.value]
    next.splice(index, 1, row)
    lastLoadedRows.value = next
  }
  syncAiContext(lastLoadedRows.value)
}

const handleSelectionChanged = (rows) => {
  selectedRows.value = Array.isArray(rows) ? rows.filter(row => !row?.__pinned) : []
}

const handleViewDocument = (row) => {
  if (app.value.key === 'work_orders') {
    openWorkOrderDrawer(row)
    return
  }
  if (app.value.key === 'work_order_items') {
    openIssueDrawer(row)
    return
  }
  if (app.value.key === 'bom_list') {
    openBomWorkbench()
    return
  }
  ElMessage.info('当前生产应用以表格维护为主')
}

const addSelectOption = () => {
  currentCol.options.push({ label: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

const buildFormulaPrompt = () => {
  const label = currentCol.label || '计算列'
  const variables = allAvailableColumns.value.map(col => col.label).join('、')
  return [
    '请帮我生成生产模块表格“自动计算”公式。',
    `目标列：${label}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{需求数量}-{已领数量}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

const openAiFormula = () => {
  syncAiContext(lastLoadedRows.value, { aiScene: 'column_formula', allowFormulaOnce: true })
  pushAiCommand({
    id: `production_formula_${Date.now()}`,
    type: 'open-worker',
    prompt: buildFormulaPrompt()
  })
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({ label: opt.label ?? opt.value ?? '' }))
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
      .map((item) => {
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
    prop: isEditing.value ? currentCol.prop : `field_${Math.floor(Math.random() * 10000)}`,
    type
  }
  if (type === 'formula') {
    colConfig.expression = currentCol.expression
  } else if (type === 'select') {
    const options = currentCol.options
      .map(opt => String(opt.label || '').trim())
      .filter(Boolean)
      .map(text => ({ label: text, value: text }))
    if (!options.length) {
      ElMessage.warning('请至少添加一个选项')
      return
    }
    colConfig.options = options
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

  if (isEditing.value) {
    extraColumns.value[editingIndex.value] = colConfig
    ElMessage.success('列配置已更新')
  } else {
    extraColumns.value.push(colConfig)
    ElMessage.success('列已添加')
  }
  await saveColumnsConfig()
  syncAiContext()
  resetForm()
}

const removeColumn = async (index) => {
  extraColumns.value.splice(index, 1)
  await saveColumnsConfig()
  syncAiContext()
  if (isEditing.value && editingIndex.value === index) resetForm()
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const isStaticVisible = (prop) => !staticHidden.value.includes(prop)
const toggleStaticColumn = async (prop, visible) => {
  const has = staticHidden.value.includes(prop)
  if (visible && has) staticHidden.value = staticHidden.value.filter(item => item !== prop)
  if (!visible && !has) staticHidden.value = [...staticHidden.value, prop]
  await saveStaticColumnsConfig()
  syncAiContext()
}

const handleCreate = async () => {
  if (app.value.createDisabledTip) {
    ElMessage.info(app.value.createDisabledTip)
    return
  }
  ElMessage.info('该生产应用不支持手工新增')
}

const formatDateValue = (value) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const formatQty = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  if (Number.isInteger(num)) return String(num)
  return num.toFixed(3).replace(/\.?0+$/, '')
}

const safeEq = (value) => encodeURIComponent(String(value ?? ''))

const nextDocNo = (prefix) => `${prefix}${Date.now().toString().slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`

const toNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const getIssueDocNo = (row = {}) => {
  const lineNo = row.line_no || row.id || ''
  return `${row.work_order_no || 'WO'}-${lineNo}`
}

const getFlowSourceDoc = (row, docType) => ({
  docType,
  docId: row?.id || null,
  docNo: docType === DOC_TYPES.WORK_ORDER_ITEM ? getIssueDocNo(row) : row?.work_order_no || ''
})

const createDocumentLinkPayload = ({ source, target, relationType, quantity = null, amount = null, payload = {} }) => ({
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
})

const activeSourceLinkQuery = (sourceType, sourceId, sourceNo, relationType = '') => {
  const clauses = []
  if (sourceId) clauses.push(`source_doc_id.eq.${safeEq(sourceId)}`)
  if (sourceNo) clauses.push(`source_doc_no.eq.${safeEq(sourceNo)}`)
  const orPart = clauses.length ? `&or=(${clauses.join(',')})` : ''
  const relationPart = relationType ? `&relation_type=eq.${safeEq(relationType)}` : ''
  return `source_doc_type=eq.${safeEq(sourceType)}&status=eq.active${relationPart}${orPart}&order=created_at.asc`
}

const pickFirstByLinkTarget = (rows, link, noField) => {
  if (!link) return rows[0] || null
  return rows.find((row) => {
    if (link.target_doc_id && row.id === link.target_doc_id) return true
    return noField && link.target_doc_no && row[noField] === link.target_doc_no
  }) || rows[0] || null
}

const loadRowsByIdsOrNos = async ({ table, noField, ids = [], nos = [], select = '*', profile = 'public' }) => {
  const clauses = []
  const cleanIds = ids.filter(Boolean).map(safeEq)
  const cleanNos = nos.filter(Boolean).map(safeEq)
  if (cleanIds.length) clauses.push(`id.in.(${cleanIds.join(',')})`)
  if (noField && cleanNos.length) clauses.push(`${noField}.in.(${cleanNos.join(',')})`)
  if (!clauses.length) return []
  const rows = await request({
    url: `/${table}?or=(${clauses.join(',')})&select=${select}&limit=50`,
    method: 'get',
    headers: { 'Accept-Profile': profile },
    silentError: true
  }).catch(() => [])
  return Array.isArray(rows) ? rows : []
}

const findActiveDocumentLink = async ({ sourceType, sourceId, sourceNo, relationType }) => {
  const rows = await request({
    url: `/document_links?${activeSourceLinkQuery(sourceType, sourceId, sourceNo, relationType)}&select=*`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

const createDocumentLink = async (payload) => {
  if (!payload) return null
  const existing = await findActiveDocumentLink({
    sourceType: payload.source_doc_type,
    sourceId: payload.source_doc_id,
    sourceNo: payload.source_doc_no,
    relationType: payload.relation_type
  })
  if (existing) return existing
  return request({
    url: '/document_links',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
    data: payload,
    silentError: true
  }).catch(() => null)
}

const writeFlowAudit = async ({ actionType, source, target, reason = '', payload = {} }) => {
  await request({
    url: '/document_flow_audits',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=minimal' },
    data: {
      action_type: actionType,
      source_doc_type: source?.docType || '',
      source_doc_id: source?.docId || null,
      source_doc_no: source?.docNo || '',
      target_doc_type: target?.docType || '',
      target_doc_id: target?.docId || null,
      target_doc_no: target?.docNo || '',
      reason,
      actor_username: getCurrentUserName() || 'production',
      payload
    },
    silentError: true
  }).catch(() => null)
}

const getSingleSelectedRow = (tip) => {
  if (selectedRows.value.length !== 1) {
    ElMessage.warning(tip || '请先选中一行')
    return null
  }
  return selectedRows.value[0]
}

const openBomWorkbench = () => {
  router.push('/bom')
}

const openWorkOrderDrawer = (row = null) => {
  const target = row || getSingleSelectedRow('请先选中一张生产工单')
  if (!target?.id) return
  workOrderDrawer.row = target
  Object.assign(workOrderDrawer.form, {
    work_order_status: target.work_order_status || '待排产',
    priority: target.priority || '普通',
    planned_qty: Number(target.planned_qty || 0),
    unit: target.unit || '',
    planned_start_date: formatDateValue(target.planned_start_date),
    planned_finish_date: formatDateValue(target.planned_finish_date),
    remark: target.remark || ''
  })
  workOrderDrawer.visible = true
}

const openIssueDrawer = (row = null) => {
  const target = row || getSingleSelectedRow('请先选中一条领料明细')
  if (!target?.id) return
  issueDrawer.row = target
  Object.assign(issueDrawer.form, {
    issued_qty: Number(target.issued_qty || 0),
    shortage_qty: Number(target.shortage_qty || 0),
    issue_status: target.issue_status || '未领料',
    remark: target.remark || ''
  })
  issueDrawer.visible = true
}

const resetFlowDialog = () => {
  flowSelectedRows.value = []
  flowNextStep.value = 'quality_inspection'
  flowDocs.value = {}
  flowLinks.value = []
  flowLoading.value = false
  flowActionLoading.value = false
  flowSourceMode.value = app.value.key
}

const getSelectedFlowRows = (mode = app.value.key) => {
  const rows = selectedRows.value.length ? selectedRows.value : []
  if (mode === 'work_order_items') return rows.filter((row) => row?.id && (row.work_order_no || row.work_order_id))
  return rows.filter((row) => row?.id && row.work_order_no)
}

const loadWorkOrderBusinessFlow = async (row = flowPrimaryRow.value) => {
  if (!row?.id && !row?.work_order_no) return
  flowLoading.value = true
  try {
    const qcLink = await findActiveDocumentLink({
      sourceType: DOC_TYPES.WORK_ORDER,
      sourceId: row.id,
      sourceNo: row.work_order_no,
      relationType: RELATION_TYPES.WORK_ORDER_TO_QUALITY_INSPECTION
    })
    const inboundLink = await findActiveDocumentLink({
      sourceType: DOC_TYPES.WORK_ORDER,
      sourceId: row.id,
      sourceNo: row.work_order_no,
      relationType: RELATION_TYPES.WORK_ORDER_TO_PRODUCTION_INBOUND
    })
    const inspections = qcLink
      ? await loadRowsByIdsOrNos({
        table: 'quality_inspections',
        noField: 'doc_no',
        ids: [qcLink.target_doc_id],
        nos: [qcLink.target_doc_no],
        profile: 'public'
      })
      : []
    const qualityInspection = pickFirstByLinkTarget(inspections, qcLink, 'doc_no')
    const productionInbound = inboundLink
      ? {
        id: inboundLink.target_doc_id,
        inbound_no: inboundLink.target_doc_no,
        docNo: inboundLink.target_doc_no,
        status: inboundLink.payload?.status || (inboundLink.status === 'active' ? '已生成链路' : inboundLink.status)
      }
      : null
    flowDocs.value = { workOrder: row, qualityInspection, productionInbound }
    flowLinks.value = [qcLink, inboundLink].filter(Boolean)
  } catch (error) {
    console.warn('load production work order flow failed', error)
    ElMessage.warning('生产流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const loadIssueBusinessFlow = async (row = flowPrimaryRow.value) => {
  if (!row?.id) return
  flowLoading.value = true
  try {
    const sourceNo = getIssueDocNo(row)
    const outboundLink = await findActiveDocumentLink({
      sourceType: DOC_TYPES.WORK_ORDER_ITEM,
      sourceId: row.id,
      sourceNo,
      relationType: RELATION_TYPES.WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND
    })
    const materialOutbound = outboundLink
      ? {
        id: outboundLink.target_doc_id,
        outbound_no: outboundLink.target_doc_no,
        docNo: outboundLink.target_doc_no,
        status: outboundLink.payload?.status || (outboundLink.status === 'active' ? '已生成链路' : outboundLink.status)
      }
      : null
    flowDocs.value = { workOrderItem: row, materialOutbound }
    flowLinks.value = [outboundLink].filter(Boolean)
  } catch (error) {
    console.warn('load production issue flow failed', error)
    ElMessage.warning('领料流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const openWorkOrderPushFlowDialog = async () => {
  const rows = getSelectedFlowRows('work_orders')
  if (!rows.length) {
    ElMessage.warning('请先选择要下推的生产工单')
    return
  }
  flowSourceMode.value = 'work_orders'
  flowSelectedRows.value = rows
  flowNextStep.value = 'quality_inspection'
  flowDialogVisible.value = true
  await loadWorkOrderBusinessFlow(rows[0])
}

const openIssuePushFlowDialog = async () => {
  const rows = getSelectedFlowRows('work_order_items')
  if (!rows.length) {
    ElMessage.warning('请先选择要下推出库的领料明细')
    return
  }
  flowSourceMode.value = 'work_order_items'
  flowSelectedRows.value = rows
  flowNextStep.value = 'material_outbound'
  flowDialogVisible.value = true
  await loadIssueBusinessFlow(rows[0])
}

const openWorkOrderPushFlowDialogForRow = async (row) => {
  if (!row?.id || !row?.work_order_no) {
    ElMessage.warning('该生产工单缺少业务编号，不能下推')
    return
  }
  flowSourceMode.value = 'work_orders'
  flowSelectedRows.value = [row]
  flowNextStep.value = 'quality_inspection'
  flowDialogVisible.value = true
  await loadWorkOrderBusinessFlow(row)
}

const openIssuePushFlowDialogForRow = async (row) => {
  if (!row?.id) {
    ElMessage.warning('该领料明细缺少主键，不能下推')
    return
  }
  flowSourceMode.value = 'work_order_items'
  flowSelectedRows.value = [row]
  flowNextStep.value = 'material_outbound'
  flowDialogVisible.value = true
  await loadIssueBusinessFlow(row)
}

const findExistingQualityInspectionForWorkOrder = async (row) => {
  const link = await findActiveDocumentLink({
    sourceType: DOC_TYPES.WORK_ORDER,
    sourceId: row.id,
    sourceNo: row.work_order_no,
    relationType: RELATION_TYPES.WORK_ORDER_TO_QUALITY_INSPECTION
  })
  if (!link) return null
  const rows = await loadRowsByIdsOrNos({
    table: 'quality_inspections',
    noField: 'doc_no',
    ids: [link.target_doc_id],
    nos: [link.target_doc_no],
    profile: 'public'
  })
  return pickFirstByLinkTarget(rows, link, 'doc_no')
}

const pushSingleWorkOrderToQualityInspection = async (row) => {
  if (!row?.id) throw new Error('生产工单缺少主键，不能下推生产检验')
  const existing = await findExistingQualityInspectionForWorkOrder(row)
  if (existing) return { skipped: true, inspection: existing }
  const sampleQty = Math.max(1, Math.min(toNumber(row.planned_qty), 100) || 1)
  const inspectionPayload = {
    doc_no: nextDocNo('QI'),
    inspection_type: '过程巡检',
    source_doc_no: row.work_order_no || '',
    item_code: row.product_material_code || '',
    item_name: row.product_material_name || row.product_material_code || '生产产品',
    source_name: row.properties?.line_name || row.properties?.workshop || '生产现场',
    batch_no: row.properties?.batch_no || '',
    sample_qty: sampleQty,
    defect_qty: 0,
    result: '待判定',
    inspector: '',
    inspection_date: new Date().toISOString().slice(0, 10),
    remark: `由生产工单 ${row.work_order_no || ''} 下推生成`,
    status: 'active',
    properties: {
      source_type: 'production_work_order',
      source_work_order_id: row.id,
      source_work_order_no: row.work_order_no || '',
      product_material_id: row.product_material_id || null,
      product_material_code: row.product_material_code || '',
      planned_qty: toNumber(row.planned_qty),
      unit: row.unit || '',
      workflow_key: 'production_to_quality'
    }
  }
  const createdRows = await request({
    url: '/quality_inspections',
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
    data: inspectionPayload
  })
  const inspection = Array.isArray(createdRows) ? createdRows[0] : createdRows
  const sourceDoc = getFlowSourceDoc(row, DOC_TYPES.WORK_ORDER)
  const targetDoc = {
    docType: DOC_TYPES.QUALITY_INSPECTION,
    docId: inspection?.id || null,
    docNo: inspection?.doc_no || inspectionPayload.doc_no
  }
  await createDocumentLink(createDocumentLinkPayload({
    source: sourceDoc,
    target: targetDoc,
    relationType: RELATION_TYPES.WORK_ORDER_TO_QUALITY_INSPECTION,
    quantity: sampleQty,
    payload: {
      product_material_code: row.product_material_code || '',
      product_material_name: row.product_material_name || ''
    }
  }))
  await writeFlowAudit({
    actionType: 'push_work_order_to_quality_inspection',
    source: sourceDoc,
    target: targetDoc,
    payload: { sample_qty: sampleQty, product_material_name: row.product_material_name || '' }
  })
  await request({
    url: `/production_work_orders?id=eq.${safeEq(row.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
    data: {
      properties: {
        ...(row.properties || {}),
        quality_inspection_id: inspection?.id || null,
        quality_inspection_no: inspection?.doc_no || inspectionPayload.doc_no,
        quality_pushed_at: new Date().toISOString()
      }
    }
  }).catch(() => null)
  return { skipped: false, inspection }
}

const findExistingProductionInboundForWorkOrder = async (row) => {
  const link = await findActiveDocumentLink({
    sourceType: DOC_TYPES.WORK_ORDER,
    sourceId: row.id,
    sourceNo: row.work_order_no,
    relationType: RELATION_TYPES.WORK_ORDER_TO_PRODUCTION_INBOUND
  })
  if (!link) return null
  return {
    inbound_no: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.payload?.status || '已生成链路'
  }
}

const pushSingleWorkOrderToProductionInbound = async (row) => {
  if (!row?.id) throw new Error('生产工单缺少主键，不能下推生产入库')
  const existing = await findExistingProductionInboundForWorkOrder(row)
  if (existing) return { skipped: true, inbound: existing }
  const quantity = toNumber(row.planned_qty)
  if (quantity <= 0) throw new Error(`生产工单 ${row.work_order_no || row.id} 计划数量必须大于 0`)
  const inboundNo = nextDocNo('PIN')
  const sourceDoc = getFlowSourceDoc(row, DOC_TYPES.WORK_ORDER)
  const targetDoc = { docType: DOC_TYPES.INVENTORY_INBOUND, docId: null, docNo: inboundNo }
  await createDocumentLink(createDocumentLinkPayload({
    source: sourceDoc,
    target: targetDoc,
    relationType: RELATION_TYPES.WORK_ORDER_TO_PRODUCTION_INBOUND,
    quantity,
    payload: {
      status: '待仓储补录',
      io_type: '生产入库',
      product_material_id: row.product_material_id || null,
      product_material_code: row.product_material_code || '',
      product_material_name: row.product_material_name || '',
      unit: row.unit || ''
    }
  }))
  await writeFlowAudit({
    actionType: 'push_work_order_to_production_inbound',
    source: sourceDoc,
    target: targetDoc,
    payload: { quantity, io_type: '生产入库', product_material_name: row.product_material_name || '' }
  })
  await request({
    url: `/production_work_orders?id=eq.${safeEq(row.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
    data: {
      properties: {
        ...(row.properties || {}),
        production_inbound_no: inboundNo,
        production_inbound_status: '待仓储补录',
        production_inbound_pushed_at: new Date().toISOString()
      }
    }
  }).catch(() => null)
  return { skipped: false, inbound: { inbound_no: inboundNo, status: '待仓储补录' } }
}

const findExistingMaterialOutboundForIssue = async (row) => {
  const link = await findActiveDocumentLink({
    sourceType: DOC_TYPES.WORK_ORDER_ITEM,
    sourceId: row.id,
    sourceNo: getIssueDocNo(row),
    relationType: RELATION_TYPES.WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND
  })
  if (!link) return null
  return {
    outbound_no: link.target_doc_no,
    docNo: link.target_doc_no,
    status: link.payload?.status || '已生成链路'
  }
}

const pushSingleIssueToMaterialOutbound = async (row, override = {}) => {
  if (!row?.id) throw new Error('领料明细缺少主键，不能下推出库')
  const existing = await findExistingMaterialOutboundForIssue(row)
  if (existing) return { skipped: true, outbound: existing }
  const quantity = toNumber(override.issued_qty ?? row.issued_qty ?? row.required_qty)
  if (quantity <= 0) throw new Error(`领料明细 ${getIssueDocNo(row)} 数量必须大于 0`)
  const outboundNo = nextDocNo('PICK')
  const sourceDoc = getFlowSourceDoc(row, DOC_TYPES.WORK_ORDER_ITEM)
  const targetDoc = { docType: DOC_TYPES.INVENTORY_OUTBOUND, docId: null, docNo: outboundNo }
  await createDocumentLink(createDocumentLinkPayload({
    source: sourceDoc,
    target: targetDoc,
    relationType: RELATION_TYPES.WORK_ORDER_ITEM_TO_MATERIAL_OUTBOUND,
    quantity,
    payload: {
      status: '待仓储补录',
      io_type: '生产领料',
      work_order_id: row.work_order_id || null,
      work_order_no: row.work_order_no || '',
      component_material_id: row.component_material_id || null,
      component_material_code: row.component_material_code || '',
      component_material_name: row.component_material_name || '',
      unit: row.unit || ''
    }
  }))
  await writeFlowAudit({
    actionType: 'push_work_order_item_to_material_outbound',
    source: sourceDoc,
    target: targetDoc,
    payload: { quantity, io_type: '生产领料', component_material_name: row.component_material_name || '' }
  })
  await request({
    url: `/production_work_order_items?id=eq.${safeEq(row.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
    data: {
      properties: {
        ...(row.properties || {}),
        material_outbound_no: outboundNo,
        material_outbound_status: '待仓储补录',
        material_outbound_pushed_at: new Date().toISOString()
      }
    }
  }).catch(() => null)
  return { skipped: false, outbound: { outbound_no: outboundNo, status: '待仓储补录' } }
}

const pushSelectedWorkOrdersToQuality = async () => {
  const rows = flowSelectedRows.value.length ? flowSelectedRows.value : getSelectedFlowRows('work_orders')
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleWorkOrderToQualityInspection(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(`${row.work_order_no || row.id}：${error?.message || '下推失败'}`)
      }
    }
    await refreshCurrentGrid()
    if (flowPrimaryRow.value) await loadWorkOrderBusinessFlow(flowPrimaryRow.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('push work orders to quality failed', errors)
      return
    }
    ElMessage.success(`已下推生产检验 ${createdCount} 单，跳过 ${skippedCount} 单`)
    flowDialogVisible.value = false
    window.location.href = '/quality/app/production_inspections'
  } finally {
    flowActionLoading.value = false
  }
}

const pushSelectedWorkOrdersToInbound = async () => {
  const rows = flowSelectedRows.value.length ? flowSelectedRows.value : getSelectedFlowRows('work_orders')
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleWorkOrderToProductionInbound(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(`${row.work_order_no || row.id}：${error?.message || '下推失败'}`)
      }
    }
    await refreshCurrentGrid()
    if (flowPrimaryRow.value) await loadWorkOrderBusinessFlow(flowPrimaryRow.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('push work orders to inbound failed', errors)
      return
    }
    ElMessage.success(`已生成生产入库链路 ${createdCount} 单，跳过 ${skippedCount} 单`)
    flowDialogVisible.value = false
    window.location.href = '/materials/inventory-stock-in?ioType=生产入库'
  } finally {
    flowActionLoading.value = false
  }
}

const pushSelectedIssuesToOutbound = async () => {
  const rows = flowSelectedRows.value.length ? flowSelectedRows.value : getSelectedFlowRows('work_order_items')
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleIssueToMaterialOutbound(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(`${getIssueDocNo(row)}：${error?.message || '下推失败'}`)
      }
    }
    await refreshCurrentGrid()
    if (flowPrimaryRow.value) await loadIssueBusinessFlow(flowPrimaryRow.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('push issues to outbound failed', errors)
      return
    }
    ElMessage.success(`已生成生产领料出库链路 ${createdCount} 单，跳过 ${skippedCount} 单`)
    flowDialogVisible.value = false
    window.location.href = '/materials/inventory-stock-out?ioType=生产领料'
  } finally {
    flowActionLoading.value = false
  }
}

const confirmProductionPush = () => {
  if (flowNextStep.value === 'quality_inspection') return pushSelectedWorkOrdersToQuality()
  if (flowNextStep.value === 'production_inbound') return pushSelectedWorkOrdersToInbound()
  return pushSelectedIssuesToOutbound()
}

const handleRowAction = ({ action, row }) => {
  if (!action || action.disabled || !row) return
  if (action.key === 'edit-work-order') {
    openWorkOrderDrawer(row)
    return
  }
  if (action.key === 'push-work-order') {
    openWorkOrderPushFlowDialogForRow(row)
    return
  }
  if (action.key === 'edit-issue') {
    openIssueDrawer(row)
    return
  }
  if (action.key === 'push-issue') {
    openIssuePushFlowDialogForRow(row)
  }
}

const refreshCurrentGrid = async () => {
  await gridRef.value?.loadData?.()
  gridRef.value?.refreshCells?.({ force: true })
}

const saveWorkOrder = async () => {
  const row = workOrderDrawer.row
  if (!row?.id) return
  workOrderDrawer.saving = true
  try {
    const payload = {
      work_order_status: workOrderDrawer.form.work_order_status || '待排产',
      priority: workOrderDrawer.form.priority || '普通',
      planned_qty: Number(workOrderDrawer.form.planned_qty || 0),
      unit: workOrderDrawer.form.unit || '盒',
      planned_start_date: workOrderDrawer.form.planned_start_date || null,
      planned_finish_date: workOrderDrawer.form.planned_finish_date || null,
      remark: workOrderDrawer.form.remark || null
    }
    await request({
      url: `/production_work_orders?id=eq.${encodeURIComponent(row.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', Prefer: 'return=representation' },
      data: payload
    })
    ElMessage.success('工单已保存')
    workOrderDrawer.visible = false
    await refreshCurrentGrid()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '工单保存失败')
  } finally {
    workOrderDrawer.saving = false
  }
}

const inferIssueStatus = (issuedQty, requiredQty) => {
  const issued = Number(issuedQty || 0)
  const required = Number(requiredQty || 0)
  if (required > 0 && issued >= required) return '已齐套'
  if (issued > 0) return '部分领料'
  return '未领料'
}

watch(
  () => issueDrawer.form.issued_qty,
  () => {
    if (!issueDrawer.visible || !activeIssueRow.value) return
    issueDrawer.form.shortage_qty = issueShortageQty.value
    issueDrawer.form.issue_status = inferIssueStatus(issueDrawer.form.issued_qty, activeIssueRow.value.required_qty)
  }
)

const saveIssue = async () => {
  const row = issueDrawer.row
  if (!row?.id) return
  issueDrawer.saving = true
  try {
    const payload = {
      issued_qty: Number(issueDrawer.form.issued_qty || 0),
      shortage_qty: Number(issueShortageQty.value || 0),
      issue_status: issueDrawer.form.issue_status || inferIssueStatus(issueDrawer.form.issued_qty, row.required_qty),
      remark: issueDrawer.form.remark || null
    }
    await request({
      url: `/production_work_order_items?id=eq.${encodeURIComponent(row.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', Prefer: 'return=representation' },
      data: payload
    })
    if (payload.issued_qty > 0) {
      await pushSingleIssueToMaterialOutbound(
        {
          ...row,
          ...payload,
          properties: {
            ...(row.properties || {}),
            issued_qty: payload.issued_qty,
            issue_status: payload.issue_status
          }
        },
        { issued_qty: payload.issued_qty }
      ).catch((error) => {
        console.warn('create production issue outbound link failed', error)
        ElMessage.warning('领料已保存，但出库链路生成失败，请稍后从“下推领料出库”重试')
      })
    }
    ElMessage.success('领料已保存')
    issueDrawer.visible = false
    await refreshCurrentGrid()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '领料保存失败')
  } finally {
    issueDrawer.saving = false
  }
}

const createWorkOrdersFromPlan = async () => {
  generatingWorkOrders.value = true
  try {
    const rows = await request({
      url: '/rpc/create_work_orders_from_sales_bom',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: { p_created_by: getCurrentUserName() || 'BOM-MRP' }
    })
    ElMessage.success(`已生成/更新 ${Array.isArray(rows) ? rows.length : 0} 张生产工单`)
    await gridRef.value?.loadData?.()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '生成生产工单失败')
  } finally {
    generatingWorkOrders.value = false
  }
}

const getCurrentUserName = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.username || info.name || info.id || 'BOM-MRP'
  } catch {
    return 'BOM-MRP'
  }
}

const goApps = () => {
  router.push('/apps')
}

const handleApplyFormula = (event) => {
  const formula = event?.detail?.formula
  if (!formula) return
  if (!colConfigVisible.value || addTab.value !== 'formula') return
  currentCol.expression = formula
}

onMounted(() => {
  loadStaticColumnsConfig().then(loadColumnsConfig)
  window.addEventListener('eis-ai-apply-formula', handleApplyFormula)
})

watch([attentionFilter, gridApiUrl], () => {
  gridRef.value?.loadData?.()
})

onUnmounted(() => {
  window.removeEventListener('eis-ai-apply-formula', handleApplyFormula)
})
</script>

<style scoped>
.app-container {
  min-height: 0;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #f5f7fb;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.header-text {
  min-width: 0;
}

.header-text h2 {
  margin: 0 0 6px;
  color: #303133;
  font-size: 20px;
  font-weight: 700;
}

.header-text p {
  margin: 0;
  color: #909399;
  font-size: 12px;
}

.header-actions {
  flex-shrink: 0;
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
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
}

.column-manager { padding: 0 5px; }
.section-title { margin-bottom: 10px; color: #303133; font-size: 14px; font-weight: 700; }
.empty-tip { margin-bottom: 10px; color: #909399; font-size: 12px; font-style: italic; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

.col-list {
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 20px;
  padding: 5px;
  border: 1px solid #ebeef5;
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
.field-label { color: #606266; font-size: 12px; }
.field-block .el-input-number { width: 100%; }

.formula-area,
.options-config {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #f5f7fa;
}

.formula-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.formula-tip,
.tag-tip,
.hint-text {
  color: #909399;
  font-size: 12px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}
.cascader-parent-row {
  display: inline-block;
  margin-bottom: 6px;
}
.cascader-parent {
  padding: 6px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
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
  align-items: center;
  gap: 8px;
}
.cascader-add :deep(.el-input) { flex: 1; }
.variable-tags { margin-top: 8px; }
.tag-tip { display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.business-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.drawer-summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #f8fafc;
}
.drawer-summary span {
  color: #909399;
  font-size: 12px;
}
.drawer-summary strong {
  color: #303133;
  font-size: 16px;
}
.drawer-summary em {
  color: #606266;
  font-size: 13px;
  font-style: normal;
}
.business-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.business-flow-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flow-push-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
}

.flow-push-header span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.flow-push-header strong {
  color: #111827;
  font-size: 22px;
}

.flow-chain {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.flow-step {
  position: relative;
  min-height: 96px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
}

.flow-step:not(:last-child)::after {
  content: "";
  position: absolute;
  top: 50%;
  right: -12px;
  width: 12px;
  height: 2px;
  background: #d1d5db;
}

.flow-step.active {
  border-color: #67c23a;
  background: #f0f9eb;
}

.flow-step.current {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.flow-step .step-type {
  color: #64748b;
  font-size: 12px;
}

.flow-step strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 16px;
}

.flow-step small {
  color: #64748b;
}

.flow-tip {
  margin: 0;
}

.flow-actions {
  display: flex;
  justify-content: flex-end;
}

.flow-doc-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.flow-doc-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flow-doc-card span {
  color: #64748b;
  font-size: 12px;
}

.flow-doc-card strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #111827;
  font-size: 16px;
}

.flow-doc-card small {
  color: #475569;
}

:global(#app.dark) .app-container {
  background-color: #0b0f14;
}

:global(#app.dark) .grid-card,
:global(#app.dark) .col-item,
:global(#app.dark) .cascader-node,
:global(#app.dark) .drawer-summary {
  background-color: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .section-title,
:global(#app.dark) .col-label,
:global(#app.dark) .drawer-summary strong,
:global(#app.dark) .flow-push-header strong,
:global(#app.dark) .flow-step strong,
:global(#app.dark) .flow-doc-card strong {
  color: #f3f4f6;
}

:global(#app.dark) .flow-push-header,
:global(#app.dark) .flow-step,
:global(#app.dark) .flow-doc-card {
  background-color: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .flow-step.active {
  border-color: #22c55e;
  background-color: rgba(34, 197, 94, 0.12);
}

:global(#app.dark) .flow-push-header span,
:global(#app.dark) .flow-step .step-type,
:global(#app.dark) .flow-step small,
:global(#app.dark) .flow-doc-card span,
:global(#app.dark) .flow-doc-card small {
  color: #9ca3af;
}

@media (max-width: 760px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .flow-chain,
  .flow-doc-panel {
    grid-template-columns: 1fr;
  }

  .flow-step:not(:last-child)::after {
    display: none;
  }

  .flow-push-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
