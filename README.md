# 文档查看器 - Vue3 + AI 助手

一个功能强大的PDF文档查看器，集成了AI助手功能，支持文本选择、截图和智能对话。

## 功能特点

### 📄 PDF文档查看
- 支持PDF文件上传和显示
- 高质量PDF渲染
- 分页浏览和导航
- 响应式设计，适配各种屏幕

### ✂️ 智能截图
- 拖拽选择截图区域
- 截图时可滚动文档
- 截图后提供操作按钮：
  - 取消截图
  - AI问问（将截图发送给AI分析）
  - 保存截图

### 📝 文本选择
- 直接选择PDF中的文本
- 选择后显示操作菜单：
  - 复制文本
  - AI问问
  - 翻译
  - 解释

### 🤖 AI助手对话
- 实时对话界面
- 支持文本和图片消息
- 快速操作按钮
- 消息历史记录
- 支持重新生成回复

## 技术栈

- **前端框架**: Vue 3 + Composition API
- **UI组件库**: Element Plus
- **PDF处理**: pdfjs-dist
- **截图功能**: html2canvas
- **构建工具**: Vite
- **样式**: CSS3 + Sass

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 构建生产版本
```bash
npm run build
```

## 使用说明

### 基本操作

1. **上传PDF文件**
   - 点击"选择PDF文件"按钮
   - 选择本地PDF文件
   - 等待文件加载完成

2. **文本选择模式**
   - 点击"文本选择"按钮启用
   - 直接选择文档中的文本
   - 选择后会显示操作菜单

3. **截图模式**
   - 点击"截图"按钮
   - 拖拽选择要截图的区域
   - 选择操作：取消、AI问问或保存

4. **AI对话**
   - 在右侧对话框中输入问题
   - 支持快捷操作按钮
   - 可以发送截图给AI分析

### 快捷键

- `Ctrl + Enter` (Windows) / `Cmd + Enter` (Mac): 快速发送消息

### 支持的文件格式

- PDF文件 (.pdf)
- 图片文件 (.jpg, .png, .gif, .webp) - 用于对话中的图片上传

## 项目结构

```
src/
├── components/           # Vue组件
│   ├── DocumentViewer.vue    # 主文档查看器
│   └── ChatInterface.vue     # AI对话界面
├── utils/               # 工具类
│   ├── pdfUtils.js          # PDF处理工具
│   ├── screenshotUtils.js   # 截图工具
│   └── textSelectionUtils.js # 文本选择工具
├── styles/              # 样式文件
│   └── global.css           # 全局样式
├── App.vue              # 根组件
└── main.js              # 入口文件
```

## 核心功能实现

### PDF文档渲染
使用 `pdfjs-dist` 库来解析和渲染PDF文档：
- 将PDF页面渲染到Canvas
- 提取文本内容用于选择
- 支持多页文档浏览

### 截图功能
基于 `html2canvas` 实现：
- 创建选择遮罩层
- 实时显示选择区域
- 生成高质量截图

### 文本选择
利用浏览器原生选择API：
- 监听文本选择事件
- 获取选择的文本内容
- 显示上下文操作菜单

### AI对话界面
现代化的聊天界面：
- 消息气泡设计
- 支持文本和图片消息
- 实时输入状态显示
- 消息操作功能

## 自定义配置

### 修改AI API
在 `DocumentViewer.vue` 中的 `handleSendMessage` 方法中集成您的AI API：

```javascript
function handleSendMessage(message) {
  // 调用您的AI API
  // 例如：OpenAI、Claude、本地模型等
}
```

### 样式定制
在 `src/styles/global.css` 中修改全局样式，或在组件中使用scoped样式。

### 功能扩展
- 添加更多文档格式支持
- 集成更多AI功能
- 添加用户认证
- 实现云端存储

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 注意事项

1. **PDF.js Worker**: 项目使用CDN加载PDF.js worker，确保网络连接正常
2. **文件大小**: 大型PDF文件可能需要较长加载时间
3. **内存使用**: 多页PDF文档会占用较多内存
4. **CORS**: 如果加载外部PDF文件，需要注意跨域问题

## 许可证

MIT License

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 更新日志

### v1.0.0
- 初始版本发布
- 基础PDF查看功能
- 截图和文本选择
- AI对话界面

---

如有问题或建议，请提交Issue或联系开发者。
