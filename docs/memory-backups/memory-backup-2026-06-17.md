# 记忆备份 2026-06-17

> 自动备份于 2026-06-17 会话结束

## 记忆索引

- [项目状态总览](#项目状态总览)
- [项目架构](#项目架构)
- [verify-code SMTP 配置](#verify-code-smtp-配置)
- [整体架构原则](#整体架构原则)

---

## 项目状态总览

### 项目状态（截至 2026-06-17）

### 本次会话改动
- 🆕 家长端全面升级（7模块）
- 🆕 登录优化（7项）
- 🆕 邮箱验证码注册
- 🆕 verify-code 云函数
- 🔧 auth.js 升级
- 🔧 complete-profile.html / functions/sms 已删除
- 🔧 数据层双向同步修复：dbProxy 云函数替代 Web SDK 直连 + 时间戳比较 + 离线重试 + 旧数据迁移保护 + 家长端补全同步
- 🎨 对外展示页面全面优化：SEO / CSS架构 / 性能 / 结构化数据 / sitemap + robots.txt

### 最新提交
- `5487d58` fix: data.js 完善双向同步
- `c5664bb` fix: data.js 改用 dbProxy 云函数
- `f91ec59` feat: 对外展示页面全面优化

### 部署
- 前端: GitHub Pages — https://dongfang-jie.github.io/chun-xiao/
- 后端: CloudBase `chunxiao-d8ghfaw3y0781da11`
- 云函数: dbProxy, verify-code

### 部署待办
- ✅ email_codes 集合
- ✅ verify-code 环境变量
- ✅ 替换占位图片
- ✅ 对外展示页面优化
- 🟢 教师端继续填充

---

## 项目架构

### 页面加载链

| 页面 | SDK | config | auth | data | 其他 |
|------|-----|--------|------|------|------|
| courses.html | ❌ | ❌ | ❌ | ❌ | ui |
| contact.html | ✅ | ✅ | ✅ | ❌ | ui + contact |
| login.html | ✅ | ✅ | ✅ | ❌ | login |
| index.html | ✅ | ✅ | ✅ | ✅ | ui + gallery |
| gallery.html | ✅ | ✅ | ✅ | ✅ | ui + gallery |
| parent-dashboard | ✅ | ✅ | ✅ | ✅ | core + parent |
| teacher-dashboard | ✅ | ✅ | ✅ | ✅ | core + 12 modules |

### 数据流（2026-06-17 更新）

```
localStorage (主存储)
    ↕ 双向同步（dbProxy 云函数，管理员权限）
CloudBase
    - pullFromCloud(): 每次加载比较 _synced 与 updatedAt 时间戳
    - save*(): 立即写 localStorage + 标记 _synced + 异步推 dbProxy
```

### 关键约定
- ES5 语法: 只用 var
- 函数声明: function name() {}
- 全局函数: get/save 系列
- 模块顺序: script 标签按依赖排列

---

## verify-code SMTP 配置

- EMAIL_USER: 3504718793@qq.com（已脱敏，仅备份结构）
- 架构: HTTP 直连 → fetch() 调用
- 部署: `tcb fn deploy verify-code --force`
- 频率限制: 同邮箱 60s / 同 IP 5次/小时 / 5分钟过期

---

## 整体架构原则

**铁律**：
1. 改 style.css 前检查所有加载它的页面
2. 新增 CSS 类名检查是否与 dashboard.css 冲突
3. 改 JS 模块前检查所有加载该模块的页面
4. 永远从架构视角出发

**共享关系**：
- css/style.css → 所有页面
- css/dashboard.css → teacher + parent dashboard
- js/app/*.js → 所有页面
- js/dashboard/*.js → teacher + parent dashboard
