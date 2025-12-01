# EdgeGenius - 脚本管理器

## 简介
EdgeGenius 是一个基于 React 和 TypeScript 构建的现代化用户脚本管理器（类似 Tampermonkey），专为 Chrome/Edge 浏览器设计。它不仅支持标准的用户脚本管理功能，还深度集成了 AI 辅助编程功能（支持 Google Gemini 和 DeepSeek），帮助用户更轻松地编写、优化和调试脚本。

## 主要功能
- **脚本管理**: 
  - 轻松创建、编辑、删除用户脚本。
  - 支持一键启用/禁用脚本。
  - 实时查看脚本运行状态。
- **AI 辅助编程**: 
  - 内置 AI 助手，支持代码生成、解释和优化。
  - 支持切换 Google Gemini 和 DeepSeek 模型。
- **GM API 支持**: 
  - 实现了常用的 Tampermonkey API，包括：
    - `GM_xmlhttpRequest`: 支持跨域网络请求。
    - `GM_setValue` / `GM_getValue`: 本地数据存储。
    - `GM_log`: 日志输出。
    - `GM_info`: 获取脚本元数据。
- **多语言支持**: 
  - 内置简体中文、英语、日语、西班牙语支持。
- **现代化 UI**: 
  - 使用 Tailwind CSS 构建的精美、响应式界面。
  - 提供暗色模式适配（跟随系统或自定义）。
- **数据安全**: 
  - 支持脚本数据的本地备份与恢复（JSON 格式）。
  - 脚本运行在独立作用域，互不干扰。

## 技术栈
- **核心框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite 5](https://vitejs.dev/)
- **编程语言**: [TypeScript](https://www.typescriptlang.org/)
- **样式库**: [Tailwind CSS](https://tailwindcss.com/)
- **图标库**: [Lucide React](https://lucide.dev/)
- **AI SDK**: Google Generative AI SDK
- **扩展标准**: Chrome Extension Manifest V3

## 目录结构
```
├── src/
│   ├── components/      # React UI 组件 (Header, ScriptList, ScriptEditor 等)
│   ├── services/        # 业务逻辑服务 (脚本存储, AI 服务等)
│   ├── utils/           # 工具函数 (i18n 等)
│   ├── App.tsx          # 主应用入口
│   ├── background.ts    # Service Worker (处理跨域请求, 脚本注入)
│   ├── content.ts       # Content Script (消息转发)
│   ├── types.ts         # TypeScript 类型定义
│   └── index.css        # 全局样式 (Tailwind 指令)
├── public/              # 静态资源
├── dist/                # 构建产出目录
├── manifest.json        # 扩展清单文件
├── package.json         # 项目依赖配置
├── vite.config.ts       # Vite 配置
└── tailwind.config.js   # Tailwind 配置
```

## 安装与开发

### 前置要求
- Node.js (推荐 v16 或更高版本)
- npm 或 yarn 包管理器

### 开发步骤

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd edge-genius-extension
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发模式**
   此命令会监听文件变化并重新构建。
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

5. **在浏览器中加载**
   1. 打开 Chrome 或 Edge 浏览器。
   2. 访问扩展程序管理页面 (`chrome://extensions/` 或 `edge://extensions/`)。
   3. 开启右上角的 **"开发者模式"**。
   4. 点击 **"加载已解压的扩展程序"** (Load unpacked)。
   5. 选择项目根目录下的 `dist` 文件夹。

## 使用指南

### 1. 配置 AI 助手
- 点击扩展图标打开主界面。
- 点击右上角的设置图标（齿轮）。
- 选择 AI 提供商 (Google Gemini 或 DeepSeek)。
- 输入对应的 API Key 并保存。

### 2. 创建新脚本
- 在主界面点击底部的 "+" 按钮。
- 输入脚本名称和描述。
- 在编辑器中编写代码。你可以点击 "AI 助手" 按钮让 AI 帮你写代码。
- 示例元数据：
  ```javascript
  // ==UserScript==
  // @name         我的脚本
  // @namespace    http://tampermonkey.net/
  // @version      0.1
  // @description  尝试在百度首页运行
  // @author       You
  // @match        https://www.baidu.com/*
  // @grant        GM_xmlhttpRequest
  // ==/UserScript==
  ```

### 3. 调试脚本
- 打开匹配的网页（例如 `https://www.baidu.com`）。
- 扩展图标上会显示当前页面运行的脚本数量。
- 打开浏览器的开发者工具 (F12) -> Console，查看 `[GM:脚本名]` 开头的日志。

## 贡献
欢迎提交 Issue 反馈 bug 或建议新功能。如果您想贡献代码，请提交 Pull Request。

## 许可证
MIT License
