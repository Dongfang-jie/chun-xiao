# 记忆备份 — 2026-06-17

> 来源：`C:\Users\35047\.claude\projects\G------\memory\`
> 共 3 条记忆

---

## 1. 项目状态总览

### 本次会话改动（2026-06-17）
- 🆕 **家长端全面升级**（7模块）：总览/我的课程/上课记录/课时明细/孩子作品/画室通知/个人信息+改密码
- 🆕 **登录优化**（7项）：密码可见切换/记住我(sessionStorage)/忘记密码/表单切换动画/实时校验/按钮loading/视觉微调
- 🆕 **邮箱验证码注册**：注册表单改为 家长姓名+邮箱+邮箱验证码+手机号+孩子姓名
- 🆕 **verify-code 云函数**：QQ SMTP 发邮件验证码 + 校验 + 防刷
- 🔧 **auth.js 升级**：_setSession 支持 rememberMe → localStorage/sessionStorage 双存储

### 部署
- **前端**: GitHub Pages — https://dongfang-jie.github.io/chun-xiao/
- **后端**: CloudBase `chunxiao-d8ghfaw3y0781da11`
- **云函数**: `dbProxy`, `verify-code`

### 待办
1. ✅ ~~创建 email_codes 数据库集合~~（已通过 ensureCollection 自动创建）
2. ✅ ~~确认 verify-code 环境变量~~（已确认）
3. 🟡 替换占位图片
4. 🟡 对外展示页面优化
5. 🟢 教师端继续填充

---

## 2. 项目架构

### 目录
```
├── index.html / login.html / parent-dashboard.html / teacher-dashboard.html
├── css/  → style.css / login.css / dashboard.css
├── js/
│   ├── app/ → config.js / auth.js / data.js / ui.js / gallery.js
│   ├── dashboard/ → core.js / parent.js / students.js / classes.js / ...
│   ├── login.js / contact.js
├── functions/
│   ├── dbProxy/ / verify-code/
├── cloudbaserc.json
```

### 数据流
localStorage ↔ CloudBase（本地为主，云端备份）
8个集合: students / classes / attendance / records / corrections / artworks / announcements / inquiries / email_codes / parents

### 认证
- 教师: 硬编码 (AUTH_CONFIG.teachers)
- 家长: CloudBase 邮箱登录 或 邮箱验证码注册
- 权限: admin(张校长) / teacher(郑校长) / parent

### 关键约定
- ES5 语法
- 全局 get/save 函数
- 模块按依赖顺序加载

---

## 3. verify-code SMTP 配置

### 凭证
- EMAIL_USER: (见 Claude 记忆，未写入仓库)
- EMAIL_PASS: (QQ 授权码，见 Claude 记忆，未写入仓库)

### 架构（2026-06-17 修复）
- 前端 fetch() → HTTP 访问服务 → verify-code 云函数
- 不再使用 SDK callFunction（浏览器报 network request error）
- HTTP URL: `https://chunxiao-d8ghfaw3y0781da11-1443528450.ap-shanghai.app.tcloudbase.com/G:/Ruanjian/Git/verify-code`

### 部署
```bash
# 部署云函数（凭证临时填入 cloudbaserc.json，部署后恢复空占位符）
npx tcb fn deploy verify-code --envId chunxiao-d8ghfaw3y0781da11 --force
```

### 排查
- `tcb fn invoke verify-code --params '{"action":"ping"}'` — 检查环境变量
- `tcb fn log verify-code --limit 20` — 查看日志
- 本地测试: `python -m http.server 8899` → `http://localhost:8899/login.html`
