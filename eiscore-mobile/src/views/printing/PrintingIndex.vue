<template>
  <div class="printing-index">
    <!-- 顶部导航 -->
    <div class="header-top">
      <span class="back-btn" @click="$router.back()"><i class="back-icon" /></span>
      <p>标签打印</p>
      <span />
    </div>

    <div class="content">
      <!-- 全屏加载遮罩 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMsg }}</div>
      </div>

      <!-- Hero 区域 -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Label Print</span>
          <h1>标签打印中心</h1>
          <p>打印仓库、库位、物料的二维码标签。</p>
        </div>
        <div class="hero-actions">
          <button class="action-btn warehouse-bg" @click="activeTab = 'warehouse'">
            <span class="action-title">仓库 / 库位标签</span>
            <span class="action-desc">打印仓库与库位二维码</span>
          </button>
          <button class="action-btn material-bg" @click="activeTab = 'material'">
            <span class="action-title">物料标签</span>
            <span class="action-desc">打印物料信息二维码</span>
          </button>
        </div>
      </section>

      <!-- Tab 切换 -->
      <section class="tab-row">
        <button class="tab-btn" :class="{ active: activeTab === 'warehouse' }" @click="activeTab = 'warehouse'">
          仓库 / 库位
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'material' }" @click="activeTab = 'material'">
          物料标签
        </button>
      </section>

      <!-- ==== 仓库/库位标签 ==== -->
      <template v-if="activeTab === 'warehouse'">
        <!-- 统计行 -->
        <section class="stats-row">
          <div class="stat-card">
            <div class="stat-label">仓库数量</div>
            <div class="stat-value">{{ warehouses.length }}</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-label">总库位数</div>
            <div class="stat-value">{{ totalLocationCount }}</div>
          </div>
          <div class="stat-card dark">
            <div class="stat-label">可打印标签</div>
            <div class="stat-value">{{ warehouses.length + totalLocationCount }}</div>
          </div>
        </section>

        <!-- 仓库列表 -->
        <section class="warehouse-section">
          <div class="section-head">
            <div>
              <h2>仓库与库位标签</h2>
              <p>点击打印按钮，打开标签预览页进行打印。</p>
            </div>
            <button class="ghost-btn" @click="loadWarehouseData">刷新</button>
          </div>

          <div v-if="whLoading" class="state">正在加载仓库...</div>
          <div v-else-if="whError" class="state error">{{ whError }}</div>
          <div v-else-if="warehouses.length === 0" class="state empty">暂无仓库数据</div>
          <div v-else class="warehouse-grid">
            <article
              v-for="(wh, index) in warehouses"
              :key="wh.id"
              class="warehouse-card"
              :class="{ expanded: wh.expanded }"
              :style="{ animationDelay: `${index * 0.06}s` }"
            >
              <div class="warehouse-top" @click="toggleWarehouse(wh)">
                <div class="warehouse-info">
                  <div class="warehouse-name">{{ wh.name || '未命名仓库' }}</div>
                  <div class="warehouse-code">{{ wh.code || '--' }}</div>
                </div>
                <div class="warehouse-meta">
                  <span class="meta-chip">库位 <strong>{{ (wh.locations || []).length }}</strong></span>
                  <button class="print-btn primary-btn" @click.stop="printLabel(wh.code, wh.name, 'warehouse')">打印仓库标签</button>
                  <i class="chevron" :class="{ open: wh.expanded }" />
                </div>
              </div>
              <transition name="panel">
                <div v-show="wh.expanded" class="location-list">
                  <div v-if="(wh.locations || []).length === 0" class="state empty">该仓库暂无库位</div>
                  <div
                    v-for="loc in (wh.locations || [])"
                    :key="loc.id"
                    class="location-row"
                  >
                    <div class="location-info">
                      <div class="location-name">{{ loc.name || '未命名库位' }}</div>
                      <div class="location-code">{{ loc.code || '--' }}</div>
                    </div>
                    <button class="print-btn ghost-print" @click.stop="printLabel(loc.code, loc.name, 'location')">打印库位标签</button>
                  </div>
                </div>
              </transition>
            </article>
          </div>
        </section>
      </template>

      <!-- ==== 物料标签 ==== -->
      <template v-if="activeTab === 'material'">
        <!-- 搜索区 -->
        <section class="search-card">
          <div class="search-row">
            <input
              v-model.trim="materialSearch"
              type="text"
              placeholder="输入物料编码或名称搜索"
              @keyup.enter="searchMaterial"
            />
            <button class="search-btn" @click="searchMaterial">查询</button>
          </div>
          <div class="search-meta">
            <span class="meta-pill">搜索物料生成二维码标签</span>
            <button v-if="materialSearch" class="clear-btn" @click="materialSearch = ''; materialList = []">清空</button>
          </div>
        </section>

        <!-- 统计行 -->
        <section class="stats-row">
          <div class="stat-card">
            <div class="stat-label">搜索结果</div>
            <div class="stat-value">{{ materialList.length }}</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-label">当前模式</div>
            <div class="stat-value">物料标签</div>
          </div>
          <div class="stat-card dark">
            <div class="stat-label">标签预览</div>
            <div class="stat-value">就绪</div>
          </div>
        </section>

        <!-- 物料列表 -->
        <section class="material-section">
          <div class="section-head">
            <div>
              <h2>物料列表</h2>
              <p>选择物料后点击打印按钮预览标签。</p>
            </div>
            <button class="ghost-btn" @click="loadAllMaterials">全部加载</button>
          </div>

          <div v-if="matLoading" class="state">正在加载物料...</div>
          <div v-else-if="materialList.length === 0" class="state empty">请搜索或加载物料</div>
          <div v-else class="material-grid">
            <div
              v-for="(mat, index) in materialList"
              :key="mat.id"
              class="material-card"
              :style="{ animationDelay: `${index * 0.04}s` }"
            >
              <div class="material-head">
                <div class="material-info">
                  <div class="material-name">{{ mat.name || '--' }}</div>
                  <div class="material-code">{{ mat.batch_no || '--' }}</div>
                </div>
                <span class="material-cat">{{ mat.category || '--' }}</span>
              </div>
              <div class="material-props">
                <span v-if="mat.properties?.spec">规格: {{ mat.properties.spec }}</span>
                <span v-if="mat.properties?.unit">单位: {{ mat.properties.unit }}</span>
                <span v-if="mat.properties?.measure_unit">计量: {{ mat.properties.measure_unit }}</span>
              </div>
              <div class="material-bottom">
                <span class="badge ready">可打印</span>
                <button class="print-btn primary-btn" @click="printMaterialLabel(mat)">打印物料标签</button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  fetchWarehouses, fetchLocationsByWarehouse,
  fetchAllMaterials, searchMaterials
} from '@/api/stock'

