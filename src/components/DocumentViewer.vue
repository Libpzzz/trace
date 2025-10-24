<template>
  <div class="document-viewer">
    <!-- 左侧文档区域 -->
    <div class="document-panel" ref="documentPanel">
      <div class="document-header">
        <div class="document-controls">
          <el-button @click="selectFile" type="primary" :icon="Upload">
            选择PDF文件
          </el-button>
          <el-button @click="loadDemoFile" :icon="Document">
            加载示例文档
          </el-button>
          <el-button @click="startScreenshot" :icon="Camera" :disabled="!pdfLoaded">
            截图
          </el-button>
          <el-button @click="toggleTextSelection" :icon="Edit" :disabled="!pdfLoaded">
            {{ textSelectionEnabled ? '退出文本选择' : '文本选择' }}
          </el-button>
        </div>
        <div class="document-info" v-if="pdfLoaded">
          <span>页数: {{ totalPages }}</span>
          <span>当前页: {{ currentPage }}</span>
        </div>
      </div>

      <div class="document-content" ref="documentContent">
        <div v-if="!pdfLoaded" class="empty-state">
          <el-icon size="64" color="#c0c4cc">
            <Document />
          </el-icon>
          <p>请选择一个PDF文件开始查看</p>
        </div>

        <div v-else class="pdf-content" ref="pdfContent">
          <div 
            v-for="page in pages" 
            :key="page.pageNum"
            class="pdf-page"
            :data-page="page.pageNum"
          >
            <div class="page-number">第 {{ page.pageNum }} 页</div>
            <div class="page-content" ref="pageContent">
              <!-- PDF页面内容将在这里渲染 -->
            </div>
          </div>
        </div>
      </div>

      <!-- 页面导航 -->
      <div class="document-footer" v-if="pdfLoaded">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="1"
          :total="totalPages"
          layout="prev, pager, next, jumper"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 右侧对话区域 -->
    <div class="chat-panel">
      <ChatInterface 
        ref="chatInterface"
        @send-message="handleSendMessage"
      />
    </div>

    <!-- 文件选择器 -->
    <input
      ref="fileInput"
      type="file"
      accept=".pdf"
      style="display: none"
      @change="handleFileSelect"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { Upload, Camera, Edit, Document } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ChatInterface from './ChatInterface.vue'
import { PDFUtils } from '../utils/pdfUtils.js'
import { ScreenshotUtils } from '../utils/screenshotUtils.js'
import { TextSelectionUtils } from '../utils/textSelectionUtils.js'

// 响应式数据
const documentPanel = ref(null)
const documentContent = ref(null)
const pdfContent = ref(null)
const pageContent = ref([])
const fileInput = ref(null)
const chatInterface = ref(null)

const pdfLoaded = ref(false)
const totalPages = ref(0)
const currentPage = ref(1)
const pages = ref([])
const textSelectionEnabled = ref(false)

// 工具类实例
let pdfUtils = null
let screenshotUtils = null
let textSelectionUtils = null

onMounted(() => {
  initializeUtils()
  setupEventListeners()
})

function initializeUtils() {
  pdfUtils = new PDFUtils()
  screenshotUtils = new ScreenshotUtils()
  textSelectionUtils = new TextSelectionUtils()
}

function setupEventListeners() {
  // 监听截图AI询问事件
  if (documentPanel.value) {
    documentPanel.value.addEventListener('screenshot-ai-ask', handleScreenshotAIAsk)
    documentPanel.value.addEventListener('text-ai-ask', handleTextAIAsk)
  }
}

function selectFile() {
  fileInput.value.click()
}

async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return

  try {
    const success = await pdfUtils.loadPDF(file)
    if (success) {
      await renderPDF()
      pdfLoaded.value = true
      totalPages.value = pdfUtils.getNumPages()
      
      // 启用文本选择
      if (textSelectionEnabled.value) {
        enableTextSelection()
      }
      
      ElMessage.success('PDF文件加载成功')
    }
  } catch (error) {
    console.error('PDF加载失败:', error)
    ElMessage.error('PDF文件加载失败')
  }
}

async function loadDemoFile() {
  try {
    const success = await pdfUtils.loadPDFFromUrl('/demo.pdf')
    if (success) {
      await renderPDF()
      pdfLoaded.value = true
      totalPages.value = pdfUtils.getNumPages()
      
      // 启用文本选择
      if (textSelectionEnabled.value) {
        enableTextSelection()
      }
      
      ElMessage.success('示例文档加载成功')
    }
  } catch (error) {
    console.error('示例文档加载失败:', error)
    ElMessage.error('示例文档加载失败')
  }
}

