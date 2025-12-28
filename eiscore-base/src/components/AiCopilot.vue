<template>
  <div class="ai-copilot-container" :class="{ 'is-open': state.isOpen }">
    <div 
      v-if="!state.isOpen" 
      class="ai-trigger-btn" 
      @click="aiBridge.toggleWindow()"
    >
      <div class="ai-icon-wrapper">
        <span class="sparkle-icon">✨</span>
      </div>
      <span class="ai-label">人工智能</span>
    </div>

    <div v-else class="ai-window">
      <div class="ai-header">
        <div class="header-left" @click="toggleHistory">
          <el-icon class="history-icon" :class="{ 'active': showHistory }"><Operation /></el-icon>
          <span class="title">EIS 智能助手</span>
        </div>
        <div class="header-right">
          <el-tooltip content="新建对话" placement="bottom">
            <el-icon class="action-icon" @click="aiBridge.createNewSession()"><Plus /></el-icon>
          </el-tooltip>
          <el-icon class="close-btn" @click="aiBridge.toggleWindow()"><Close /></el-icon>
        </div>
      </div>

      <div class="ai-body">
        <div class="history-sidebar" :class="{ 'show': showHistory }">
          <div class="sidebar-header">对话历史</div>
          <div class="session-list">
            <div 
              v-for="sess in state.sessions" 
              :key="sess.id" 
              class="session-item"
              :class="{ 'active': sess.id === state.currentSessionId }"
              @click="switchSession(sess.id)"
            >
              <span class="session-title">{{ sess.title }}</span>
              <el-icon class="delete-icon" @click.stop="aiBridge.deleteSession(sess.id)"><Delete /></el-icon>
            </div>
          </div>
        </div>

        <div class="chat-area" @click="showHistory = false">
          <div class="messages-container" ref="messagesRef">
            <template v-if="currentSession">
              <div 
                v-for="(msg, index) in currentSession.messages" 
                :key="index" 
                class="message-row"
                :class="msg.role"
              >
                <div class="avatar-wrapper">
                  <div class="avatar">{{ msg.role === 'user' ? '👤' : '✨' }}</div>
                </div>
                
                <div class="content-wrapper">
                  <div v-if="msg.images && msg.images.length" class="msg-images">
                    <el-image 
                      v-for="(img, idx) in msg.images" 
                      :key="idx" 
                      :src="img.url" 
                      :preview-src-list="msg.images.map(i=>i.url)"
                      class="msg-img"
                    />
                  </div>
                  
                  <div class="bubble">
                    <div class="markdown-body" v-html="formatText(msg.content)"></div>
                    <span v-if="msg.role === 'assistant' && index === currentSession.messages.length - 1 && state.isStreaming" class="cursor">|</span>
                  </div>
                  
                  <div v-if="msg.role === 'user' && !state.isLoading" class="msg-actions">
                    <el-button link size="small" type="info" @click="retryMessage(msg.content)">重新发送</el-button>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <div class="input-section">
            <div v-if="state.selectedImages.length" class="image-preview-bar">
              <div v-for="(img, idx) in state.selectedImages" :key="idx" class="preview-item">
                <img :src="img.url" />
                <div class="remove-img" @click="state.selectedImages.splice(idx, 1)">×</div>
              </div>
            </div>

            <div class="input-box">
              <el-upload
                action="#"
                :auto-upload="false"
                :show-file-list="false"
                :on-change="(file) => aiBridge.handleFileSelect(file.raw)"
                accept="image/*"
                class="upload-trigger"
              >
                <el-icon class="tool-icon"><Picture /></el-icon>
              </el-upload>

              <textarea 
                v-model="state.inputBuffer" 
                placeholder="输入问题或指令 (Shift+Enter 换行)..."
                @keydown.enter="handleEnter"
                :disabled="state.isLoading"
              ></textarea>
              
              <div class="send-btn" :class="{ 'disabled': state.isLoading }" @click="handleSend">
                <el-icon v-if="state.isLoading" class="is-loading"><Loading /></el-icon>
                <el-icon v-else><Position /></el-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { aiBridge } from '@/utils/ai-bridge'
import { Operation, Close, Plus, Delete, Picture, Position, Loading } from '@element-plus/icons-vue'

const state = aiBridge.state
const showHistory = ref(false)
const messagesRef = ref(null)

const currentSession = computed(() => aiBridge.getCurrentSession())

// 简易格式化：将换行符转为 <br>，后续可接入 markdown-it
const formatText = (text) => {
  if (!text) return ''
  // 简单的安全转义
  let safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // 代码块简单高亮背景
  safe = safe.replace(/```([\s\S]*?)```/g, '<pre class="code-block">$1</pre>')
  // 换行
  return safe.replace(/\n/g, '<br>')
}

const toggleHistory = () => {
  showHistory.value = !showHistory.value
}

