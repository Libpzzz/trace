import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// 设置worker路径 - 使用npm包中的worker文件
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

// 设置日志级别：0=errors, 1=warnings, 2=infos
// 设置为1只显示错误，隐藏警告（如knockout groups等）
pdfjsLib.GlobalWorkerOptions.verbosity = 0

export class PDFUtils {
  constructor() {
    this.pdfDoc = null
    this.pages = [] // 存储页面的canvas和viewport
    this.textContent = [] // 存储文本内容
    this.pageCache = new Map() // 缓存已渲染的页面
  }

  async loadPDF(file) {
    try {
      const arrayBuffer = await this.fileToArrayBuffer(file)
      this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      // 不再预加载所有页面，只初始化页面数组
      this.initializePages()
      return true
    } catch (error) {
      return false
    }
  }

  async loadPDFFromUrl(url) {
    try {
      this.pdfDoc = await pdfjsLib.getDocument(url).promise
      // 不再预加载所有页面，只初始化页面数组
      this.initializePages()
      return true
    } catch (error) {
      return false
    }
  }
  
  // 初始化页面数组（不渲染）
  initializePages() {
    this.pages = []
    this.textContent = []
    const numPages = this.pdfDoc.numPages
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      this.pages.push({
        pageNum,
        canvas: null,
        viewport: null,
        page: null,
        loading: false,
        loaded: false
      })
      this.textContent.push({
        pageNum,
        items: null,
        viewport: null,
        loaded: false
      })
    }
  }

  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  // 按需加载单个页面
  async loadPage(pageNum) {
    const pageIndex = pageNum - 1
    const pageData = this.pages[pageIndex]
    
    
    // 如果已加载，直接返回
    if (pageData && pageData.loaded) {
      return pageData
    }
    
    // 如果正在加载，等待加载完成
    if (pageData && pageData.loading) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (pageData.loaded) {
            clearInterval(checkInterval)
            resolve(pageData)
          }
        }, 50)
      })
    }
    
    // 标记为加载中
    pageData.loading = true
    
    try {
      const page = await this.pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 1.5 })
      
      
      // 渲染页面到canvas
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise

      // 提取文本内容
      const textContent = await page.getTextContent()
      const textItems = textContent.items.map(item => ({
        str: item.str,
        transform: item.transform,
        width: item.width,
        height: item.height,
        fontName: item.fontName,
        dir: item.dir
      }))

      // 更新页面数据
      pageData.canvas = canvas
      pageData.viewport = viewport
      pageData.page = page
      pageData.loaded = true
      pageData.loading = false
      
      // 更新文本内容
      const textData = this.textContent[pageIndex]
      textData.items = textItems
      textData.rawTextContent = textContent
      textData.viewport = viewport
      textData.loaded = true
      
      return pageData
    } catch (error) {
      pageData.loading = false
      throw error
    }
  }
  
  // 预加载相邻页面（优化体验）
  async preloadAdjacentPages(currentPageNum, preloadCount = 1) {
    const promises = []
    
    // 预加载前面的页面
    for (let i = Math.max(1, currentPageNum - preloadCount); i < currentPageNum; i++) {
      promises.push(this.loadPage(i))
    }
    
    // 预加载后面的页面
    for (let i = currentPageNum + 1; i <= Math.min(this.pdfDoc.numPages, currentPageNum + preloadCount); i++) {
      promises.push(this.loadPage(i))
    }
    
    // 不等待预加载完成，让它们后台执行
    Promise.all(promises).catch(err => console.error('预加载页面失败:', err))
  }

  getPageCanvas(pageNum) {
    const pageData = this.pages.find(p => p.pageNum === pageNum)
    return pageData ? pageData.canvas : null
  }

  getPageTextContent(pageNum) {
    const textData = this.textContent.find(p => p.pageNum === pageNum)
    return textData ? textData.items : []
  }

  getPageTextContentRaw(pageNum) {
    const textData = this.textContent.find(p => p.pageNum === pageNum)
    return textData ? textData.rawTextContent : null
  }

  getPageObject(pageNum) {
    const pageData = this.pages.find(p => p.pageNum === pageNum)
    return pageData ? pageData.page : null
  }

  getAllPages() {
    return this.pages
  }

  getNumPages() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0
  }

  // 根据坐标获取文本
  getTextAtPosition(pageNum, x, y, width, height) {
    const textData = this.textContent.find(p => p.pageNum === pageNum)
    if (!textData) return []

    const selectedText = []
    textData.items.forEach(item => {
      const [, , , , itemX, itemY] = item.transform
      const itemWidth = item.width
      const itemHeight = item.height

      // 检查文本项是否在选择区域内
      if (itemX >= x && itemX <= x + width && 
          itemY >= y && itemY <= y + height) {
        selectedText.push(item.str)
      }
    })

    return selectedText
  }
}
