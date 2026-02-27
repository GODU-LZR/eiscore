<template>
  <div class="warehouse-query">
    <div class="header-top">
      <span class="back-btn" @click="$router.back()"><i class="back-icon" /></span>
      <p>仓库查询</p>
      <span />
    </div>

    <div class="main">
      <!-- 加载遮罩 -->
      <div v-if="pageLoading" class="page-mask">
        <div class="spinner" />
        <div class="mask-text">{{ loadingMsg }}</div>
      </div>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-copy">
          <span class="hero-badge">Warehouse Query</span>
          <h1>仓库库存查询</h1>
          <p>按仓库、库位、物料多维度查询当前库存。</p>
        </div>
      </section>

      <!-- 搜索卡片 -->
      <section class="search-card">
        <div class="search-row">
          <input
            v-model.trim="keyword"
            type="text"
            placeholder="搜索仓库 / 库位 / 物料名称或编码"
            @keyup.enter="applySearch"
          />
          <button class="search-btn" @click="applySearch">搜索</button>
        </div>
        <div class="search-meta">
          <button v-if="activeKeyword" class="clear-btn" @click="clearSearch">清空</button>
          <span class="result-hint" v-if="activeKeyword">
            匹配 {{ filteredWarehouses.length }} 个仓库
          </span>
        </div>
      </section>

      <!-- 统计行 -->
      <section class="stats-row">
        <div class="stat-card">
          <div class="stat-label">仓库</div>
          <div class="stat-value">{{ warehouses.length }}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">库位总数</div>
          <div class="stat-value">{{ totalLocations }}</div>
        </div>
        <div class="stat-card dark">
          <div class="stat-label">物料种类</div>
          <div class="stat-value">{{ totalMaterials }}</div>
        </div>
      </section>

      <!-- 仓库列表 -->
      <section class="list-section">
        <div class="section-head">
          <div>
            <h2>仓库列表</h2>
            <p>展开查看库区、库位与库存明细。</p>
          </div>
          <button class="ghost-btn" @click="refresh">刷新</button>
        </div>

        <div v-if="!pageLoading && filteredWarehouses.length === 0" class="state empty">
          {{ activeKeyword ? '未找到匹配结果' : '暂无仓库数据' }}
        </div>

        <div class="warehouse-grid">
          <article
            v-for="(wh, i) in filteredWarehouses"
            :key="wh.id"
            class="warehouse-card"
            :style="{ animationDelay: `${i * 0.05}s` }"
          >
            <div class="warehouse-top" @click="toggleWh(wh)">
              <div class="warehouse-info">
                <div class="warehouse-name">{{ wh.name || '未命名仓库' }}</div>
                <div class="warehouse-code">{{ wh.code || '--' }}</div>
              </div>
              <div class="warehouse-meta">
                <div class="meta-chip"><span>库位</span><strong>{{ wh.locCount }}</strong></div>
                <div class="meta-chip"><span>物料</span><strong>{{ wh.matCount }}</strong></div>
                <span class="status-dot" :class="wh.status === '启用' ? 'ok' : 'off'">{{ wh.status }}</span>
                <i class="chevron" :class="{ open: wh.expanded }" />
              </div>
            </div>

            <transition name="panel">
              <div v-show="wh.expanded" class="warehouse-body">
                <div v-if="wh.loading" class="state">加载库位中...</div>
                <div v-else-if="wh.locations.length === 0" class="state empty">暂无库位</div>

                <div v-else class="location-list">
                  <div
                    v-for="loc in getFilteredLocations(wh)"
                    :key="loc.id"
                    class="location-card"
                  >
                    <div class="location-head" @click="toggleLoc(loc)">
                      <div>
                        <div class="location-name">{{ loc.name || '未命名' }}</div>
                        <div class="location-code">{{ loc.code || '--' }}</div>
                      </div>
                      <div class="location-meta">
                        <span class="meta-chip sm"><span>物料</span><strong>{{ (loc.materials || []).length }}</strong></span>
                        <i class="chevron sm" :class="{ open: loc.expanded }" />
                      </div>
                    </div>

                    <transition name="panel">
                      <div v-show="loc.expanded" class="material-body">
                        <div v-if="(loc.materials || []).length === 0" class="state empty sm">暂无物料</div>
                        <div
                          v-for="mat in getFilteredMaterials(loc)"
                          :key="mat.material_id"
                          class="material-row"
                        >
                          <div class="mat-info">
                            <div class="mat-name">{{ mat.material_name || '--' }}</div>
                            <div class="mat-code">{{ mat.material_code || '--' }}</div>
                          </div>
                          <div class="mat-qty">
                            <span class="qty-num">{{ fmtQty(mat.available_qty) }}</span>
                            <span class="qty-unit">{{ mat.unit || '--' }}</span>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>
                </div>
              </div>
            </transition>
          </article>
        </div>
      </section>

      <div style="height: calc(24px + env(safe-area-inset-bottom))"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { showToast } from 'vant'