const router = useRouter()

/* ---------- 状态 ---------- */
const pageLoading = ref(false)
const loadingMsg = ref('正在加载...')
const activeTab = ref('warehouse')

// 仓库
const warehouses = ref([])
const whLoading = ref(false)
const whError = ref('')

// 物料
const materialSearch = ref('')
const materialList = ref([])
const matLoading = ref(false)

/* ---------- 计算属性 ---------- */
const totalLocationCount = computed(() =>
  warehouses.value.reduce((sum, w) => sum + (w.locations || []).length, 0)
)

/* ---------- 仓库/库位 ---------- */

async function loadWarehouseData() {
  whLoading.value = true
  whError.value = ''
  try {
    const list = await fetchWarehouses()
    const whList = (Array.isArray(list) ? list : []).map(w => ({
      ...w,
      locations: [],
      expanded: false
    }))

    // 并行加载所有仓库的库位
    const results = await Promise.allSettled(
      whList.map(w => fetchLocationsByWarehouse(w.id))
    )
    whList.forEach((w, i) => {
      if (results[i].status === 'fulfilled') {
        const locs = results[i].value
        w.locations = Array.isArray(locs) ? locs : []
      }
    })

    warehouses.value = whList
  } catch (e) {
    whError.value = '加载仓库数据失败'
  } finally {
    whLoading.value = false
  }
}

function toggleWarehouse(wh) {
  wh.expanded = !wh.expanded
}

function printLabel(code, name, labelType) {
  const route = router.resolve({
    path: '/printing/label',
    query: { code, name, labelType }
  })
  window.open(route.href, '_blank')
}

/* ---------- 物料 ---------- */

async function searchMaterial() {
  const kw = materialSearch.value
  if (!kw) return showToast('请输入搜索关键词')
  matLoading.value = true
  try {
    const list = await searchMaterials(kw)
    materialList.value = Array.isArray(list) ? list : []
    if (materialList.value.length === 0) {
      showToast({ message: '未找到匹配物料', icon: 'warning-o' })
    }
  } catch (e) {
    showToast({ message: '搜索失败', icon: 'fail' })
  } finally {
    matLoading.value = false
  }
}

