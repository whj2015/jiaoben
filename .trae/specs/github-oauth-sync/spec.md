# GitHub OAuth 登录与脚本仓库同步功能规范

## Why
为插件添加 GitHub OAuth 认证功能，实现用户通过 GitHub 账号安全登录，并自动管理脚本仓库，实现脚本的云端同步与版本控制，提升用户体验和数据可移植性。

## What Changes
- 新增 GitHub OAuth 2.0 认证流程
- 实现脚本仓库自动检测与创建功能
- 添加脚本文件导入与导出功能
- 扩展本地存储系统以支持 GitHub 登录状态管理
- 完善错误处理与 API 速率限制处理机制

## Impact
- Affected specs: 用户认证、数据存储、脚本管理
- Affected code: 
  - `services/` 新增 GitHub OAuth 服务和仓库管理服务
  - `components/` 新增 GitHub 登录组件
  - `types.ts` 扩展 GitHub 用户类型定义
  - `background/` 处理 OAuth 回调

## ADDED Requirements

### Requirement: GitHub OAuth 认证流程
系统应当实现完整的 GitHub OAuth 2.0 认证流程。

#### Scenario: 发起 OAuth 授权
- **WHEN** 用户点击"使用 GitHub 登录"按钮
- **THEN** 系统打开 GitHub OAuth 授权页面，请求 `repo` 和 `user` 权限范围

#### Scenario: 授权回调处理
- **WHEN** 用户在 GitHub 页面完成授权
- **THEN** 系统接收授权码，交换获取访问令牌，并安全存储令牌

#### Scenario: 获取用户信息
- **WHEN** OAuth 认证成功
- **THEN** 系统调用 GitHub API 获取用户基本信息（用户名、头像、邮箱）

#### Scenario: 令牌刷新与过期
- **WHEN** 访问令牌过期或失效
- **THEN** 系统提示用户重新授权，清除过期会话

### Requirement: 脚本仓库检测
系统应当检测用户账户下是否存在指定的脚本仓库。

#### Scenario: 检查仓库存在性
- **WHEN** 用户登录成功后
- **THEN** 系统调用 GitHub API 检查用户账户下是否存在名为 `jiaoben-scripts`（可配置）的仓库

#### Scenario: 仓库存在处理
- **WHEN** 脚本仓库已存在
- **THEN** 系统读取仓库内所有 `.js`、`.ts`、`.mjs` 脚本文件，并解析导入至插件系统

#### Scenario: 仓库不存在处理
- **WHEN** 脚本仓库不存在
- **THEN** 系统自动创建新的私有仓库，并上传系统中所有生成的脚本文件

### Requirement: 脚本导入功能
系统应当从 GitHub 仓库导入脚本文件。

#### Scenario: 读取仓库脚本列表
- **WHEN** 检测到脚本仓库存在
- **THEN** 系统获取仓库目录树，筛选出所有脚本文件

#### Scenario: 解析脚本内容
- **WHEN** 获取到脚本文件内容
- **THEN** 系统解析脚本元数据（名称、描述、版本），验证格式正确性

#### Scenario: 导入至插件系统
- **WHEN** 脚本格式验证通过
- **THEN** 系统将脚本导入至本地插件系统，保持与云端同步

#### Scenario: 格式错误处理
- **WHEN** 脚本文件格式不正确
- **THEN** 系统记录错误日志，跳过该文件，继续处理其他脚本

### Requirement: 脚本仓库创建
系统应当自动创建新的脚本仓库。

#### Scenario: 创建仓库
- **WHEN** 用户账户下不存在脚本仓库
- **THEN** 系统调用 GitHub API 创建名为 `jiaoben-scripts` 的私有仓库，设置描述为"Jiaoben 插件脚本同步仓库"

#### Scenario: 上传现有脚本
- **WHEN** 仓库创建成功
- **THEN** 系统遍历本地所有脚本文件，逐个上传至仓库根目录

#### Scenario: 设置仓库权限
- **WHEN** 仓库创建完成
- **THEN** 系统确保仓库为私有状态，仅用户本人可访问

### Requirement: 错误处理机制
系统应当针对各类异常情况提供清晰的错误提示和处理。

#### Scenario: 网络错误处理
- **WHEN** 网络请求失败
- **THEN** 系统显示网络错误提示，提供重试选项，记录错误详情

#### Scenario: 认证失败处理
- **WHEN** OAuth 认证失败（用户拒绝、令牌无效等）
- **THEN** 系统显示认证失败提示，说明失败原因，提供重新登录选项

#### Scenario: 仓库操作失败处理
- **WHEN** 仓库创建或读取失败（权限不足、名称冲突等）
- **THEN** 系统显示具体错误信息，提供解决方案建议

#### Scenario: API 速率限制处理
- **WHEN** GitHub API 返回速率限制错误（HTTP 403）
- **THEN** 系统显示速率限制提示，计算重置时间，提供等待后重试选项

### Requirement: 操作状态反馈
系统应当提供清晰的操作状态反馈。

#### Scenario: 登录进度反馈
- **WHEN** OAuth 认证流程进行中
- **THEN** 系统显示当前步骤（授权中、获取令牌、同步数据）

#### Scenario: 同步进度反馈
- **WHEN** 脚本同步进行中
- **THEN** 系统显示进度条和当前处理的文件名

#### Scenario: 操作成功提示
- **WHEN** 操作成功完成
- **THEN** 系统显示成功提示，包含操作摘要（导入 X 个脚本、创建仓库等）

### Requirement: GitHub API 规范遵守
系统应当遵守 GitHub API 使用规范。

#### Scenario: 速率限制遵守
- **WHEN** 发送 API 请求
- **THEN** 系统检查剩余请求配额，在接近限制时自动延迟请求

#### Scenario: 条件请求
- **WHEN** 获取资源内容
- **THEN** 系统使用 ETag 或 Last-Modified 头进行条件请求，减少数据传输

#### Scenario: 用户代理标识
- **WHEN** 发送任何 API 请求
- **THEN** 系统在请求头中包含正确的 User-Agent 标识

## MODIFIED Requirements
无

## REMOVED Requirements
无
