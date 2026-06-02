<template>
  <div class="bom-page">
    <header class="bom-topbar">
      <div class="title-block">
        <h2>产品配方工作台</h2>
        <p>先选产品，再维护用料，最后检查需求和缺料建议</p>
      </div>
      <div class="top-actions">
        <el-button :loading="loading" @click="loadAll">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openBomDialog()">
          <el-icon><Plus /></el-icon>
          <span>新建配方</span>
        </el-button>
      </div>
    </header>

    <section class="bom-guide">
      <button
        v-for="step in guideSteps"
        :key="step.key"
        type="button"
        class="guide-step"
        :class="{ active: step.view === activeView, done: step.done }"
        @click="goWorkflowStep(step)"
      >
        <span class="step-no">{{ step.no }}</span>
        <span class="step-main">
          <strong>{{ step.title }}</strong>
          <em>{{ step.desc }}</em>
        </span>
        <el-tag v-if="step.done" size="small" type="success" effect="plain">已完成</el-tag>
        <el-tag v-else size="small" type="info" effect="plain">待处理</el-tag>
      </button>
    </section>

    <section class="bom-controlbar">
      <el-input
        v-model.trim="keyword"
        class="search-input"
        clearable
        placeholder="搜索配方编号、名称或产品"
        @keyup.enter="loadBoms"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <el-select
        v-model="selectedBomId"
        class="bom-selector"
        filterable
        placeholder="选择当前产品配方"
        :disabled="!filteredBoms.length"
      >
        <el-option
          v-for="bom in filteredBoms"
          :key="bom.id"
          :label="`${bom.bom_no} · ${bom.parent_material_name}`"
          :value="bom.id"
        >
          <div class="bom-option">
            <strong>{{ bom.bom_no }}</strong>
            <span>{{ bom.parent_material_code }} · {{ bom.parent_material_name }}</span>
          </div>
        </el-option>
      </el-select>

      <div class="view-switch" role="tablist" aria-label="产品配方视图">
        <button
          v-for="tab in viewTabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeView === tab.key }"
          @click="activeView = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </section>

    <section class="bom-overview">
      <div class="overview-item">
        <span>配方总数</span>
        <strong>{{ boms.length }}</strong>
      </div>
      <div class="overview-item">
        <span>已启用</span>
        <strong>{{ enabledBomCount }}</strong>
      </div>
      <div class="overview-item">
        <span>草稿</span>
        <strong>{{ draftBomCount }}</strong>
      </div>
      <div class="overview-item">
        <span>当前用料</span>
        <strong>{{ selectedBom ? bomItems.length : 0 }}</strong>
      </div>
      <div class="overview-item">
        <span>缺料项</span>
        <strong>{{ mrpShortageRows.length }}</strong>
      </div>
    </section>

    <section v-if="selectedBom" class="bom-strip">
      <div class="strip-main">
        <strong>{{ selectedBom.bom_name }}</strong>
        <span>{{ selectedBom.parent_material_code }} · {{ selectedBom.parent_material_name }}</span>
      </div>
      <div class="strip-meta">
        <el-tag size="small" :type="getStatusTagType(selectedBom.status)">{{ selectedBom.status }}</el-tag>
        <span>版本 {{ selectedBom.version }}</span>
        <span>一次产出 {{ formatNumber(selectedBom.base_qty) }} {{ selectedBom.unit }}</span>
        <span>{{ selectedBom.item_count || 0 }} 项用料</span>
        <span>生效 {{ formatDate(selectedBom.effective_from) }}</span>
      </div>
      <div class="strip-actions">
        <el-button :disabled="!canEdit" @click="openBomDialog(selectedBom)">
          <el-icon><Edit /></el-icon>
          <span>主信息</span>
        </el-button>
        <el-button type="primary" :disabled="!canCreate" @click="openItemDialog()">
          <el-icon><Plus /></el-icon>
          <span>添加用料</span>
        </el-button>
        <el-button type="danger" plain :disabled="!canDelete" @click="deleteBom(selectedBom)">
          <el-icon><Delete /></el-icon>
          <span>删除</span>
        </el-button>
      </div>
    </section>
    <section v-else class="bom-strip empty-current">
      <div class="strip-main">
        <strong>还没有选中产品配方</strong>
        <span>从下方清单选择一个配方，或新建一个产品配方开始维护</span>
      </div>
      <div class="strip-actions">
        <el-button type="primary" :disabled="!canCreate" @click="openBomDialog()">
          <el-icon><Plus /></el-icon>
          <span>新建配方</span>
        </el-button>
      </div>
    </section>

    <main class="bom-workspace">
      <section v-show="activeView === 'list'" class="workspace-panel">
        <div class="panel-head">
          <div>
            <strong>选择或新建产品配方</strong>
            <span>先找到要生产的产品，再维护它需要哪些原料和包材</span>
          </div>
          <span>{{ filteredBoms.length }} 个配方</span>
        </div>
        <div class="panel-body list-layout">
          <div class="list-main">
            <el-empty v-if="!loading && filteredBoms.length === 0" description="还没有产品配方">
              <el-button type="primary" :disabled="!canCreate" @click="openBomDialog()">新建第一个配方</el-button>
            </el-empty>
            <el-table
              v-else
              v-loading="loading"
              :data="filteredBoms"
              max-height="480"
              row-key="id"
              border
              highlight-current-row
              empty-text="暂无产品配方"
              @row-click="selectBom"
            >
              <el-table-column prop="bom_no" label="配方编号" min-width="170" show-overflow-tooltip />
              <el-table-column prop="bom_name" label="配方名称" min-width="210" show-overflow-tooltip />
              <el-table-column label="生产产品" min-width="220">
                <template #default="{ row }">
                  <div class="material-cell">
                    <strong>{{ row.parent_material_code }}</strong>
                    <span>{{ row.parent_material_name }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="版本/状态" width="120">
                <template #default="{ row }">
                  <div class="stack-cell">
                    <strong>{{ row.version }}</strong>
                    <el-tag size="small" :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="一次产出" width="130" align="right">
                <template #default="{ row }">{{ formatNumber(row.base_qty) }} {{ row.unit }}</template>
              </el-table-column>
              <el-table-column label="用料数" width="90" align="right">
                <template #default="{ row }">{{ row.item_count || 0 }}</template>
              </el-table-column>
              <el-table-column label="操作" width="190" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" link @click.stop="selectBom(row, 'items')">维护用料</el-button>
                  <el-button type="primary" link :disabled="!canEdit" @click.stop="openBomDialog(row)">编辑</el-button>
                  <el-button type="danger" link :disabled="!canDelete" @click.stop="deleteBom(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <aside class="selection-card">
            <template v-if="selectedBom">
              <div class="selection-title">
                <span>当前选中</span>
                <el-tag size="small" :type="getStatusTagType(selectedBom.status)">{{ selectedBom.status }}</el-tag>
              </div>
              <strong>{{ selectedBom.parent_material_name }}</strong>
              <p>{{ selectedBom.bom_name }}</p>
              <div class="selection-facts">
                <div>
                  <span>配方编号</span>
                  <b>{{ selectedBom.bom_no }}</b>
                </div>
                <div>
                  <span>一次产出</span>
                  <b>{{ formatNumber(selectedBom.base_qty) }} {{ selectedBom.unit }}</b>
                </div>
                <div>
                  <span>用料条目</span>
                  <b>{{ selectedBom.item_count || 0 }} 项</b>
                </div>
                <div>
                  <span>生效日期</span>
                  <b>{{ formatDate(selectedBom.effective_from) }}</b>
                </div>
              </div>
              <div class="selection-actions">
                <el-button type="primary" @click="activeView = 'items'">维护用料</el-button>
                <el-button plain @click="activeView = 'explode'">检查用量</el-button>
              </div>
            </template>
            <template v-else>
              <div class="selection-title">
                <span>操作提示</span>
              </div>
              <strong>先建一个产品配方</strong>
              <p>配方就是“做这个产品需要哪些料、各用多少”。建好主信息后，再逐项添加原料、辅料和包材。</p>
              <el-button type="primary" :disabled="!canCreate" @click="openBomDialog()">新建配方</el-button>
            </template>
          </aside>
        </div>
      </section>

      <section v-show="activeView === 'items'" class="workspace-panel">
        <div class="panel-head">
          <div>
            <strong>维护用料清单</strong>
            <span v-if="selectedBom">按 {{ formatNumber(selectedBom.base_qty) }} {{ selectedBom.unit }} 产出维护标准用量</span>
            <span v-else>先选择一个产品配方，再添加原料、辅料和包材</span>
          </div>
          <div class="panel-actions">
            <el-button size="small" plain @click="activeView = 'list'">换一个配方</el-button>
            <el-button size="small" type="primary" :disabled="!selectedBom || !canCreate" @click="openItemDialog()">
              <el-icon><Plus /></el-icon>
              <span>添加用料</span>
            </el-button>
          </div>
        </div>
        <div v-if="selectedBom" class="panel-body">
          <el-table
            v-loading="itemsLoading"
            :data="bomItems"
            max-height="460"
            row-key="id"
            border
            empty-text="暂无用料，点击右上角添加"
          >
            <el-table-column prop="line_no" label="序号" width="64" />
            <el-table-column label="用到的物料" min-width="240">
              <template #default="{ row }">
                <div class="material-cell">
                  <strong>{{ row.component_material_code }}</strong>
                  <span>{{ row.component_material_name }}</span>
                  <em>{{ row.component_material_category || '-' }}</em>
                </div>
              </template>
            </el-table-column>
              <el-table-column label="标准用量" width="130" align="right">
                <template #default="{ row }">{{ formatNumber(row.qty) }} {{ row.unit }}</template>
            </el-table-column>
            <el-table-column label="损耗/实际备料" width="150" align="right">
              <template #default="{ row }">
                <div class="stack-cell right">
                  <strong>{{ formatPercent(row.loss_rate) }}</strong>
                  <span>{{ formatNumber(row.gross_qty) }} {{ row.unit }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="领料方式/说明" min-width="190">
              <template #default="{ row }">
                <div class="stack-cell">
                  <strong>{{ row.issue_method }}</strong>
                  <span>{{ row.remark || '-' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="112">
              <template #default="{ row }">
                <el-button type="primary" link :disabled="!canEdit" @click="openItemDialog(row)">编辑</el-button>
                <el-button type="danger" link :disabled="!canDelete" @click="deleteItem(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-else class="workspace-empty" description="请选择或新建一个产品配方" />
      </section>

      <section v-show="activeView === 'explode'" class="workspace-panel">
        <div class="panel-head">
          <div>
            <strong>检查生产用量</strong>
            <span>输入计划生产数量，系统会按配方自动换算需要准备多少料</span>
          </div>
          <div class="explode-actions">
            <span>计划生产</span>
            <el-input-number v-model="explodeQty" :min="0.000001" :precision="3" controls-position="right" />
            <el-button type="primary" plain :disabled="!selectedBom" :loading="explodeLoading" @click="loadExplosion">计算用量</el-button>
          </div>
        </div>
        <div v-if="selectedBom" class="panel-body">
          <el-table
            :data="explosionRows"
            max-height="420"
            row-key="component_material_id"
            border
            empty-text="暂无用量结果"
          >
            <el-table-column prop="component_material_code" label="物料编码" min-width="160" />
            <el-table-column prop="component_material_name" label="物料名称" min-width="220" show-overflow-tooltip />
            <el-table-column label="需要准备" width="170" align="right">
              <template #default="{ row }">{{ formatNumber(row.required_qty) }} {{ row.unit }}</template>
            </el-table-column>
          </el-table>
        </div>
        <el-empty v-else class="workspace-empty" description="请选择或新建一个产品配方" />
      </section>

      <section v-show="activeView === 'mrp'" class="workspace-panel">
        <div class="panel-head">
          <div>
            <strong>按销售订单给出缺料建议</strong>
            <span>把已确认订单、成品库存、用料清单和原料库存串起来，直接生成采购或生产建议</span>
          </div>
          <div class="panel-actions">
            <el-button size="small" :loading="mrpLoading" @click="loadMrp">
              <el-icon><Refresh /></el-icon>
              <span>刷新</span>
            </el-button>
            <el-button size="small" type="primary" :loading="purchaseDemandLoading" :disabled="!mrpShortageRows.length" @click="createPurchaseDemands">
              <el-icon><Plus /></el-icon>
              <span>生成采购建议</span>
            </el-button>
            <el-button size="small" type="success" :loading="workOrderLoading" :disabled="!mrpProductionPlanRows.length" @click="createWorkOrders">
              <el-icon><Plus /></el-icon>
              <span>生成生产工单</span>
            </el-button>
          </div>
        </div>
        <div class="panel-body">
          <div class="mrp-summary">
            <div class="mrp-kpi">
              <span>参与计算订单</span>
              <strong>{{ mrpOrderSummary.orderCount }}</strong>
            </div>
            <div class="mrp-kpi">
              <span>建议生产数量</span>
              <strong>{{ formatNumber(mrpOrderSummary.productionQty) }}</strong>
            </div>
            <div class="mrp-kpi">
              <span>缺料项</span>
              <strong>{{ mrpShortageRows.length }}</strong>
            </div>
            <div class="mrp-kpi">
              <span>可生成采购</span>
              <strong>{{ mrpShortageRows.length ? '是' : '否' }}</strong>
            </div>
            <div class="mrp-kpi">
              <span>生产建议</span>
              <strong>{{ mrpProductionPlanRows.length }}</strong>
            </div>
            <div class="mrp-kpi">
              <span>生产工单</span>
              <strong>{{ mrpWorkOrders.length }}</strong>
            </div>
          </div>

          <div class="subsection-title">生产建议</div>
          <el-table
            v-loading="mrpLoading"
            :data="mrpProductionPlanRows"
            max-height="220"
            row-key="product_material_id"
            border
            empty-text="暂无生产建议"
            class="mrp-subtable"
          >
            <el-table-column label="成品" min-width="190">
              <template #default="{ row }">
                <div class="material-cell">
                  <strong>{{ row.product_material_code }}</strong>
                  <span>{{ row.product_material_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="销售/库存/生产" min-width="170" align="right">
              <template #default="{ row }">
                <div class="stack-cell right">
                  <strong>生产 {{ formatNumber(row.planned_qty) }} {{ row.unit }}</strong>
                  <span>销售 {{ formatNumber(row.sales_qty) }} / 库存 {{ formatNumber(row.finished_available_qty) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="采用配方" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ row.bom_no }} · {{ row.bom_version }}</template>
            </el-table-column>
            <el-table-column prop="source_order_nos" label="来源订单" min-width="220" show-overflow-tooltip />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="row.open_work_order_count > 0 ? 'success' : 'warning'">{{ row.plan_status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="subsection-title">已生成工单</div>
          <el-table
            v-loading="mrpLoading"
            :data="mrpWorkOrders"
            max-height="220"
            row-key="id"
            border
            empty-text="暂无生产工单"
            class="mrp-subtable"
          >
            <el-table-column prop="work_order_no" label="工单号" min-width="190" show-overflow-tooltip />
            <el-table-column label="成品" min-width="180">
              <template #default="{ row }">
                <div class="material-cell">
                  <strong>{{ row.product_material_code }}</strong>
                  <span>{{ row.product_material_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="计划数量" width="130" align="right">
              <template #default="{ row }">{{ formatNumber(row.planned_qty) }} {{ row.unit }}</template>
            </el-table-column>
            <el-table-column label="缺料项" width="100" align="right">
              <template #default="{ row }">
                <span :class="{ shortage: Number(row.shortage_item_count || 0) > 0 }">{{ row.shortage_item_count || 0 }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" type="info">{{ row.work_order_status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="subsection-title">缺料明细</div>
          <el-table
            v-loading="mrpLoading"
            :data="mrpRows"
            max-height="460"
            row-key="row_no"
            border
            empty-text="暂无缺料结果"
          >
            <el-table-column label="成品" min-width="190">
              <template #default="{ row }">
                <div class="material-cell">
                  <strong>{{ row.product_material_code }}</strong>
                  <span>{{ row.product_material_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="销售/生产" width="150" align="right">
              <template #default="{ row }">
                <div class="stack-cell right">
                  <strong>销售 {{ formatNumber(row.sales_qty) }}</strong>
                  <span>生产 {{ formatNumber(row.production_qty) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="需要的物料" min-width="210">
              <template #default="{ row }">
                <div class="material-cell">
                  <strong>{{ row.component_material_code }}</strong>
                  <span>{{ row.component_material_name }}</span>
                  <em>{{ row.component_material_category || '-' }}</em>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="需要数量" width="130" align="right">
              <template #default="{ row }">{{ formatNumber(row.required_qty) }} {{ row.unit }}</template>
            </el-table-column>
            <el-table-column label="可用库存" width="130" align="right">
              <template #default="{ row }">{{ formatNumber(row.available_qty) }} {{ row.unit }}</template>
            </el-table-column>
            <el-table-column label="缺料" width="130" align="right">
              <template #default="{ row }">
                <span :class="{ shortage: Number(row.shortage_qty || 0) > 0 }">
                  {{ formatNumber(row.shortage_qty) }} {{ row.unit }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="Number(row.shortage_qty || 0) > 0 ? 'danger' : 'success'">
                  {{ row.mrp_status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source_order_nos" label="来源销售订单" min-width="230" show-overflow-tooltip />
          </el-table>
        </div>
      </section>
    </main>

    <el-drawer
      v-model="bomDialog.visible"
      :title="bomDialog.form.id ? '编辑产品配方' : '新建产品配方'"
      size="560px"
      direction="rtl"
      append-to-body
      destroy-on-close
    >
      <div class="drawer-intro">
        <strong>{{ bomDialog.form.id ? '修改产品、产出数量或启用状态' : '先填主信息，保存后再添加用料' }}</strong>
        <span>配方用于生产领料、用量换算、采购建议和生产工单。</span>
      </div>
      <el-form :model="bomDialog.form" label-width="112px">
        <el-form-item label="配方编号" required>
          <el-input v-model.trim="bomDialog.form.bom_no" placeholder="例如：BOM-MAT-FG-001-V1" />
        </el-form-item>
        <el-form-item label="配方名称" required>
          <el-input v-model.trim="bomDialog.form.bom_name" placeholder="例如：香煎金鲳鱼标准BOM" />
        </el-form-item>
        <el-form-item label="生产产品" required>
          <el-select v-model="bomDialog.form.parent_material_id" filterable placeholder="选择成品/半成品" style="width: 100%">
            <el-option
              v-for="m in materials"
              :key="m.id"
              :label="`${m.batch_no} · ${m.name}`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <div class="form-two-col">
          <el-form-item label="版本" required>
            <el-input v-model.trim="bomDialog.form.version" placeholder="V1" />
          </el-form-item>
          <el-form-item label="配方类型">
            <el-select v-model="bomDialog.form.bom_type">
              <el-option v-for="item in bomTypeOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="一次产出" required>
            <el-input-number v-model="bomDialog.form.base_qty" :min="0.000001" :precision="3" controls-position="right" />
          </el-form-item>
          <el-form-item label="单位" required>
            <el-input v-model.trim="bomDialog.form.unit" placeholder="盒/箱/千克" />
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="bomDialog.form.status">
              <el-option v-for="item in statusOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="生效日期">
            <el-date-picker v-model="bomDialog.form.effective_from" type="date" value-format="YYYY-MM-DD" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input v-model="bomDialog.form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="bomDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="bomDialog.saving" @click="saveBom">保存主信息</el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer
      v-model="itemDialog.visible"
      :title="itemDialog.form.id ? '编辑用料' : '添加用料'"
      size="560px"
      direction="rtl"
      append-to-body
      destroy-on-close
    >
      <div class="drawer-intro" v-if="selectedBom">
        <strong>{{ selectedBom.parent_material_name }}</strong>
        <span>当前按 {{ formatNumber(selectedBom.base_qty) }} {{ selectedBom.unit }} 产出维护标准用量。</span>
      </div>
      <el-form :model="itemDialog.form" label-width="112px">
        <el-form-item label="序号" required>
          <el-input-number v-model="itemDialog.form.line_no" :min="1" :step="10" controls-position="right" />
        </el-form-item>
        <el-form-item label="用到的物料" required>
          <el-select v-model="itemDialog.form.component_material_id" filterable placeholder="选择原料/包材/半成品" style="width: 100%">
            <el-option
              v-for="m in componentMaterialOptions"
              :key="m.id"
              :label="`${m.batch_no} · ${m.name}`"
              :value="m.id"
            />
          </el-select>
        </el-form-item>
        <div class="form-two-col">
          <el-form-item label="标准用量" required>
            <el-input-number v-model="itemDialog.form.qty" :min="0.000001" :precision="4" controls-position="right" />
          </el-form-item>
          <el-form-item label="单位" required>
            <el-input v-model.trim="itemDialog.form.unit" placeholder="千克/个/盒" />
          </el-form-item>
          <el-form-item label="损耗率">
            <el-input-number v-model="itemDialog.form.loss_rate" :min="0" :max="0.999999" :step="0.01" :precision="4" controls-position="right" />
          </el-form-item>
          <el-form-item label="发料方式">
            <el-select v-model="itemDialog.form.issue_method">
              <el-option v-for="item in issueMethodOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="替代组">
          <el-input v-model.trim="itemDialog.form.substitute_group" placeholder="可选，同组表示可替代" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemDialog.form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="itemDialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="itemDialog.saving" @click="saveItem">保存用料</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
import request from '@/utils/request'
import { hasPerm } from '@/utils/permission'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const currentUser = computed(() => userStore.userInfo?.username || 'Admin')

const loading = ref(false)
const itemsLoading = ref(false)
const explodeLoading = ref(false)
const mrpLoading = ref(false)
const purchaseDemandLoading = ref(false)
const workOrderLoading = ref(false)
const keyword = ref('')
const boms = ref([])
const bomItems = ref([])
const materials = ref([])
const explosionRows = ref([])
const mrpRows = ref([])
const mrpOrderRows = ref([])
const mrpProductionPlanRows = ref([])
const mrpWorkOrders = ref([])
const selectedBomId = ref('')
const explodeQty = ref(1)
const activeView = ref('list')

const viewTabs = [
  { key: 'list', label: '选配方' },
  { key: 'items', label: '维护用料' },
  { key: 'explode', label: '算用量' },
  { key: 'mrp', label: '缺料建议' }
]
const bomTypeOptions = ['生产BOM', '包装BOM', '研发BOM', '委外BOM']
const statusOptions = ['草稿', '启用', '停用', '作废']
const issueMethodOptions = ['按需领料', '倒冲领料', '不发料']

const canCreate = computed(() => hasPerm('op:mms_bom.create'))
const canEdit = computed(() => hasPerm('op:mms_bom.edit'))
const canDelete = computed(() => hasPerm('op:mms_bom.delete'))

const bomDialog = reactive({
  visible: false,
  saving: false,
  form: createEmptyBomForm()
})

const itemDialog = reactive({
  visible: false,
  saving: false,
  form: createEmptyItemForm()
})

const selectedBom = computed(() => boms.value.find(item => item.id === selectedBomId.value) || null)

const mrpShortageRows = computed(() => mrpRows.value.filter(row => Number(row.shortage_qty || 0) > 0))

const enabledBomCount = computed(() => boms.value.filter(item => item.status === '启用').length)

const draftBomCount = computed(() => boms.value.filter(item => item.status === '草稿').length)

const guideSteps = computed(() => [
  {
    key: 'choose',
    no: '1',
    title: '选择产品配方',
    desc: '找到要生产的产品',
    view: 'list',
    done: Boolean(selectedBom.value)
  },
  {
    key: 'materials',
    no: '2',
    title: '填写用料',
    desc: '录入原料、辅料和包材',
    view: 'items',
    done: bomItems.value.length > 0
  },
  {
    key: 'check',
    no: '3',
    title: '检查用量',
    desc: '按生产数量自动换算',
    view: 'explode',
    done: explosionRows.value.length > 0
  },
  {
    key: 'shortage',
    no: '4',
    title: '查看缺料建议',
    desc: '需要时生成采购或生产建议',
    view: 'mrp',
    done: mrpRows.value.length > 0
  }
])

const mrpOrderSummary = computed(() => {
  const includedOrders = mrpOrderRows.value.filter(row => row.mrp_included)
  const productPlan = new Map()
  mrpRows.value.forEach((row) => {
    const key = row.product_material_code || row.product_material_id
    if (!productPlan.has(key)) {
      productPlan.set(key, Number(row.production_qty || 0))
    }
  })
  return {
    orderCount: includedOrders.length,
    productionQty: Array.from(productPlan.values()).reduce((sum, value) => sum + value, 0)
  }
})

const filteredBoms = computed(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return boms.value
  return boms.value.filter((item) => [
    item.bom_no,
    item.bom_name,
    item.parent_material_code,
    item.parent_material_name,
    item.version,
    item.status
  ].some(value => String(value || '').toLowerCase().includes(text)))
})

const componentMaterialOptions = computed(() => {
  const parentId = Number(selectedBom.value?.parent_material_id || bomDialog.form.parent_material_id || 0)
  return materials.value.filter(item => Number(item.id) !== parentId)
})

function createEmptyBomForm() {
  return {
    id: '',
    bom_no: '',
    bom_name: '',
    parent_material_id: null,
    version: 'V1',
    base_qty: 1,
    unit: '',
    bom_type: '生产BOM',
    status: '草稿',
    effective_from: new Date().toISOString().slice(0, 10),
    remark: ''
  }
}

function createEmptyItemForm() {
  return {
    id: '',
    line_no: 10,
    component_material_id: null,
    qty: 1,
    unit: '',
    loss_rate: 0,
    issue_method: '按需领料',
    substitute_group: '',
    remark: ''
  }
}

const formatNumber = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
}

const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`

const formatDate = (value) => {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

const getStatusTagType = (status) => {
  if (status === '启用') return 'success'
  if (status === '草稿') return 'warning'
  if (status === '作废') return 'danger'
  return 'info'
}

const getMaterialUnit = (materialId) => {
  const item = materials.value.find(m => Number(m.id) === Number(materialId))
  return item?.properties?.unit || item?.properties?.measure_unit || ''
}

const buildBomNo = (materialId, version = 'V1') => {
  const item = materials.value.find(m => Number(m.id) === Number(materialId))
  if (!item?.batch_no) return ''
  return `BOM-${item.batch_no}-${version || 'V1'}`
}

const loadMaterials = async () => {
  const rows = await request({
    url: '/raw_materials?select=id,batch_no,name,category,properties&order=batch_no.asc',
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  materials.value = Array.isArray(rows) ? rows : []
}

const loadBoms = async () => {
  loading.value = true
  try {
    const rows = await request({
      url: '/v_boms?select=*&order=updated_at.desc',
      method: 'get',
      headers: { 'Accept-Profile': 'scm' }
    })
    boms.value = Array.isArray(rows) ? rows : []
    if (!selectedBomId.value && boms.value.length) {
      selectedBomId.value = boms.value[0].id
    }
    if (selectedBomId.value && !boms.value.some(item => item.id === selectedBomId.value)) {
      selectedBomId.value = boms.value[0]?.id || ''
    }
  } finally {
    loading.value = false
  }
}

const loadItems = async () => {
  if (!selectedBomId.value) {
    bomItems.value = []
    return
  }
  itemsLoading.value = true
  try {
    const rows = await request({
      url: `/v_bom_items?bom_id=eq.${selectedBomId.value}&order=line_no.asc`,
      method: 'get',
      headers: { 'Accept-Profile': 'scm' }
    })
    bomItems.value = Array.isArray(rows) ? rows : []
  } finally {
    itemsLoading.value = false
  }
}

const loadExplosion = async () => {
  if (!selectedBom.value?.parent_material_id) {
    explosionRows.value = []
    return
  }
  explodeLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/explode_bom',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: {
        p_parent_material_id: selectedBom.value.parent_material_id,
        p_qty: explodeQty.value || 1,
        p_version: selectedBom.value.version || null
      }
    })
    explosionRows.value = Array.isArray(rows) ? rows : []
  } finally {
    explodeLoading.value = false
  }
}

const loadMrp = async () => {
  mrpLoading.value = true
  try {
    const [orders, rows, productionPlans, workOrders] = await Promise.all([
      request({
        url: '/v_sales_bom_order_plan?select=*&order=order_no.asc',
        method: 'get',
        headers: { 'Accept-Profile': 'scm' }
      }),
      request({
        url: '/v_sales_bom_mrp?select=*&order=product_material_code.asc,component_material_code.asc',
        method: 'get',
        headers: { 'Accept-Profile': 'scm' }
      }),
      request({
        url: '/v_sales_bom_production_plan?select=*&order=product_material_code.asc',
        method: 'get',
        headers: { 'Accept-Profile': 'scm' }
      }),
      request({
        url: '/v_production_work_orders?select=*&order=created_at.desc',
        method: 'get',
        headers: { 'Accept-Profile': 'scm' }
      })
    ])
    mrpOrderRows.value = Array.isArray(orders) ? orders : []
    mrpRows.value = Array.isArray(rows) ? rows : []
    mrpProductionPlanRows.value = Array.isArray(productionPlans) ? productionPlans : []
    mrpWorkOrders.value = Array.isArray(workOrders) ? workOrders : []
  } finally {
    mrpLoading.value = false
  }
}

const loadAll = async () => {
  await loadMaterials()
  await loadBoms()
  await loadItems()
  await loadExplosion()
  await loadMrp()
}

const goWorkflowStep = (step) => {
  if (!step?.view) return
  activeView.value = step.view
}

const selectBom = (bom, nextView = '') => {
  if (bom?.id && bom.id !== selectedBomId.value) {
    bomItems.value = []
    explosionRows.value = []
  }
  selectedBomId.value = bom?.id || ''
  if (nextView) activeView.value = nextView
}

const openBomDialog = (row = null) => {
  Object.assign(bomDialog.form, createEmptyBomForm(), row ? {
    id: row.id,
    bom_no: row.bom_no,
    bom_name: row.bom_name,
    parent_material_id: row.parent_material_id,
    version: row.version,
    base_qty: Number(row.base_qty || 1),
    unit: row.unit || '',
    bom_type: row.bom_type || '生产BOM',
    status: row.status || '草稿',
    effective_from: formatDate(row.effective_from) === '-' ? '' : formatDate(row.effective_from),
    remark: row.remark || ''
  } : {})
  bomDialog.visible = true
}

const openItemDialog = (row = null) => {
  if (!selectedBomId.value) {
    ElMessage.warning('请先选择一个产品配方')
    activeView.value = 'list'
    return
  }
  const nextLineNo = bomItems.value.length
    ? Math.max(...bomItems.value.map(item => Number(item.line_no || 0))) + 10
    : 10
  Object.assign(itemDialog.form, createEmptyItemForm(), row ? {
    id: row.id,
    line_no: Number(row.line_no || 10),
    component_material_id: row.component_material_id,
    qty: Number(row.qty || 1),
    unit: row.unit || '',
    loss_rate: Number(row.loss_rate || 0),
    issue_method: row.issue_method || '按需领料',
    substitute_group: row.substitute_group || '',
    remark: row.remark || ''
  } : {
    line_no: nextLineNo
  })
  itemDialog.visible = true
}

const saveBom = async () => {
  const form = bomDialog.form
  if (!form.bom_no || !form.bom_name || !form.parent_material_id || !form.version || !form.base_qty || !form.unit) {
    ElMessage.warning('请填写配方编号、名称、生产产品、版本、一次产出和单位')
    return
  }
  const isCreating = !form.id
  bomDialog.saving = true
  try {
    const payload = {
      bom_no: form.bom_no,
      bom_name: form.bom_name,
      parent_material_id: form.parent_material_id,
      version: form.version,
      base_qty: Number(form.base_qty),
      unit: form.unit,
      bom_type: form.bom_type,
      status: form.status,
      effective_from: form.effective_from || null,
      remark: form.remark || null,
      created_by: currentUser.value
    }
    if (form.id) {
      await request({
        url: `/boms?id=eq.${form.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: payload
      })
      ElMessage.success('产品配方已更新')
    } else {
      const created = await request({
        url: '/boms',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', Prefer: 'return=representation' },
        data: payload
      })
      selectedBomId.value = Array.isArray(created) && created[0]?.id ? created[0].id : selectedBomId.value
      ElMessage.success('产品配方已创建，请继续添加用料')
    }
    bomDialog.visible = false
    await loadBoms()
    await loadItems()
    await loadExplosion()
    if (isCreating) activeView.value = 'items'
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '保存失败')
  } finally {
    bomDialog.saving = false
  }
}

const saveItem = async () => {
  if (!selectedBomId.value) return
  const form = itemDialog.form
  if (!form.component_material_id || !form.qty || !form.unit) {
    ElMessage.warning('请选择用到的物料，并填写标准用量和单位')
    return
  }
  itemDialog.saving = true
  try {
    const payload = {
      bom_id: selectedBomId.value,
      line_no: Number(form.line_no || 10),
      component_material_id: form.component_material_id,
      qty: Number(form.qty),
      unit: form.unit,
      loss_rate: Number(form.loss_rate || 0),
      issue_method: form.issue_method,
      substitute_group: form.substitute_group || null,
      remark: form.remark || null
    }
    if (form.id) {
      await request({
        url: `/bom_items?id=eq.${form.id}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
        data: payload
      })
      ElMessage.success('用料已更新')
    } else {
      await request({
        url: '/bom_items',
        method: 'post',
        headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', Prefer: 'return=representation' },
        data: payload
      })
      ElMessage.success('用料已添加')
    }
    itemDialog.visible = false
    await Promise.all([loadItems(), loadBoms(), loadExplosion()])
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '保存失败')
  } finally {
    itemDialog.saving = false
  }
}

const deleteBom = async (row) => {
  if (!row?.id) return
  await ElMessageBox.confirm(`确认删除配方 ${row.bom_no}？用料清单也会一起删除。`, '删除产品配方', {
    type: 'warning'
  })
  await request({
    url: `/boms?id=eq.${row.id}`,
    method: 'delete',
    headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' }
  })
  ElMessage.success('产品配方已删除')
  selectedBomId.value = ''
  await loadBoms()
  await loadItems()
}

const deleteItem = async (row) => {
  if (!row?.id) return
  await ElMessageBox.confirm(`确认删除用料 ${row.component_material_code}？`, '删除用料', {
    type: 'warning'
  })
  await request({
    url: `/bom_items?id=eq.${row.id}`,
    method: 'delete',
    headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' }
  })
  ElMessage.success('用料已删除')
  await Promise.all([loadItems(), loadBoms(), loadExplosion()])
}

const createPurchaseDemands = async () => {
  if (!mrpShortageRows.value.length) {
    ElMessage.info('当前没有缺料项，无需生成采购需求')
    return
  }
  purchaseDemandLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/create_purchase_demands_from_sales_bom',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: {
        p_product_material_id: null,
        p_required_date: null,
        p_requester_name: currentUser.value || 'BOM-MRP'
      }
    })
    const count = Array.isArray(rows) ? rows.length : 0
    ElMessage.success(`已生成/更新 ${count} 条采购需求`)
    await loadMrp()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '生成采购需求失败')
  } finally {
    purchaseDemandLoading.value = false
  }
}

const createWorkOrders = async () => {
  if (!mrpProductionPlanRows.value.length) {
    ElMessage.info('当前没有生产计划，无需生成生产工单')
    return
  }
  workOrderLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/create_work_orders_from_sales_bom',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: {
        p_created_by: currentUser.value || 'BOM-MRP'
      }
    })
    const count = Array.isArray(rows) ? rows.length : 0
    ElMessage.success(`已生成/更新 ${count} 张生产工单`)
    await loadMrp()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '生成生产工单失败')
  } finally {
    workOrderLoading.value = false
  }
}

watch(() => bomDialog.form.parent_material_id, (materialId) => {
  if (!bomDialog.visible) return
  const unit = getMaterialUnit(materialId)
  if (unit && !bomDialog.form.unit) bomDialog.form.unit = unit
  if (!bomDialog.form.id && !bomDialog.form.bom_no) {
    bomDialog.form.bom_no = buildBomNo(materialId, bomDialog.form.version)
  }
})

watch(() => bomDialog.form.version, (version) => {
  if (!bomDialog.visible || bomDialog.form.id || !bomDialog.form.parent_material_id) return
  bomDialog.form.bom_no = buildBomNo(bomDialog.form.parent_material_id, version)
})

watch(() => itemDialog.form.component_material_id, (materialId) => {
  if (!itemDialog.visible) return
  const unit = getMaterialUnit(materialId)
  if (unit) itemDialog.form.unit = unit
})

watch(selectedBomId, async () => {
  explodeQty.value = Number(selectedBom.value?.base_qty || 1)
  await loadItems()
  await loadExplosion()
})

onMounted(loadAll)
</script>

<style scoped>
.bom-page {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: auto;
  padding: 10px;
  background: #f5f7fb;
  color: #1f2937;
}

.bom-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.title-block {
  min-width: 0;
}

.title-block h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 700;
}

.title-block p {
  margin: 0;
  color: #667085;
  font-size: 12px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

.bom-guide {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 8px;
  margin-top: 10px;
  flex-shrink: 0;
}

.guide-step {
  min-width: 0;
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  color: #1f2937;
  text-align: left;
  cursor: pointer;
}

.guide-step.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.12);
}

.guide-step.done {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.step-no {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 700;
  font-size: 13px;
}

.step-main {
  min-width: 0;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}

.step-main strong {
  color: #1f2937;
  font-size: 13px;
}

.step-main em {
  color: #667085;
  font-size: 12px;
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bom-controlbar {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(260px, 1fr) auto;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
  margin-top: 10px;
  padding: 10px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.search-input {
  width: 100%;
}

.bom-selector {
  width: 100%;
}

.bom-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.bom-option strong {
  color: #1f2937;
  font-size: 12px;
}

.bom-option span {
  color: #667085;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.view-switch {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border: 1px solid #d0d5dd;
  border-radius: 6px;
  background: #f9fafb;
  white-space: nowrap;
}

.view-switch button {
  height: 30px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #475467;
  cursor: pointer;
  font-size: 13px;
}

.view-switch button.active {
  background: #2563eb;
  color: #fff;
}

.bom-overview {
  display: grid;
  grid-template-columns: repeat(5, minmax(110px, 1fr));
  gap: 8px;
  margin-top: 10px;
  flex-shrink: 0;
}

.overview-item {
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.overview-item span {
  display: block;
  margin-bottom: 4px;
  color: #667085;
  font-size: 12px;
}

.overview-item strong {
  color: #1f2937;
  font-size: 20px;
  font-weight: 700;
}

.bom-strip {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.4fr) auto;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
  margin-top: 10px;
  padding: 10px;
  background: #fff;
  border: 1px solid #dbeafe;
  border-radius: 6px;
}

.strip-main,
.material-cell,
.stack-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.strip-main strong {
  color: #1f2937;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strip-main span,
.strip-meta span,
.material-cell span,
.material-cell em,
.stack-cell span {
  color: #667085;
  font-size: 12px;
  font-style: normal;
}

.strip-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.strip-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.strip-actions :deep(.el-button) {
  margin-left: 0;
}

.empty-current {
  border-color: #fde68a;
  background: #fffbeb;
}

.bom-workspace {
  flex: 1;
  min-height: 0;
  margin-top: 10px;
}

.workspace-panel {
  min-height: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.panel-head,
.panel-actions,
.explode-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-head {
  padding: 9px 12px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-head > div:first-child {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.panel-head strong {
  font-size: 13px;
}

.panel-head span,
.panel-actions span,
.explode-actions span {
  color: #667085;
  font-size: 12px;
}

.panel-body {
  padding: 12px;
}

.list-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  align-items: stretch;
}

.list-main {
  min-width: 0;
}

.selection-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #f8fbff;
}

.selection-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #667085;
  font-size: 12px;
}

.selection-card > strong {
  display: block;
  color: #1f2937;
  font-size: 15px;
  line-height: 1.4;
}

.selection-card p {
  margin: 6px 0 12px;
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.selection-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.selection-facts div {
  padding: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.selection-facts span,
.selection-facts b {
  display: block;
}

.selection-facts span {
  margin-bottom: 2px;
  color: #667085;
  font-size: 12px;
}

.selection-facts b {
  color: #1f2937;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.selection-actions :deep(.el-button) {
  margin-left: 0;
}

.workspace-empty {
  padding: 72px 0;
}

.mrp-summary {
  display: grid;
  grid-template-columns: repeat(6, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.mrp-subtable {
  margin-bottom: 12px;
}

.subsection-title {
  margin: 12px 0 8px;
  color: #1f2937;
  font-size: 13px;
  font-weight: 700;
}

.subsection-title:first-of-type {
  margin-top: 0;
}

.mrp-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f9fafb;
}

.mrp-kpi span {
  color: #667085;
  font-size: 12px;
}

.mrp-kpi strong {
  color: #1f2937;
  font-size: 18px;
}

.material-cell strong {
  color: #1f2937;
  font-size: 12px;
}

.material-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stack-cell strong {
  color: #1f2937;
  font-size: 12px;
  font-weight: 600;
}

.stack-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stack-cell.right {
  align-items: flex-end;
}

.shortage {
  color: #dc2626;
  font-weight: 700;
}

.explode-actions :deep(.el-input-number) {
  width: 128px;
}

.form-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 16px;
}

.drawer-intro {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #f8fbff;
}

.drawer-intro strong {
  color: #1f2937;
  font-size: 13px;
}

.drawer-intro span {
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.drawer-footer :deep(.el-button) {
  margin-left: 0;
}

:deep(.el-input-number) {
  width: 100%;
}

@media (max-width: 1120px) {
  .bom-guide {
    grid-template-columns: repeat(2, minmax(160px, 1fr));
  }

  .bom-controlbar {
    grid-template-columns: 1fr 1fr;
  }

  .view-switch {
    grid-column: 1 / -1;
    width: max-content;
  }

  .bom-strip {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .bom-overview {
    grid-template-columns: repeat(3, minmax(110px, 1fr));
  }

  .list-layout {
    grid-template-columns: 1fr;
  }

  .strip-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .bom-page {
    padding: 8px;
  }

  .bom-topbar,
  .top-actions,
  .panel-head,
  .panel-actions,
  .explode-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .bom-guide,
  .bom-overview {
    grid-template-columns: 1fr;
  }

  .guide-step {
    min-height: auto;
  }

  .bom-controlbar {
    grid-template-columns: 1fr;
  }

  .view-switch {
    width: 100%;
    overflow-x: auto;
  }

  .mrp-summary {
    grid-template-columns: 1fr 1fr;
  }

  .form-two-col {
    grid-template-columns: 1fr;
  }
}
</style>
