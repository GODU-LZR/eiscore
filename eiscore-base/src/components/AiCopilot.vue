<template>
  <div class="ai-copilot-container">
    <div 
      v-if="!state.isOpen" 
      class="ai-trigger-btn" 
      @click="aiBridge.toggleWindow()"
    >
      <div class="ai-icon">🤖</div>
      <span class="ai-label">AI 助手</span>
    </div>

    <div v-else class="ai-window">
      <div class="ai-header">
        <div class="header-left">
          <span class="icon">✨</span>
          <span class="title">EISCore Copilot</span>
          <span v-if="state.currentContext" class="context-badge">
            {{ state.currentContext.app }} / {{ state.currentContext.page }}
          </span>
        </div>
        <div class="header-right">
          <span class="close-btn" @click="aiBridge.toggleWindow()">×</span>
        </div>
      </div>

      <div class="ai-messages" ref="messagesRef">
        <div 
          v-for="(msg, index) in state.messages" 
          :key="index" 
          class="message-row"
          :class="msg.role"
        >
          <div class="avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
          <div class="bubble">
            <div style="white-space: pre-wrap;">{{ msg.content }}</div>
          </div>
        </div>
        <div v-if="state.isLoading" class="message-row assistant">
          <div class="avatar">🤖</div>
          <div class="bubble loading">
            <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>
          </div>
        </div>
      </div>

      <div class="ai-input-area">
        <textarea 
          v-model="inputText" 
          placeholder="输入指令，例如：把当前表单加上一个审批人字段..."
          @keydown.enter.prevent="handleSend"
        ></textarea>
        <button class="send-btn" @click="handleSend" :disabled="state.isLoading || !inputText">
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { aiBridge } from '@/utils/ai-bridge'

const state = aiBridge.state
const inputText = ref('')
const messagesRef = ref(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const handleSend = () => {
  if (!inputText.value.trim() || state.isLoading) return
  const text = inputText.value
  inputText.value = ''
  aiBridge.sendMessage(text)
}

watch(() => state.messages.length, scrollToBottom)
watch(() => state.isOpen, (val) => {
  if (val) scrollToBottom()
})

onMounted(() => {
  // 组件加载时尝试获取配置
  aiBridge.loadConfig()
})
</script>

<style scoped>
.ai-copilot-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  font-family: 'Segoe UI', sans-serif;
}

/* 悬浮按钮 */
.ai-trigger-btn {
  background: linear-gradient(135deg, #409EFF, #337ecc);
  color: white;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s;
}
.ai-trigger-btn:hover {
  transform: scale(1.05);
}
.ai-icon { font-size: 24px; line-height: 1; }
.ai-label { font-size: 10px; margin-top: 2px; }

/* 聊天窗口 */
.ai-window {
  width: 380px;
  height: 550px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e4e7ed;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-header {
  background: #f5f7fa;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.header-left { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #303133; }
.context-badge {
  background: #ecf5ff;
  color: #409EFF;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: normal;
}
.close-btn { cursor: pointer; font-size: 20px; color: #909399; }
.close-btn:hover { color: #606266; }

.ai-messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  background: #fff;
}

.message-row {
  display: flex;
  margin-bottom: 16px;
  gap: 8px;
}
.message-row.user { flex-direction: row-reverse; }

.avatar {
  width: 32px;
  height: 32px;
  background: #f0f2f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.message-row.user .avatar { background: #d9ecff; }

.bubble {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  max-width: 80%;
  word-break: break-word;
}
.message-row.assistant .bubble { background: #f4f4f5; color: #303133; border-top-left-radius: 2px; }
.message-row.user .bubble { background: #409EFF; color: #fff; border-top-right-radius: 2px; }

.loading .dot {
  animation: bounce 1.4s infinite ease-in-out both;
  margin: 0 1px;
}
.loading .dot:nth-child(1) { animation-delay: -0.32s; }
.loading .dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

.ai-input-area {
  padding: 12px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  gap: 8px;
  background: #fff;
}
textarea {
  flex: 1;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  resize: none;
  height: 40px;
  font-family: inherit;
  font-size: 14px;
}
textarea:focus { outline: none; border-color: #409EFF; }
.send-btn {
  background: #409EFF;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0 16px;
  cursor: pointer;
  font-weight: 500;
}
.send-btn:disabled { background: #a0cfff; cursor: not-allowed; }
</style>