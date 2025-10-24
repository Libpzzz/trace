<template>
  <div class="chat-interface">
    <div class="chat-header">
      <h3>AI 助手</h3>
      <el-button @click="clearChat" size="small" text>
        <el-icon><Delete /></el-icon>
        清空对话
      </el-button>
    </div>

    <div class="chat-messages" ref="messagesContainer">
      <div v-if="messages.length === 0" class="empty-chat">
        <el-icon size="48" color="#c0c4cc">
          <ChatDotRound />
        </el-icon>
        <p>开始与AI助手对话吧！</p>
        <div class="quick-actions">
          <el-button size="small" @click="sendQuickMessage('请帮我总结这个文档的主要内容')">
            总结文档
          </el-button>
          <el-button size="small" @click="sendQuickMessage('这个文档讲的是什么？')">
            文档概述
          </el-button>
        </div>
      </div>

      <div
        v-for="(message, index) in messages"
        :key="index"
        class="message-item"
        :class="{ 'user-message': message.type === 'user', 'ai-message': message.type === 'ai' }"
      >
        <div class="message-avatar">
          <el-avatar v-if="message.type === 'user'" :size="32">
            <el-icon><User /></el-icon>
          </el-avatar>
          <el-avatar v-else :size="32" style="background: #409eff">
            <el-icon><Avatar /></el-icon>
          </el-avatar>
        </div>

        <div class="message-content">
          <div class="message-bubble">
            <div v-if="message.image" class="message-image">
              <img :src="message.image" alt="截图" @click="previewImage(message.image)" />
            </div>
            <div class="message-text" v-html="formatMessage(message.content)"></div>
          </div>
          <div class="message-time">
            {{ formatTime(message.timestamp) }}
          </div>
        </div>

        <div class="message-actions" v-if="message.type === 'ai'">
          <el-button size="small" text @click="copyMessage(message.content)">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
          <el-button size="small" text @click="regenerateMessage(index)">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>

      <div v-if="isTyping" class="typing-indicator">
        <div class="message-item ai-message">
          <div class="message-avatar">
            <el-avatar :size="32" style="background: #409eff">
              <el-icon><Avatar /></el-icon>
            </el-avatar>
          </div>
          <div class="message-content">
            <div class="message-bubble">
              <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="chat-input">
      <div class="input-container">
        <el-input
          v-model="inputMessage"
          type="textarea"
          :rows="3"
          placeholder="输入您的问题..."
          @keydown.ctrl.enter="sendMessage"
          @keydown.meta.enter="sendMessage"
          resize="none"
        />
        <div class="input-actions">
          <el-button @click="attachFile" size="small" text>
            <el-icon><Paperclip /></el-icon>
          </el-button>
          <el-button 
            @click="sendMessage" 
            type="primary" 
            size="small"
            :disabled="!inputMessage.trim() || isTyping"
          >
            发送
          </el-button>
        </div>
      </div>
      <div class="input-hint">
        按 Ctrl+Enter 快速发送
      </div>
    </div>

    <!-- 图片预览 -->
    <el-dialog v-model="imagePreviewVisible" title="图片预览" width="80%">
      <img :src="previewImageSrc" style="width: 100%; height: auto;" />
    </el-dialog>

    <!-- 文件上传 -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="handleFileUpload"
    />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { 
  Delete, 
  ChatDotRound, 
  User, 
  Avatar, 
  CopyDocument, 
  Refresh, 
  Paperclip 
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// Props 和 Emits
const emit = defineEmits(['send-message'])

// 响应式数据
const messages = ref([])
const inputMessage = ref('')
const isTyping = ref(false)
const messagesContainer = ref(null)
const fileInput = ref(null)
const imagePreviewVisible = ref(false)
const previewImageSrc = ref('')

// 生命周期
onMounted(() => {
  // 添加欢迎消息
  addMessage({
    type: 'ai',
    content: '您好！我是AI助手，可以帮您分析文档内容、回答问题。您可以：\n\n• 选择文档中的文本进行提问\n• 截图后让我分析图片内容\n• 直接输入问题与我对话\n\n有什么可以帮助您的吗？',
    timestamp: new Date()
  })
})

// 方法
function sendMessage() {
  if (!inputMessage.value.trim() || isTyping.value) return

  const message = {
    type: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date()
  }

  addMessage(message)
  emit('send-message', message)

  inputMessage.value = ''
  showTypingIndicator()
}

function sendQuickMessage(content) {
  const message = {
    type: 'user',
    content: content,
    timestamp: new Date()
  }

  addMessage(message)
  emit('send-message', message)
  showTypingIndicator()
}

function addMessage(message) {
  messages.value.push(message)
  nextTick(() => {
    scrollToBottom()
  })
}

function showTypingIndicator() {
  isTyping.value = true
  nextTick(() => {
    scrollToBottom()
  })
}

function hideTypingIndicator() {
  isTyping.value = false
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function clearChat() {
  messages.value = []
  addMessage({
    type: 'ai',
    content: '对话已清空，有什么新问题需要帮助吗？',
    timestamp: new Date()
  })
}

function formatMessage(content) {
  // 简单的消息格式化，支持换行
  return content.replace(/\n/g, '<br>')
}

function formatTime(timestamp) {
  const now = new Date()
  const time = new Date(timestamp)
  const diff = now - time

  if (diff < 60000) { // 1分钟内
    return '刚刚'
  } else if (diff < 3600000) { // 1小时内
    return `${Math.floor(diff / 60000)}分钟前`
  } else if (diff < 86400000) { // 24小时内
    return time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else {
    return time.toLocaleString('zh-CN', { 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }
}

async function copyMessage(content) {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

function regenerateMessage(index) {
  // 重新生成AI回复
  if (index > 0 && messages.value[index - 1].type === 'user') {
    const userMessage = messages.value[index - 1]
    messages.value.splice(index) // 删除当前AI回复及之后的消息
    emit('send-message', userMessage)
    showTypingIndicator()
  }
}

function previewImage(src) {
  previewImageSrc.value = src
  imagePreviewVisible.value = true
}

function attachFile() {
  fileInput.value.click()
}

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  if (file.type.startsWith('image/')) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const message = {
        type: 'user',
        content: '请分析这张图片',
        image: e.target.result,
        timestamp: new Date()
      }
      addMessage(message)
      emit('send-message', message)
      showTypingIndicator()
    }
    reader.readAsDataURL(file)
  } else {
    ElMessage.error('只支持图片文件')
  }

  // 清空文件输入
  event.target.value = ''
}

// 暴露方法给父组件
defineExpose({
  addMessage,
  showTypingIndicator,
  hideTypingIndicator
})
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9fa;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-bottom: 1px solid #e4e7ed;
}

.chat-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  text-align: center;
}

.empty-chat p {
  margin: 16px 0 24px;
  font-size: 14px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-item {
  display: flex;
  margin-bottom: 20px;
  align-items: flex-start;
}

.user-message {
  flex-direction: row-reverse;
}

.user-message .message-content {
  margin-right: 12px;
  margin-left: 0;
}

.ai-message .message-content {
  margin-left: 12px;
  margin-right: 0;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  max-width: 70%;
}

.message-bubble {
  background: white;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  position: relative;
}

.user-message .message-bubble {
  background: #409eff;
  color: white;
}

.user-message .message-bubble::after {
  content: '';
  position: absolute;
  right: -8px;
  top: 12px;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-left-color: #409eff;
}

.ai-message .message-bubble::after {
  content: '';
  position: absolute;
  left: -8px;
  top: 12px;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  border-right-color: white;
}

.message-image {
  margin-bottom: 8px;
}

.message-image img {
  max-width: 200px;
  max-height: 150px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.message-image img:hover {
  transform: scale(1.05);
}

.message-text {
  line-height: 1.5;
  word-break: break-word;
}

.message-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  text-align: right;
}

.user-message .message-time {
  text-align: left;
}

.message-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-item:hover .message-actions {
  opacity: 1;
}

.typing-indicator {
  margin-bottom: 20px;
}

.typing-dots {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c0c4cc;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.chat-input {
  background: white;
  border-top: 1px solid #e4e7ed;
  padding: 16px 20px;
}

.input-container {
  position: relative;
}

.input-actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  text-align: center;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .chat-messages {
    padding: 12px;
  }
  
  .message-content {
    max-width: 85%;
  }
  
  .chat-input {
    padding: 12px;
  }
}
</style>