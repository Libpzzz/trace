export class TextSelectionUtils {
  constructor() {
    this.isSelecting = false
    this.selectedText = ''
    this.selectionRange = null
    this.actionButtons = null
  }

  initTextSelection(container) {
    // 监听文本选择事件
    document.addEventListener('selectionchange', () => {
      this.handleSelectionChange(container)
    })

    // 监听鼠标抬起事件
    container.addEventListener('mouseup', (e) => {
      setTimeout(() => {
        this.handleMouseUp(e, container)
      }, 10)
    })
  }

  handleSelectionChange(container) {
    const selection = window.getSelection()
    
    if (selection.rangeCount === 0) {
      this.hideActionButtons()
      return
    }

    const range = selection.getRangeAt(0)
    const selectedText = selection.toString().trim()

    if (selectedText.length === 0) {
      this.hideActionButtons()
      return
    }

    // 检查选择是否在容器内
    const containerElement = container.querySelector('.pdf-content')
    if (!containerElement || !containerElement.contains(range.commonAncestorContainer)) {
      this.hideActionButtons()
      return
    }

    this.selectedText = selectedText
    this.selectionRange = range.cloneRange()
  }

  handleMouseUp(e, container) {
    if (this.selectedText.length === 0) {
      this.hideActionButtons()
      return
    }

    // 获取选择的位置
    const selection = window.getSelection()
    if (selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()

    this.showTextActionButtons(container, {
      x: rect.left - containerRect.left,
      y: rect.bottom - containerRect.top + 10,
      width: rect.width,
      height: rect.height
    })
  }

  showTextActionButtons(container, position) {
    this.hideActionButtons()

    const buttonContainer = document.createElement('div')
    buttonContainer.className = 'text-selection-actions'
    buttonContainer.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      z-index: 1000;
      display: flex;
      gap: 8px;
      background: white;
      padding: 8px;
      border-radius: 6px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
      border: 1px solid #e4e7ed;
    `

    const buttons = [
      { text: '复制', class: 'copy', action: 'copy' },
      { text: 'AI问问', class: 'ai-ask', action: 'ai-ask' },
      { text: '翻译', class: 'translate', action: 'translate' },
      { text: '解释', class: 'explain', action: 'explain' }
    ]

    buttons.forEach(btn => {
      const button = document.createElement('button')
      button.textContent = btn.text
      button.className = `text-action-btn ${btn.class}`
      button.style.cssText = `
        padding: 6px 12px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        background: white;
        color: #606266;
        transition: all 0.2s;
      `

      button.addEventListener('mouseenter', () => {
        button.style.background = '#409eff'
        button.style.color = 'white'
        button.style.borderColor = '#409eff'
      })

      button.addEventListener('mouseleave', () => {
        button.style.background = 'white'
        button.style.color = '#606266'
        button.style.borderColor = '#dcdfe6'
      })

      button.addEventListener('click', (e) => {
        e.stopPropagation()
        this.handleTextAction(btn.action, container)
      })

      buttonContainer.appendChild(button)
    })

    container.style.position = 'relative'
    container.appendChild(buttonContainer)
    this.actionButtons = buttonContainer

    // 点击其他地方隐藏按钮
    setTimeout(() => {
      document.addEventListener('click', this.hideActionButtonsHandler, true)
    }, 100)
  }

  hideActionButtonsHandler = (e) => {
    if (this.actionButtons && !this.actionButtons.contains(e.target)) {
      this.hideActionButtons()
    }
  }

  hideActionButtons() {
    if (this.actionButtons) {
      this.actionButtons.remove()
      this.actionButtons = null
    }
    document.removeEventListener('click', this.hideActionButtonsHandler, true)
  }
  
  // 清除文本选择并隐藏操作栏（供外部调用）
  clearSelection() {
    window.getSelection().removeAllRanges()
    this.selectedText = ''
    this.selectionRange = null
    this.hideActionButtons()
  }

  async handleTextAction(action, container) {
    switch (action) {
      case 'copy':
        await this.copyText()
        break
      case 'ai-ask':
        this.askAI(container)
        break
      case 'translate':
        this.translateText(container)
        break
      case 'explain':
        this.explainText(container)
        break
    }
    this.hideActionButtons()
  }

  async copyText() {
    try {
      await navigator.clipboard.writeText(this.selectedText)
      // 可以添加复制成功的提示
      console.log('文本已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  askAI(container) {
    const event = new CustomEvent('text-ai-ask', {
      detail: { 
        text: this.selectedText,
        action: 'ask',
        prompt: `请回答关于以下文本的问题: "${this.selectedText}"`
      }
    })
    container.dispatchEvent(event)
  }

  translateText(container) {
    const event = new CustomEvent('text-ai-ask', {
      detail: { 
        text: this.selectedText,
        action: 'translate',
        prompt: `请翻译以下文本: "${this.selectedText}"`
      }
    })
    container.dispatchEvent(event)
  }

  explainText(container) {
    const event = new CustomEvent('text-ai-ask', {
      detail: { 
        text: this.selectedText,
        action: 'explain',
        prompt: `请解释以下文本的含义: "${this.selectedText}"`
      }
    })
    container.dispatchEvent(event)
  }

  clearSelection() {
    window.getSelection().removeAllRanges()
    this.selectedText = ''
    this.selectionRange = null
    this.hideActionButtons()
  }
}
