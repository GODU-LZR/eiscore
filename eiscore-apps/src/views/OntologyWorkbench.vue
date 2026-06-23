<template>
  <div class="ontology-workbench">
    <section class="wb-hero">
      <div class="hero-text">
        <h2>本体关系工作台</h2>
        <p>以图关系方式查看系统表之间的本体语义关系与影响范围。</p>
      </div>
      <div class="hero-metrics" aria-label="本体关系概览指标">
        <div v-for="item in topMetricCards" :key="item.key" class="hero-metric">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <div class="hero-actions">
        <el-tag effect="dark" size="small" type="info">已加载 {{ filteredRelations.length }} 条关系</el-tag>
        <el-button :loading="loading || reasoningLoading" size="small" type="primary" @click="reloadAll">刷新数据</el-button>
        <el-button size="small" @click="goBack">返回应用中心</el-button>
      </div>
    </section>

    <section class="workbench-shell" :class="{ 'nav-collapsed': navCollapsed }">
      <aside class="workbench-nav" :class="{ 'is-collapsed': navCollapsed }" aria-label="本体工作台功能导航">
        <div class="workbench-nav-toolbar">
          <span class="workbench-nav-label">工作台视图</span>
          <el-tooltip :content="navCollapsed ? '展开侧栏' : '收起侧栏'" placement="right">
            <el-button
              class="nav-collapse-button"
              circle
              text
              size="small"
              :icon="navCollapsed ? Expand : Fold"
              :aria-label="navCollapsed ? '展开本体工作台侧栏' : '收起本体工作台侧栏'"
              @click="toggleNavCollapsed"
            />
          </el-tooltip>
        </div>
        <button
          v-for="item in workbenchViews"
          :key="item.key"
          type="button"
          class="workbench-nav-item"
          :class="[`attention-${item.attention}`, { active: activeWorkbenchView === item.key }]"
          :title="`${item.title} ${item.metric}`"
          :aria-label="`${item.title}，${item.desc}，${item.metric}`"
          @click="setActiveWorkbenchView(item.key)"
        >
          <span class="nav-icon" aria-hidden="true">
            <component :is="item.icon" />
          </span>
          <span class="nav-main">
            <span class="nav-title">{{ item.title }}</span>
            <span class="nav-desc">{{ item.desc }}</span>
          </span>
          <span class="nav-meta">
            <span class="attention-dot"></span>
            <span>{{ item.metric }}</span>
          </span>
        </button>
      </aside>

      <div class="workbench-stage">
    <section v-show="['reasoning', 'kg', 'insight'].includes(activeWorkbenchView)" class="reasoning-section workbench-view">
      <el-card shadow="never" class="wb-card reasoning-card">
        <template #header>
          <div class="card-header">
            <span>{{ activeWorkbenchMeta.title }}</span>
            <div v-if="activeWorkbenchView === 'reasoning'" class="header-controls">
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
            <div v-else-if="activeWorkbenchView === 'kg'" class="header-controls">
              <el-tag effect="plain">节点 {{ kgNodes.length }} 个</el-tag>
              <el-tag effect="plain">子图 {{ kgGraphStats.nodes }}/{{ kgGraphStats.links }}</el-tag>
              <el-button size="small" text :loading="kgLoading" @click="loadKgNodes">查询节点</el-button>
            </div>
            <div v-else class="header-controls">
              <el-tag :type="reasoningHealthTagType" effect="plain">
                {{ reasoningHealth.health_code || 'unknown' }}
              </el-tag>
              <el-button size="small" text :loading="insightLoading" @click="loadReasoningInsights">
                读取洞察
              </el-button>
            </div>
          </div>
        </template>

        <div v-show="activeWorkbenchView === 'reasoning'" class="workbench-view-body">
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
        </div>

        <div v-show="activeWorkbenchView === 'kg'" class="kg-panel">
          <div class="kg-header">
            <div class="detail-title">知识图谱查询</div>
            <div class="header-controls">
              <el-tag effect="plain">节点 {{ kgNodes.length }} 个</el-tag>
              <el-button size="small" text :loading="kgLoading" @click="loadKgNodes">查询节点</el-button>
            </div>
          </div>

          <div class="kg-toolbar">
            <el-select v-model="kgNodeType" clearable size="small" style="width: 130px">
              <el-option label="全部节点" value="" />
              <el-option label="角色" value="role" />
              <el-option label="应用" value="app" />
              <el-option label="表" value="table" />
              <el-option label="字段" value="column" />
              <el-option label="权限" value="permission" />
            </el-select>
            <el-input
              v-model="kgSearchText"
              clearable
              size="small"
              class="kg-search"
              placeholder="搜索节点标识/名称/语义"
              @keyup.enter="loadKgNodes"
            />
            <el-button size="small" type="primary" plain :loading="kgLoading" @click="loadKgNodes">
              搜索
            </el-button>
          </div>

          <div class="kg-layout">
            <div class="kg-node-pane">
              <el-table
                :data="kgNodes"
                size="small"
                border
                stripe
                :loading="kgLoading"
                max-height="320"
                highlight-current-row
                @row-click="selectKgNode"
              >
                <el-table-column label="节点" min-width="210">
                  <template #default="{ row }">
                    <div class="kg-node-title">
                      <span>{{ row.node_label || row.node_id }}</span>
                      <el-tag v-if="row.is_sensitive" size="small" type="danger" effect="plain">敏感</el-tag>
                    </div>
                    <div class="table-raw">{{ nodeTypeLabel(row.node_type) }}:{{ row.node_id }}</div>
                  </template>
                </el-table-column>
                <el-table-column prop="semantic_class" label="语义类" width="130" show-overflow-tooltip />
                <el-table-column prop="total_degree" label="度数" width="72" />
              </el-table>
            </div>

            <div class="kg-detail-pane">
              <div v-if="kgSelectedNode" class="kg-selected">
                <div class="kg-selected-title">
                  <span>{{ kgSelectedNode.node_label || kgSelectedNode.node_id }}</span>
                  <el-tag size="small" effect="plain">{{ nodeTypeLabel(kgSelectedNode.node_type) }}</el-tag>
                </div>
                <div class="table-raw">{{ kgSelectedNode.node_type }}:{{ kgSelectedNode.node_id }}</div>
                <div class="kg-metrics">
                  <div v-for="item in kgSelectedMetrics" :key="item.key" class="kg-metric">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
              <div v-else class="column-empty-tip">请选择一个节点。</div>

              <div class="kg-graph-panel">
                <div class="kg-graph-header">
                  <div class="kg-graph-title">子图视图</div>
                  <div class="kg-graph-stats">
                    <el-tag size="small" effect="plain">节点 {{ kgGraphStats.nodes }} 个</el-tag>
                    <el-tag size="small" effect="plain">边 {{ kgGraphStats.links }} 条</el-tag>
                    <el-button size="small" text @click="resizeKgGraph">重绘</el-button>
                  </div>
                </div>
                <div v-show="kgGraphStats.nodes" ref="kgGraphRef" class="kg-graph-canvas"></div>
                <div v-if="!kgGraphStats.nodes" class="column-empty-tip">暂无子图</div>
                <div v-if="kgSelectedEdge" class="kg-edge-proof">
                  <div class="kg-edge-proof-title">
                    <span>{{ kgSelectedEdge.from }} -[{{ predicateLabel(kgSelectedEdge.predicate) }}]-> {{ kgSelectedEdge.to }}</span>
                    <el-tag size="small" :type="kgSelectedEdge.is_inferred ? 'success' : 'info'" effect="plain">
                      {{ kgSelectedEdge.is_inferred ? '推理' : '种子' }}
                    </el-tag>
                  </div>
                  <div class="kg-edge-proof-meta">
                    <span>规则：{{ kgSelectedEdge.rule_name || kgSelectedEdge.inference_rule || '-' }}</span>
                    <span>置信度：{{ kgSelectedEdge.confidence ?? '-' }}</span>
                  </div>
                  <div v-if="kgSelectedEdgeEvidenceRows.length" class="kg-edge-evidence">
                    <div v-for="item in kgSelectedEdgeEvidenceRows" :key="item.key" class="kg-edge-evidence-row">
                      <span>{{ item.key }}</span>
                      <code>{{ item.value }}</code>
                    </div>
                  </div>
                </div>
              </div>

              <el-tabs class="kg-tabs">
                <el-tab-pane label="邻域展开">
                  <div class="kg-subtoolbar">
                    <el-select v-model="kgDirection" size="small" style="width: 112px">
                      <el-option label="出边" value="outgoing" />
                      <el-option label="入边" value="incoming" />
                      <el-option label="双向" value="both" />
                    </el-select>
                    <el-select v-model="kgDepth" size="small" style="width: 96px">
                      <el-option label="1 跳" :value="1" />
                      <el-option label="2 跳" :value="2" />
                      <el-option label="3 跳" :value="3" />
                      <el-option label="4 跳" :value="4" />
                    </el-select>
                    <el-select v-model="kgPredicate" clearable size="small" style="width: 190px">
                      <el-option label="全部谓词" value="" />
                      <el-option label="可访问应用" value="acl:canAccessApp" />
                      <el-option label="可访问业务表" value="acl:canAccessTable" />
                      <el-option label="可操作业务表" value="acl:canOperateTable" />
                      <el-option label="敏感字段可达" value="risk:canAccessSensitiveColumn" />
                      <el-option label="传递依赖" value="ontology:transitivelyDependsOn" />
                    </el-select>
                    <el-button size="small" :loading="kgNeighborLoading" @click="loadKgNeighbors">
                      展开
                    </el-button>
                  </div>

                  <el-table
                    :data="kgNeighbors"
                    size="small"
                    border
                    stripe
                    :loading="kgNeighborLoading"
                    max-height="260"
                    @row-click="selectKgNeighbor"
                  >
                    <el-table-column prop="depth" label="跳数" width="72" />
                    <el-table-column label="方向" width="82">
                      <template #default="{ row }">{{ row.edge_direction === 'incoming' ? '入边' : '出边' }}</template>
                    </el-table-column>
                    <el-table-column label="谓词" min-width="150">
                      <template #default="{ row }">{{ predicateLabel(row.predicate) }}</template>
                    </el-table-column>
                    <el-table-column label="目标" min-width="230">
                      <template #default="{ row }">
                        <div>{{ row.to_label || row.to_id }}</div>
                        <div class="table-raw">{{ row.to_type }}:{{ row.to_id }}</div>
                      </template>
                    </el-table-column>
                    <el-table-column prop="inference_rule" label="规则" min-width="160" show-overflow-tooltip />
                  </el-table>
                </el-tab-pane>

                <el-tab-pane label="路径查询">
                  <div class="kg-subtoolbar">
                    <el-select v-model="kgPathTargetType" size="small" style="width: 112px">
                      <el-option label="应用" value="app" />
                      <el-option label="表" value="table" />
                      <el-option label="字段" value="column" />
                      <el-option label="权限" value="permission" />
                      <el-option label="应用动作" value="app_action" />
                      <el-option label="角色" value="role" />
                    </el-select>
                    <el-input
                      v-model="kgPathTargetId"
                      clearable
                      size="small"
                      class="kg-path-target"
                      placeholder="目标节点标识"
                    />
                    <el-select v-model="kgPathDirection" size="small" style="width: 112px">
                      <el-option label="出边" value="outgoing" />
                      <el-option label="入边" value="incoming" />
                      <el-option label="双向" value="both" />
                    </el-select>
                    <el-select v-model="kgPathDepth" size="small" style="width: 96px">
                      <el-option label="1 跳" :value="1" />
                      <el-option label="2 跳" :value="2" />
                      <el-option label="3 跳" :value="3" />
                      <el-option label="4 跳" :value="4" />
                    </el-select>
                    <el-button size="small" type="primary" plain :loading="kgPathLoading" @click="findKgPaths">
                      查路径
                    </el-button>
                  </div>

                  <el-table
                    :data="kgPathRows"
                    size="small"
                    border
                    stripe
                    :loading="kgPathLoading"
                    max-height="260"
                  >
                    <el-table-column prop="depth" label="深度" width="72" />
                    <el-table-column label="终点" min-width="220">
                      <template #default="{ row }">
                        <div>{{ row.target_label || row.target_id }}</div>
                        <div class="table-raw">{{ row.target_type }}:{{ row.target_id }}</div>
                      </template>
                    </el-table-column>
                    <el-table-column prop="path_text" label="路径" min-width="420" show-overflow-tooltip />
                  </el-table>
                  <div v-if="!kgPathRows.length" class="column-empty-tip kg-empty-tip">点击邻域行可带入目标节点。</div>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>
        </div>

        <div v-show="activeWorkbenchView === 'insight'" class="insight-panel">
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

    <section v-show="activeWorkbenchView === 'relations'" class="wb-layout workbench-view">
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
    </section>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Connection,
  Cpu,
  DataAnalysis,
  Expand,
  Fold,
  Search as SearchIcon
} from '@element-plus/icons-vue'
import request from '@/utils/request'
import OntologyRelationGraph from '@/components/OntologyRelationGraph.vue'

