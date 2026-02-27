<template>
  <div class="label-print">
    <!-- 不打印的顶部栏 -->
    <div class="header-top no-print">
      <span class="back-btn" @click="$router.back()"><i class="back-icon" /></span>
      <p>标签预览</p>
      <button class="print-action" @click="doPrint">打印</button>
    </div>

    <div class="content">
      <div v-if="!labelInfo.qrContent" class="state empty">
        暂无可打印的标签数据，请返回上一页重试。
      </div>

      <template v-else>
        <!-- 打印提示(不打印) -->
        <div class="tips-bar no-print">
          <div class="tips-text">
            打印提示：点击右上角「打印」按钮，或按 <strong>Ctrl + P</strong> 触发浏览器打印。
          </div>
        </div>

        <!-- 标签卡（打印区域，输出两份） -->
        <div class="print-area" ref="printArea">
          <section v-for="idx in 2" :key="idx" class="label-card">
            <div class="label-wrapper">
              <div class="qr-box">
                <canvas :ref="el => { if (idx === 1) qrCanvas1 = el; else qrCanvas2 = el }" />
              </div>
              <div class="info-column">
                <div class="label-title">{{ labelInfo.title }}</div>
                <div
                  v-for="item in labelInfo.infoPairs"
                  :key="`${item.key}-${idx}`"
                  class="info-item"
                >
                  <span class="info-key">{{ item.key }}：</span>
                  <span class="info-value">{{ formatValue(item.value) }}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'

const route = useRoute()
const qrCanvas1 = ref(null)
const qrCanvas2 = ref(null)

const labelInfo = reactive({
  title: '',
  qrContent: '',
  infoPairs: []
})

function buildLabelInfo(raw = {}) {
  const code = raw.code || raw.qrContent || ''
  const name = raw.name || ''
  const labelType = String(raw.labelType || '').toLowerCase()
  const upper = String(code).toUpperCase()

  let title = raw.title
  if (!title) {
    if (labelType === 'warehouse') title = '仓库标签'
    else if (labelType === 'location') title = '库位标签'
    else if (labelType === 'material') title = '物料标签'
    else if (upper.startsWith('WH-')) title = '仓库标签'
    else if (upper.startsWith('LOC-')) title = '库位标签'
    else title = '标签'
  }

  const infoPairs = raw.infoPairs || [
    { key: '名称', value: name || '--' },
    { key: '编码', value: code || '--' }
  ]

  return { title, qrContent: code, infoPairs }
}

function initFromQuery() {
  const payload = route.query?.payload
  const queryLabelType = route.query?.labelType || ''

  if (payload) {
    try {
      const decoded = JSON.parse(decodeURIComponent(atob(payload)))
      const info = buildLabelInfo({ ...decoded, labelType: decoded.labelType || queryLabelType })
      Object.assign(labelInfo, info)
      return
    } catch { /* fallback */ }
  }

  const code = route.query?.code || ''
  const name = route.query?.name || ''
  const info = buildLabelInfo({ code, name, labelType: queryLabelType })
  Object.assign(labelInfo, info)
}

async function renderQR() {
  if (!labelInfo.qrContent) return
  await nextTick()

  const opts = { width: 200, margin: 1, color: { dark: '#000000', light: '#ffffff' } }

  try {
    if (qrCanvas1.value) await QRCode.toCanvas(qrCanvas1.value, labelInfo.qrContent, opts)
    if (qrCanvas2.value) await QRCode.toCanvas(qrCanvas2.value, labelInfo.qrContent, opts)
  } catch (e) {
    console.error('QRCode render failed', e)
  }
}

function formatValue(v) {
  if (v === undefined || v === null || v === '') return '--'
  return String(v)
}

function doPrint() {
  window.print()
}

onMounted(() => {
  initFromQuery()
  renderQR()
})

watch(() => route.query, () => {
  initFromQuery()
  renderQR()
}, { deep: true })
</script>

<style scoped>
/* ===== Header (不打印) ===== */
.header-top{width:100%;height:44px;background:#007cff;display:flex;justify-content:space-between;align-items:center;padding:0 20px;box-sizing:border-box;font-size:16px;color:#fff;position:sticky;top:0;z-index:20}
.back-btn{display:flex;align-items:center;justify-content:center;width:28px;height:28px;cursor:pointer}
.back-icon{width:10px;height:10px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(45deg)}
.print-action{background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.4);color:#fff;padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
.print-action:active{background:rgba(255,255,255,0.3)}

/* ===== Content ===== */
.content {
  font-family: 'Source Han Sans CN','Noto Sans SC','Microsoft YaHei',sans-serif;
  color: #1d2433;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  min-height: calc(100vh - 44px);
  background: #fff;
}

/* ===== Tips (不打印) ===== */
.tips-bar{width:100%;max-width:640px;padding:12px 16px;background:rgba(27,109,255,0.06);border-radius:12px;box-sizing:border-box}
.tips-text{font-size:13px;color:#5a6b7c;line-height:1.6}
.tips-text strong{color:#1b6dff}

/* ===== Print Area ===== */
.print-area{width:100%;max-width:640px;display:flex;flex-direction:column;gap:24px}

/* ===== Label Card ===== */
.label-card {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 12px;
  padding: 24px;
  box-sizing: border-box;
}
.label-wrapper {
  display: flex;
  align-items: center;
  gap: 24px;
}
.qr-box canvas {
  width: 180px !important;
  height: 180px !important;
}
.info-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.label-title {
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}
.info-item {
  display: flex;
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
}
.info-key {
  font-weight: 600;
  color: #606266;
  white-space: nowrap;
  margin-right: 6px;
}
.info-value {
  flex: 1;
  word-break: break-all;
}

/* ===== States ===== */
.state{text-align:center;padding:40px 16px;font-size:14px;color:#5a6b7c}

/* ===== Print Styles ===== */
@media print {
  .no-print {
    display: none !important;
  }
  .tips-bar {
    display: none !important;
  }

  body, html {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  .label-print {
    min-height: auto;
  }

  .content {
    padding: 0;
    gap: 0;
    min-height: auto;
  }

  .print-area {
    max-width: none;
    width: 100%;
    gap: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100vh;
  }

  .label-card {
    width: 90%;
    height: 46%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: auto;
    border: 1px solid #dcdfe6;
    border-radius: 0;
    padding: 2vh 2vw;
    max-width: none;
  }

  .label-wrapper {
    border: none;
    padding: 0;
    width: 100%;
    height: 100%;
    gap: 2vw;
  }

  .qr-box canvas {
    width: 16vh !important;
    height: 16vh !important;
  }

  .label-title {
    font-size: 3vh;
  }

  .info-item {
    font-size: 1.6vh;
  }
}
</style>
