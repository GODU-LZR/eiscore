<template>
  <div class="hello-page">
    <div class="hello-card">
      <div class="hello-badge">Flash Draft</div>
      <h1 class="hello-title">{{ message }}</h1>
      <p class="hello-subtitle">这是一个由闪念草稿生成的 Hello World 页面</p>

      <div class="hello-actions">
        <button class="hello-btn" type="button" @click="greet">点我打招呼</button>
        <button class="hello-btn ghost" type="button" @click="reset">重置</button>
      </div>

      <p class="hello-count">已点击 {{ count }} 次</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const baseMessage = 'Hello World'
const message = ref(baseMessage)
const count = ref(0)

function greet() {
  count.value += 1
  message.value = `${baseMessage} 👋 (第 ${count.value} 次问候)`
}

function reset() {
  count.value = 0
  message.value = baseMessage
}
</script>

<style scoped>
.hello-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #eef2ff 0%, #e0f2fe 55%, #ecfeff 100%);
  font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.hello-card {
  width: 100%;
  max-width: 460px;
  padding: 40px 32px;
  text-align: center;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 18px 40px rgba(30, 64, 175, 0.14);
}

.hello-badge {
  display: inline-block;
  padding: 4px 12px;
  margin-bottom: 20px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1d4ed8;
  background: #e0e7ff;
  border-radius: 999px;
}

.hello-title {
  margin: 0 0 12px;
  font-size: 30px;
  line-height: 1.3;
  font-weight: 700;
  color: #0f172a;
}

.hello-subtitle {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.6;
  color: #64748b;
}

.hello-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.hello-btn {
  padding: 10px 22px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background: #2563eb;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.hello-btn:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.28);
}

.hello-btn:active {
  transform: translateY(0);
}

.hello-btn.ghost {
  color: #2563eb;
  background: #ffffff;
  border-color: #bfdbfe;
}

.hello-btn.ghost:hover {
  background: #eff6ff;
  box-shadow: none;
}

.hello-count {
  margin: 24px 0 0;
  font-size: 13px;
  color: #94a3b8;
}
</style>