const router = useRouter()

const loading = ref(false)
const relations = ref([])
const activeWorkbenchView = ref('relations')
const navCollapsed = ref(false)
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
const kgLoading = ref(false)
const kgNodes = ref([])
const kgSearchText = ref('sales_manager')
const kgNodeType = ref('role')
const kgSelectedNode = ref(null)
const kgNeighborLoading = ref(false)
const kgNeighbors = ref([])
const kgDirection = ref('outgoing')
const kgDepth = ref(1)
const kgPredicate = ref('')
const kgPathLoading = ref(false)
const kgPathRows = ref([])
const kgPathTargetType = ref('table')
const kgPathTargetId = ref('hr.archives')
const kgPathDirection = ref('outgoing')
const kgPathDepth = ref(2)
const kgGraphRef = ref(null)
const kgSelectedEdge = ref(null)
const pathLoading = ref(false)
const pathSubjectType = ref('role')
const pathSubjectId = ref('sales_manager')
const pathObjectType = ref('app')
const pathObjectId = ref('')
const pathRows = ref([])
let graphResizeObserver = null
let kgGraphResizeObserver = null
let kgChart = null
let kgEchartsModulePromise = null

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
  'public.v_ontology_kg_nodes': '知识图谱节点视图',
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

const KG_NODE_TYPE_LABELS = {
  role: '角色',
  app: '应用',
  app_action: '应用动作',
  table: '表',
  column: '字段',
  permission: '权限',
  permission_kind: '权限类型',
  semantic_class: '语义类',
  semantic_domain: '语义域'
}