import {
  fetchWarehouses, fetchChildren, fetchInventory
} from '@/api/warehouse'

const pageLoading = ref(false)
const loadingMsg = ref('正在加载仓库数据...')
const keyword = ref('')
const activeKeyword = ref('')
const warehouses = ref([])

const totalLocations = computed(() =>
  warehouses.value.reduce((s, w) => s + (w.locCount || 0), 0)
)
const totalMaterials = computed(() => {
  const codes = new Set()
  warehouses.value.forEach(wh =>
    (wh.locations || []).forEach(loc =>
      (loc.materials || []).forEach(m => { if (m.material_code) codes.add(m.material_code) })
    )
  )
  return codes.size || warehouses.value.reduce((s, w) => s + (w.matCount || 0), 0)
})

const kw = computed(() => (activeKeyword.value || '').toLowerCase())

const filteredWarehouses = computed(() => {
  if (!kw.value) return warehouses.value
  return warehouses.value.filter(wh => {
    if (m(wh.name, kw.value) || m(wh.code, kw.value)) return true
    return (wh.locations || []).some(loc =>
      m(loc.name, kw.value) || m(loc.code, kw.value) ||
      (loc.materials || []).some(mt => m(mt.material_name, kw.value) || m(mt.material_code, kw.value))
    )
  })
})

const m = (v, k) => v && String(v).toLowerCase().includes(k)

function getFilteredLocations(wh) {
  if (!kw.value) return wh.locations || []
  return (wh.locations || []).filter(loc =>
    m(loc.name, kw.value) || m(loc.code, kw.value) ||
    (loc.materials || []).some(mt => m(mt.material_name, kw.value) || m(mt.material_code, kw.value))
  )
}
function getFilteredMaterials(loc) {
  if (!kw.value) return loc.materials || []
  return (loc.materials || []).filter(mt =>
    m(mt.material_name, kw.value) || m(mt.material_code, kw.value)
  )
}

onMounted(() => loadAll())

async function loadAll() {
  pageLoading.value = true
  loadingMsg.value = '正在加载仓库数据...'
  try {
    const list = await fetchWarehouses()
    const whs = (Array.isArray(list) ? list : []).map(w => ({
      id: w.id, code: w.code, name: w.name, status: w.status || '启用',
      locCount: 0, matCount: 0,
      locations: [], expanded: false, loaded: false, loading: false
    }))
    // 加载所有仓库的库位和物料
    for (const wh of whs) {
      await loadLocations(wh)
    }
    warehouses.value = whs
  } catch {
    showToast('加载仓库信息失败')
  } finally {
    pageLoading.value = false
  }
}

