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

          <div v-else class="pdf-content" ref="pdfContent" :style="{ transform: `scale(${pdfScale})`, transformOrigin: 'top center' }">
            <div 
              v-for="page in pages" 
              :key="page.pageNum"
              class="pdf-page"
              :data-page="page.pageNum"
            >
              <div class="page-content" :data-page="page.pageNum" ref="pageContent" style="margin-bottom: 20px;">
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
import { ref, onMounted, nextTick } from 'vue'
import { Upload, Camera, Document, ArrowLeft, ArrowRight, Minus, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 导入 pdfjs-dist
import * as pdfjsLib from 'pdfjs-dist'

// 设置 Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// 导入 pdf_viewer.mjs
import { TextLayerBuilder } from 'pdfjs-dist/web/pdf_viewer.mjs'
import "pdfjs-dist/web/pdf_viewer.css";

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
})

function initializeUtils() {
  pdfUtils = new PDFUtils()
  screenshotUtils = new ScreenshotUtils()
  screenshotUtils.setPDFUtils(pdfUtils)
  textSelectionUtils = new TextSelectionUtils()
}

function setupEventListeners() {
  if (pdfContent.value) {
    pdfContent.value.addEventListener('screenshot-ai-ask', handleScreenshotAIAsk)
  }
  
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
      pdfLoaded.value = true
      totalPages.value = pdfUtils.getNumPages()
      
      await nextTick()
      await nextTick()
      
      await renderPDF()
      setupEventListeners()
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
      pdfLoaded.value = true
      totalPages.value = pdfUtils.getNumPages()
      
      await nextTick()
      await nextTick()
      
      await renderPDF()
      setupEventListeners()
      enableTextSelection()
      
      ElMessage.success('示例文档加载成功')
    }
  } catch (error) {
    ElMessage.error('示例文档加载失败')
  }
}

