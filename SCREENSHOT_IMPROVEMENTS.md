# PDF 截图功能改进说明

## 概述

本次更新将 PDF 截图功能从 pdfjs-dist@2 版本升级到 pdfjs-dist@5.4.296，并参考旧版本的实现，改进了截图功能的核心逻辑。

## 主要改进

### 1. 升级到 pdfjs-dist v5

- 使用最新的 pdfjs-dist@5.4.296 版本
- 使用 ES6 模块导入方式 (`import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`)
- 完全兼容 Vite 构建工具

### 2. 改进截图方法 - 直接从 Canvas 提取图像

**旧方案的问题：**
- 使用 `html2canvas` 截图，可能会有黑底问题
- 性能较差，需要渲染整个 DOM 树

**新方案的优势：**
- 直接从 PDF canvas 提取图像，避免黑底问题
- 性能更好，直接操作 canvas 元素
- 支持跨页截图
- 自动回退到 html2canvas 方法（当找不到 canvas 时）

### 3. 文件结构改进

#### `src/utils/screenshotUtils.js`

新增功能：
- `setPDFUtils(pdfUtils)` - 设置 PDF 工具类引用
- `captureFromPDFCanvas()` - 从 PDF canvas 直接提取图像
- `drawPageToOutput()` - 辅助方法，绘制页面到输出 canvas
- `captureWithHtml2Canvas()` - 备用方法，使用 html2canvas

核心逻辑：
```javascript
// 创建输出 canvas
const outputCanvas = document.createElement('canvas')
const outputCtx = outputCanvas.getContext('2d')

// 设置白色背景
outputCtx.fillStyle = '#ffffff'
outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height)

// 遍历所有 PDF 页面
// 计算重叠区域
// 直接从源 canvas 绘制到输出 canvas
```

#### `src/components/DocumentViewer.vue`

改进点：
- 将 PDF canvas 添加到 DOM 中，方便截图工具访问
- 保存原始 canvas 和显示 canvas 的引用
- 正确初始化 screenshotUtils 与 pdfUtils 的关联

### 4. 技术细节

#### 坐标转换

正确处理以下坐标转换：
1. 全局坐标 → 容器相对坐标
2. 容器相对坐标 → PDF 页面相对坐标
3. PDF 页面坐标 → Canvas 坐标（考虑缩放比例）

#### 跨页截图

支持截图跨越多个 PDF 页面：
- 遍历所有页面，检测与选择区域的重叠
- 只处理重叠的部分
- 按顺序合成到输出 canvas

#### 性能优化

- 使用 requestAnimationFrame 优化鼠标移动事件
- 只处理可见和重叠的页面
- 直接从 canvas 提取，避免 DOM 操作

## 使用方法

### 基本使用

```javascript
import { ScreenshotUtils } from '../utils/screenshotUtils.js'
import { PDFUtils } from '../utils/pdfUtils.js'

// 初始化
const pdfUtils = new PDFUtils()
const screenshotUtils = new ScreenshotUtils()

// 关联 PDF 工具类
screenshotUtils.setPDFUtils(pdfUtils)

// 开始截图
screenshotUtils.startCapture(containerElement)
```

### 事件监听

```javascript
// 监听截图 AI 询问事件
container.addEventListener('screenshot-ai-ask', (event) => {
  const { screenshot, file, selection } = event.detail
  // 处理截图
})
```

## 兼容性

- ✅ Vue 3
- ✅ Element Plus
- ✅ pdfjs-dist v5
- ✅ Vite
- ✅ 现代浏览器（Chrome, Firefox, Safari, Edge）

## 注意事项

1. **Canvas 元素必须存在**：PDF 页面需要将 canvas 添加到 DOM 中
2. **滚动位置**：截图时需要考虑容器的滚动位置
3. **缩放比例**：正确处理页面缩放和 canvas 原始尺寸的比例关系
4. **跨域问题**：使用 html2canvas 时需要处理跨域图片

## 参考

参考了 pdfjs-dist@2 版本的实现方式：
- 直接从 canvas 提取图像
- 考虑 PDF 缩放比例
- 支持跨页截图
- 正确的坐标转换

## 未来改进方向

1. 添加撤销/重做功能
2. 支持多种截图格式（PNG, JPEG, PDF）
3. 添加画笔和标记工具
4. 支持截图编辑
5. 优化大文件性能

