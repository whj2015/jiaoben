# EdgeGenius - AI 驱动的脚本管理器

EdgeGenius 是一个现代化的、集成了 AI 辅助编程功能的 Tampermonkey 风格用户脚本管理器。它允许用户管理、编辑和运行自定义 JavaScript 脚本，并利用 Google Gemini 和 DeepSeek 等先进 AI 模型自动生成或优化脚本代码。

## ✨ 主要特性

- **🤖 AI 辅助编程**：
  - **自然语言生成**：只需描述需求，AI 即可自动编写完整的用户脚本。
  - **智能修改**：支持在现有代码基础上进行增量修改，保留原有功能。
  - **上下文感知**：AI 能感知当前浏览的网页 URL，生成针对特定站点的代码。
  - **多模型支持**：内置支持 Google Gemini (`gemini-2.5-flash`) 和 DeepSeek (OpenAI 兼容模式)。

- **📜 强大的脚本管理**：
  - **全功能编辑器**：内置代码编辑器，支持语法高亮。
  - **标准 API 支持**：支持 `GM_setValue`, `GM_getValue`, `GM_log`, `GM_xmlhttpRequest` (支持跨域请求) 等常用 API。
  - **沙盒执行**：脚本在隔离环境中运行 (IIFE)，互不干扰，同时支持 `MAIN` 世界执行。
  - **版本控制**：自动保存脚本历史版本，随时回滚。

- **🌍 多语言支持**：
  - 支持简体中文、英语、日语、西班牙语。

- **💾 数据安全**：
  - **本地存储**：脚本和配置存储在本地 (Chrome Storage / LocalStorage)。
  - **导入/导出**：支持备份所有数据为 JSON 文件，或导出单个 `.user.js` 文件。

## 🛠️ 安装指南

### 开发环境安装

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd jiaoben
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建项目**
   ```bash
   npm run build
   ```

4. **加载扩展**
   - 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`。
   - 开启右上角的 **"开发者模式" (Developer mode)**。
   - 点击 **"加载已解压的扩展程序" (Load unpacked)**。
   - 选择项目目录下的 `dist` 文件夹。

## ⚙️ 配置说明

在使用 AI 功能之前，需要配置 API Key：

1. 点击浏览器工具栏中的 EdgeGenius 图标打开扩展。
2. 进入 **设置 (Settings)** 页面。
3. 选择 AI 提供商 (**Google Gemini** 或 **DeepSeek**)。
4. 输入对应的 API Key 并保存。

> **注意**：API Key 仅存储在您的本地浏览器中，不会上传到任何第三方服务器。

## 📖 使用指南

### 创建新脚本
1. 在首页点击 **"+"** 按钮。
2. 您可以选择手动编写代码，或者点击 **"AI 助手"** 图标。
3. 在 AI 对话框中输入需求，例如："*为百度首页添加一个夜间模式按钮*"。
4. AI 生成代码后，点击应用即可。

### 管理脚本
- **启用/禁用**：在列表中通过开关快速切换脚本状态。
- **编辑**：点击脚本卡片进入编辑模式。
- **历史记录**：在编辑器中查看和恢复历史版本。

## 💻 开发命令

- `npm run dev`: 启动开发服务器 (Vite)。
- `npm run build`: 构建生产版本。
- `npm run preview`: 预览构建结果。

## 🤝 贡献
欢迎提交 Issue 和 Pull Request 来改进 EdgeGenius！
