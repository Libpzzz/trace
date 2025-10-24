import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'
import 'pdfjs-dist/legacy/build/pdf.worker.entry'

// 设置worker路径
pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PDF_WORKER_URL || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js'

export class PDFUtils {
  constructor() {
    this.pdfDoc = null
    this.pages = []
    this.textContent = []
  }

  async loadPDF(file) {
    try {
      const arrayBuffer = await this.fileToArrayBuffer(file)
      this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      await this.extractAllPages()
      return true
    } catch (error) {
      console.error('PDF加载失败:', error)
      return false
    }
  }

  async loadPDFFromUrl(url) {
    try {
      this.pdfDoc = await pdfjsLib.getDocument(url).promise
      await this.extractAllPages()
      return true
    } catch (error) {
      console.error('PDF加载失败:', error)
      return false
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

  async extractAllPages() {
    this.pages = []
    this.textContent = []
    
    for (let pageNum = 1; pageNum <= this.pdfDoc.numPages; pageNum++) {
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

      this.pages.push({
        pageNum,
        canvas,
        viewport,
        page
      })

      this.textContent.push({
        pageNum,
        items: textItems,
        viewport
      })
    }
  }

  getPageCanvas(pageNum) {
    const pageData = this.pages.find(p => p.pageNum === pageNum)
    return pageData ? pageData.canvas : null
  }

  getPageTextContent(pageNum) {
    const textData = this.textContent.find(p => p.pageNum === pageNum)
    return textData ? textData.items : []
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