async function loadAllMaterials() {
  matLoading.value = true
  try {
    const list = await fetchAllMaterials()
    materialList.value = Array.isArray(list) ? list : []
  } catch (e) {
    showToast({ message: '加载物料失败', icon: 'fail' })
  } finally {
    matLoading.value = false
  }
}

function printMaterialLabel(mat) {
  const payload = {
    code: mat.batch_no || String(mat.id),
    name: mat.name,
    labelType: 'material',
    infoPairs: [
      { key: '物料编码', value: mat.batch_no || '--' },
      { key: '物料名称', value: mat.name || '--' },
      { key: '物料分类', value: mat.category || '--' },
      { key: '规格', value: mat.properties?.spec || '--' },
      { key: '单位', value: mat.properties?.unit || '--' },
      { key: '计量单位', value: mat.properties?.measure_unit || '--' }
    ]
  }
  const encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
  const route = router.resolve({
    path: '/printing/label',
    query: { payload: encoded, labelType: 'material' }
  })
  window.open(route.href, '_blank')
}

/* ---------- 初始化 ---------- */
onMounted(() => {
  loadWarehouseData()
})
</script>

<style scoped>
/* ===== Header ===== */
.header-top{width:100%;height:44px;background:#007cff;display:flex;justify-content:space-between;align-items:center;padding:0 20px;box-sizing:border-box;font-size:16px;color:#fff;position:sticky;top:0;z-index:20}
.back-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer}
.back-icon{width:10px;height:10px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}

/* ===== Content ===== */
.content {
  --ink: #1d2433;
  --muted: #5a6b7c;
  --line: #e3e9f2;
  --accent: #1b6dff;
  --accent-dark: #0e3fa5;
  --fresh: #21c189;
  font-family: 'Source Han Sans CN','Noto Sans SC','Microsoft YaHei',sans-serif;
  color: var(--ink);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 44px);
  background:
    radial-gradient(700px 280px at 10% -10%, rgba(27,109,255,0.16), transparent 65%),
    radial-gradient(600px 260px at 100% 20%, rgba(33,193,137,0.14), transparent 60%),
    linear-gradient(140deg, #f9fbff 0%, #f1f6ff 50%, #f6fbf8 100%);
}

