# GitHub OAuth 登录与脚本仓库同步功能检查清单

## 类型定义
- [x] types.ts 中包含 GitHubUser 接口定义（id, login, name, avatar_url, email）
- [x] types.ts 中包含 GitHubToken 接口定义（access_token, token_type, scope）
- [x] types.ts 中包含 GitHubRepo 接口定义（id, name, full_name, private, description）
- [x] types.ts 中包含 ScriptMetadata 接口定义（name, description, version, author）
- [x] GitHubAuthState 枚举正确定义（UNAUTHENTICATED, AUTHENTICATING, AUTHENTICATED, ERROR）

## OAuth 服务
- [x] githubOAuth.ts 实现 generateAuthUrl 函数生成正确的授权 URL
- [x] githubOAuth.ts 实现 exchangeCodeForToken 函数交换授权码
- [x] githubOAuth.ts 实现 getGitHubUser 函数获取用户信息
- [x] githubOAuth.ts 实现令牌安全存储（加密）
- [x] OAuth 回调正确处理授权码

## 仓库管理服务
- [x] githubRepo.ts 实现 checkRepoExists 函数检查仓库存在性
- [x] githubRepo.ts 实现 createScriptRepo 函数创建私有仓库
- [x] githubRepo.ts 实现 getRepoContents 函数获取仓库内容
- [x] githubRepo.ts 实现 uploadFile 函数上传单个文件
- [x] githubRepo.ts 实现 uploadAllScripts 函数批量上传脚本
- [x] 仓库创建时设置正确的描述和权限

## 脚本导入服务
- [x] scriptImport.ts 实现 parseScriptMetadata 函数解析脚本元数据
- [x] scriptImport.ts 实现 validateScriptFormat 函数验证脚本格式
- [x] scriptImport.ts 实现 importScriptToLocal 函数导入脚本
- [x] 支持解析 .js、.ts、.mjs 文件格式
- [x] 格式错误脚本被正确跳过并记录

## 登录界面组件
- [x] GitHubLogin.tsx 显示"使用 GitHub 登录"按钮
- [x] GitHubLogin.tsx 显示登录进度状态
- [x] GitHubLogin.tsx 显示错误提示信息
- [x] 登录按钮样式符合整体设计风格

## 同步状态组件
- [x] GitHubSync.tsx 显示仓库检测状态
- [x] GitHubSync.tsx 显示脚本同步进度条
- [x] GitHubSync.tsx 显示当前处理的文件名
- [x] GitHubSync.tsx 显示同步结果摘要

## 用户状态组件
- [x] GitHubUserStatus.tsx 显示用户头像和名称
- [x] GitHubUserStatus.tsx 显示登出按钮
- [x] GitHubUserStatus.tsx 实现登出确认对话框

## 主应用集成
- [x] App.tsx 正确管理 GitHub 认证状态
- [x] Header 组件显示 GitHub 登录/用户状态入口
- [x] 应用启动时检查并恢复登录状态
- [x] 设置页面包含 GitHub 同步选项

## API 速率限制处理
- [x] githubRateLimit.ts 实现请求配额检查
- [x] 接近限制时自动延迟请求
- [x] 速率限制错误显示重置时间
- [x] 提供等待后重试选项

## 国际化
- [x] 中文翻译文件包含所有 GitHub 登录相关文本
- [x] i18n.tsx 正确引用翻译键值

## 错误处理
- [x] 网络错误显示友好提示并提供重试选项
- [x] 认证失败显示具体原因
- [x] 仓库操作失败显示解决方案建议
- [x] 条件请求正确使用 ETag/Last-Modified
- [x] 所有请求包含正确的 User-Agent 头

## 安全性
- [x] OAuth access_token 加密存储
- [x] 登出时正确清理敏感数据
- [x] OAuth state 参数防止 CSRF 攻击
- [x] API 请求包含必要的认证头
