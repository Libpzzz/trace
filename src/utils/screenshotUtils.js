import html2canvas from 'html2canvas'

export class ScreenshotUtils {
  constructor() {
    this.isCapturing = false
    this.startPoint = null
    this.endPoint = null
    this.selectionBox = null
    this.overlay = null
    this.isDrawing = false
    this.eventHandlers = null
    this.pdfUtils = null // 用于访问PDF数据
    this.container = null // 保存容器引用
  }

  setPDFUtils(pdfUtils) {
    this.pdfUtils = pdfUtils
  }

  startCapture(container) {
    console.log('ScreenshotUtils.startCapture - container:', container)
    
    if (!container) {
      console.error('ScreenshotUtils: 容器元素不能为空')
      throw new Error('容器元素不能为空')
    }
    
    // 保存容器引用
    this.container = container
    
    // 如果已经在截图模式，先取消
    if (this.isCapturing) {
      console.log('已在截图模式，先取消')
      this.cancelCapture()
    }
    
    this.isCapturing = true
    console.log('创建 overlay...')
    this.createOverlay(container)
    console.log('overlay 创建完成:', this.overlay)
    console.log('绑定事件...')
    this.bindEvents(container)
    console.log('事件绑定完成')
  }

  createOverlay(container) {
    // 计算容器高度用于 box-shadow（创建"洞"效果）
    const containerHeight = container.scrollHeight || container.clientHeight || 9999
    console.log('创建截图遮罩，容器高度:', containerHeight)
    
    // 创建鼠标样式层（透明背景，只用于显示crosshair鼠标）
    this.overlay = document.createElement('div')
    this.overlay.className = 'screenshot-mask'
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1001;
      user-select: none;
      cursor: crosshair;
      pointer-events: auto;
    `

    // 创建选择框，初始显示整个遮罩（box-shadow实现）
    // 初始尺寸为0x0，box-shadow会扩展到整个容器创建遮罩效果
    this.selectionBox = document.createElement('div')
    this.selectionBox.className = 'selection-box'
    this.selectionBox.setAttribute('data-page-height', containerHeight.toString())
    // 初始状态：尺寸为0，box-shadow显示整个遮罩
    this.selectionBox.style.cssText = `
      position: absolute;
      border: 0;
      background: transparent;
      display: block;
      z-index: 1000;
      pointer-events: none;
      box-shadow: 0 0 0 ${containerHeight}px rgba(0, 0, 0, 0.5);
      left: 0;
      top: 0;
      width: 0;
      height: 0;
    `

    // 将 overlay 和 selectionBox 添加到容器内
    container.appendChild(this.overlay)
    container.appendChild(this.selectionBox)
    
    console.log('蒙版创建完成，容器尺寸:', container.clientWidth, 'x', container.clientHeight)
  }

  bindEvents(container) {
    const handleMouseDown = (e) => {
      console.log('handleMouseDown - isCapturing:', this.isCapturing, 'target:', e.target)
      console.log('handleMouseDown - actionButtons:', this.actionButtons)
      
      // 如果点击在操作按钮区域，不处理
      if (this.actionButtons && this.actionButtons.contains(e.target)) {
        console.log('点击在操作按钮上，忽略')
        return
      }
      
      // 如果已经完成一次选择，点击蒙层重新开始选择
      if (this.actionButtons) {
        console.log('点击蒙层，清除当前选择并重新绘制')
        // 清除操作按钮
        if (this.actionButtons) {
          this.actionButtons.remove()
          this.actionButtons = null
        }
        // 重置选择框
        if (this.selectionBox) {
          this.selectionBox.style.border = '0'
          this.selectionBox.style.left = '0px'
          this.selectionBox.style.top = '0px'
          this.selectionBox.style.width = '0px'
          this.selectionBox.style.height = '0px'
        }
        this.startPoint = null
        this.endPoint = null
      }
      
      if (!this.isCapturing) {
        console.log('未在截图模式，返回')
        return
      }
      
      console.log('开始拖拽选择')
      console.log('鼠标位置 (client):', e.clientX, e.clientY)
      
      this.isDrawing = true
      
      // 获取 container 的位置（需要考虑滚动）
      const containerRect = container.getBoundingClientRect()
      console.log('containerRect:', containerRect)
      console.log('container.scrollTop:', container.scrollTop)
      
      const relativeX = e.clientX - containerRect.left
      const relativeY = e.clientY - containerRect.top + container.scrollTop
      
      console.log('计算的坐标 (relative):', relativeX, relativeY)
      
      this.startPoint = {
        x: relativeX,
        y: relativeY
      }
      
      console.log('startPoint:', this.startPoint)
      
      // 显示选择框，添加边框
      this.selectionBox.style.display = 'block'
      this.selectionBox.style.border = '2px dashed #409eff'
      this.selectionBox.style.left = relativeX + 'px'
      // selectionBox 需要显示在可见区域，所以要减去scrollTop
      this.selectionBox.style.top = (relativeY - container.scrollTop) + 'px'
      this.selectionBox.style.width = '0px'
      this.selectionBox.style.height = '0px'
      
      e.preventDefault()
      e.stopPropagation()
    }

    const handleMouseMove = (e) => {
      if (!this.isCapturing || !this.isDrawing) return

      // 使用相对于 container 的坐标（需要考虑滚动）
      const containerRect = container.getBoundingClientRect()
      this.endPoint = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top + container.scrollTop
      }

      const width = Math.abs(this.endPoint.x - this.startPoint.x)
      const height = Math.abs(this.endPoint.y - this.startPoint.y)
      const left = Math.min(this.startPoint.x, this.endPoint.x)
      const top = Math.min(this.startPoint.y, this.endPoint.y)

      this.selectionBox.style.left = left + 'px'
      // selectionBox 需要显示在可见区域，所以要减去scrollTop
      this.selectionBox.style.top = (top - container.scrollTop) + 'px'
      this.selectionBox.style.width = width + 'px'
      this.selectionBox.style.height = height + 'px'
    }

    const handleMouseUp = (e) => {
      console.log('handleMouseUp - isCapturing:', this.isCapturing, 'isDrawing:', this.isDrawing)
      if (!this.isCapturing || !this.isDrawing) return
      
      this.isDrawing = false
      
      // 使用相对于 container 的坐标（需要考虑滚动）
      const containerRect = container.getBoundingClientRect()
      this.endPoint = {
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top + container.scrollTop
      }
      
      console.log('endPoint:', this.endPoint)
      console.log('startPoint:', this.startPoint)

      // 如果选择区域太小，取消选择
      const width = Math.abs(this.endPoint.x - this.startPoint.x)
      const height = Math.abs(this.endPoint.y - this.startPoint.y)
      
      console.log('选择区域大小:', width, 'x', height)
      
      // 只有当用户真正拖拽了（移动超过10px）且区域太小时才取消
      if (width < 10 && height < 10) {
        // 简单点击，不做任何操作，保持截图模式，恢复初始状态
        console.log('选择区域太小，恢复初始状态')
        this.selectionBox.style.border = '0'
        this.selectionBox.style.left = '0px'
        this.selectionBox.style.top = '0px'
        this.selectionBox.style.width = '0px'
        this.selectionBox.style.height = '0px'
        this.startPoint = null
        this.endPoint = null
        e.preventDefault()
        e.stopPropagation()
        return
      }

      console.log('显示操作按钮')
      this.showActionButtons(container)
      
      e.preventDefault()
      e.stopPropagation()
    }

    // ESC 键取消截图
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && this.isCapturing) {
        this.cancelCapture()
      }
    }

    // 给overlay添加鼠标事件监听
    if (this.overlay) {
      this.overlay.addEventListener('mousedown', handleMouseDown)
      this.overlay.addEventListener('mousemove', handleMouseMove)
      this.overlay.addEventListener('mouseup', handleMouseUp)
    }
    
    // 给 document 添加键盘事件
    document.addEventListener('keydown', handleKeyDown)

    // 保存事件处理器以便后续移除
    this.eventHandlers = {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleKeyDown,
      overlay: this.overlay,
      container: container
    }
  }

  showActionButtons(container) {
    // 创建操作按钮容器
    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'screenshot-actions'
    
    // 计算按钮位置（相对于选择框）
    const left = Math.min(this.startPoint.x, this.endPoint.x)
    const top = Math.min(this.startPoint.y, this.endPoint.y)
    const height = Math.abs(this.endPoint.y - this.startPoint.y)
    
    buttonContainer.style.cssText = `
      position: absolute;
      left: ${left}px;
      top: ${top + height + 10}px;
      z-index: 1002;
      display: flex;
      gap: 8px;
      background: white;
      padding: 8px;
      border-radius: 6px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    `
    
    // 将按钮添加到容器内
    container.appendChild(buttonContainer)

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
      
      // 将base64转换为File对象
      const file = await this.dataURLtoFile(screenshot, `screenshot-${Date.now()}.png`)
      
      // 触发AI问问事件
      const event = new CustomEvent('screenshot-ai-ask', {
        detail: { 
          screenshot, 
          file,
          selection: this.getSelectionData() 
        }
      })
      container.dispatchEvent(event)
      this.cancelCapture()
    } catch (error) {
      console.error('截图失败:', error)
    }
  }
  
  // 将base64转换为File对象
  dataURLtoFile(dataurl, filename) {
    return new Promise((resolve) => {
      const arr = dataurl.split(',')
      const mime = arr[0].match(/:(.*?);/)[1]
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      resolve(new File([u8arr], filename, { type: mime }))
    })
  }

  async captureAndSave(container) {
    try {
      console.log('开始保存截图...')
      const screenshot = await this.captureSelection(container)
      console.log('截图生成成功，长度:', screenshot ? screenshot.length : 'null')
      
      if (!screenshot) {
        console.error('截图数据为空')
        alert('截图失败，请重试')
        return
      }
      
      // 下载截图
      const blob = await this.dataURLtoBlob(screenshot)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = `screenshot-${Date.now()}.png`
      link.href = url
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 清理URL对象
      setTimeout(() => URL.revokeObjectURL(url), 100)
      
      console.log('图片下载已触发')
      this.cancelCapture()
    } catch (error) {
      console.error('截图保存失败:', error)
      alert('截图保存失败: ' + error.message)
    }
  }

  // 将base64转换为Blob对象
  dataURLtoBlob(dataurl) {
    return new Promise((resolve) => {
      const arr = dataurl.split(',')
      const mime = arr[0].match(/:(.*?);/)[1]
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      resolve(new Blob([u8arr], { type: mime }))
    })
  }

  async captureSelection(container) {
    if (!this.startPoint || !this.endPoint) {
      console.error('选择区域不完整')
      return null
    }

    const left = Math.min(this.startPoint.x, this.endPoint.x)
    const top = Math.min(this.startPoint.y, this.endPoint.y)
    const width = Math.abs(this.endPoint.x - this.startPoint.x)
    const height = Math.abs(this.endPoint.y - this.startPoint.y)

    console.log('captureSelection - 选择区域:', { left, top, width, height })

    // 临时隐藏遮罩和按钮
    if (this.overlay) {
    this.overlay.style.display = 'none'
    }
    if (this.actionButtons) {
      this.actionButtons.style.display = 'none'
    }
    if (this.selectionBox) {
      this.selectionBox.style.display = 'none'
    }

    // 如果有PDF工具类，使用直接提取canvas的方法（避免黑底问题）
    if (this.pdfUtils) {
      console.log('使用 captureFromPDFCanvas 方法')
      try {
        const result = await this.captureFromPDFCanvas(container, left, top, width, height)
        return result
      } catch (error) {
        console.error('captureFromPDFCanvas 失败:', error)
        // 回退到html2canvas
        console.log('回退到 html2canvas 方法')
        return await this.captureWithHtml2Canvas(container, left, top, width, height)
      }
    }

    // 否则回退到html2canvas方法
    console.log('使用 captureWithHtml2Canvas 方法')
    return await this.captureWithHtml2Canvas(container, left, top, width, height)
  }

  /**
   * 从PDF canvas直接提取图像，避免黑底问题（参考工作示例重写）
   */
  async captureFromPDFCanvas(container, left, top, width, height) {
    try {
      console.log('=================== 开始截图 ===================')
      console.log('输入的截图参数:', { left, top, width, height })
      console.log('startPoint:', this.startPoint)
      console.log('endPoint:', this.endPoint)

      // 创建一个新的canvas来合成截图
      const outputCanvas = document.createElement('canvas')
      const outputCtx = outputCanvas.getContext('2d')
      outputCanvas.width = width
      outputCanvas.height = height

      // 设置白色背景
      outputCtx.fillStyle = '#ffffff'
      outputCtx.fillRect(0, 0, outputCanvas.width, outputCanvas.height)

      // 获取docContent相对视口的位置
      const containerRect = container.getBoundingClientRect()
      console.log('容器位置:', containerRect)
      console.log('container.scrollTop:', container.scrollTop)

      // 遍历所有PDF页面canvas - 使用 .pdf-page 查找页面元素
      const pdfPages = container.querySelectorAll('.pdf-page')
      console.log('找到的 PDF 页面数量:', pdfPages.length)

      // 过滤掉未加载的页面（高度小于100的认为是占位符）
      const loadedPages = Array.from(pdfPages).filter(page => {
        const height = page.getBoundingClientRect().height
        return height > 100
      })
      
      console.log('已加载的页面数量:', loadedPages.length)
      
      if (loadedPages.length === 0) {
        console.error('没有找到已加载的页面')
        throw new Error('没有找到已加载的PDF页面')
      }

      for (let i = 0; i < loadedPages.length; i++) {
        const page = loadedPages[i]
        const pageRect = page.getBoundingClientRect()
        
        console.log(`处理页面 ${i + 1}，pageRect 高度:`, pageRect.height)
        
        // 从PDF工具类获取页码
        const pageNum = parseInt(page.getAttribute('data-page'))
        
        console.log(`页面 ${pageNum || i + 1}:`)
        console.log('  pageRect:', pageRect)
        console.log('  选择区域: top =', top, 'top + height =', top + height)

        // 获取原始canvas（因为页面上的canvas可能被缩放）
        if (!pageNum) {
          console.log(`页面 ${i + 1} - 无页码，跳过`)
          continue
        }

        let pageCanvas = null
        
        // 优先使用 PDF 工具类的原始 canvas
        if (this.pdfUtils) {
          pageCanvas = this.pdfUtils.getPageCanvas(pageNum)
        }
        
        // 如果没有原始 canvas，尝试从页面元素中获取
        if (!pageCanvas) {
          // 尝试从页面查找canvas
          const canvasElements = page.querySelectorAll('canvas')
          if (canvasElements.length > 0) {
            pageCanvas = canvasElements[0] // 使用第一个canvas
          }
        }
        
        if (!pageCanvas) {
          console.log(`页面 ${pageNum} - 未找到canvas`)
          continue
        }

        // 获取页面显示元素的宽高（缩放后的尺寸）
        const pageDisplayWidth = pageRect.width
        const pageDisplayHeight = pageRect.height

        // 获取原始canvas的宽高（未缩放尺寸）
        const canvasWidth = pageCanvas.width
        const canvasHeight = pageCanvas.height

        // 计算缩放比例（显示尺寸 / 原始尺寸）
        const scaleX = pageDisplayWidth / canvasWidth
        const scaleY = pageDisplayHeight / canvasHeight
        console.log(`  缩放比例: x=${scaleX.toFixed(4)}, y=${scaleY.toFixed(4)}`)

        // 计算页面相对于内容区域的位置（考虑滚动）
        const pageRelativeTop = pageRect.top - containerRect.top + container.scrollTop
        const pageRelativeLeft = pageRect.left - containerRect.left

        // 选择区域的边界（容器坐标）
        const selectionLeft = left
        const selectionRight = left + width
        const selectionTop = top
        const selectionBottom = top + height

        // 计算重叠区域的边界（容器坐标）
        const overlapLeft = Math.max(pageRelativeLeft, selectionLeft)
        const overlapRight = Math.min(pageRelativeLeft + pageDisplayWidth, selectionRight)
        const overlapTop = Math.max(pageRelativeTop, selectionTop)
        const overlapBottom = Math.min(pageRelativeTop + pageDisplayHeight, selectionBottom)

        // 如果没有重叠，跳过
        if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) {
          console.log('  不重叠，跳过')
          continue
        }

        // 计算重叠区域在页面显示元素中的坐标（相对页面左上角）
        const pageOverlapLeft = overlapLeft - pageRelativeLeft
        const pageOverlapTop = overlapTop - pageRelativeTop
        const pageOverlapWidth = overlapRight - overlapLeft
        const pageOverlapHeight = overlapBottom - overlapTop

        // 转换为原始canvas坐标（除以缩放比例）
        const canvasOverlapLeft = pageOverlapLeft / scaleX
        const canvasOverlapTop = pageOverlapTop / scaleY
        const canvasOverlapWidth = pageOverlapWidth / scaleX
        const canvasOverlapHeight = pageOverlapHeight / scaleY

        // 计算在输出canvas中的绘制位置（相对于选择区域左上角）
        const outputX = overlapLeft - selectionLeft
        const outputY = overlapTop - selectionTop

        console.log(`  页面重叠区域（显示坐标）: x=${pageOverlapLeft}, y=${pageOverlapTop}, w=${pageOverlapWidth}, h=${pageOverlapHeight}`)
        console.log(`  转换为canvas坐标: x=${canvasOverlapLeft.toFixed(0)}, y=${canvasOverlapTop.toFixed(0)}, w=${canvasOverlapWidth.toFixed(0)}, h=${canvasOverlapHeight.toFixed(0)}`)
        console.log(`  输出位置: x=${outputX}, y=${outputY}`)

        // 确保不超出源canvas边界
        const actualSourceX = Math.max(0, Math.min(canvasOverlapLeft, canvasWidth))
        const actualSourceY = Math.max(0, Math.min(canvasOverlapTop, canvasHeight))
        const actualSourceWidth = Math.min(canvasOverlapWidth, canvasWidth - actualSourceX)
        const actualSourceHeight = Math.min(canvasOverlapHeight, canvasHeight - actualSourceY)

        if (actualSourceHeight <= 0 || actualSourceWidth <= 0) {
          console.log('  无效的源尺寸，跳过')
          continue
        }

        // 如果源尺寸被裁剪了，需要按比例调整输出尺寸
        const outputWidth = (actualSourceWidth / canvasOverlapWidth) * pageOverlapWidth
        const outputHeight = (actualSourceHeight / canvasOverlapHeight) * pageOverlapHeight

        console.log(`  实际绘制 - 源: (${actualSourceX}, ${actualSourceY}) 尺寸: ${actualSourceWidth}x${actualSourceHeight}`)
        console.log(`  实际绘制 - 输出: (${outputX}, ${outputY}) 尺寸: ${outputWidth}x${outputHeight}`)

        // 绘制到输出canvas
        try {
          outputCtx.drawImage(
            pageCanvas,
            actualSourceX,        // 源图像的x坐标
            actualSourceY,        // 源图像的y坐标
            actualSourceWidth,    // 源图像的宽度
            actualSourceHeight,   // 源图像的高度
            outputX,              // 目标canvas的x坐标
            outputY,              // 目标canvas的y坐标
            outputWidth,          // 目标宽度
            outputHeight          // 目标高度
          )
          console.log('绘制成功')
        } catch (e) {
          console.warn('绘制页面失败:', e)
        }
      }

      return outputCanvas.toDataURL('image/png', 0.95)
    } catch (error) {
      console.error('从PDF canvas提取截图失败:', error)
      throw error
    }
  }

  /**
   * 使用html2canvas截图的备用方法
   */
  async captureWithHtml2Canvas(container, left, top, width, height) {
    // 坐标已经是相对于容器的了，直接使用
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
    console.log('cancelCapture 被调用')
    this.isCapturing = false
    this.isDrawing = false
    
    // 移除事件监听器
    if (this.eventHandlers) {
      const { overlay, container } = this.eventHandlers
      
      // 从 overlay 上移除事件监听器
      if (overlay) {
        overlay.removeEventListener('mousedown', this.eventHandlers.handleMouseDown)
        overlay.removeEventListener('mousemove', this.eventHandlers.handleMouseMove)
        overlay.removeEventListener('mouseup', this.eventHandlers.handleMouseUp)
      }
      
      // 从 document 上移除键盘事件
      document.removeEventListener('keydown', this.eventHandlers.handleKeyDown)
      
      this.eventHandlers = null
    }
    
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
    this.container = null
  }
}