/* ===== Loading ===== */
.page-mask{position:fixed;inset:0;background:rgba(255,255,255,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:100}
.spinner{width:36px;height:36px;border:3px solid #e3e9f2;border-top-color:#1b6dff;border-radius:50%;animation:spin .7s linear infinite}
.mask-text{margin-top:12px;color:#5a6b7c;font-size:14px}
@keyframes spin{to{transform:rotate(360deg)}}

/* ===== Hero ===== */
.hero{display:grid;gap:16px;padding:18px;border-radius:18px;background:rgba(255,255,255,0.92);border:1px solid rgba(255,255,255,0.7);box-shadow:0 18px 40px rgba(20,37,90,0.12);animation:riseIn .6s ease both}
.hero-copy h1{margin:8px 0 6px;font-size:22px;letter-spacing:.5px}
.hero-copy p{margin:0;color:var(--muted);font-size:14px}
.hero-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;color:var(--accent-dark);background:rgba(27,109,255,0.12);letter-spacing:.4px}
.hero-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.action-btn{border:none;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:6px;color:#fff;cursor:pointer;text-align:left;transition:transform .2s ease,box-shadow .2s ease}
.action-btn:active{transform:translateY(1px)}
.action-btn.warehouse-bg{background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);box-shadow:0 12px 24px rgba(27,109,255,0.24)}
.action-btn.material-bg{background:linear-gradient(135deg,#1f2d3d 0%,#44556b 100%);box-shadow:0 12px 24px rgba(31,45,61,0.24)}
.action-title{font-size:16px;font-weight:600}
.action-desc{font-size:12px;opacity:.9}

/* ===== Tabs ===== */
.tab-row{display:grid;grid-template-columns:1fr 1fr;gap:0;background:#fff;border-radius:16px;padding:4px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 8px 20px rgba(20,37,90,0.06)}
.tab-btn{border:none;background:transparent;border-radius:12px;padding:10px;font-size:14px;font-weight:600;color:var(--muted);cursor:pointer;transition:all .2s}
.tab-btn.active{background:var(--accent);color:#fff;box-shadow:0 6px 16px rgba(27,109,255,0.2)}

/* ===== Stats ===== */
.stats-row{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);animation:riseIn .7s ease both}
.stat-card{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 8px 20px rgba(20,37,90,0.08)}
.stat-card.accent{background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);color:#fff}
.stat-card.dark{background:linear-gradient(135deg,#1f2d3d 0%,#44556b 100%);color:#fff}
.stat-label{font-size:12px;opacity:.8}
.stat-value{font-size:16px;font-weight:700;margin-top:6px}

/* ===== Section Head ===== */
.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.section-head h2{margin:0 0 4px;font-size:18px}
.section-head p{margin:0;font-size:12px;color:var(--muted)}
.ghost-btn{border:1.5px solid var(--line);background:#fff;border-radius:10px;padding:6px 14px;font-size:13px;color:var(--accent);cursor:pointer}
.ghost-btn:active{background:#f7f9fc}

/* ===== Search Card ===== */
.search-card{background:#fff;border-radius:18px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 10px 24px rgba(20,37,90,0.07);padding:14px 16px;animation:riseIn .5s ease both}
.search-row{display:flex;gap:10px;overflow:hidden;box-sizing:border-box}
.search-row input{flex:1;border:1.5px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px;outline:none;min-width:0;transition:border .2s}
.search-row input:focus{border-color:var(--accent)}
.search-btn{background:var(--accent);color:#fff;border:none;border-radius:12px;padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0}
.search-btn:active{opacity:.8}
.search-meta{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;font-size:12px}
.meta-pill{background:rgba(27,109,255,0.08);color:var(--accent);padding:3px 10px;border-radius:999px}
.clear-btn{border:none;background:rgba(239,68,68,0.1);color:#ef4444;padding:3px 10px;border-radius:999px;font-size:12px;cursor:pointer}

/* ===== Warehouse Grid ===== */
.warehouse-grid{display:flex;flex-direction:column;gap:12px}
.warehouse-card{background:#fff;border-radius:18px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 10px 24px rgba(20,37,90,0.07);overflow:hidden;animation:riseIn .5s ease both}
.warehouse-top{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;cursor:pointer;gap:10px}
.warehouse-info{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.warehouse-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.warehouse-code{font-size:12px;color:var(--muted)}
.warehouse-meta{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.meta-chip{background:rgba(27,109,255,0.08);color:var(--accent);padding:3px 10px;border-radius:999px;font-size:12px;white-space:nowrap}
.meta-chip strong{margin-left:3px}
.chevron{width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);display:inline-block;transition:transform .2s ease;flex-shrink:0}
.chevron.open{transform:rotate(-135deg)}

/* Print Buttons */
.print-btn{border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;white-space:nowrap;transition:all .15s}
.primary-btn{background:var(--accent);color:#fff}
.primary-btn:active{opacity:.8}
.ghost-print{background:rgba(27,109,255,0.08);color:var(--accent)}
.ghost-print:active{background:rgba(27,109,255,0.16)}

/* Location List */
.location-list{display:flex;flex-direction:column;gap:8px;padding:0 16px 14px}
.location-row{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-radius:12px;background:#f7f9fc}
.location-info{flex:1;min-width:0}
.location-name{font-size:14px;font-weight:500}
.location-code{font-size:12px;color:var(--muted);margin-top:2px}

/* ===== Material Grid ===== */
.material-grid{display:flex;flex-direction:column;gap:12px}
.material-card{background:#fff;border-radius:18px;border:1px solid rgba(227,233,242,0.8);box-shadow:0 10px 24px rgba(20,37,90,0.07);padding:14px 16px;animation:riseIn .5s ease both}
.material-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.material-info{flex:1;min-width:0}
.material-name{font-size:15px;font-weight:600}
.material-code{font-size:12px;color:var(--muted);margin-top:3px}
.material-cat{font-size:12px;color:var(--accent);background:rgba(27,109,255,0.08);padding:3px 10px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.material-props{display:flex;gap:10px;margin-top:8px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.material-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed rgba(227,233,242,0.7)}
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600}
.badge.ready{background:rgba(33,193,137,0.12);color:#0f7b52}

/* ===== States ===== */
.state{text-align:center;padding:16px;font-size:13px;color:var(--muted)}
.state.error{color:#ef4444}

/* ===== Transitions ===== */
.panel-enter-active,.panel-leave-active{transition:all .2s ease}
.panel-enter-from,.panel-leave-to{opacity:0;transform:translateY(-6px)}

@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
</style>