async function renderPDF() {
  const numPages = pdfUtils.getNumPages()
  pages.value = Array.from({ length: numPages }, (_, i) => ({
    pageNum: i + 1,
    loaded: false
  }))

  await nextTick()
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    await loadAndRenderPage(pageNum)
    if (pageNum % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

async function loadAndRenderPage(pageNum) {
  const index = pageNum - 1
  if (pages.value[index] && pages.value[index].loaded) {
    return
  }

  await nextTick()
  let pageData = null
  try {
    pageData = await pdfUtils.loadPage(pageNum)
  } catch (error) {
    console.error(`加载页面 ${pageNum} 失败:`, error)
    return
  }
  
  if (!pageData) {
    return
  }
  
  pages.value[index] = {
    ...pages.value[index],
    ...pageData,
    loaded: true
  }
  
  await nextTick()
  
  // 找到对应的页面元素
  const allPageElements = document.querySelectorAll('.page-content')
  let pageElement = null
  for (let el of allPageElements) {
    if (el.getAttribute('data-page') === String(pageNum)) {
      pageElement = el
      break
    }
  }
  
  if (!pageElement) {
    console.warn(`找不到页面 ${pageNum} 的DOM元素`)
    return
  }
  
  if (pageElement && pageData.canvas) {
    const containerWidth = pageElement.clientWidth || pageElement.offsetWidth
    if (!containerWidth || containerWidth === 0) {
      return
    }
    
    // 清除旧内容
    pageElement.innerHTML = ''
    
    await nextTick()
    
    // 计算实际显示高度
    const aspectRatio = pageData.viewport.height / pageData.viewport.width
    const actualHeight = containerWidth * aspectRatio
    
    // 设置容器样式
    pageElement.style.cssText = `
      position: relative;
      width: 100%;
      height: ${actualHeight}px;
    `
    
    // 创建 canvas 包装器（背景层，不接收事件）
    const canvasWrapper = document.createElement('div')
    canvasWrapper.className = 'canvas-wrapper'
    canvasWrapper.setAttribute('data-page-canvas', pageData.pageNum)
    canvasWrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      pointer-events: none;
    `
    
    // 创建显示用的 canvas
    const displayCanvas = document.createElement('canvas')
    displayCanvas.width = containerWidth
    displayCanvas.height = actualHeight
    const displayCtx = displayCanvas.getContext('2d')
    
    // 绘制 PDF 内容
    displayCtx.drawImage(pageData.canvas, 0, 0, displayCanvas.width, displayCanvas.height)
    
    canvasWrapper.appendChild(displayCanvas)
    pageElement.appendChild(canvasWrapper)
    
    // 保存 canvas 引用
    pages.value[index].displayCanvas = displayCanvas
    pages.value[index].originalCanvas = pageData.canvas
    
    // 创建文本层（顶层，接收鼠标事件）
    const textLayer = document.createElement('div')
    textLayer.className = 'text-layer'
    textLayer.setAttribute('data-page-layer', pageData.pageNum)
    
    // 先添加到DOM，让后续能正确获取父元素尺寸
    pageElement.appendChild(textLayer)
    
    // 等待DOM更新
    await nextTick()
    
    // 渲染文本层 - 关键修复：传入正确的参数
    await renderTextLayer(textLayer, pageData.page, pageData.viewport, pageData.pageNum)
  }
  
  pdfUtils.preloadAdjacentPages(pageNum, 1)
}

async function renderTextLayer(textLayerDiv, page, viewport, pageNum) {
  try {
    // 获取实际的容器尺寸
    const pageElement = textLayerDiv.parentElement
    const containerWidth = pageElement.clientWidth || pageElement.offsetWidth
    const containerHeight = pageElement.clientHeight || pageElement.offsetHeight
    
    if (!containerWidth || !containerHeight) {
      console.warn(`页面 ${pageNum} - 无法获取容器尺寸`)
      return
    }
    
    console.log(`页面 ${pageNum} - 容器尺寸: ${containerWidth}x${containerHeight}, 视口尺寸: ${viewport.width}x${viewport.height}`)
    
    // 计算缩放比例
    const scale = containerWidth / viewport.width
    
    // 使用缩放后的视口
    const scaledViewport = viewport.clone({ scale })
    
    // 在 pdfjs-dist 5.x 中，TextLayerBuilder 需要传入 pdfPage 对象
    const textLayer = new TextLayerBuilder({
      pdfPage: page,
      enablePermissions: true
    });
    
    // 使用异步 render 方法，传入 viewport
    await textLayer.render({
      viewport: scaledViewport
    });
    
    // 先清空容器并添加文本层
    textLayerDiv.innerHTML = ''
    textLayerDiv.appendChild(textLayer.div)
    
    // 设置文本层的 div 尺寸（直接使用容器尺寸，不要100%）
    textLayer.div.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: ${containerWidth}px;
      height: ${containerHeight}px;
      z-index: 1;
      overflow: hidden;
    `
    
    // 手动设置 CSS 变量（包括 --total-scale-factor）
    // 这个变量用于计算文本的字体大小
    // 根据实际测试，需要添加0.6的偏移量来对齐canvas绘制的文本
    // 原因：pdf-viewer.css 中的 text-layer span 使用 font-size: calc(var(--total-scale-factor) * <原始字体大小>)
    // 但实际渲染时还需要考虑其他因素（如像素密度、浏览器缩放等），所以需要额外调整
    const adjustedScale = scale + 0.6
    textLayer.div.style.setProperty('--total-scale-factor', adjustedScale.toString())
    
    // 设置外层容器的样式
    textLayerDiv.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      pointer-events: auto;
      user-select: text;
      -webkit-user-select: text;
      cursor: text;
    `
    
    // 确保文本层的spans可以正常选中
    setTimeout(() => {
      const spans = textLayerDiv.querySelectorAll('span')
      spans.forEach(span => {
        span.style.cursor = 'text'
        span.style.pointerEvents = 'auto'
        span.style.userSelect = 'text'
      })
      console.log(`页面 ${pageNum} - 文本层渲染完成，spans数量: ${spans.length}`)
    }, 100)
    
  } catch (error) {
    console.error(`页面 ${pageNum} 文本层渲染失败:`, error)
  }
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
  
  if (textSelectionUtils) {
    textSelectionUtils.clearSelection()
  }
  
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
  scrollToPage(page)
}

function handleScreenshotAIAsk(event) {
  const { screenshot, file, selection } = event.detail
  
  if (chatInterface.value) {
    chatInterface.value.addMessage({
      type: 'user',
      content: '请分析这张截图',
      image: screenshot,
      file: file,
      timestamp: new Date()
    })
  }
}

function handleTextAIAsk(event) {
  const { text, action, prompt } = event.detail
  
  if (chatInterface.value) {
    chatInterface.value.addMessage({
      type: 'user',
      content: prompt,
      timestamp: new Date()
    })
  }
}

function handleSendMessage(message) {
  setTimeout(() => {
    if (chatInterface.value) {
      chatInterface.value.addMessage({
        type: 'ai',
        content: '这是AI的回复消息。我已经收到了您的问题,正在为您分析...',
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

/* 关键样式：文本层 */
.text-layer {
  /* 确保文本层覆盖整个页面 */
  width: 100% !important;
  height: 100% !important;
  /* 确保z-index高于画布层 */
  z-index: 10 !important;
  /* 确保没有被其他元素遮挡 */
  pointer-events: auto !important;
}

.text-layer > span {
  /* 确保文本span元素正确定位 */
  transform-origin: 0 0 !important;
  white-space: pre !important;
  /* 透明文本但保留选中能力 */
  color: transparent !important;
  /* 确保可以被鼠标选中 */
  user-select: text !important;
  -webkit-user-select: text !important;
}

/* 选中文本时的高亮效果 */
.text-layer span::selection,
.text-layer > span::selection {
  background: rgba(64, 158, 255, 0.3);
  color: transparent;
}

.text-layer span::-moz-selection,
.text-layer > span::-moz-selection {
  background: rgba(64, 158, 255, 0.3);
  color: transparent;
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