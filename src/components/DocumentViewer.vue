<template>
  <div class="document-viewer">
    <div class="document-panel" ref="documentPanel">
      <div class="document-header">
        <div class="document-controls-left">
          <el-button @click="selectFile" type="primary" :icon="Upload">
            选择PDF文件
          </el-button>
          <el-button @click="loadDemoFile" :icon="Document">
            加载示例文档
          </el-button>
          <el-button @click="toggleThumbnails" class="menu_btn">
            {{ thumbnailsVisible ? '隐藏' : '显示' }}缩略图
          </el-button>
          <el-button @click="startScreenshot" :icon="Camera" :disabled="!pdfLoaded">
            截图
          </el-button>
        </div>
        
        <div class="document-controls-right" v-if="pdfLoaded">
          <div class="switch_page">
            <div class="pdf-pre" @click="prevPage">
              <el-icon><ArrowLeft /></el-icon>
            </div>
            <el-input-number
              class="inputNumber"
              controls-position="right"
              v-model="currentPage"
              @change="handlePageChange(currentPage)"
              :precision="0"
              :step="1"
              :min="1"
              :max="totalPages"
            />
            /
            <span class="pdfPageTotal">{{ totalPages }}</span>
            <div class="pdf-next" @click="nextPage">
              <el-icon><ArrowRight /></el-icon>
            </div>
          </div>
          <div class="scale_controls">
            <el-button @click="scaleDown" :icon="Minus" circle />
            <div class="num">{{ Math.round(pdfScale * 100) }}%</div>
            <el-button @click="scaleUp" :icon="Plus" circle />
          </div>
        </div>
      </div>

      <div class="pdf-box">
        <!-- 左侧缩略图 -->
        <div 
          v-show="thumbnailsVisible && pdfLoaded"
          class="thumbnail-container"
          ref="thumbnailContainerRef"
        >
          <div
            class="thumbnail-list"
            v-for="(page, index) in pages"
            :key="index"
            @click="scrollToPage(page.pageNum)"
          >
            <div
              class="thumbnail-placeholder"
              :style="{
                border: currentPage == page.pageNum ? '2px solid #409eff' : '1px solid #DCDCDC',
                width: '80px',
                height: '113px',
              }"
            >
              <p class="thumbnail-number">{{ page.pageNum }}</p>
            </div>
          </div>
        </div>
        
        <!-- PDF内容区域 -->
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
              :style="{
                transform: `scale(${pdfScale})`,
                transformOrigin: '0 0',
                marginBottom: `${20 * pdfScale}px`
              }"
            >
              <div class="page-content" :data-page="page.pageNum" ref="pageContent">
                <!-- PDF页面内容将在这里渲染 -->
              </div>
            </div>
          </div>
        </div>
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
import { ref, onMounted, nextTick, watch } from 'vue'
import { Upload, Camera, Edit, Document, ArrowLeft, ArrowRight, Minus, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

import * as pdfjsLib from "pdfjs-dist";

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
const thumbnailsVisible = ref(false)
const pdfScale = ref(1.0)

// 工具类实例
let pdfUtils = null
let screenshotUtils = null
let textSelectionUtils = null

onMounted(() => {
  initializeUtils()
  loadDemoFile()
  
  // 注释掉：现在使用批量加载所有页面，不再需要按需加载
  // setupScrollObserver()
})

function setupScrollObserver() {
  // 使用 Intersection Observer 监听页面是否进入视口
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0) {
        const pageElement = entry.target
        const pageNum = parseInt(pageElement.getAttribute('data-page'))
        if (pageNum && pages.value[pageNum - 1] && !pages.value[pageNum - 1].loaded) {
          loadAndRenderPage(pageNum)
        }
      }
    })
  }, {
    root: documentContent.value,
    rootMargin: '200px', // 提前200px开始加载
    threshold: 0.1
  })

  // 监听所有页面元素
  watch(() => pages.value.length, () => {
    nextTick(() => {
      const pageElements = document.querySelectorAll('.page-content')
      pageElements.forEach(pageElement => {
        observer.observe(pageElement)
      })
    })
  }, { immediate: true })

  // 保存observer以便清理
  // observer在组件卸载时需要disconnect，但当前没有onUnmounted
}

