import html2canvas from 'html2canvas'

export class ScreenshotUtils {
  constructor() {
    this.isCapturing = false
    this.startPoint = null
    this.endPoint = null
    this.selectionBox = null
    this.overlay = null
  }

  startCapture(container) {
    this.isCapturing = true
    this.createOverlay(container)
    this.bindEvents(container)
  }

  createOverlay(container) {
    // 创建遮罩层
    this.overlay = document.createElement('div')
    this.overlay.className = 'screenshot-overlay'
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      cursor: crosshair;
      z-index: 1000;
    `

    // 创建选择框
    this.selectionBox = document.createElement('div')
    this.selectionBox.className = 'selection-box'
    this.selectionBox.style.cssText = `
      position: absolute;
      border: 2px dashed #409eff;
      background: rgba(64, 158, 255, 0.1);
      display: none;
      z-index: 1001;
    `

    container.style.position = 'relative'
    container.appendChild(this.overlay)
    container.appendChild(this.selectionBox)
  }

  bindEvents(container) {
    let isDrawing = false

    const handleMouseDown = (e) => {
      if (!this.isCapturing) return
      
      isDrawing = true
      const rect = container.getBoundingClientRect()
      this.startPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
      
      this.selectionBox.style.display = 'block'
      this.selectionBox.style.left = this.startPoint.x + 'px'
      this.selectionBox.style.top = this.startPoint.y + 'px'
      this.selectionBox.style.width = '0px'
      this.selectionBox.style.height = '0px'
    }

    const handleMouseMove = (e) => {
      if (!this.isCapturing || !isDrawing) return

      const rect = container.getBoundingClientRect()
      this.endPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }

      const width = Math.abs(this.endPoint.x - this.startPoint.x)
      const height = Math.abs(this.endPoint.y - this.startPoint.y)
      const left = Math.min(this.startPoint.x, this.endPoint.x)
      const top = Math.min(this.startPoint.y, this.endPoint.y)

      this.selectionBox.style.left = left + 'px'
      this.selectionBox.style.top = top + 'px'
      this.selectionBox.style.width = width + 'px'
      this.selectionBox.style.height = height + 'px'
    }

    const handleMouseUp = (e) => {
      if (!this.isCapturing || !isDrawing) return
      
      isDrawing = false
      const rect = container.getBoundingClientRect()
      this.endPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }

      // 如果选择区域太小，取消选择
      const width = Math.abs(this.endPoint.x - this.startPoint.x)
      const height = Math.abs(this.endPoint.y - this.startPoint.y)
      
      if (width < 10 || height < 10) {
        this.cancelCapture()
        return
      }

      this.showActionButtons(container)
    }

    this.overlay.addEventListener('mousedown', handleMouseDown)
    this.overlay.addEventListener('mousemove', handleMouseMove)
    this.overlay.addEventListener('mouseup', handleMouseUp)

    // 保存事件处理器以便后续移除
    this.eventHandlers = {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp
    }
  }

  showActionButtons(container) {
    // 创建操作按钮容器
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'screenshot-actions'
    
    const selectionRect = this.selectionBox.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    
    buttonContainer.style.cssText = `
      position: absolute;
      left: ${this.selectionBox.offsetLeft}px;
      top: ${this.selectionBox.offsetTop + this.selectionBox.offsetHeight + 10}px;
      z-index: 1002;
      display: flex;
      gap: 8px;
      background: white;
      padding: 8px;
      border-radius: 6px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    `

    // 创建按钮
    const buttons = [
      { text: '取消', class: 'cancel', action: 'cancel' },
      { text: 'AI问问', class: 'ai-ask', action: 'ai-ask' },
      { text: '保存', class: 'save', action: 'save' }
    ]

    buttons.forEach(btn => {
      const button = document.createElement('button')
      button.textContent = btn.text
      button.className = `screenshot-btn ${btn.class}`
      button.style.cssText = `
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      `
      
      if (btn.action === 'cancel') {
        button.style.background = '#f56c6c'
        button.style.color = 'white'
      } else if (btn.action === 'ai-ask') {
        button.style.background = '#409eff'
        button.style.color = 'white'
      } else {
        button.style.background = '#67c23a'
        button.style.color = 'white'
      }

      button.addEventListener('click', () => {
        this.handleButtonClick(btn.action, container)
      })

      buttonContainer.appendChild(button)
    })

    container.appendChild(buttonContainer)
    this.actionButtons = buttonContainer
  }

  async handleButtonClick(action, container) {
    switch (action) {
      case 'cancel':
        this.cancelCapture()
        break
      case 'ai-ask':
        await this.captureAndAskAI(container)
        break
      case 'save':
        await this.captureAndSave(container)
        break
    }
  }

  async captureAndAskAI(container) {
    try {
      const screenshot = await this.captureSelection(container)
      // 触发AI问问事件
      const event = new CustomEvent('screenshot-ai-ask', {
        detail: { screenshot, selection: this.getSelectionData() }
      })
      container.dispatchEvent(event)
      this.cancelCapture()
    } catch (error) {
      console.error('截图失败:', error)
    }
  }

  async captureAndSave(container) {
    try {
      const screenshot = await this.captureSelection(container)
      // 下载截图
      const link = document.createElement('a')
      link.download = `screenshot-${Date.now()}.png`
      link.href = screenshot
      link.click()
      this.cancelCapture()
    } catch (error) {
      console.error('截图保存失败:', error)
    }
  }

  async captureSelection(container) {
    const left = Math.min(this.startPoint.x, this.endPoint.x)
    const top = Math.min(this.startPoint.y, this.endPoint.y)
    const width = Math.abs(this.endPoint.x - this.startPoint.x)
    const height = Math.abs(this.endPoint.y - this.startPoint.y)

    // 临时隐藏遮罩和按钮
    this.overlay.style.display = 'none'
    if (this.actionButtons) {
      this.actionButtons.style.display = 'none'
    }

    const canvas = await html2canvas(container, {
      x: left,
      y: top,
      width: width,
      height: height,
      useCORS: true,
      allowTaint: true
    })

    return canvas.toDataURL('image/png')
  }

  getSelectionData() {
    if (!this.startPoint || !this.endPoint) return null

    return {
      x: Math.min(this.startPoint.x, this.endPoint.x),
      y: Math.min(this.startPoint.y, this.endPoint.y),
      width: Math.abs(this.endPoint.x - this.startPoint.x),
      height: Math.abs(this.endPoint.y - this.startPoint.y)
    }
  }

  cancelCapture() {
    this.isCapturing = false
    
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
    
    if (this.selectionBox) {
      this.selectionBox.remove()
      this.selectionBox = null
    }
    
    if (this.actionButtons) {
      this.actionButtons.remove()
      this.actionButtons = null
    }

    this.startPoint = null
    this.endPoint = null
  }
}