async function loadLocations(wh) {
  wh.loading = true
  try {
    const locs = await fetchChildren(wh.id)
    const locArr = (Array.isArray(locs) ? locs : []).map(l => ({
      id: l.id, code: l.code, name: l.name, level: l.level,
      materials: [], expanded: false, loaded: false
    }))
    const flat = []
    for (const loc of locArr) {
      if (loc.level === 2) {
        const children = await fetchChildren(loc.id)
        ;(Array.isArray(children) ? children : []).forEach(c => {
          flat.push({
            id: c.id, code: c.code, name: `${loc.name} / ${c.name}`, level: c.level,
            materials: [], expanded: false, loaded: false
          })
        })
      } else {
        flat.push(loc)
      }
    }
    for (const loc of flat) {
      try {
        const inv = await fetchInventory(loc.id)
        loc.materials = Array.isArray(inv) ? inv : []
        loc.loaded = true
      } catch { loc.materials = [] }
    }
    wh.locations = flat
    wh.locCount = flat.length
    wh.matCount = new Set(flat.flatMap(l => (l.materials || []).map(m => m.material_code)).filter(Boolean)).size
    wh.loaded = true
  } catch { /* ignore */ } finally {
    wh.loading = false
  }
}

function toggleWh(wh) { wh.expanded = !wh.expanded }
function toggleLoc(loc) { loc.expanded = !loc.expanded }
function applySearch() { activeKeyword.value = keyword.value }
function clearSearch() { keyword.value = ''; activeKeyword.value = '' }
function fmtQty(v) { return v == null || v === '' ? '--' : v }

async function refresh() {
  await loadAll()
  showToast({ message: '刷新完成', icon: 'success' })
}
</script>

<style scoped>
.header-top{width:100%;height:44px;background:#007cff;display:flex;justify-content:space-between;align-items:center;padding:0 20px;box-sizing:border-box;font-size:16px;font-weight:400;color:#fff;position:sticky;top:0;z-index:20}
.back-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer}
.back-icon{width:10px;height:10px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}

