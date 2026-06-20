# 春晓画室

## 项目概述
少儿美术/书法培训机构网站。前端 GitHub Pages + 后端腾讯云 CloudBase。

## 部署
- 线上: https://dongfang-jie.github.io/chun-xiao/
- 云环境: CloudBase `chunxiao-d8ghfaw3y0781da11`
- 仓库: https://github.com/Dongfang-jie/chun-xiao

## 技术栈
- HTML/CSS/JS (ES5 兼容，不编译)
- CloudBase Web SDK 2.21.0 (CDN)
- CloudBase 云函数 Node.js 18.15
- localStorage 为主 + CloudBase 异步同步

## 目录结构
```
├── index.html / login.html / parent-dashboard.html / teacher-dashboard.html
├── css/  → style.css / login.css / dashboard.css
├── js/
│   ├── app/ → config.js / auth.js / data.js / storage.js / ui.js / gallery.js / sync-status.js
│   ├── dashboard/ → core.js / parent.js / overview.js / students.js / classes.js / schedule.js / attendance.js / attendance-stats.js / records.js / lesson-log.js / renewals.js / artworks.js / announcements.js / courses.js / inquiries.js
│   ├── login.js / contact.js
├── functions/
│   ├── dbProxy/ (数据库代理，读写权限)
│   └── verify-code/ (QQ SMTP 发邮箱验证码，nodemailer)
└── cloudbaserc.json
```

## 关键约定
- 数据流: localStorage 读写 → 异步推 CloudBase；每次加载从 CloudBase 拉取比较时间戳
- 同步通道: CloudBase Web SDK 直接数据库访问（匿名登录），**不经过云函数**
- 依赖 CloudBase 数据库安全规则对所有业务集合开放 `read: true, write: "auth != null"`
- parents / email_codes 集合保持仅 owner 可读写（保护隐私）
- 10 个数据集合: students / classes / attendance / records / corrections / artworks / announcements / inquiries / renewals / courses + email_codes(验证码) / parents(家长)
- 认证: 教师硬编码(AUTH_CONFIG.teachers) / 家长 CloudBase 邮箱登录 或 邮箱验证码注册
- 权限: admin(张校长 756924037@qq.com) / teacher(郑校长 953034984@qq.com) / parent
- hasAdminPermission() 覆盖 admin+teacher

## 当前功能
- 公开页: 首页/画廊/课程/联系预约(ServerChan微信通知)
- 登录: 邮箱密码 + 邮箱验证码注册(5字段) + 忘记密码 + 记住我(sessionStorage)
- 家长端7模块: 总览/我的课程(周课表)/上课记录(考勤统计)/课次明细(消课日志)/孩子作品/画室通知/个人信息+改密码
- 教师端: 总览/学生管理(学员/班级/课表/点名/上课记录/续费)/课消日志/作品管理(完整CRUD+云存储+筛选+批量+导出)/预约查询/发布通知/课程管理
- 全局: 深色模式/图片灯箱/回到顶部/响应式/同步状态气泡
- 云存储: CloudBase Storage `app.storage.from().upload()` / `app.getTempFileURL()` / `remove()`，图片存 cloud:// fileID，渲染时异步解析临时URL

## Agent skills

### Issue tracker

GitHub Issues，通过 `gh` CLI 操作。See `docs/agents/issue-tracker.md`.

### Triage labels

使用默认标签名：`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`。See `docs/agents/triage-labels.md`.

### Domain docs

单上下文（single-context）：根目录 `CONTEXT.md` + `docs/adr/`。See `docs/agents/domain.md`.

## CloudBase 安全规则

数据同步依赖 CloudBase Web SDK 直接访问数据库（匿名登录 `signInAnonymously()`）。以下集合需在控制台设置安全规则：

| 集合 | read | write | 说明 |
|------|------|-------|------|
| students / classes / attendance / records / corrections / artworks / announcements / inquiries / renewals / courses | `true` | `"auth != null"` | 业务数据，双端同步 |
| parents | `"doc._openid == auth.uid"` | `"doc._openid == auth.uid"` | 家长密码，仅 owner |
| email_codes | `"doc._openid == auth.uid"` | `"doc._openid == auth.uid"` | 邮箱验证码，仅 owner |

**不要开放 parents 和 email_codes** — 它们存敏感数据。如双端同步出 PERMISSION_DENIED，检查对应集合安全规则是否配置。

## CSP 注意事项

所有 7 个 HTML 页面的 `<meta http-equiv="Content-Security-Policy">` 需保持一致。当前 `connect-src`：

```
connect-src 'self' https://*.tcloudbase.com https://*.app.tcloudbase.com https://*.tencentcloudapi.com
```

| 域名 | 用途 |
|------|------|
| `*.tcloudbase.com` | CloudBase SDK 直接数据库操作 |
| `*.app.tcloudbase.com` | HTTP 访问服务（dbProxy 云函数回退） |
| `*.tencentcloudapi.com` | Auth 认证（匿名登录、令牌签发） |

⚠️ **CSP 的 `*` 通配符只匹配一级子域名**。`*.tcloudbase.com` 能匹配 `foo.tcloudbase.com`，但**不能**匹配 `ap-shanghai.app.tcloudbase.com`（两级）。需要 `*.app.tcloudbase.com` 单独覆盖。新增云函数 HTTP 端点或 SDK 域名时，务必检查通配符覆盖。删除任何一个都会导致相应功能完全不可用。

## 作品管理要点

- 图片存储: 优先 CloudBase Storage (`cloud://` fileID)，上传失败回退 base64 data URL
- 画廊分区: `gallery.js` 按 `type` 字段分流：`'书法'` → 书法区 / `'课堂剪影'` → 课堂剪影区 / 其他 → 美术区；`'家长端'` 类型**不出现在公开画廊**
- 作品 `type` 可选值: 美术 / 书法 / 课堂剪影 / 家长端
- 数据模型: `id/title/student/studentId/type/image/addedAt/addedBy/lastModifiedAt/lastModifiedBy`
- 家长端匹配: 优先 `studentId` 关联 students 表，fallback `student === childName`
