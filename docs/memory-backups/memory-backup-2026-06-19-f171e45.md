# 记忆备份 — 2026-06-19 登录页+多孩子子系统

## 本次提交
- `7534c16` feat: 登录页改进 — 注册加密码/SVG眼睛图标/老师端隐藏注册/删除记住我
- `8a17cff` fix: 修复验证码云函数URL中的垃圾路径
- `f1f1ac9` fix: 验证码发送改用 SDK callFunction 解决 CORS 跨域
- `ee277d8` fix: 验证码函数改为 HTTP Web 函数部署
- `dfcfd12` fix: 家长注册登录改用本地密码哈希
- `226c092` feat: 家长端多孩子子系统
- `f171e45` feat: 孩子关联改为搜索+教师审批模式

## 关键技术决策

### 1. 家长认证：本地密码哈希，不依赖 CloudBase 认证 API
- **原因**: CloudBase Web SDK 2.21.0 的 `auth.signUp()` 自带邮件验证流程，与项目 QQ SMTP 验证码冲突
- **方案**: `Auth.hashPassword()` / `Auth.verifyPassword()` 本地哈希，存 `parents.passwordHash`

### 2. verify-code 部署为 HTTP Web 函数
- **原因**: `fetch()` 跨域需 OPTIONS 预检，Event 函数 HTTP 网关不支持
- **方案**: `tcb fn deploy verify-code --httpFn --path '/verify-code' --force`
- **URL**: `https://chunxiao-d8ghfaw3y0781da11.service.tcloudbase.com/verify-code`

### 3. 多孩子数据模型
- `parents.children: [{name, studentId}]` + `activeChildIndex`
- 会话存储 children 数组，`Auth.currentChild()` 获取当前
- 旧 `childName` 自动迁移

### 4. 孩子关联审批流
- 家长输入姓名搜索 → 匹配学生 → 创建 inquiry `type: link_request`
- 教师端审批通过/拒绝
- 注册时自动匹配，无需审批

## 数据库变更
- `parents` 集合: read → `true` (原来 `doc._openid == auth.uid`，需手动在控制台改)
- `parents` 新增字段: `children`, `activeChildIndex`, `passwordHash`
- `students` 新增字段: `parentEmail`
- `inquiries` 新增类型: `type: 'link_request'`

## 关键文件
- `js/app/auth.js` — hashPassword, verifyPassword, currentChild, updateChildren, 会话 children 支持
- `js/login.js` — 注册密码字段, 自动匹配学生, children 初始化
- `js/dashboard/parent.js` — findChildStudent(多孩子), loadChildManagement, switchActiveChild, addChild(审批)
- `js/dashboard/inquiries.js` — link_request 渲染, approveLinkRequest, rejectLinkRequest
- `js/dashboard/core.js` — initParentHeader, refreshAllParentModules
- `parent-dashboard.html` — 顶栏切换器, 孩子管理区块
- `css/dashboard.css` — 孩子管理/切换器/下拉/深色模式样式
- `functions/verify-code/index.js` — HTTP 服务器模式 (Web函数)
- `cloudbaserc.json` — verify-code 部署配置