const KG_GRAPH_CATEGORIES = [
  { name: '角色' },
  { name: '应用' },
  { name: '业务表' },
  { name: '字段' },
  { name: '权限' },
  { name: '其他' }
]

const KG_GRAPH_CATEGORY_BY_TYPE = {
  role: '角色',
  app: '应用',
  app_action: '应用',
  table: '业务表',
  column: '字段',
  permission: '权限'
}

const KG_GRAPH_NODE_COLORS = {
  role: '#5b6ee1',
  app: '#009688',
  app_action: '#26a69a',
  table: '#3f8cff',
  column: '#d66b9d',
  permission: '#f0a020',
  permission_kind: '#b98b00',
  semantic_class: '#8e6bd6',
  semantic_domain: '#607d8b'
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

const topMetricCards = computed(() => ([
  { key: 'relations', label: '关系总数', value: filteredRelations.value.length },
  { key: 'tables', label: '表总数', value: allTables.value.length },
  { key: 'ontology', label: '本体关系', value: ontologyCount.value },
  { key: 'foreign', label: '外键关系', value: foreignKeyCount.value },
  { key: 'facts', label: '推理事实', value: reasoningSummary.value.facts_total || 0 },
  { key: 'rules', label: '推理规则', value: reasoningSummary.value.active_rules || 0 }
]))

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

const kgSelectedMetrics = computed(() => {
  const node = kgSelectedNode.value || {}
  return [
    { key: 'degree', label: '总度数', value: node.total_degree || node.degree_total || 0 },
    { key: 'out', label: '出边', value: node.outgoing_edges || 0 },
    { key: 'in', label: '入边', value: node.incoming_edges || 0 },
    { key: 'predicates', label: '谓词', value: node.predicate_count || 0 }
  ]
})

const kgGraphPayload = computed(() => {
  const nodes = new Map()
  const links = new Map()

  const selected = kgSelectedNode.value
  if (selected?.node_type && selected?.node_id) {
    addKgGraphNode(nodes, selected.node_type, selected.node_id, selected.node_label, {
      is_sensitive: selected.is_sensitive,
      symbolSize: 50,
      total_degree: selected.total_degree || selected.degree_total || 0
    })
  }

  const addLink = ({
    sourceType,
    sourceId,
    sourceLabel,
    targetType,
    targetId,
    targetLabel,
    predicate,
    edgeId,
    inferenceRule,
    ruleName,
    isInferred,
    confidence,
    evidence
  }) => {
    if (!sourceType || !sourceId || !targetType || !targetId) return
    const sourceNode = addKgGraphNode(nodes, sourceType, sourceId, sourceLabel)
    const targetNode = addKgGraphNode(nodes, targetType, targetId, targetLabel)
    if (!sourceNode || !targetNode) return
    const edge = {
      edge_id: edgeId,
      source: sourceNode.id,
      target: targetNode.id,
      predicate: predicate || '',
      label: {
        show: false,
        formatter: predicateLabel(predicate)
      },
      lineStyle: {
        width: isInferred === false ? 1.2 : 1.8,
        opacity: 0.72,
        type: isInferred === false ? 'dashed' : 'solid',
        color: isInferred === false ? '#9aa6b2' : '#5b8def'
      },
      raw: {
        from: sourceNode.id,
        to: targetNode.id,
        predicate,
        edge_id: edgeId,
        inference_rule: inferenceRule,
        rule_name: ruleName,
        is_inferred: isInferred,
        confidence,
        evidence
      }
    }
    links.set(kgEdgeKey(edge), edge)
  }

  kgNeighbors.value.forEach((row) => {
    addLink({
      sourceType: row.edge_subject_type || row.from_type,
      sourceId: row.edge_subject_id || row.from_id,
      sourceLabel: row.edge_subject_type === row.from_type ? row.from_label : '',
      targetType: row.edge_object_type || row.to_type,
      targetId: row.edge_object_id || row.to_id,
      targetLabel: row.edge_object_type === row.to_type ? row.to_label : '',
      predicate: row.predicate,
      edgeId: row.edge_id,
      inferenceRule: row.inference_rule,
      ruleName: row.rule_name,
      isInferred: row.is_inferred,
      confidence: row.confidence,
      evidence: row.evidence
    })
  })

  kgPathRows.value.forEach((row) => {
    addKgGraphNode(nodes, row.target_type, row.target_id, row.target_label)
    const facts = Array.isArray(row.path_facts) ? row.path_facts : []
    facts.forEach((fact) => {
      addLink({
        sourceType: fact.subject_type,
        sourceId: fact.subject_id,
        targetType: fact.object_type,
        targetId: fact.object_id,
        predicate: fact.predicate,
        edgeId: fact.id,
        inferenceRule: fact.rule,
        ruleName: fact.rule,
        isInferred: fact.inferred,
        confidence: fact.confidence,
        evidence: fact.evidence
      })
    })
  })

  return {
    nodes: Array.from(nodes.values()),
    links: Array.from(links.values()),
    stats: {
      nodes: nodes.size,
      links: links.size
    }
  }
})

const kgGraphStats = computed(() => kgGraphPayload.value.stats)

const workbenchViews = computed(() => {
  const insightAttention = reasoningHealth.value.is_healthy === false
    ? 'critical'
    : reasoningHealth.value.health_code && reasoningHealth.value.health_code !== 'healthy'
      ? 'warning'
      : 'normal'
  return [
    {
      key: 'relations',
      title: '关系图谱',
      desc: '表关系 / 列语义 / 明细',
      metric: `${graphRelations.value.length} 条`,
      attention: selectedTable.value ? 'focus' : 'normal',
      icon: Connection
    },
    {
      key: 'reasoning',
      title: '推理引擎',
      desc: '事实 / 规则 / 路径解释',
      metric: `${reasoningSummary.value.facts_total || 0} facts`,
      attention: reasoningSummary.value.last_run_status === 'completed' ? 'normal' : 'warning',
      icon: Cpu
    },
    {
      key: 'kg',
      title: 'KG 查询',
      desc: '节点 / 邻域 / 子图证据',
      metric: `${kgGraphStats.value.nodes}/${kgGraphStats.value.links}`,
      attention: kgSelectedEdge.value ? 'focus' : 'normal',
      icon: SearchIcon
    },
    {
      key: 'insight',
      title: '洞察审计',
      desc: '风险 / 影响 / 敏感路径',
      metric: reasoningHealth.value.health_code || 'unknown',
      attention: insightAttention,
      icon: DataAnalysis
    }
  ]
})

const activeWorkbenchMeta = computed(() => {
  return workbenchViews.value.find((item) => item.key === activeWorkbenchView.value) || workbenchViews.value[0]
})

const formatKgEvidenceValue = (value) => {
  if (value == null) return '-'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (!text) return '-'
  return text.length > 180 ? `${text.slice(0, 177)}...` : text
}

const kgSelectedEdgeEvidenceRows = computed(() => {
  const evidence = kgSelectedEdge.value?.evidence
  if (!evidence || typeof evidence !== 'object') return []
  if (Array.isArray(evidence)) {
    return evidence.slice(0, 8).map((item, index) => ({
      key: `item_${index + 1}`,
      value: formatKgEvidenceValue(item)
    }))
  }
  return Object.entries(evidence).slice(0, 8).map(([key, value]) => ({
    key,
    value: formatKgEvidenceValue(value)
  }))
})

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

const nodeTypeLabel = (value) => KG_NODE_TYPE_LABELS[value] || value || '-'

const kgNodeKey = (type, id) => `${type || 'unknown'}:${id || ''}`

const kgGraphCategory = (type) => KG_GRAPH_CATEGORY_BY_TYPE[type] || '其他'

const kgGraphNodeSize = (node) => {
  if (node?.node_type === 'role') return 44
  if (node?.node_type === 'app') return 38
  if (node?.node_type === 'table') return 36
  if (node?.node_type === 'column') return node?.is_sensitive ? 34 : 28
  return 30
}

const addKgGraphNode = (map, type, id, label, extra = {}) => {
  if (!type || !id) return null
  const key = kgNodeKey(type, id)
  const existing = map.get(key) || {}
  const next = {
    id: key,
    name: label || existing.name || id,
    rawType: type,
    rawId: id,
    category: kgGraphCategory(type),
    symbolSize: Math.max(existing.symbolSize || 0, kgGraphNodeSize({ node_type: type, ...extra })),
    itemStyle: {
      color: extra.is_sensitive ? '#d9475f' : (KG_GRAPH_NODE_COLORS[type] || '#607d8b')
    },
    label: {
      show: true,
      formatter: (value) => {
        const name = String(value?.data?.name || '')
        return name.length > 18 ? `${name.slice(0, 17)}...` : name
      }
    },
    tooltip: {
      formatter: `${nodeTypeLabel(type)}:${id}<br/>${label || id}`
    },
    ...existing,
    ...extra
  }
  map.set(key, next)
  return next
}

const kgEdgeKey = (edge) => {
  if (edge?.edge_id != null) return `edge:${edge.edge_id}`
  if (edge?.id != null) return `edge:${edge.id}`
  return `${edge.source}|${edge.predicate}|${edge.target}`
}

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

const loadAgentOntologyContext = async ({ query = null, limit = 80 } = {}) => {
  const data = await request({
    url: '/rpc/agent_ontology_context',
    method: 'post',
    data: {
      p_query: query || null,
      p_limit: limit
    },
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    }
  })
  return data && typeof data === 'object' ? data : {}
}

