# Tasks

- [x] Task 1: 扩展类型定义
  - [x] SubTask 1.1: 在 types.ts 中添加 GitHubUser、GitHubToken、GitHubRepo 类型接口
  - [x] SubTask 1.2: 添加 GitHubAuthState 枚举定义认证状态
  - [x] SubTask 1.3: 添加 ScriptMetadata 接口定义脚本元数据

- [x] Task 2: 创建 GitHub OAuth 服务
  - [x] SubTask 2.1: 创建 services/githubOAuth.ts 实现 OAuth 核心逻辑
  - [x] SubTask 2.2: 实现生成授权 URL 函数 generateAuthUrl
  - [x] SubTask 2.3: 实现授权码交换函数 exchangeCodeForToken
  - [x] SubTask 2.4: 实现获取用户信息函数 getGitHubUser
  - [x] SubTask 2.5: 实现令牌安全存储与验证函数

- [x] Task 3: 创建 GitHub 仓库管理服务
  - [x] SubTask 3.1: 创建 services/githubRepo.ts 实现仓库操作逻辑
  - [x] SubTask 3.2: 实现检查仓库存在函数 checkRepoExists
  - [x] SubTask 3.3: 实现创建仓库函数 createScriptRepo
  - [x] SubTask 3.4: 实现获取仓库内容函数 getRepoContents
  - [x] SubTask 3.5: 实现上传文件函数 uploadFile
  - [x] SubTask 3.6: 实现批量上传脚本函数 uploadAllScripts

- [x] Task 4: 创建脚本导入服务
  - [x] SubTask 4.1: 创建 services/scriptImport.ts 实现脚本导入逻辑
  - [x] SubTask 4.2: 实现解析脚本元数据函数 parseScriptMetadata
  - [x] SubTask 4.3: 实现验证脚本格式函数 validateScriptFormat
  - [x] SubTask 4.4: 实现导入脚本到本地函数 importScriptToLocal

- [x] Task 5: 创建 OAuth 回调处理
  - [x] SubTask 5.1: 在 background 脚本中添加 OAuth 回调监听
  - [x] SubTask 5.2: 处理授权码并完成令牌交换
  - [x] SubTask 5.3: 通知前端认证结果

- [x] Task 6: 创建 GitHub 登录界面组件
  - [x] SubTask 6.1: 创建 components/GitHubLogin.tsx 登录组件
  - [x] SubTask 6.2: 实现"使用 GitHub 登录"按钮
  - [x] SubTask 6.3: 实现登录进度状态显示
  - [x] SubTask 6.4: 实现错误提示显示

- [x] Task 7: 创建同步状态组件
  - [x] SubTask 7.1: 创建 components/GitHubSync.tsx 同步状态组件
  - [x] SubTask 7.2: 实现仓库检测状态显示
  - [x] SubTask 7.3: 实现脚本同步进度条
  - [x] SubTask 7.4: 实现同步结果摘要显示

- [x] Task 8: 创建用户状态组件
  - [x] SubTask 8.1: 创建 components/GitHubUserStatus.tsx 用户状态组件
  - [x] SubTask 8.2: 实现用户头像与名称显示
  - [x] SubTask 8.3: 实现登出按钮与确认对话框

- [x] Task 9: 实现 API 速率限制处理
  - [x] SubTask 9.1: 创建 utils/githubRateLimit.ts 速率限制工具
  - [x] SubTask 9.2: 实现请求配额检查函数
  - [x] SubTask 9.3: 实现自动延迟请求逻辑
  - [x] SubTask 9.4: 实现速率限制错误提示

- [x] Task 10: 集成到主应用
  - [x] SubTask 10.1: 修改 App.tsx 添加 GitHub 认证状态管理
  - [x] SubTask 10.2: 在 Header 组件添加 GitHub 登录入口
  - [x] SubTask 10.3: 实现登录状态持久化检查
  - [x] SubTask 10.4: 在设置页面添加 GitHub 同步选项

- [x] Task 11: 添加国际化支持
  - [x] SubTask 11.1: 在 _locales/zh_CN/messages.json 添加 GitHub 登录相关翻译
  - [x] SubTask 11.2: 在 utils/i18n.tsx 添加翻译键值

- [x] Task 12: 错误处理与边界情况
  - [x] SubTask 12.1: 创建统一的 GitHub 错误处理工具函数
  - [x] SubTask 12.2: 实现网络错误重试机制
  - [x] SubTask 12.3: 实现条件请求（ETag/Last-Modified）
  - [x] SubTask 12.4: 添加 User-Agent 请求头

# Task Dependencies
- [Task 2] 依赖于 [Task 1]
- [Task 3] 依赖于 [Task 1, Task 2]
- [Task 4] 依赖于 [Task 1]
- [Task 5] 依赖于 [Task 2]
- [Task 6] 依赖于 [Task 1]
- [Task 7] 依赖于 [Task 1, Task 3, Task 4]
- [Task 8] 依赖于 [Task 1, Task 2]
- [Task 9] 依赖于 [Task 1]
- [Task 10] 依赖于 [Task 2, Task 3, Task 4, Task 6, Task 7, Task 8]
- [Task 11] 依赖于 [Task 6, Task 7, Task 8]
- [Task 12] 依赖于 [Task 2, Task 3]
- [Task 2, Task 4] 可并行执行（在 Task 1 完成后）
- [Task 6, Task 8] 可并行执行（在 Task 1 完成后）
- [Task 3, Task 9] 可并行执行（在 Task 1, Task 2 完成后）