const switchSession = (id) => {
  state.currentSessionId = id
  showHistory.value = false // 移动端或窄屏体验优化
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const handleEnter = (e) => {
  if (!e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

const handleSend = () => {
  if (state.isLoading) return
  const text = state.inputBuffer
  aiBridge.sendMessage(text)
}

const retryMessage = (text) => {
  aiBridge.sendMessage(text, true) // true 表示这是重试，不重复添加用户消息
}

// 监听消息变化自动滚动
watch(() => currentSession.value?.messages.length, scrollToBottom)
watch(() => currentSession.value?.messages[currentSession.value.messages.length-1]?.content, scrollToBottom) // 监听流式输出
watch(() => state.isOpen, (val) => { if(val) scrollToBottom() })

onMounted(() => {
  aiBridge.loadConfig()
})
</script>

<style scoped lang="scss">
// 变量定义
$primary-color: var(--el-color-primary, #409EFF);
$bg-color: #ffffff;
$chat-bg: #f5f7fa;
$border-color: #e4e7ed;

.ai-copilot-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

// 1. 悬浮按钮样式优化
.ai-trigger-btn {
  width: 60px;
  height: 60px;
  background: $primary-color;
  border-radius: 16px; // 正方形带圆弧
  box-shadow: 0 8px 24px rgba($primary-color, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  color: white;

  &:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 12px 30px rgba($primary-color, 0.5);
  }

  .sparkle-icon {
    font-size: 24px;
    margin-bottom: 2px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }
  
  .ai-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
}

// 2. 主窗口样式
.ai-window {
  width: 400px;
  height: 600px;
  background: $bg-color;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.05);
  animation: popIn 0.3s ease-out;
}

@keyframes popIn {
  from { opacity: 0; transform: scale(0.9) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.ai-header {
  height: 50px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  user-select: none;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    color: #303133;
    
    .history-icon { 
      font-size: 18px; 
      transition: transform 0.3s;
      &.active { transform: rotate(90deg); color: $primary-color; }
    }
    .title { font-weight: 600; font-size: 15px; }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .el-icon {
      font-size: 18px;
      cursor: pointer;
      color: #909399;
      transition: color 0.2s;
      &:hover { color: $primary-color; }
      &.close-btn:hover { color: #f56c6c; }
    }
  }
}

.ai-body {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
}

// 侧边栏
.history-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  background: #f9fafc;
  border-right: 1px solid $border-color;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 10;
  display: flex;
  flex-direction: column;

  &.show { transform: translateX(0); }

  .sidebar-header {
    padding: 12px;
    font-size: 12px;
    color: #909399;
    font-weight: 600;
  }

  .session-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px;
  }

  .session-item {
    padding: 10px 12px;
    border-radius: 8px;
    margin-bottom: 4px;
    cursor: pointer;
    font-size: 13px;
    color: #606266;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s;

    &:hover { background: #eef0f5; }
    &.active { background: #ecf5ff; color: $primary-color; font-weight: 500; }

    .session-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
    .delete-icon { font-size: 14px; color: #c0c4cc; &:hover { color: #f56c6c; } }
  }
}

// 聊天区域
.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: $chat-bg;
  width: 100%; // 确保占满
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.message-row {
  display: flex;
  gap: 12px;
  
  &.user { flex-direction: row-reverse; }

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  
  &.assistant .avatar { background: linear-gradient(135deg, #e6f7ff, #ffffff); color: $primary-color; }
  &.user .avatar { background: $primary-color; color: white; }

  .content-wrapper {
    max-width: 80%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  
  &.user .content-wrapper { align-items: flex-end; }

  .msg-images {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
    
    .msg-img {
      width: 100px;
      height: 100px;
      border-radius: 8px;
      border: 1px solid $border-color;
    }
  }

  .bubble {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.6;
    position: relative;
    word-break: break-word;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  &.assistant .bubble { background: #fff; color: #303133; border-top-left-radius: 2px; }
  &.user .bubble { background: $primary-color; color: #fff; border-top-right-radius: 2px; }

  .msg-actions { margin-top: 4px; opacity: 0; transition: opacity 0.2s; }
  &:hover .msg-actions { opacity: 1; }
}

// 简易 Markdown 样式覆盖
.markdown-body :deep(pre) {
  background: #282c34;
  color: #abb2bf;
  padding: 10px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Consolas', monospace;
  margin: 8px 0;
}

.cursor {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: $primary-color;
  animation: blink 1s infinite;
  vertical-align: middle;
  margin-left: 2px;
}
@keyframes blink { 50% { opacity: 0; } }

// 输入区
.input-section {
  background: #fff;
  border-top: 1px solid $border-color;
  padding: 12px;
  
  .image-preview-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    overflow-x: auto;
    
    .preview-item {
      position: relative;
      width: 48px;
      height: 48px;
      img { width: 100%; height: 100%; border-radius: 4px; object-fit: cover; }
      .remove-img {
        position: absolute; top: -6px; right: -6px;
        width: 16px; height: 16px; background: rgba(0,0,0,0.5); color: white;
        border-radius: 50%; font-size: 12px; display: flex; align-items: center; justify-content: center;
        cursor: pointer;
      }
    }
  }

  .input-box {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: #f5f7fa;
    border-radius: 24px;
    padding: 6px 6px 6px 12px;
    border: 1px solid transparent;
    transition: all 0.2s;

    &:focus-within {
      background: #fff;
      border-color: $primary-color;
      box-shadow: 0 0 0 2px rgba($primary-color, 0.1);
    }

    textarea {
      flex: 1;
      background: transparent;
      border: none;
      resize: none;
      height: 40px;
      max-height: 100px;
      padding: 8px 0;
      font-size: 14px;
      &:focus { outline: none; }
    }

    .tool-icon {
      font-size: 20px;
      color: #909399;
      cursor: pointer;
      margin-bottom: 8px;
      &:hover { color: $primary-color; }
    }

    .send-btn {
      width: 36px;
      height: 36px;
      background: $primary-color;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      cursor: pointer;
      transition: transform 0.2s;
      flex-shrink: 0;

      &:hover { transform: scale(1.1); }
      &.disabled { background: #a0cfff; cursor: not-allowed; }
      
      .is-loading { animation: rotate 1s linear infinite; }
    }
  }
}
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>