const fetchColumnSemanticsByTable = async (tableKey) => {
  const parsed = parseTableKey(tableKey)
  if (!parsed) return []
  const context = await loadAgentOntologyContext({ query: parsed.tableKey, limit: 20 })
  const rows = context?.columns?.[parsed.tableKey] || []
  if (!Array.isArray(rows)) return []
  return rows.map((item) => ({
    table_schema: parsed.schema,
    table_name: parsed.table,
    column_name: item.col || item.column_name || '',
    semantic_class: item.cls || item.semantic_class || '',
    semantic_name: item.name || item.semantic_name || '',
    data_type: item.type || item.data_type || '',
    ui_type: item.ui || item.ui_type || '',
    is_sensitive: item.sensitive === true || item.is_sensitive === true,
    source: item.source || 'agent_ontology_context',
    tags: item.tags || [],
    is_active: true,
    table_key: parsed.tableKey,
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
    url: '/rpc/agent_ontology_reasoning_summary',
    method: 'post',
    data: {},
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public'
    }
  })
  reasoningSummary.value = firstRow(rows) || {}
}

const loadReasoningFacts = async () => {
  const predicateFilter = reasoningPredicate.value
    ? String(reasoningPredicate.value)
    : null
  const rows = await request({
    url: '/rpc/agent_ontology_reasoning_facts',
    method: 'post',
    data: {
      p_predicate: predicateFilter,
      p_limit: 200
    },
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
        url: '/rpc/agent_ontology_reasoning_health',
        method: 'post',
        data: {},
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/rpc/agent_ontology_role_access_insights',
        method: 'post',
        data: { p_limit: 50 },
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/rpc/agent_ontology_table_impact_insights',
        method: 'post',
        data: { p_limit: 50 },
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/rpc/agent_ontology_reasoning_rule_stats',
        method: 'post',
        data: { p_limit: 50 },
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      }),
      request({
        url: '/rpc/agent_ontology_sensitive_access_paths',
        method: 'post',
        data: { p_limit: 50 },
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
    await Promise.all([loadReasoning(), loadReasoningInsights(), loadKgNodes()])
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
      url: '/rpc/agent_explain_role_ontology_access',
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

const selectKgNode = async (row, options = {}) => {
  if (!row) return
  kgSelectedNode.value = row
  kgSelectedEdge.value = null
  if (!kgPathTargetId.value && row.node_type !== kgPathTargetType.value) {
    kgPathTargetType.value = row.node_type === 'role' ? 'table' : row.node_type
  }
  if (options.loadNeighbors !== false) {
    await loadKgNeighbors(true)
  }
}

const loadKgNodes = async () => {
  kgLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/agent_search_ontology_kg_nodes',
      method: 'post',
      data: {
        p_query: String(kgSearchText.value || '').trim() || null,
        p_node_type: kgNodeType.value || null,
        p_limit: 50
      },
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    kgNodes.value = Array.isArray(rows) ? rows : []
    const currentKey = kgSelectedNode.value
      ? `${kgSelectedNode.value.node_type}:${kgSelectedNode.value.node_id}`
      : ''
    const nextSelected = kgNodes.value.find((row) => `${row.node_type}:${row.node_id}` === currentKey) || kgNodes.value[0] || null
    if (nextSelected) {
      await selectKgNode(nextSelected, { loadNeighbors: true })
    } else {
      kgSelectedNode.value = null
      kgNeighbors.value = []
      kgPathRows.value = []
    }
  } catch {
    ElMessage.error('查询知识图谱节点失败')
  } finally {
    kgLoading.value = false
  }
}

const loadKgNeighbors = async (silent = false) => {
  const node = kgSelectedNode.value
  if (!node?.node_type || !node?.node_id) {
    if (!silent) ElMessage.warning('请先选择节点')
    return
  }
  kgNeighborLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/agent_query_ontology_kg_neighbors',
      method: 'post',
      data: {
        p_node_type: node.node_type,
        p_node_id: node.node_id,
        p_direction: kgDirection.value,
        p_max_depth: Number(kgDepth.value || 1),
        p_limit: 80,
        p_predicate: kgPredicate.value || null
      },
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    kgNeighbors.value = Array.isArray(rows) ? rows : []
    const target = kgNeighbors.value.find((row) => ['app', 'table', 'column', 'permission', 'role'].includes(row.to_type))
    if (target) {
      kgPathTargetType.value = target.to_type
      kgPathTargetId.value = target.to_id
    }
  } catch {
    if (!silent) ElMessage.error('展开知识图谱邻域失败')
  } finally {
    kgNeighborLoading.value = false
  }
}

const selectKgNeighbor = (row) => {
  if (!row?.to_type || !row?.to_id) return
  kgPathTargetType.value = row.to_type
  kgPathTargetId.value = row.to_id
}

const findKgPaths = async () => {
  const node = kgSelectedNode.value
  const targetId = String(kgPathTargetId.value || '').trim()
  if (!node?.node_type || !node?.node_id) {
    ElMessage.warning('请先选择起点节点')
    return
  }
  if (!targetId) {
    ElMessage.warning('请填写目标节点标识')
    return
  }
  kgPathLoading.value = true
  try {
    const rows = await request({
      url: '/rpc/agent_find_ontology_kg_paths',
      method: 'post',
      data: {
        p_source_type: node.node_type,
        p_source_id: node.node_id,
        p_target_type: kgPathTargetType.value,
        p_target_id: targetId,
        p_max_depth: Number(kgPathDepth.value || 2),
        p_direction: kgPathDirection.value,
        p_limit: 20
      },
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    kgPathRows.value = Array.isArray(rows) ? rows : []
  } catch {
    ElMessage.error('查询知识图谱路径失败')
  } finally {
    kgPathLoading.value = false
  }
}

const loadKgEcharts = async () => {
  kgEchartsModulePromise ||= import('echarts')
  return kgEchartsModulePromise
}

const formatKgTooltip = (params) => {
  if (params.dataType === 'edge') {
    const raw = params.data?.raw || {}
    return [
      `${raw.from || ''} -> ${raw.to || ''}`,
      predicateLabel(raw.predicate),
      raw.rule_name || raw.inference_rule || ''
    ].filter(Boolean).join('<br/>')
  }
  const data = params.data || {}
  return [
    `${nodeTypeLabel(data.rawType)}:${data.rawId}`,
    data.name
  ].filter(Boolean).join('<br/>')
}

const renderKgGraph = async () => {
  await nextTick()
  const host = kgGraphRef.value
  if (!host) return
  const payload = kgGraphPayload.value
  const echarts = await loadKgEcharts()
  if (!kgChart) {
    kgChart = echarts.init(host)
  }
  if (!payload.stats.nodes) {
    kgChart.clear()
    return
  }
  kgChart.off('click')
  kgChart.on('click', (params) => {
    if (params.dataType === 'edge') {
      kgSelectedEdge.value = params.data?.raw || null
      return
    }
    if (params.dataType === 'node') {
      const data = params.data || {}
      if (data.rawType && data.rawId) {
        kgPathTargetType.value = data.rawType
        kgPathTargetId.value = data.rawId
        kgSelectedEdge.value = null
      }
    }
  })
  kgChart.setOption({
    color: Object.values(KG_GRAPH_NODE_COLORS),
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: formatKgTooltip
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: {
        color: '#606266',
        fontSize: 11
      },
      data: KG_GRAPH_CATEGORIES.map((item) => item.name)
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        top: 28,
        bottom: 8,
        left: 8,
        right: 8,
        roam: true,
        draggable: true,
        data: payload.nodes,
        links: payload.links,
        categories: KG_GRAPH_CATEGORIES,
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 8,
        label: {
          color: '#303133',
          fontSize: 11
        },
        edgeLabel: {
          show: false,
          fontSize: 10,
          formatter: (value) => predicateLabel(value?.data?.predicate)
        },
        force: {
          repulsion: 230,
          edgeLength: [82, 160],
          gravity: 0.06,
          friction: 0.42
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: {
            width: 3,
            opacity: 0.95
          },
          edgeLabel: {
            show: true
          }
        }
      }
    ]
  }, true)
  kgChart.resize()
}

const resizeKgGraph = () => {
  if (kgChart) {
    kgChart.resize()
    return
  }
  void renderKgGraph()
}

const bindKgGraphResizeObserver = () => {
  if (typeof ResizeObserver === 'undefined' || !kgGraphRef.value) return
  kgGraphResizeObserver = new ResizeObserver(() => {
    resizeKgGraph()
  })
  kgGraphResizeObserver.observe(kgGraphRef.value)
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
      url: '/rpc/agent_explain_ontology_path',
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

const setActiveWorkbenchView = (key) => {
  if (!workbenchViews.value.some((item) => item.key === key)) return
  activeWorkbenchView.value = key
}

const refreshWorkbenchLayout = async () => {
  await nextTick()
  updateGraphHostWidth()
  resizeKgGraph()
}

const toggleNavCollapsed = () => {
  navCollapsed.value = !navCollapsed.value
  void refreshWorkbenchLayout()
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
    const context = await loadAgentOntologyContext({
      query: String(searchText.value || '').trim() || null,
      limit: 200
    })
    const rows = Array.isArray(context.relations) ? context.relations : []
    relations.value = rows.map((row, index) => ({
      id: row.id || index + 1,
      relation_type: row.relation_type || 'ontology',
      subject_table: row.subject_table || row.from || '',
      subject_column: row.subject_column || '',
      predicate: row.predicate || '',
      object_table: row.object_table || row.to || '',
      object_column: row.object_column || '',
      bridge_table: row.bridge_table || '',
      details: row.details || '',
      subject_semantic_name: row.subject_semantic_name || row.fromName || '',
      object_semantic_name: row.object_semantic_name || row.toName || ''
    }))
    refreshedAt.value = new Date().toLocaleTimeString()
    syncSelectedTable()
  } catch (error) {
    ElMessage.error('加载关系数据失败')
  } finally {
    loading.value = false
  }
}

const reloadRelationsWithRetry = async () => {
  await reload()
  if (relations.value.length || String(searchText.value || '').trim()) return
  await new Promise((resolve) => setTimeout(resolve, 600))
  if (!relations.value.length && !String(searchText.value || '').trim()) {
    await reload()
  }
}

const reloadAll = async () => {
  await Promise.all([reloadRelationsWithRetry(), loadReasoning(), loadReasoningInsights(), loadKgNodes()])
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

watch(kgGraphPayload, () => {
  void renderKgGraph()
})

watch(activeWorkbenchView, async (view) => {
  await nextTick()
  if (view === 'relations') {
    updateGraphHostWidth()
  }
  if (view === 'kg') {
    resizeKgGraph()
  }
})

onMounted(() => {
  reloadAll()
  nextTick(() => {
    bindGraphResizeObserver()
    bindKgGraphResizeObserver()
    void renderKgGraph()
  })
})

onBeforeUnmount(() => {
  if (graphResizeObserver) {
    graphResizeObserver.disconnect()
    graphResizeObserver = null
  }
  if (kgGraphResizeObserver) {
    kgGraphResizeObserver.disconnect()
    kgGraphResizeObserver = null
  }
  if (kgChart) {
    kgChart.dispose()
    kgChart = null
  }
})
</script>

<style scoped>
.ontology-workbench {
  min-height: 100vh;
  padding: 12px;
  background: var(--el-bg-color-page);
}

.wb-hero {
  display: grid;
  grid-template-columns: minmax(220px, 0.72fr) minmax(420px, 1.6fr) auto;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--el-fill-color-light) 62%, var(--el-bg-color));
  border: 1px solid var(--el-border-color-light);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
}