.warehouse-query{min-height:100vh;background:#f5f8f9}
.main{--ink:#1d2433;--muted:#5a6b7c;--line:#e3e9f2;--accent:#1b6dff;--accent-dark:#0e3fa5;--fresh:#21c189;font-family:'Source Han Sans CN','Noto Sans SC','Microsoft YaHei',sans-serif;color:var(--ink);padding:16px;display:flex;flex-direction:column;gap:16px;position:relative;background:radial-gradient(700px 280px at 10% -10%,rgba(27,109,255,.16),transparent 65%),radial-gradient(600px 260px at 100% 20%,rgba(33,193,137,.14),transparent 60%),linear-gradient(140deg,#f9fbff 0%,#f1f6ff 50%,#f6fbf8 100%)}
.main::before,.main::after{content:'';position:absolute;inset:0;pointer-events:none}
.main::before{background:radial-gradient(500px 320px at 90% -10%,rgba(255,178,74,.25),transparent 70%);opacity:.6}
.main::after{background-image:repeating-linear-gradient(120deg,rgba(12,34,64,.03) 0,rgba(12,34,64,.03) 1px,transparent 1px,transparent 64px);opacity:.4}
.main>*{position:relative;z-index:1}

.page-mask{position:fixed;inset:0;background:rgba(247,249,252,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:30;backdrop-filter:blur(6px)}
.spinner{width:42px;height:42px;border-radius:50%;border:3px solid rgba(27,109,255,.2);border-top-color:var(--accent);animation:spin .9s linear infinite}
.mask-text{font-size:13px;color:var(--muted)}

.hero{padding:18px;border-radius:18px;background:rgba(255,255,255,.92);border:1px solid rgba(255,255,255,.7);box-shadow:0 18px 40px rgba(20,37,90,.12);animation:riseIn .6s ease both}
.hero-copy h1{margin:8px 0 6px;font-size:22px;letter-spacing:.5px}
.hero-copy p{margin:0;color:var(--muted);font-size:14px}
.hero-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;color:var(--accent-dark);background:rgba(27,109,255,.12);letter-spacing:.4px}

.search-card{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 10px 24px rgba(20,37,90,.08);display:flex;flex-direction:column;gap:10px;animation:riseIn .7s ease both}
.search-row{display:flex;gap:10px;box-sizing:border-box;overflow:hidden}
.search-row input{flex:1;min-width:0;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px;background:#f7f9fc;color:var(--ink);outline:none;box-sizing:border-box}
.search-btn{flex-shrink:0;border:none;border-radius:12px;padding:10px 16px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-sizing:border-box}
.search-meta{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted)}
.clear-btn{border:none;background:#f2f5f9;color:var(--muted);padding:4px 10px;border-radius:999px;cursor:pointer;font-size:12px}
.result-hint{color:var(--accent-dark)}

.stats-row{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);animation:riseIn .8s ease both}
.stat-card{background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 8px 20px rgba(20,37,90,.08)}
.stat-card.accent{background:linear-gradient(135deg,#1b6dff 0%,#4b8bff 100%);color:#fff}
.stat-card.dark{background:linear-gradient(135deg,#1f2d3d 0%,#44556b 100%);color:#fff}
.stat-label{font-size:12px;opacity:.8}
.stat-value{font-size:20px;font-weight:700;margin-top:6px}

.list-section{display:flex;flex-direction:column;gap:12px}
.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.section-head h2{margin:0 0 4px;font-size:18px}
.section-head p{margin:0;font-size:12px;color:var(--muted)}
.ghost-btn{border:1px solid var(--line);background:#fff;color:var(--muted);border-radius:12px;padding:8px 14px;cursor:pointer;font-size:12px}

.warehouse-grid{display:grid;gap:14px}
.warehouse-card{background:#fff;border-radius:18px;border:1px solid rgba(227,233,242,.8);box-shadow:0 12px 26px rgba(20,37,90,.08);overflow:hidden;animation:riseIn .5s ease both}
.warehouse-top{padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:12px;cursor:pointer}
.warehouse-info{flex:1 1 140px;min-width:120px}
.warehouse-name{font-size:16px;font-weight:600}
.warehouse-code{font-size:12px;color:var(--muted);margin-top:4px;font-family:'JetBrains Mono','SFMono-Regular',Consolas,monospace}
.warehouse-meta{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted)}
.meta-chip{display:flex;align-items:center;gap:5px;background:#f3f6fb;padding:4px 10px;border-radius:999px;color:var(--ink);font-size:12px}
.meta-chip.sm{font-size:11px;padding:3px 8px}
.status-dot{padding:3px 8px;border-radius:999px;font-size:11px;font-weight:600}
.status-dot.ok{background:rgba(33,193,137,.12);color:#0f7b52}
.status-dot.off{background:rgba(239,68,68,.1);color:#b91c1c}
.chevron{width:8px;height:8px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg);transition:transform .2s ease;display:inline-block}
.chevron.open{transform:rotate(-135deg)}
.chevron.sm{width:7px;height:7px}

.warehouse-body{border-top:1px solid rgba(227,233,242,.6);padding:10px 12px 14px;background:#fbfcff}
.location-list{display:flex;flex-direction:column;gap:10px}
.location-card{border:1px solid rgba(227,233,242,.8);border-radius:14px;background:#fff;overflow:hidden}
.location-head{padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer}
.location-name{font-size:14px;font-weight:600}
.location-code{font-size:12px;color:var(--muted);margin-top:3px;font-family:'JetBrains Mono','SFMono-Regular',Consolas,monospace}
.location-meta{display:flex;align-items:center;gap:8px}

.material-body{border-top:1px dashed rgba(227,233,242,.7);padding:8px 12px 12px;display:flex;flex-direction:column;gap:6px;background:#fafcff}
.material-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px dashed rgba(227,233,242,.6)}
.material-row:last-child{border-bottom:none}
.mat-name{font-size:13px;font-weight:600}
.mat-code{font-size:11px;color:var(--muted);margin-top:2px}
.mat-qty{display:flex;align-items:baseline;gap:4px}
.qty-num{font-size:15px;font-weight:700;color:var(--ink)}
.qty-unit{font-size:12px;color:var(--muted)}

.state{text-align:center;padding:12px;color:var(--muted);font-size:13px}
.state.error{color:#ff4d4f}
.state.empty{color:#94a3b8}
.state.sm{padding:8px;font-size:12px}

.panel-enter-active,.panel-leave-active{transition:all .2s ease}
.panel-enter-from,.panel-leave-to{opacity:0;transform:translateY(-6px)}
@keyframes riseIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
