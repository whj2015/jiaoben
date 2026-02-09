# EdgeGenius - AI 驱动的脚本管理器

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5.2.2-3178C6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-3.4.1-06B6D4?logo=tailwindcss" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Vite-5.1.6-646CFF?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome" alt="Manifest V3">
</p>

<p align="center">
  <b>EdgeGenius</b> 是一个现代化的、集成了 AI 辅助编程功能的 Tampermonkey 风格用户脚本管理器。
  它允许用户管理、编辑和运行自定义 JavaScript 脚本，并利用 Google Gemini 和 DeepSeek 等先进 AI 模型自动生成或优化脚本代码。
</p>

---

## ✨ 主要特性

### 🤖 AI 辅助编程

| 功能 | 描述 |
|------|------|
| **自然语言生成** | 只需描述需求，AI 即可自动编写完整的用户脚本 |
| **智能修改** | 支持在现有代码基础上进行增量修改，保留原有功能 |
| **上下文感知** | AI 能感知当前浏览的网页 URL，生成针对特定站点的代码 |
| **多模型支持** | 内置支持 Google Gemini (`gemini-2.5-flash`) 和 DeepSeek (OpenAI 兼容模式) |

### 📜 强大的脚本管理

- **全功能编辑器**：内置代码编辑器，支持语法高亮
- **标准 API 支持**：支持 `GM_setValue`, `GM_getValue`, `GM_log`, `GM_xmlhttpRequest` (支持跨域请求) 等常用 API
- **沙盒执行**：脚本在隔离环境中运行 (IIFE)，互不干扰，同时支持 `MAIN` 世界执行
- **版本控制**：自动保存脚本历史版本，随时回滚

### 🌍 多语言支持

- 🇨🇳 简体中文
- 🇺🇸 English
- 🇯🇵 日本語
- 🇪🇸 Español

### 💾 数据安全

- **本地存储**：脚本和配置存储在本地 (Chrome Storage / LocalStorage)
- **导入/导出**：支持备份所有数据为 JSON 文件，或导出单个 `.user.js` 文件

---

## 🛠️ 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式方案**: TailwindCSS 3
- **UI 图标**: Lucide React
- **AI SDK**: Google GenAI SDK
- **测试框架**: Vitest + React Testing Library

---

## 📦 安装指南

### 前置要求

- Node.js 18+
- npm 9+ 或 pnpm/yarn

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

   - 打开 Chrome/Edge 浏览器，访问 `chrome://extensions/`
   - 开启右上角的 **"开发者模式" (Developer mode)**
   - 点击 **"加载已解压的扩展程序" (Load unpacked)**
   - 选择项目目录下的 `dist` 文件夹

---

## ⚙️ 配置说明

在使用 AI 功能之前，需要配置 API Key：

1. 点击浏览器工具栏中的 EdgeGenius 图标打开扩展
2. 进入 **设置 (Settings)** 页面
3. 选择 AI 提供商 (**Google Gemini** 或 **DeepSeek**)
4. 输入对应的 API Key 并保存

> **🔒 安全提示**：API Key 仅存储在您的本地浏览器中，不会上传到任何第三方服务器。

### 获取 API Key

- **Google Gemini**: 访问 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取 API Key
- **DeepSeek**: 访问 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取 API Key

---

## 📖 使用指南

### 创建新脚本

1. 在首页点击 **"+"** 按钮
2. 您可以选择手动编写代码，或者点击 **"AI 助手"** 图标
3. 在 AI 对话框中输入需求，例如：*"为百度首页添加一个夜间模式按钮"*
4. AI 生成代码后，点击应用即可

### 管理脚本

| 操作 | 说明 |
|------|------|
| **启用/禁用** | 在列表中通过开关快速切换脚本状态 |
| **编辑** | 点击脚本卡片进入编辑模式 |
| **历史记录** | 在编辑器中查看和恢复历史版本 |
| **删除** | 在脚本列表中删除不需要的脚本 |

### 数据备份与恢复

- **导出备份**: 在设置页面点击"导出备份"，将所有脚本导出为 JSON 文件
- **导入恢复**: 在设置页面点击"导入"，选择之前导出的 JSON 文件

---

## 💻 开发命令

```bash
# 启动开发服务器 (带热更新)
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 运行单元测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 启动测试 UI 界面
npm run test:ui
```

---

## 🏗️ 项目结构

```
jiaoben/
├── components/          # React 组件
│   ├── Header.tsx      # 顶部导航栏
│   ├── ScriptList.tsx  # 脚本列表
│   ├── ScriptEditor.tsx # 脚本编辑器
│   ├── AIAssistant.tsx # AI 助手对话框
│   ├── TabManager.tsx  # 标签页管理器
│   └── ErrorBoundary.tsx # 错误边界
├── services/           # 业务逻辑服务
│   ├── scriptService.ts  # 脚本管理服务
│   ├── geminiService.ts  # AI 服务
│   └── extensionService.ts # 扩展服务
├── utils/              # 工具函数
│   ├── i18n.tsx        # 国际化
│   ├── helpers.ts      # 辅助函数
│   ├── logger.ts       # 日志工具
│   ├── errorHandler.ts # 错误处理
│   ├── encryption.ts   # 加密工具
│   └── simpleDiff.ts   # 文本对比
├── tests/              # 测试文件
├── types.ts            # TypeScript 类型定义
├── App.tsx             # 主应用组件
├── background.ts       # 后台脚本 (Service Worker)
├── content.ts          # 内容脚本
├── manifest.json       # 扩展清单
├── vite.config.ts      # Vite 配置
├── tailwind.config.js  # TailwindCSS 配置
└── package.json        # 项目依赖
```

---

## 🔧 支持的 API

EdgeGenius 支持以下 Tampermonkey/Greasemonkey 标准 API：

| API | 说明 |
|-----|------|
| `GM_setValue(name, value)` | 存储数据到本地 |
| `GM_getValue(name, defaultValue)` | 读取本地存储的数据 |
| `GM_log(message)` | 输出日志到控制台 |
| `GM_xmlhttpRequest(details)` | 发起跨域 HTTP 请求 |

---

## 🧪 测试

项目使用 Vitest 进行单元测试，测试文件位于 `tests/` 目录：

```bash
# 运行所有测试
npm run test

# 运行测试并查看覆盖率
npm run test:coverage

# 启动测试 UI
npm run test:ui
```

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进 EdgeGenius！

### 提交 PR 的流程

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

---

## 📄 许可证

[MIT](LICENSE) © EdgeGenius Contributors

---

## 🙏 致谢

- [Tampermonkey](https://www.tampermonkey.net/) - 用户脚本管理器的先驱
- [Google Gemini](https://deepmind.google/technologies/gemini/) - AI 能力支持
- [DeepSeek](https://www.deepseek.com/) - 备选 AI 模型
- [React](https://react.dev/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具
- [TailwindCSS](https://tailwindcss.com/) - 样式方案