.hero-text {
  min-width: 0;
}

.hero-text h2 {
  margin: 0 0 3px;
  font-size: 20px;
  line-height: 1.15;
  color: var(--el-text-color-primary);
}

.hero-text p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(68px, 1fr));
  gap: 6px;
  min-width: 0;
}

.hero-metric {
  min-width: 0;
  border-radius: 7px;
  border: 1px solid var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-fill-color-blank) 74%, var(--el-fill-color-light));
  padding: 6px 8px;
}

.hero-metric span,
.hero-metric strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-metric span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.1;
}

.hero-metric strong {
  margin-top: 3px;
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 720;
  line-height: 1;
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 260px;
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

.workbench-shell {
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  transition: grid-template-columns 0.18s ease;
}

.workbench-shell.nav-collapsed {
  grid-template-columns: 56px minmax(0, 1fr);
}

.workbench-nav {
  position: sticky;
  top: 12px;
  display: grid;
  gap: 6px;
  min-width: 0;
  transition: width 0.18s ease;
}

.workbench-nav-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 32px;
  padding: 4px 5px 4px 8px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--el-fill-color-blank) 78%, var(--el-fill-color-light));
}

.workbench-nav-label {
  min-width: 0;
  overflow: hidden;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-collapse-button {
  flex: 0 0 auto;
}

.workbench-nav-item {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 58px;
  border: 1px solid var(--el-border-color-light);
  border-left-width: 4px;
  border-radius: 8px;
  background: var(--el-fill-color-blank);
  padding: 8px 9px;
  color: var(--el-text-color-primary);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, padding 0.18s ease;
}

.workbench-nav-item:hover,
.workbench-nav-item.active {
  background: color-mix(in srgb, var(--el-color-primary-light-9) 55%, var(--el-fill-color-blank));
  border-color: color-mix(in srgb, var(--el-color-primary) 30%, var(--el-border-color-light));
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06);
}

