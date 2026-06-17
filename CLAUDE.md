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
│   ├── app/ → config.js / auth.js / data.js / ui.js
│   ├── dashboard/ → core.js / parent.js / students.js / classes.js / schedule.js / attendance.js / records.js / lessonlog.js / artworks.js / announcements.js / courses.js / inquiries.js
│   ├── login.js / contact.js / gallery.js
├── functions/
│   ├── dbProxy/ (数据库代理，读写权限)
│   └── verify-code/ (QQ SMTP 发邮箱验证码，nodemailer)
└── cloudbaserc.json
```

## 关键约定
- 数据流: localStorage 读写 → 异步推 CloudBase；初始加载从 CloudBase 拉（仅本地为空时）
- 8 个数据集合: students / classes / attendance / records / corrections / artworks / announcements / inquiries + email_codes(验证码) / parents(家长)
- 认证: 教师硬编码(AUTH_CONFIG.teachers) / 家长 CloudBase 邮箱登录 或 邮箱验证码注册
- 权限: admin(张校长 756924037@qq.com) / teacher(郑校长 953034984@qq.com) / parent
- hasAdminPermission() 覆盖 admin+teacher

## 当前功能
- 公开页: 首页/画廊/课程/联系预约(ServerChan微信通知)
- 登录: 邮箱密码 + 邮箱验证码注册(5字段) + 忘记密码 + 记住我(sessionStorage)
- 家长端7模块: 总览/我的课程(周课表)/上课记录(考勤统计)/课时明细(消课日志)/孩子作品/画室通知/个人信息+改密码
- 教师端: 总览/学生管理(学员/班级/课表/点名/上课记录)/课消日志/作品管理/预约查询/发布通知/课程管理
- 全局: 深色模式/图片灯箱/回到顶部/响应式
