<template>
  <div class="ontology-workbench">
    <section class="wb-hero">
      <div class="hero-text">
        <h2>本体关系工作台</h2>
        <p>以图关系方式查看系统表之间的本体语义关系与影响范围。</p>
      </div>
      <div class="hero-actions">
        <el-tag effect="dark" type="info">已加载 {{ filteredRelations.length }} 条关系</el-tag>
        <el-button :loading="loading || reasoningLoading" type="primary" @click="reloadAll">刷新数据</el-button>
        <el-button @click="goBack">返回应用中心</el-button>
      </div>
    </section>

    <section class="wb-metric-row">
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">关系总数</div>
        <div class="metric-value">{{ filteredRelations.length }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">表总数</div>
        <div class="metric-value">{{ allTables.length }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">本体关系</div>
        <div class="metric-value">{{ ontologyCount }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">外键关系</div>
        <div class="metric-value">{{ foreignKeyCount }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">推理事实</div>
        <div class="metric-value">{{ reasoningSummary.facts_total || 0 }}</div>
      </el-card>
      <el-card shadow="never" class="wb-card metric-line-item">
        <div class="metric-label">推理规则</div>
        <div class="metric-value">{{ reasoningSummary.active_rules || 0 }}</div>
      </el-card>
    </section>

    <section class="reasoning-section">
      <el-card shadow="never" class="wb-card reasoning-card">
        <template #header>
          <div class="card-header">
            <span>知识图谱推理</span>
            <div class="header-controls">
              <el-tag :type="reasoningSummary.last_run_status === 'completed' ? 'success' : 'warning'" effect="plain">
                {{ reasoningSummary.last_run_status || '未刷新' }}
              </el-tag>
              <el-button size="small" text :loading="reasoningLoading" @click="loadReasoning">
                读取推理
              </el-button>
              <el-button size="small" type="primary" plain :loading="reasoningRefreshLoading" @click="refreshReasoning">
                刷新推理
              </el-button>
            </div>
          </div>
        </template>

        <div class="reasoning-metrics">
          <div v-for="item in reasoningMetricCards" :key="item.key" class="reasoning-metric">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>

        <div class="reasoning-toolbar">
          <el-select v-model="reasoningPredicate" size="small" style="width: 210px" @change="loadReasoningFacts">
            <el-option label="全部推理边" value="" />
            <el-option label="角色访问应用" value="acl:canAccessApp" />
            <el-option label="角色访问业务表" value="acl:canAccessTable" />
            <el-option label="角色操作业务表" value="acl:canOperateTable" />
            <el-option label="传递依赖" value="ontology:transitivelyDependsOn" />
            <el-option label="敏感字段可达" value="risk:canAccessSensitiveColumn" />
          </el-select>
          <el-input
            v-model="reasoningSearchText"
            clearable
            size="small"
            class="reasoning-search"
            placeholder="筛选主体/客体/规则"
          />
          <el-tag effect="plain">事实 {{ filteredReasoningFacts.length }} 条</el-tag>
        </div>

        <el-table
          :data="filteredReasoningFacts"
          size="small"
          border
          stripe
          :loading="reasoningLoading"
          max-height="300"
        >
          <el-table-column label="主体" min-width="180">
            <template #default="{ row }">
              <div>{{ row.subject_label || row.subject_id }}</div>
              <div class="table-raw">{{ row.subject_type }}:{{ row.subject_id }}</div>
            </template>
          </el-table-column>
          <el-table-column label="谓词" min-width="170">
            <template #default="{ row }">{{ predicateLabel(row.predicate) }}</template>
          </el-table-column>
          <el-table-column label="客体" min-width="180">
            <template #default="{ row }">
              <div>{{ row.object_label || row.object_id }}</div>
              <div class="table-raw">{{ row.object_type }}:{{ row.object_id }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="rule_name" label="规则" min-width="150" />
          <el-table-column prop="inference_depth" label="深度" width="76" />
          <el-table-column prop="is_inferred" label="类型" width="88">
            <template #default="{ row }">
              <el-tag size="small" :type="row.is_inferred ? 'success' : 'info'" effect="plain">
                {{ row.is_inferred ? '推理' : '种子' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div class="path-panel">
          <div class="detail-title">路径解释</div>
          <div class="path-toolbar">
            <el-select v-model="pathSubjectType" size="small" style="width: 120px">
              <el-option label="角色" value="role" />
              <el-option label="表" value="table" />
              <el-option label="应用" value="app" />
              <el-option label="权限" value="permission" />
            </el-select>
            <el-input v-model="pathSubjectId" size="small" class="path-input" placeholder="主体标识" />
            <el-select v-model="pathObjectType" clearable size="small" style="width: 120px">
              <el-option label="应用" value="app" />
              <el-option label="表" value="table" />
              <el-option label="权限" value="permission" />
              <el-option label="字段" value="column" />
            </el-select>
            <el-input v-model="pathObjectId" clearable size="small" class="path-input" placeholder="目标标识" />
            <el-button size="small" :loading="pathLoading" @click="explainPath">解释路径</el-button>
          </div>
          <el-table
            v-if="pathRows.length"
            :data="pathRows"
            size="small"
            border
            stripe
            max-height="220"
          >
            <el-table-column prop="depth" label="深度" width="76" />
            <el-table-column label="终点" min-width="180">
              <template #default="{ row }">
                <div>{{ row.terminal_label || row.terminal_id }}</div>
                <div class="table-raw">{{ row.terminal_type }}:{{ row.terminal_id }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="path_text" label="解释链" min-width="420" show-overflow-tooltip />
          </el-table>
          <div v-else class="column-empty-tip">暂无路径结果</div>
        </div>

        <div class="insight-panel">
          <div class="insight-header">
            <div class="detail-title">推理洞察</div>
            <div class="header-controls">
              <el-tag :type="reasoningHealthTagType" effect="plain">
                {{ reasoningHealth.health_code || 'unknown' }}
              </el-tag>
              <el-button size="small" text :loading="insightLoading" @click="loadReasoningInsights">
                读取洞察
              </el-button>
            </div>
          </div>

          <div class="insight-metrics">
            <div v-for="item in insightMetricCards" :key="item.key" class="insight-metric">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>

          <el-tabs class="insight-tabs">
            <el-tab-pane label="角色风险">
              <el-table :data="roleAccessInsights" size="small" border stripe max-height="260">
                <el-table-column label="角色" min-width="150">
                  <template #default="{ row }">
                    <div>{{ row.role_name || row.role_code }}</div>
                    <div class="table-raw">{{ row.role_code }}</div>
                  </template>
                </el-table-column>
                <el-table-column prop="accessible_apps" label="应用" width="76" />
                <el-table-column prop="accessible_tables" label="表" width="76" />
                <el-table-column prop="operable_tables" label="可操作表" width="96" />
                <el-table-column prop="sensitive_columns" label="敏感字段" width="96" />
                <el-table-column prop="sensitive_tables" label="敏感表" width="88" />
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="表影响">
              <el-table :data="tableImpactInsights" size="small" border stripe max-height="260">
                <el-table-column label="表" min-width="210">
                  <template #default="{ row }">
                    <div>{{ row.table_label || row.table_id }}</div>
                    <div class="table-raw">{{ row.table_id }}</div>
                  </template>
                </el-table-column>
                <el-table-column prop="sensitive_columns" label="敏感字段" width="96" />
                <el-table-column prop="roles_can_access" label="可访问角色" width="104" />
                <el-table-column prop="roles_can_operate" label="可操作角色" width="104" />
                <el-table-column prop="transitive_dependent_tables" label="传递影响" width="96" />
                <el-table-column prop="depends_on_tables" label="依赖数" width="88" />
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="规则统计">
              <el-table :data="ruleStats" size="small" border stripe max-height="260">
                <el-table-column label="规则" min-width="220">
                  <template #default="{ row }">
                    <div>{{ cleanDisplayText(row.rule_name) || row.rule_code }}</div>
                    <div class="table-raw">{{ row.rule_code }}</div>
                  </template>
                </el-table-column>
                <el-table-column prop="declared_predicate" label="谓词" min-width="150">
                  <template #default="{ row }">{{ predicateLabel(row.declared_predicate) }}</template>
                </el-table-column>
                <el-table-column prop="facts_total" label="事实" width="76" />
                <el-table-column prop="inferred_facts" label="推理" width="76" />
                <el-table-column prop="predicate_count" label="谓词数" width="88" />
                <el-table-column prop="is_active" label="状态" width="82">
                  <template #default="{ row }">
                    <el-tag size="small" :type="row.is_active ? 'success' : 'info'" effect="plain">
                      {{ row.is_active ? '启用' : '停用' }}
                    </el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>

            <el-tab-pane label="敏感路径">
              <el-table :data="sensitiveAccessPaths" size="small" border stripe max-height="260">
                <el-table-column label="角色" min-width="130">
                  <template #default="{ row }">
                    <div>{{ row.role_name || row.role_code }}</div>
                    <div class="table-raw">{{ row.role_code }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="字段" min-width="220">
                  <template #default="{ row }">
                    <div>{{ row.column_label || row.column_name }}</div>
                    <div class="table-raw">{{ row.column_id }}</div>
                  </template>
                </el-table-column>
                <el-table-column label="表" min-width="180">
                  <template #default="{ row }">
                    <div>{{ row.table_label || row.table_id }}</div>
                    <div class="table-raw">{{ row.table_id }}</div>
                  </template>
                </el-table-column>
                <el-table-column prop="access_rule" label="访问证据" min-width="170" show-overflow-tooltip />
              </el-table>
            </el-tab-pane>
          </el-tabs>

          <div class="role-explain-panel">
            <div class="role-explain-toolbar">
              <span class="role-explain-label">角色访问解释</span>
              <el-input v-model="roleExplainCode" clearable size="small" class="path-input" placeholder="角色编码" />
              <el-button size="small" :loading="roleExplainLoading" @click="explainRoleAccess">解释角色</el-button>
              <el-tag effect="plain">路径 {{ roleExplainRows.length }} 条</el-tag>
            </div>
            <el-table
              v-if="roleExplainRows.length"
              :data="roleExplainRows"
              size="small"
              border
              stripe
              max-height="260"
            >
              <el-table-column label="目标" min-width="220">
                <template #default="{ row }">
                  <div>{{ row.target_label || row.target_id }}</div>
                  <div class="table-raw">{{ row.target_type }}:{{ row.target_id }}</div>
                </template>
              </el-table-column>
              <el-table-column label="谓词" min-width="170">
                <template #default="{ row }">{{ predicateLabel(row.predicate) }}</template>
              </el-table-column>
              <el-table-column prop="permission_code" label="权限证据" min-width="220" show-overflow-tooltip />
              <el-table-column prop="path_text" label="解释链" min-width="360" show-overflow-tooltip />
            </el-table>
            <div v-else class="column-empty-tip">暂无角色解释结果</div>
          </div>
        </div>
      </el-card>
    </section>

    <section class="wb-layout">
      <main class="wb-main full">
        <el-card shadow="never" class="wb-card relation-card">
          <template #header>
            <div class="card-header">
              <span>图关系总览</span>
              <div class="header-controls">
                <el-select v-model="relationType" size="small" style="width: 140px">
                  <el-option label="全部类型" value="all" />
                  <el-option label="本体关系" value="ontology" />
                  <el-option label="外键关系" value="foreign_key" />
                </el-select>
                <el-tag type="success" effect="plain">
                  当前聚焦: {{ selectedTable ? tableDisplayLabel(selectedTable) : '全部表' }}
                </el-tag>
                <el-button size="small" text :disabled="!selectedTable" @click="clearTableFocus">
                  查看全部
                </el-button>
              </div>
            </div>
          </template>

          <div class="graph-toolbar">
            <el-input
              v-model="searchText"
              clearable
              class="graph-search"
              placeholder="筛选关系（表名/关系词/说明）"
            />
            <div class="graph-tip">点击表格图标可聚焦该表关系，再次点击可取消聚焦。</div>
            <div class="graph-zoom">
              <el-button size="small" @click="zoomOut">缩小</el-button>
              <el-slider
                v-model="graphZoom"
                :min="0.6"
                :max="1.8"
                :step="0.1"
                style="width: 130px"
              />
              <el-button size="small" @click="zoomIn">放大</el-button>
              <el-button size="small" text @click="resetZoom">100%</el-button>
            </div>
            <el-tag effect="plain">当前展示 {{ graphRelations.length }} 条关系</el-tag>
          </div>

          <div ref="graphHostRef" class="graph-host">
            <OntologyRelationGraph
              :relations="graphRelations"
              :selected-table="selectedTable"
              :picked-relation-id="pickedRelationId"
              :table-label-map="tableLabelMap"
              :predicate-label="predicateLabel"
              :host-width="graphHostWidth"
              :zoom="graphZoom"
              @toggle-table="toggleTableFocus"
              @pick-relation="pickRelation"
            />
          </div>

          <div class="relation-detail" v-if="pickedRelation">
            <div class="detail-title">关系详情</div>
            <div class="detail-grid">
              <div class="detail-item"><span>类型</span><strong>{{ relationTypeLabel(pickedRelation.relation_type) }}</strong></div>
              <div class="detail-item"><span>关系词</span><strong>{{ predicateLabel(pickedRelation.predicate) }}</strong></div>
              <div class="detail-item">
                <span>主体</span>
                <strong>{{ tableDisplayLabel(pickedRelation.subject_table) }}（{{ pickedRelation.subject_table }}{{ formatColumn(pickedRelation.subject_column) }}）</strong>
              </div>
              <div class="detail-item">
                <span>客体</span>
                <strong>{{ tableDisplayLabel(pickedRelation.object_table) }}（{{ pickedRelation.object_table }}{{ formatColumn(pickedRelation.object_column) }}）</strong>
              </div>
              <div class="detail-item full"><span>桥接表</span><strong>{{ pickedRelation.bridge_table || '-' }}</strong></div>
              <div class="detail-item full"><span>说明</span><strong>{{ pickedRelation.details || '-' }}</strong></div>
            </div>
          </div>

          <div class="column-semantic-panel">
            <div class="detail-title">列级语义</div>
            <div class="column-toolbar">
              <el-tag effect="plain" type="info">
                当前范围: {{ selectedTable ? tableDisplayLabel(selectedTable) : '未选中表（点击图中表节点）' }}
              </el-tag>
              <el-tag effect="plain">列语义 {{ currentColumnRows.length }} 条</el-tag>
              <el-button
                size="small"
                text
                :loading="columnSemanticsLoading"
                :disabled="columnTablesForDisplay.length === 0"
                @click="reloadColumnSemantics"
              >
                刷新列语义
              </el-button>
            </div>

            <div v-if="columnTablesForDisplay.length === 0" class="column-empty-tip">
              点击图中的表格节点后，可查看该表的列级语义（字段语义、敏感标记、语义来源等）。
            </div>

            <el-table
              v-else
              :data="currentColumnRows"
              size="small"
              border
              stripe
              :loading="columnSemanticsLoading"
              max-height="320"
            >
              <el-table-column label="所属表" min-width="170">
                <template #default="{ row }">
                  <div>{{ tableDisplayLabel(row.table_key) }}</div>
                  <div class="table-raw">{{ row.table_key }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="column_name" label="字段名" min-width="130" />
              <el-table-column prop="semantic_name" label="语义名" min-width="150" />
              <el-table-column prop="semantic_class" label="语义类型" min-width="120">
                <template #default="{ row }">{{ semanticClassLabel(row.semantic_class) }}</template>
              </el-table-column>
              <el-table-column prop="data_type" label="数据类型" width="110" />
              <el-table-column prop="ui_type" label="界面类型" width="110" />
              <el-table-column prop="semantics_mode" label="语义模式" width="120">
                <template #default="{ row }">{{ semanticsModeLabel(row.semantics_mode) }}</template>
              </el-table-column>
              <el-table-column prop="source" label="来源" width="110" />
              <el-table-column prop="is_sensitive" label="敏感" width="90">
                <template #default="{ row }">
                  <el-tag size="small" :type="row.is_sensitive ? 'danger' : 'info'" effect="plain">
                    {{ row.is_sensitive ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>

        <el-card shadow="never" class="wb-card list-card">
          <template #header>
            <div class="card-header">
              <span>关系明细列表</span>
              <div class="header-controls">
                <el-tag type="info" effect="plain">更新时间 {{ refreshedAt }}</el-tag>
                <el-button size="small" text @click="toggleListPanel">
                  {{ listPanelExpanded ? '收起列表' : '展开列表' }}
                </el-button>
              </div>
            </div>
          </template>
          <div v-if="!listPanelExpanded" class="list-collapsed-tip">
            明细列表已收起，可点击“展开列表”查看关系明细。
          </div>
          <el-table
            v-else
            :data="tableRows"
            size="small"
            border
            stripe
            height="280"
            @row-click="pickRelation"
          >
            <el-table-column prop="relation_type" label="关系类型" width="120">
              <template #default="{ row }">
                <el-tag size="small" :type="row.relation_type === 'ontology' ? 'primary' : 'success'">
                  {{ relationTypeLabel(row.relation_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="subject_table" label="主体表" min-width="180">
              <template #default="{ row }">
                <div>{{ tableDisplayLabel(row.subject_table) }}</div>
                <div class="table-raw">{{ row.subject_table }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="predicate" label="关系词" min-width="180">
              <template #default="{ row }">{{ predicateLabel(row.predicate) }}</template>
            </el-table-column>
            <el-table-column prop="object_table" label="客体表" min-width="180">
              <template #default="{ row }">
                <div>{{ tableDisplayLabel(row.object_table) }}</div>
                <div class="table-raw">{{ row.object_table }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="details" label="说明" min-width="260" show-overflow-tooltip />
          </el-table>
        </el-card>
      </main>
    </section>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import OntologyRelationGraph from '@/components/OntologyRelationGraph.vue'

const router = useRouter()

const loading = ref(false)
const relations = ref([])
const searchText = ref('')
const relationType = ref('ontology')
const selectedTable = ref('')
const pickedRelationId = ref(null)
const refreshedAt = ref('-')
const graphHostRef = ref(null)
const graphHostWidth = ref(1000)
const listPanelExpanded = ref(false)
const graphZoom = ref(1)
const columnSemanticsLoading = ref(false)
const columnSemanticsCache = ref({})
const reasoningLoading = ref(false)
const reasoningRefreshLoading = ref(false)
const reasoningSummary = ref({})
const reasoningFacts = ref([])
const reasoningPredicate = ref('')
const reasoningSearchText = ref('')
const insightLoading = ref(false)
const reasoningHealth = ref({})
const roleAccessInsights = ref([])
const tableImpactInsights = ref([])
const ruleStats = ref([])
const sensitiveAccessPaths = ref([])
const roleExplainLoading = ref(false)
const roleExplainCode = ref('sales_manager')
const roleExplainRows = ref([])
const pathLoading = ref(false)
const pathSubjectType = ref('role')
const pathSubjectId = ref('sales_manager')
const pathObjectType = ref('app')
const pathObjectId = ref('')
const pathRows = ref([])
let graphResizeObserver = null

const STATIC_TABLE_LABELS = {
  'public.users': '用户',
  'public.roles': '角色',
  'public.permissions': '权限点',
  'public.user_roles': '用户角色关系',
  'public.role_permissions': '角色权限关系',
  'public.v_permission_ontology': '权限语义视图',
  'public.ontology_inference_rules': '本体推理规则',
  'public.ontology_inferred_facts': '本体推理事实',
  'public.ontology_reasoning_runs': '本体推理运行',
  'public.v_ontology_reasoning_facts': '本体推理事实视图',
  'public.v_ontology_reasoning_edges': '本体推理边视图',
  'public.v_ontology_reasoning_summary': '本体推理摘要',
  'public.v_ontology_reasoning_rule_stats': '本体推理规则统计',
  'public.v_ontology_role_access_insights': '角色访问洞察',
  'public.v_ontology_sensitive_access_paths': '敏感字段访问路径',
  'public.v_ontology_table_dependency_paths': '表依赖路径',
  'public.v_ontology_table_impact_insights': '表影响洞察',
  'public.v_ontology_reasoning_health': '本体推理健康状态',
  'workflow.definitions': '流程定义',
  'workflow.instances': '流程实例',
  'workflow.task_assignments': '任务分派',
  'app_center.apps': '应用中心应用',
  'app_center.workflow_state_mappings': '流程状态映射'
}

const PREDICATE_LABELS = {
  'acl:hasRole': '拥有角色',
  'acl:grantsPermission': '授予权限',
  'wf:instanceOf': '实例属于流程定义',
  'wf:hasCurrentTask': '实例当前任务',
  'wf:assignedRole': '任务分配给角色',
  'wf:assignedUser': '任务分配给用户',
  'wf:mapsToStatus': '流程节点映射业务状态',
  'eiscore:linkedApp': '流程关联应用',
  'ontology:semanticProjection': '权限语义投影',
  'ontology:dependsOn': '业务依赖关系',
  'ontology:transitivelyDependsOn': '传递依赖',
  'ontology:belongsTo': '字段属于表',
  'ontology:hasDomain': '所属业务域',
  'app:usesTable': '应用使用业务表',
  'acl:requiresPermission': '需要权限',
  'acl:canAccessApp': '可访问应用',
  'acl:canOperateAppAction': '可执行应用动作',
  'acl:canAccessTable': '可访问业务表',
  'acl:canOperateTable': '可操作业务表',
  'wf:canPerformTransition': '可执行流程迁移',
  'data:hasSensitiveColumn': '包含敏感字段',
  'risk:canAccessSensitiveColumn': '可达敏感字段',
  'rdf:type': '类型'
}

const SEMANTIC_CLASS_LABELS = {
  business_attribute: '业务属性',
  enum_attribute: '枚举属性',
  hierarchy_attribute: '层级属性',
  geo_attribute: '地理属性',
  file_attribute: '文件属性',
  derived_metric: '派生指标',
  time_attribute: '时间属性',
  json_attribute: 'JSON属性',
  identifier: '标识',
  reference_attribute: '引用属性',
  boolean_attribute: '布尔属性'
}

const normalizedSearch = computed(() => String(searchText.value || '').trim().toLowerCase())

const filteredRelations = computed(() => {
  const keyword = normalizedSearch.value
  return relations.value.filter((item) => {
    const typePass = relationType.value === 'all' || item.relation_type === relationType.value
    if (!typePass) return false
    if (!keyword) return true
    const haystack = [
      item.subject_table,
      item.subject_column,
      item.predicate,
      item.object_table,
      item.object_column,
      item.subject_semantic_name,
      item.object_semantic_name,
      item.bridge_table,
      item.details
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const allTables = computed(() => {
  const set = new Set()
  filteredRelations.value.forEach((item) => {
    if (item.subject_table) set.add(item.subject_table)
    if (item.object_table) set.add(item.object_table)
  })
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const graphRelations = computed(() => {
  if (!selectedTable.value) return filteredRelations.value
  return filteredRelations.value.filter((item) =>
    item.subject_table === selectedTable.value || item.object_table === selectedTable.value
  )
})

const ontologyCount = computed(() =>
  filteredRelations.value.filter((item) => item.relation_type === 'ontology').length
)

const foreignKeyCount = computed(() =>
  filteredRelations.value.filter((item) => item.relation_type === 'foreign_key').length
)

const pickedRelation = computed(() =>
  graphRelations.value.find((item) => item.id === pickedRelationId.value) || null
)

const tableRows = computed(() => graphRelations.value.slice(0, 500))

const columnTablesForDisplay = computed(() => {
  if (selectedTable.value) return [selectedTable.value]
  if (!pickedRelation.value) return []
  const list = [pickedRelation.value.subject_table, pickedRelation.value.object_table]
  return Array.from(new Set(list.filter(Boolean)))
})

const currentColumnRows = computed(() => {
  return columnTablesForDisplay.value.flatMap((tableKey) => {
    const rows = columnSemanticsCache.value[tableKey] || []
    return rows.map((row) => ({ ...row, table_key: tableKey }))
  })
})

const reasoningMetricCards = computed(() => ([
  { key: 'facts', label: '事实总数', value: reasoningSummary.value.facts_total || 0 },
  { key: 'inferred', label: '推理事实', value: reasoningSummary.value.inferred_facts || 0 },
  { key: 'app', label: '角色-应用', value: reasoningSummary.value.role_app_access_facts || 0 },
  { key: 'table', label: '角色-业务表', value: reasoningSummary.value.role_table_access_facts || 0 },
  { key: 'sensitive', label: '敏感可达', value: reasoningSummary.value.sensitive_exposure_facts || 0 },
  { key: 'dependency', label: '传递依赖', value: reasoningSummary.value.transitive_dependency_facts || 0 }
]))

const reasoningHealthTagType = computed(() => {
  if (reasoningHealth.value.is_healthy === true) return 'success'
  if (reasoningHealth.value.health_code) return 'danger'
  return 'info'
})

const insightMetricCards = computed(() => ([
  {
    key: 'relations',
    label: '关系覆盖',
    value: `${reasoningHealth.value.semanticized_relations || 0}/${reasoningHealth.value.api_relations || 0}`
  },
  {
    key: 'columns',
    label: '字段覆盖',
    value: `${reasoningHealth.value.semanticized_columns || 0}/${reasoningHealth.value.ontology_columns || 0}`
  },
  { key: 'roles', label: '角色洞察', value: roleAccessInsights.value.length },
  { key: 'tables', label: '影响表', value: tableImpactInsights.value.length },
  { key: 'sensitive', label: '敏感路径', value: sensitiveAccessPaths.value.length },
  { key: 'rules', label: '规则统计', value: ruleStats.value.length }
]))

const filteredReasoningFacts = computed(() => {
  const keyword = String(reasoningSearchText.value || '').trim().toLowerCase()
  if (!keyword) return reasoningFacts.value
  return reasoningFacts.value.filter((item) => {
    const haystack = [
      item.subject_type,
      item.subject_id,
      item.subject_label,
      item.predicate,
      item.object_type,
      item.object_id,
      item.object_label,
      item.inference_rule,
      item.rule_name
    ].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const firstRow = (value) => (Array.isArray(value) ? value[0] : value)

const relationTypeLabel = (value) => {
  if (value === 'ontology') return '本体关系'
  if (value === 'foreign_key') return '外键关系'
  return value || '-'
}

const semanticClassLabel = (value) => SEMANTIC_CLASS_LABELS[value] || value || '-'

const semanticsModeLabel = (value) => {
  if (value === 'ai_defined') return 'AI定义'
  if (value === 'creator_defined') return '创建者定义'
  if (value === 'none') return '无语义'
  return value || '-'
}

const predicateLabel = (value) => PREDICATE_LABELS[value] || value || '-'

const cleanDisplayText = (value) => {
  const text = String(value || '').trim()
  if (!text || text.includes('?')) return ''
  return text
}

const formatColumn = (value) => (value ? `.${value}` : '')

const sanitizeSemanticName = (value, fallback) => {
  const name = String(value || '').trim()
  if (!name || name === fallback) return ''
  if (name.includes('?')) return ''
  return name
}

const tableLabelMap = computed(() => {
  const map = { ...STATIC_TABLE_LABELS }
  filteredRelations.value.forEach((item) => {
    if (item.subject_table) {
      const semantic = sanitizeSemanticName(item.subject_semantic_name, item.subject_table)
      if (semantic) map[item.subject_table] = semantic
    }
    if (item.object_table) {
      const semantic = sanitizeSemanticName(item.object_semantic_name, item.object_table)
      if (semantic) map[item.object_table] = semantic
    }
  })
  return map
})

const tableDisplayLabel = (table) => tableLabelMap.value[table] || table

const parseTableKey = (tableKey) => {
  const value = String(tableKey || '').trim()
  if (!value) return null
  const chunks = value.split('.')
  if (chunks.length === 1) return { schema: 'public', table: chunks[0], tableKey: `public.${chunks[0]}` }
  const schema = chunks[0]
  const table = chunks.slice(1).join('.')
  return { schema, table, tableKey: `${schema}.${table}` }
}

const extractSemanticsMode = (tags) => {
  if (!Array.isArray(tags)) return ''
  const hit = tags.find((item) => String(item || '').startsWith('semantics:'))
  if (!hit) return ''
  return String(hit).slice('semantics:'.length)
}

const fetchColumnSemanticsByTable = async (tableKey) => {
  const parsed = parseTableKey(tableKey)
  if (!parsed) return []
  const schema = encodeURIComponent(parsed.schema)
  const table = encodeURIComponent(parsed.table)
  const rows = await request({
    url: `/ontology_column_semantics?select=table_schema,table_name,column_name,semantic_class,semantic_name,data_type,ui_type,is_sensitive,source,tags,is_active&table_schema=eq.${schema}&table_name=eq.${table}&is_active=is.true&order=column_name.asc`,
    method: 'get',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    }
  })
  if (!Array.isArray(rows)) return []
  return rows.map((item) => ({
    ...item,
    table_key: `${item.table_schema}.${item.table_name}`,
    semantics_mode: extractSemanticsMode(item.tags)
  }))
}

const ensureColumnSemanticsLoaded = async (tableKeys, force = false) => {
  const targets = Array.from(new Set((tableKeys || []).filter(Boolean))).filter((key) =>
    force || !Array.isArray(columnSemanticsCache.value[key])
  )
  if (!targets.length) return
  columnSemanticsLoading.value = true
  try {
    const list = await Promise.all(targets.map((key) => fetchColumnSemanticsByTable(key)))
    const next = { ...columnSemanticsCache.value }
    targets.forEach((key, index) => {
      next[key] = list[index]
    })
    columnSemanticsCache.value = next
  } catch {
    ElMessage.error('加载列语义失败')
  } finally {
    columnSemanticsLoading.value = false
  }
}

const reloadColumnSemantics = async () => {
  if (!columnTablesForDisplay.value.length) return
  const next = { ...columnSemanticsCache.value }
  columnTablesForDisplay.value.forEach((key) => {
    delete next[key]
  })
  columnSemanticsCache.value = next
  await ensureColumnSemanticsLoaded(columnTablesForDisplay.value, true)
}

const fetchReasoningSummary = async () => {
  const rows = await request({
    url: '/v_ontology_reasoning_summary?select=last_run_status,facts_total,seed_facts,inferred_facts,active_rules,role_app_access_facts,role_table_access_facts,workflow_transition_facts,sensitive_exposure_facts,transitive_dependency_facts,last_finished_at&limit=1',
    method: 'get',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    }
  })
  reasoningSummary.value = firstRow(rows) || {}
}

const loadReasoningFacts = async () => {
  const predicateFilter = reasoningPredicate.value
    ? `&predicate=eq.${encodeURIComponent(reasoningPredicate.value)}`
    : ''
  const rows = await request({
    url: `/v_ontology_reasoning_facts?select=id,subject_type,subject_id,subject_label,predicate,object_type,object_id,object_label,inference_rule,rule_name,inference_depth,is_inferred,evidence${predicateFilter}&order=is_inferred.desc,inference_depth.asc,id.asc&limit=200`,
    method: 'get',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    }
  })
  reasoningFacts.value = Array.isArray(rows) ? rows : []
}

const loadReasoning = async () => {
  reasoningLoading.value = true
  try {
    await Promise.all([fetchReasoningSummary(), loadReasoningFacts()])
  } catch {
    ElMessage.error('加载推理数据失败')
  } finally {
    reasoningLoading.value = false
  }
}

const loadReasoningInsights = async () => {
  insightLoading.value = true
  try {
    const [
      healthRows,
      roleRows,
      tableRows,
      ruleRows,
      sensitiveRows
    ] = await Promise.all([
      request({
        url: '/v_ontology_reasoning_health?select=id,is_healthy,health_code,facts_total,inferred_facts,api_relations,semanticized_relations,ontology_columns,semanticized_columns,missing_relation_semantics,missing_column_semantics,last_run_status,last_finished_at&limit=1',
        method: 'get',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/v_ontology_role_access_insights?select=role_code,role_name,accessible_apps,accessible_tables,operable_tables,sensitive_columns,sensitive_tables,inferred_permission_paths&order=sensitive_columns.desc,accessible_apps.desc,role_code.asc&limit=50',
        method: 'get',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/v_ontology_table_impact_insights?select=table_id,table_label,sensitive_columns,roles_can_access,roles_can_operate,direct_dependent_tables,transitive_dependent_tables,depends_on_tables,has_reasoning_impact&has_reasoning_impact=eq.true&order=transitive_dependent_tables.desc,roles_can_access.desc,table_id.asc&limit=50',
        method: 'get',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/v_ontology_reasoning_rule_stats?select=rule_code,rule_name,declared_predicate,facts_total,seed_facts,inferred_facts,predicate_count,is_active,min_depth,max_depth&order=inferred_facts.desc,facts_total.desc,rule_code.asc&limit=50',
        method: 'get',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/v_ontology_sensitive_access_paths?select=role_code,role_name,table_id,table_label,column_id,column_name,column_label,access_rule,access_predicate,inference_rule,rule_name&order=role_code.asc,table_id.asc,column_name.asc&limit=50',
        method: 'get',
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      })
    ])
    reasoningHealth.value = firstRow(healthRows) || {}
    roleAccessInsights.value = Array.isArray(roleRows) ? roleRows : []
    tableImpactInsights.value = Array.isArray(tableRows) ? tableRows : []
    ruleStats.value = Array.isArray(ruleRows) ? ruleRows : []
    sensitiveAccessPaths.value = Array.isArray(sensitiveRows) ? sensitiveRows : []
    await explainRoleAccess(true)
  } catch {
    ElMessage.error('加载推理洞察失败')
  } finally {
    insightLoading.value = false
  }
}

const refreshReasoning = async () => {
  reasoningRefreshLoading.value = true
  try {
    await request({
      url: '/rpc/refresh_ontology_inferences',
      method: 'post',
      data: { p_max_depth: 4 },
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    await Promise.all([loadReasoning(), loadReasoningInsights()])
    ElMessage.success('推理刷新完成')
  } catch {
    ElMessage.error('刷新推理失败')
  } finally {
    reasoningRefreshLoading.value = false
  }
}

const explainRoleAccess = async (silent = false) => {
  const roleCode = String(roleExplainCode.value || '').trim()
  if (!roleCode) {
    if (!silent) ElMessage.warning('请填写角色编码')
    return
  }
  roleExplainLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/explain_role_ontology_access',
      method: 'post',
      data: {
        p_role_code: roleCode,
        p_limit: 50
      },
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    roleExplainRows.value = Array.isArray(rows) ? rows : []
  } catch {
    if (!silent) ElMessage.error('角色访问解释失败')
  } finally {
    roleExplainLoading.value = false
  }
}

const explainPath = async () => {
  const subjectId = String(pathSubjectId.value || '').trim()
  if (!subjectId) {
    ElMessage.warning('请填写主体标识')
    return
  }
  pathLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/explain_ontology_path',
      method: 'post',
      data: {
        p_subject_type: pathSubjectType.value,
        p_subject_id: subjectId,
        p_object_type: pathObjectType.value || null,
        p_object_id: String(pathObjectId.value || '').trim() || null,
        p_max_depth: 4
      },
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    pathRows.value = Array.isArray(rows) ? rows : []
  } catch {
    ElMessage.error('路径解释失败')
  } finally {
    pathLoading.value = false
  }
}

const toggleTableFocus = (table) => {
  if (!table) {
    selectedTable.value = ''
    syncPickedRelation()
    return
  }
  selectedTable.value = selectedTable.value === table ? '' : table
  syncPickedRelation()
}

const clearTableFocus = () => {
  selectedTable.value = ''
  syncPickedRelation()
}

const toggleListPanel = () => {
  listPanelExpanded.value = !listPanelExpanded.value
  nextTick(() => updateGraphHostWidth())
}

const zoomIn = () => {
  graphZoom.value = Math.min(1.8, Number((graphZoom.value + 0.1).toFixed(1)))
}

const zoomOut = () => {
  graphZoom.value = Math.max(0.6, Number((graphZoom.value - 0.1).toFixed(1)))
}

const resetZoom = () => {
  graphZoom.value = 1
}

const pickRelation = (row) => {
  if (!row) return
  pickedRelationId.value = row.id
  if (
    selectedTable.value &&
    row.subject_table !== selectedTable.value &&
    row.object_table !== selectedTable.value
  ) {
    selectedTable.value = ''
  }
}

const syncPickedRelation = () => {
  if (!graphRelations.value.some((item) => item.id === pickedRelationId.value)) {
    pickedRelationId.value = null
  }
}

const syncSelectedTable = () => {
  if (!allTables.value.length) {
    selectedTable.value = ''
    pickedRelationId.value = null
    return
  }
  if (selectedTable.value && !allTables.value.includes(selectedTable.value)) {
    selectedTable.value = ''
  }
  syncPickedRelation()
}

const updateGraphHostWidth = () => {
  const width = graphHostRef.value?.clientWidth || 1000
  graphHostWidth.value = Math.max(860, width - 6)
}

const bindGraphResizeObserver = () => {
  updateGraphHostWidth()
  if (typeof ResizeObserver === 'undefined' || !graphHostRef.value) return
  graphResizeObserver = new ResizeObserver(() => {
    updateGraphHostWidth()
  })
  graphResizeObserver.observe(graphHostRef.value)
}

const reload = async () => {
  loading.value = true
  try {
    const rows = await request({
      url: '/ontology_table_relations?select=id,relation_type,subject_table,subject_column,predicate,object_table,object_column,bridge_table,details,subject_semantic_name,object_semantic_name&order=relation_type.asc,id.asc',
      method: 'get',
      headers: {
        'Accept-Profile': 'app_data',
        'Content-Profile': 'app_data'
      }
    })
    relations.value = Array.isArray(rows) ? rows : []
    refreshedAt.value = new Date().toLocaleTimeString()
    syncSelectedTable()
  } catch (error) {
    ElMessage.error('加载关系数据失败')
  } finally {
    loading.value = false
  }
}

const reloadAll = async () => {
  await Promise.all([reload(), loadReasoning(), loadReasoningInsights()])
}

const goBack = () => {
  router.push('/')
}

watch(filteredRelations, () => {
  syncSelectedTable()
})

watch(columnTablesForDisplay, (tables) => {
  ensureColumnSemanticsLoaded(tables)
}, { immediate: true })

onMounted(() => {
  reloadAll()
  nextTick(() => bindGraphResizeObserver())
})

onBeforeUnmount(() => {
  if (graphResizeObserver) {
    graphResizeObserver.disconnect()
    graphResizeObserver = null
  }
})
</script>

<style scoped>
.ontology-workbench {
  min-height: 100vh;
  padding: 18px;
  background:
    radial-gradient(1200px 420px at -10% -20%, color-mix(in srgb, var(--el-color-primary) 16%, transparent), transparent 60%),
    radial-gradient(900px 380px at 110% -30%, color-mix(in srgb, var(--el-color-success) 14%, transparent), transparent 58%),
    var(--el-bg-color-page);
}

.wb-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--el-color-primary) 14%, var(--el-bg-color)),
    color-mix(in srgb, var(--el-color-primary-light-8) 40%, var(--el-bg-color))
  );
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, transparent);
}

.hero-text h2 {
  margin: 0 0 6px;
  font-size: 24px;
  line-height: 1.2;
  color: var(--el-text-color-primary);
}

.hero-text p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.wb-metric-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.wb-layout {
  display: block;
}

.wb-main.full {
  min-width: 0;
}

.wb-card {
  border-radius: 12px;
  border: 1px solid var(--el-border-color-light);
}

.metric-line-item {
  padding: 10px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 60%, var(--el-fill-color-blank));
}

.metric-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.metric-value {
  margin-top: 6px;
  color: var(--el-text-color-primary);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.relation-card {
  margin-bottom: 12px;
}

.reasoning-section {
  margin-bottom: 12px;
}

.reasoning-card :deep(.el-card__body) {
  padding-top: 12px;
}

.reasoning-metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.reasoning-metric {
  min-width: 0;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 9px 10px;
}

.reasoning-metric span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.reasoning-metric strong {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-primary);
  font-size: 20px;
  line-height: 1;
}

.reasoning-toolbar,
.path-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.reasoning-search {
  width: min(320px, 100%);
}

.path-panel {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 10px;
}

.insight-panel {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  padding: 10px;
}

.insight-header,
.role-explain-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.insight-metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 8px;
}

.insight-metric {
  min-width: 0;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 8px 10px;
}

.insight-metric span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.insight-metric strong {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-primary);
  font-size: 18px;
  line-height: 1;
  word-break: break-all;
}

.insight-tabs {
  margin-top: 2px;
}

.role-explain-panel {
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
}

.role-explain-toolbar {
  justify-content: flex-start;
}

.role-explain-label {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.path-input {
  width: min(260px, 100%);
}

.graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 52%, var(--el-fill-color-blank));
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 20%, var(--el-border-color));
}

.graph-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.graph-search {
  width: min(420px, 100%);
}

.graph-zoom {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-fill-color-blank) 84%, var(--el-color-primary-light-9));
  border: 1px solid var(--el-border-color-light);
}

.graph-host {
  min-height: clamp(520px, 66vh, 900px);
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 8px;
}

.relation-detail {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 10px;
}

.column-semantic-panel {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 10px;
}

.column-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.column-empty-tip {
  padding: 14px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.detail-item {
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color-light);
  padding: 8px;
}

.detail-item span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 4px;
}

.detail-item strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  word-break: break-all;
}

.detail-item.full {
  grid-column: 1 / -1;
}

.list-card :deep(.el-card__body) {
  padding-top: 10px;
}

.table-raw {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  margin-top: 2px;
}

.list-collapsed-tip {
  padding: 14px 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  background: var(--el-fill-color-extra-light);
}

@media (max-width: 1200px) {
  .wb-metric-row,
  .reasoning-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .wb-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .wb-metric-row,
  .reasoning-metrics {
    grid-template-columns: 1fr;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