function initializeUtils() {
  pdfUtils = new PDFUtils()
  screenshotUtils = new ScreenshotUtils()
  screenshotUtils.setPDFUtils(pdfUtils) // 设置PDF工具类以便从canvas直接提取图像
  textSelectionUtils = new TextSelectionUtils()
}

function setupEventListeners() {
  // 监听截图AI询问事件 - 在 pdfContent 上监听
  if (pdfContent.value) {
    pdfContent.value.addEventListener('screenshot-ai-ask', handleScreenshotAIAsk)
  }
  
  // 监听文本AI询问事件 - 在 documentPanel 上监听
  if (documentPanel.value) {
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
      // 先设置pdfLoaded为true，这样模板才会渲染.pdf-content元素
      pdfLoaded.value = true
      totalPages.value = pdfUtils.getNumPages()
      
      // 等待DOM更新，确保页面元素已经渲染
      await nextTick()
      await nextTick()
      
      // 然后再渲染PDF内容
      await renderPDF()
      
      // 设置事件监听器（在 PDF 加载完成后）
      setupEventListeners()
      
      // 默认启用文本选择
      enableTextSelection()
      
      ElMessage.success('PDF文件加载成功')
    }
  } catch (error) {
    ElMessage.error('PDF文件加载失败')
  }
}

async function loadDemoFile() {
  try {
    const success = await pdfUtils.loadPDFFromUrl('https://image.keymemox.com/2025/10/23/%E4%B9%89%E5%8A%A1%E6%95%99%E8%82%B2%E6%95%99%E7%A7%91%E4%B9%A6%E8%AF%AD%E6%96%87%E4%BA%8C%E5%B9%B4%E7%BA%A7%E4%B8%8A%E5%86%8C6983c48a-1ece-44f9-a199-83f2e5220874.pdf')
    if (success) {
      // 先设置pdfLoaded为true，这样模板才会渲染.pdf-content元素
      pdfLoaded.value = true
      totalPages.value = pdfUtils.getNumPages()
      
      // 等待DOM更新，确保页面元素已经渲染
      await nextTick()
      await nextTick()
      
      // 然后再渲染PDF内容
      await renderPDF()
      
      // 设置事件监听器（在 PDF 加载完成后）
      setupEventListeners()
      
      // 默认启用文本选择
      enableTextSelection()
      
      ElMessage.success('示例文档加载成功')
    }
  } catch (error) {
    ElMessage.error('示例文档加载失败')
  }
}