async function renderPDF() {
  await nextTick()
  
  const allPages = pdfUtils.getAllPages()
  pages.value = allPages

  await nextTick()

  // 渲染所有页面
  const pageElements = document.querySelectorAll('.page-content')
  pageElements.forEach((element, index) => {
    const pageData = allPages[index]
    if (pageData && pageData.canvas) {
      element.innerHTML = ''
      
      // 创建文本层容器
      const textLayer = document.createElement('div')
      textLayer.className = 'text-layer'
      textLayer.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: auto;
        z-index: 2;
      `

      // 添加canvas
      const canvas = pageData.canvas.cloneNode(true)
      canvas.style.cssText = `
        display: block;
        max-width: 100%;
        height: auto;
        position: relative;
        z-index: 1;
      `
      
      element.appendChild(canvas)
      
      // 渲染文本层
      renderTextLayer(textLayer, pageData.pageNum, pageData.viewport)
      element.appendChild(textLayer)
      
      // 设置页面容器样式
      element.style.position = 'relative'
    }
  })
}

function renderTextLayer(textLayer, pageNum, viewport) {
  const textContent = pdfUtils.getPageTextContent(pageNum)
  
  textContent.forEach(item => {
    const textSpan = document.createElement('span')
    textSpan.textContent = item.str
    textSpan.style.cssText = `
      position: absolute;
      left: ${item.transform[4]}px;
      top: ${viewport.height - item.transform[5]}px;
      font-size: ${item.height}px;
      font-family: ${item.fontName || 'sans-serif'};
      color: transparent;
      user-select: text;
      cursor: text;
    `
    textLayer.appendChild(textSpan)
  })
}

function startScreenshot() {
  if (!pdfLoaded.value) return
  
  screenshotUtils.startCapture(documentContent.value)
}

function toggleTextSelection() {
  textSelectionEnabled.value = !textSelectionEnabled.value
  
  if (textSelectionEnabled.value) {
    enableTextSelection()
  } else {
    disableTextSelection()
  }
}

function enableTextSelection() {
  if (pdfContent.value) {
    textSelectionUtils.initTextSelection(documentPanel.value)
    
    // 启用文本选择样式
    const textLayers = document.querySelectorAll('.text-layer span')
    textLayers.forEach(span => {
      span.style.color = 'rgba(0, 0, 0, 0.8)'
      span.style.background = 'transparent'
    })
  }
}

function disableTextSelection() {
  textSelectionUtils.clearSelection()
  
  // 禁用文本选择样式
  const textLayers = document.querySelectorAll('.text-layer span')
  textLayers.forEach(span => {
    span.style.color = 'transparent'
  })
}

function handlePageChange(page) {
  currentPage.value = page
  // 滚动到对应页面
  const pageElement = document.querySelector(`[data-page="${page}"]`)
  if (pageElement) {
    pageElement.scrollIntoView({ behavior: 'smooth' })
  }
}

function handleScreenshotAIAsk(event) {
  const { screenshot, selection } = event.detail
  
  // 发送截图到AI对话
  if (chatInterface.value) {
    chatInterface.value.addMessage({
      type: 'user',
      content: '请分析这张截图',
      image: screenshot,
      timestamp: new Date()
    })
  }
}

function handleTextAIAsk(event) {
  const { text, action, prompt } = event.detail
  
  // 发送文本到AI对话
  if (chatInterface.value) {
    chatInterface.value.addMessage({
      type: 'user',
      content: prompt,
      timestamp: new Date()
    })
  }
}

function handleSendMessage(message) {
  // 处理用户发送的消息
  console.log('用户发送消息:', message)
  
  // 这里可以调用AI API
  // 模拟AI回复
  setTimeout(() => {
    if (chatInterface.value) {
      chatInterface.value.addMessage({
        type: 'ai',
        content: '这是AI的回复消息。我已经收到了您的问题，正在为您分析...',
        timestamp: new Date()
      })
    }
  }, 1000)
}
</script>

<style scoped>
.document-viewer {
  display: flex;
  height: 100vh;
  background: #f5f5f5;
}

.document-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-right: 1px solid #e4e7ed;
}

.document-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e4e7ed;
  background: white;
}

.document-controls {
  display: flex;
  gap: 12px;
}

.document-info {
  display: flex;
  gap: 16px;
  color: #606266;
  font-size: 14px;
}

.document-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
}

.empty-state p {
  margin-top: 16px;
  font-size: 16px;
}

.pdf-content {
  max-width: 800px;
  margin: 0 auto;
}

.pdf-page {
  margin-bottom: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.page-number {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 500;
  color: #606266;
}

.page-content {
  padding: 20px;
  position: relative;
}

.text-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  z-index: 2;
}

.text-layer span {
  position: absolute;
  user-select: text;
  cursor: text;
}

.document-footer {
  padding: 16px;
  border-top: 1px solid #e4e7ed;
  background: white;
  display: flex;
  justify-content: center;
}

.chat-panel {
  width: 400px;
  background: white;
}

/* 截图相关样式 */
.screenshot-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  cursor: crosshair;
  z-index: 1000;
}

.selection-box {
  position: absolute;
  border: 2px dashed #409eff;
  background: rgba(64, 158, 255, 0.1);
  z-index: 1001;
}

/* 文本选择操作按钮样式 */
.text-selection-actions,
.screenshot-actions {
  position: absolute;
  z-index: 1002;
  display: flex;
  gap: 8px;
  background: white;
  padding: 8px;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e4e7ed;
}

.text-action-btn,
.screenshot-btn {
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  background: white;
  color: #606266;
  transition: all 0.2s;
}

.text-action-btn:hover {
  background: #409eff;
  color: white;
  border-color: #409eff;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .document-viewer {
    flex-direction: column;
  }
  
  .chat-panel {
    width: 100%;
    height: 300px;
  }
  
  .document-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .document-controls {
    justify-content: center;
  }
}
</style>