.workbench-nav-item.attention-critical {
  border-left-color: var(--el-color-danger);
}

.workbench-nav-item.attention-warning {
  border-left-color: var(--el-color-warning);
}

.workbench-nav-item.attention-focus {
  border-left-color: var(--el-color-primary);
}

.workbench-nav-item.attention-normal {
  border-left-color: var(--el-color-success);
}

.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 58%, var(--el-fill-color-extra-light));
  color: var(--el-text-color-primary);
}

.nav-icon :deep(svg) {
  width: 16px;
  height: 16px;
}

.nav-main,
.nav-meta {
  min-width: 0;
}

.nav-title,
.nav-desc {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-title {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.2;
}

.nav-desc {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.nav-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 58px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.nav-meta span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-dot {
  width: 7px;
  height: 7px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--el-color-success);
}

.attention-critical .attention-dot {
  background: var(--el-color-danger);
}

.attention-warning .attention-dot {
  background: var(--el-color-warning);
}

.attention-focus .attention-dot {
  background: var(--el-color-primary);
}

.workbench-nav.is-collapsed .workbench-nav-toolbar {
  justify-content: center;
  padding: 4px;
}

.workbench-nav.is-collapsed .workbench-nav-label {
  display: none;
}

.workbench-nav.is-collapsed .workbench-nav-item {
  grid-template-columns: 1fr;
  justify-items: center;
  min-height: 48px;
  padding: 8px 6px;
  border-left-width: 3px;
}

.workbench-nav.is-collapsed .nav-main {
  display: none;
}

.workbench-nav.is-collapsed .nav-meta {
  position: absolute;
  top: 6px;
  right: 6px;
  max-width: none;
}

.workbench-nav.is-collapsed .nav-meta span:last-child {
  display: none;
}

.workbench-stage {
  min-width: 0;
}

.workbench-view {
  min-width: 0;
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

.reasoning-card .kg-panel,
.reasoning-card .insight-panel {
  margin-top: 0;
  border: 0;
  background: transparent;
  padding: 0;
}

.workbench-view-body {
  min-width: 0;
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

.kg-panel {
  margin-top: 12px;
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  padding: 10px;
}

.kg-header,
.kg-toolbar,
.kg-subtoolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kg-header {
  justify-content: space-between;
  margin-bottom: 10px;
}

.kg-toolbar {
  margin-bottom: 10px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
}

.kg-search {
  width: min(340px, 100%);
}

.kg-layout {
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(0, 1.55fr);
  gap: 10px;
  align-items: start;
}

.kg-node-pane,
.kg-detail-pane {
  min-width: 0;
}

.kg-node-title,
.kg-selected-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.kg-node-title span,
.kg-selected-title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kg-selected {
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-extra-light);
  padding: 8px;
  margin-bottom: 8px;
}

.kg-selected-title {
  justify-content: space-between;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.kg-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.kg-metric {
  min-width: 0;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  padding: 7px 8px;
}

.kg-metric span {
  display: block;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.2;
}

.kg-metric strong {
  display: block;
  margin-top: 4px;
  color: var(--el-text-color-primary);
  font-size: 17px;
  line-height: 1;
  word-break: break-all;
}

.kg-tabs {
  margin-top: 4px;
}

.kg-graph-panel {
  margin: 8px 0 10px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-blank);
  padding: 8px;
}

.kg-graph-header,
.kg-graph-stats,
.kg-edge-proof-title,
.kg-edge-proof-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.kg-graph-header {
  justify-content: space-between;
  margin-bottom: 6px;
}

.kg-graph-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.kg-graph-canvas {
  width: 100%;
  height: 320px;
  min-height: 280px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--el-border-color-lighter) 45%, transparent) 1px, transparent 1px),
    linear-gradient(0deg, color-mix(in srgb, var(--el-border-color-lighter) 45%, transparent) 1px, transparent 1px),
    var(--el-fill-color-extra-light);
  background-size: 28px 28px;
}