async function renderPDF() {
  // 初始化pages数组
  const numPages = pdfUtils.getNumPages()
  pages.value = Array.from({ length: numPages }, (_, i) => ({
    pageNum: i + 1,
    loaded: false
  }))

  // 等待DOM更新完成
  await nextTick()
  
  // 按顺序加载所有页面的文本层
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    await loadAndRenderPage(pageNum)
    // 每页加载后延迟10ms，避免UI阻塞
    if (pageNum % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
}

async function loadAndRenderPage(pageNum) {
  // 检查是否已加载
  const index = pageNum - 1
  if (pages.value[index] && pages.value[index].loaded) {
    return
  }

  await nextTick()
  let pageData = null
  try {
    // 加载指定页
    pageData = await pdfUtils.loadPage(pageNum)
    
  } catch (error) {
    return
  }
  
  if (!pageData) {
    return
  }
  
  // 更新pages数组中对应页的状态
  pages.value[index] = {
    ...pages.value[index],
    ...pageData,
    loaded: true
  }
  
  await nextTick()
  
  // 确保选择正确的页面元素
  const allPageElements = document.querySelectorAll('.page-content')
  let pageElement = null
  for (let el of allPageElements) {
    if (el.getAttribute('data-page') === String(pageNum)) {
      pageElement = el
      break
    }
  }
  // 如果找不到元素，尝试所有可能的元素
  if (!pageElement) {
    console.warn(`找不到页面 ${pageNum} 的DOM元素`)
  }
  
  if (pageElement && pageData.canvas) {
    // 获取容器宽度（在清空内容之前）
    const containerWidth = pageElement.clientWidth || pageElement.offsetWidth
    if (!containerWidth || containerWidth === 0) {
      return
    }
    
    // 清除旧内容
    pageElement.innerHTML = ''
    
    // 清除所有旧文本层
    const oldTextLayers = document.querySelectorAll('.text-layer')
    oldTextLayers.forEach(layer => {
      layer.remove()
    })
    
    // 等待DOM更新
    await nextTick()
    
    // 计算实际的背景图片高度（contain模式）
    const aspectRatio = pageData.viewport.height / pageData.viewport.width
    const actualHeight = containerWidth * aspectRatio
    
    // 设置容器样式
    pageElement.style.cssText = `
      position: relative;
      width: 100%;
      height: ${actualHeight}px;
    `
    
    // 将 canvas 添加到 DOM 中（用于截图）
    const canvasWrapper = document.createElement('div')
    canvasWrapper.className = 'canvas-wrapper'
    canvasWrapper.setAttribute('data-page-canvas', pageData.pageNum)
    canvasWrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: flex-start;
      align-items: flex-start;
    `
    
    // 创建一个可见的 canvas 用于显示
    const displayCanvas = document.createElement('canvas')
    displayCanvas.width = containerWidth
    displayCanvas.height = actualHeight
    const displayCtx = displayCanvas.getContext('2d')
    
    // 将原 canvas 的内容绘制到显示 canvas
    displayCtx.drawImage(pageData.canvas, 0, 0, displayCanvas.width, displayCanvas.height)
    
    canvasWrapper.appendChild(displayCanvas)
    pageElement.appendChild(canvasWrapper)
    
    // 同时保存原始 canvas 到页面数据中，用于截图
    pages.value[index].displayCanvas = displayCanvas
    pages.value[index].originalCanvas = pageData.canvas
    
    // 创建文本层容器用于文本选择
    const textLayer = document.createElement('div')
    textLayer.className = 'text-layer'
    textLayer.setAttribute('data-page-layer', pageData.pageNum) // 添加标识
    textLayer.setAttribute(
      "style",
      `
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: auto;
        z-index: 2;
      `
    )
    
    // 将文本层添加到页面元素
    pageElement.appendChild(textLayer)
    // 渲染文本层
    renderTextLayer(textLayer, pageData.pageNum, pageData.viewport)
  }
  
  // 预加载相邻页面
  pdfUtils.preloadAdjacentPages(pageNum, 1)
}

async function loadCurrentPage() {
  await loadAndRenderPage(currentPage.value)
}

async function renderTextLayer(textLayer, page, viewport) {
  const textContent = await page.getTextContent();
  const canvas = textLayer.previousElementSibling; // 对应同页canvas
  const ctx = canvas.getContext("2d");

  // 清空旧内容
  textLayer.innerHTML = "";

  textContent.items.forEach((item) => {
    const span = document.createElement("span");
    span.textContent = item.str;

    // 将 PDF 坐标转换为 HTML 坐标
    const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const [a, b, c, d, e, f] = transform;

    // 定位
    span.style.position = "absolute";
    span.style.whiteSpace = "pre";
    span.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
    span.style.transformOrigin = "0 0";
    span.style.color = "transparent"; // 可改为黑色调试

    textLayer.appendChild(span);
  });
}

function startScreenshot() {
  if (!pdfLoaded.value) {
    ElMessage.warning('请先加载PDF文件')
    return
  }
  
  if (!pdfContent.value) {
    ElMessage.error('PDF内容区域未找到')
    return
  }
  
  // 清除文本选择操作栏
  if (textSelectionUtils) {
    textSelectionUtils.clearSelection()
  }
  
  // 传入pdfContent作为截图容器，这样能覆盖整个PDF显示区域
  try {
    screenshotUtils.startCapture(pdfContent.value)
  } catch (error) {
    ElMessage.error('截图启动失败: ' + error.message)
  }
}

function enableTextSelection() {
  if (!pdfContent.value) return
  
  textSelectionUtils.initTextSelection(documentPanel.value)
}

// function disableTextSelection() {
//   textSelectionUtils.clearSelection()

//   // 禁用文本选择样式
//   const textLayers = document.querySelectorAll('.text-layer span')
//   textLayers.forEach(span => {
//     span.style.color = 'rgba(0, 0, 0, 0.9)'
//     span.style.background = 'rgba(255, 255, 255, 0.8)'
//   })
// }

function toggleThumbnails() {
  thumbnailsVisible.value = !thumbnailsVisible.value
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    scrollToPage(currentPage.value)
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    scrollToPage(currentPage.value)
  }
}

function scrollToPage(pageNum) {
  if (pageNum !== currentPage.value) {
    currentPage.value = pageNum
  }
  const pageElement = document.querySelector(`.pdf-page[data-page="${pageNum}"]`)
  if (pageElement) {
    pageElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function scaleUp() {
  if (pdfScale.value < 2.0) {
    pdfScale.value = Math.min(pdfScale.value + 0.25, 2.0)
  }
}

function scaleDown() {
  if (pdfScale.value > 0.25) {
    pdfScale.value = Math.max(pdfScale.value - 0.25, 0.25)
  }
}

async function handlePageChange(page) {
  // 只需要滚动到页面，不需要重复加载
  scrollToPage(page)
}

function handleScreenshotAIAsk(event) {
  const { screenshot, file, selection } = event.detail
  
  // 发送截图到AI对话
  if (chatInterface.value) {
    chatInterface.value.addMessage({
      type: 'user',
      content: '请分析这张截图',
      image: screenshot,
      file: file, // 传递File对象
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
  padding: 16px;
  border-bottom: 1px solid #e4e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.document-controls-left {
  display: flex;
  gap: 12px;
  align-items: center;
}

.document-controls-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.switch_page {
  display: flex;
  align-items: center;
  gap: 10px;

  .pdf-pre,
  .pdf-next {
    width: 37px;
    height: 37px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
  }
  
  :deep(.inputNumber) {
    width: 46px;
    height: 37px;
    background: #ffffff;
    border-radius: 6px;
    border: 1px solid #d9d9d9;
    
    .el-input-number__decrease {
      display: none;
    }
    
    .el-input-number__increase {
      display: none;
    }
    
    .el-input {
      .el-input__wrapper {
        border: none !important;
        box-shadow: none;
        .el-input__inner {
          text-align: center;
        }
      }
    }
  }

  .pdfPageTotal {
    font-weight: 500;
    font-size: 14px;
    color: #3d3d3d;
    margin: 0 10px;
  }
}

.scale_controls {
  height: 24px;
  display: flex;
  align-items: center;
  gap: 8px;

  .num {
    font-weight: 500;
    font-size: 14px;
    color: #717171;
    margin: 0 4px;
    line-height: 20px;
  }
}

.pdf-box {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.thumbnail-container {
  flex-shrink: 0;
  width: 133px;
  height: 100%;
  overflow-y: auto;
  padding: 0 15px;
  background: #ffffff;
  box-shadow: 1px 0px 0px 1px rgba(216, 216, 216, 0.16);
  box-sizing: border-box;

  .thumbnail-list {
    width: 100%;
    text-align: center;
    margin-top: 10px;
    cursor: pointer;
    background-color: #ffffff;
  }

  .thumbnail-placeholder {
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
  }

  .thumbnail-number {
    line-height: 20px;
    text-align: center;
    font-weight: 500;
    font-size: 14px;
    margin-top: 5px;
  }
}

.document-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
  background: #f7f7f7;
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
  max-width: 100%;
  margin: 0 auto;
  position: relative;
  min-height: 100%;
}

.pdf-page {
  margin-bottom: 20px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.page-content {
  padding: 0;
  position: relative;
}

.text-layer {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: auto;
  z-index: 2;
}

.text-layer span {
  position: absolute;
  user-select: text;
  cursor: text;
  white-space: pre;
  overflow: visible !important;
  /* 临时显示文本，方便调试 */
  color: rgba(0, 0, 0, 0.1);
  background: rgba(255, 0, 0, 0.05);
}

.chat-panel {
  width: 400px;
  background: white;
}

/* 截图相关样式 */
.screenshot-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 999;
  user-select: none;
  cursor: crosshair;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.3);
}

.selection-box {
  position: absolute;
  border: 2px dashed #409eff;
  background: transparent;
  z-index: 1000;
  pointer-events: none;
}

/* 动画 */
@keyframes selectionBoxAppear {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
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