.kg-edge-proof {
  margin-top: 8px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color-light));
  background: color-mix(in srgb, var(--el-color-primary-light-9) 42%, var(--el-fill-color-blank));
  padding: 8px;
}

.kg-edge-proof-title {
  justify-content: space-between;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.kg-edge-proof-title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kg-edge-proof-meta {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.kg-edge-evidence {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
  margin-top: 8px;
}

.kg-edge-evidence-row {
  display: grid;
  grid-template-columns: minmax(90px, 0.32fr) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  min-width: 0;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-blank);
  padding: 5px 6px;
}

.kg-edge-evidence-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.kg-edge-evidence-row code {
  min-width: 0;
  color: var(--el-text-color-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.35;
  white-space: normal;
  word-break: break-all;
}

.kg-subtoolbar {
  margin-bottom: 8px;
}

.kg-path-target {
  width: min(300px, 100%);
}

.kg-empty-tip {
  margin-top: 8px;
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

@media (max-width: 1280px) {
  .wb-hero {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .hero-metrics {
    grid-column: 1 / -1;
  }
}

@media (max-width: 1200px) {
  .reasoning-metrics,
  .insight-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .workbench-shell {
    grid-template-columns: 168px minmax(0, 1fr);
  }

  .workbench-shell.nav-collapsed {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .kg-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .wb-hero {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .hero-text p {
    white-space: normal;
  }

  .hero-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .hero-actions {
    justify-content: flex-start;
    min-width: 0;
  }

  .reasoning-metrics,
  .insight-metrics,
  .kg-metrics {
    grid-template-columns: 1fr;
  }

  .workbench-shell,
  .workbench-shell.nav-collapsed {
    grid-template-columns: 1fr;
  }

  .workbench-nav {
    position: static;
    grid-template-columns: 1fr;
  }

  .workbench-nav-item {
    min-height: 58px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .kg-graph-canvas {
    height: 260px;
    min-height: 240px;
  }
}

@media (max-width: 640px) {
  .hero-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
