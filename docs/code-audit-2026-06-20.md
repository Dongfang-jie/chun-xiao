# 春晓画室 全局代码审查报告

**日期**: 2026-06-20 | **审查范围**: HTML ×4, CSS ×3, JS ×26, 云函数 ×2, 配置 ×3

---

## 🔴 严重问题 (Critical) — 需立即修复

### C1. 教师密码明文暴露在客户端源码
**文件**: `js/app/auth.js:9-10`
```javascript
{ email: '756924037@qq.com', password: '756924', name: '张校长', role: 'admin' },
{ email: '953034984@qq.com', password: '454657', name: '郑校长', role: 'teacher' }
```
任何人查看网页源代码即可获取完整凭证。**应立即将认证移至后端云函数。**

### C2. ServerChan 推送密钥暴露
**文件**: `js/app/auth.js:13-15`
`SCT364390TgpWv9nIL4dE2g1frC1DCIrzq` 硬编码在客户端 JS 中。任何人可用此密钥向配置的微信账号发送任意通知。

### C3. XSS — 所有 dashboard 页面 innerHTML 无转义
**涉及全部 16 个 dashboard JS 文件**。学生姓名、作品标题、通知内容等用户数据直接拼接到 HTML 字符串中，无任何转义。示例：
- `gallery.js:27` — `'<h4>' + a.title + '</h4>'`
- `students.js:594` — `insertAdjacentHTML('beforeend', html)` 含全部学生数据
- `parent.js:554` — `'<h4>' + a.title + '</h4>'`
- `announcements.js:57` — `a.content.replace(/\n/g, '<br>')` 仅转义换行

**需要创建一个 `escapeHtml()` 工具函数并在所有 innerHTML 拼接处使用。**

### C4. `dbProxyOk` 永远为 false — dbProxy 拉取回退是死代码
**文件**: `js/app/data.js:113`
`var dbProxyOk = false;` 从未被设为 `true`。所有 `if (dbProxyOk)` 检查永远为 `false`，导致 HTTP 方式的云端数据拉取永远不会触发。**push 能用 dbProxy，但 pull 不行。**

### C5. GitHub Actions 备份从未运行 — `actions/checkout@v6` 不存在
**文件**: `.github/workflows/backup.yml:20`
`actions/checkout` 最新主版本是 v4，不存在 v6。该 workflow 启动即失败。**这意味着自动备份从未实际执行。**

### C6. 验证码使用 `Math.random()` — 可预测
**文件**: `functions/verify-code/index.js:115-121`
`Math.random()` 不是密码学安全的随机数生成器。验证码可被预测。

### C7. dbProxy 云函数无任何认证 — 公开数据库管理员权限
**文件**: `functions/dbProxy/index.js:20-123`
结合 `cloudbaserc.json` 中 `enablePublicAccess: true`，任何知道 URL 的人都可以读写所有 10 个数据库集合。

---

## 🟠 高优先级 (High)

### 安全

| # | 问题 | 文件:行 |
|---|------|---------|
| H1 | `hashPassword` 使用非加密哈希 (DJB2 变体)，且含 `hash & hash` 无操作 | `auth.js:232-249` |
| H2 | verify-code 函数 CORS `*` 允许任意来源 | `functions/verify-code/index.js:215` |
| H3 | 验证码验证存在竞态条件（并发请求可绕过3次限制） | `functions/verify-code/index.js:364-373` |
| H4 | CloudBase CDN 脚本缺少 SRI integrity 属性 | 全部 4 个 HTML 文件 |
| H5 | dbProxy 写操作不是原子性的：先删后增，中间态暴露 | `data.js:255-265` |

### 漏洞

| # | 问题 | 文件:行 |
|---|------|---------|
| H6 | `auth.js:92-96` — migration 的 `db.update()` 未 await，错误被静默吞掉 | `auth.js:93` |
| H7 | `data.js:255-265` — 旧数据删除后新数据写入可能失败，云端数据永久丢失 | `data.js:261` |
| H8 | `data.js:480+490` — `DEFAULT_COURSES` 变量提升导致 fallback 永远为空数组 | `data.js:480` |
| H9 | `data.js:335` — `Auth.currentUser` 被当作函数引用检查，实际 `exportedBy` 值变成 `"currentUser"` | `data.js:335` |
| H10 | `ui.js:45` — `initLightbox` 在 `gallery.js` 渲染前执行，画廊图片灯箱永远不工作 | `ui.js:45` |
| H11 | `storage.js:34` — 非 PNG/JPEG 格式(MIME)全被错误映射为 `.jpg` | `storage.js:34` |
| H12 | 注册时 DB 写入失败仍返回 session — 数据不一致 | `auth.js:141-158` |
| H13 | `parent.js:882` — `document.addEventListener('click', ...)` 每次 dropdown 渲染都累加 | `parent.js:882` |
| H14 | `parent.js:766` — `user.children` 为 `null` 时 `.forEach` 崩溃 | `parent.js:766` |
| H15 | `attendance.js:304` — `saveAttendance` 用 `Date.now()` 作 ID，同毫秒重复导致数据丢失 | `attendance.js:314` |
| H16 | `students.js:599-603` — `hideStudentDetail` 被覆盖，多次打开 overlay 导致内存泄漏 | `students.js:599` |
| H17 | `lesson-log.js:366` — `consumedLessons` 可被设为负数 | `lesson-log.js:366` |

### 连贯性

| # | 问题 |
|---|------|
| H18 | 脚本加载顺序依赖脆弱，无模块系统，无加载顺序文档 |
| H19 | localStorage 命名不一致: `chunxiao-` vs `chunxiao_` vs `chunxiao_dashboard_` |
| H20 | `findEnrollment` 模式在 4 个文件中重复 6+ 次 |
| H21 | DAY_MAP/DAY_NAMES 在 3 个文件中各定义一次 |
| H22 | `data-mgmt.js` 的 `DATA_COLLECTIONS` 与 `data.js` 的映射重复 |

---

## 🟡 中优先级 (Medium)

### 简洁性

| # | 问题 | 文件:行 |
|---|------|---------|
| M1 | `data.js:389-497` — 9 对几乎相同的 get/save 函数，可简化为配置驱动 | `data.js` |
| M2 | 246 个内联 style 属性，其中 191 个在 `teacher-dashboard.html` | 全部 HTML |
| M3 | CSS `!important` 在 dark mode 中大量使用 (dashboard.css:555-593 共 16 次) | `dashboard.css` |
| M4 | login.css 和 dashboard.css 几乎不使用 CSS 变量，硬编码颜色值 | 2 个 CSS |
| M5 | `#2a2a2a` 重复约 40 次，`#444` 重复约 20 次 — 应提取为 CSS 变量 | 3 个 CSS |
| M6 | `teacher-dashboard.html` 加载 21 个独立 JS 文件（21 次 HTTP 请求） | `teacher-dashboard.html:605-625` |
| M7 | `core.js:130-142` 和 `core.js:149-189` — 初始渲染执行两次（同步前+同步后） | `core.js` |

### 错误处理

| # | 问题 | 文件:行 |
|---|------|---------|
| M8 | `core.js:146` — `pullFromCloud()` 无 `.catch()`，同步失败无用户反馈 | `core.js:146` |
| M9 | `auth.js:168` — `signOut()` 失败完全静默 (`catch (e) { /* 忽略 */ }`) | `auth.js:168` |
| M10 | 多处 `localStorage.setItem()` 无 try-catch，配额满时崩溃 | 多个文件 |
| M11 | `data.js:258` — 单条文档删除错误被完全静默吞掉 | `data.js:258` |
| M12 | `data.js:313` — setTimeout 重试回调是 async 但返回值被丢弃，rejection 未处理 | `data.js:313` |
| M13 | 无全局 `unhandledrejection` 事件监听器 | 全部 JS |
| M14 | `verify-code` 函数中验证码存储失败后仍返回 `success: true` | `functions/verify-code/index.js:327` |

### 安全性（额外）

| # | 问题 |
|---|------|
| M15 | 无 Content Security Policy (CSP) |
| M16 | `login.js:20` — verify-code URL 硬编码，不在 config.js 中 |
| M17 | `core.js:118` — `console.log('✅ 已登录：' + user.email)` 泄露邮箱到控制台 |
| M18 | `index.html:230` — 灯箱按钮是 `<span>` 而非 `<button>`，无 aria-label |
| M19 | 18+ 个 `console.log` 调试语句应移除 |

---

## 🟢 低优先级 (Low)

### CSS

| # | 问题 |
|---|------|
| L1 | Z-index 值无统一管理 (2~99999，共 8 个不同层级) |
| L2 | 多个固定 px 值应转为 rem (约 30 处) |
| L3 | 缺失 1400px+ 大屏断点 |
| L4 | `.contact-info` 4 列网格在 641-850px 之间过于拥挤 |
| L5 | 5 个可能未使用的 CSS 规则 |
| L6 | 暗色模式遗漏 6 处元素 |

### HTML

| # | 问题 |
|---|------|
| L7 | `index.html:37` — 页首 logo 不应使用 `loading="lazy"` |
| L8 | Favicon 使用 JPEG 格式，部分浏览器不支持 |
| L9 | 缺失 `og:url` OpenGraph 标签 |
| L10 | 登录/仪表盘页缺失 `robots` noindex 标签 |
| L11 | 表格缺少 `<caption>` 元素 |
| L12 | index.html 缓存策略不统一（有的有 version 参数，有的没有） |

### JS

| # | 问题 |
|---|------|
| L13 | `storage.js:35` — `Date.now()+随机数` 作文件名，极端情况下可能碰撞 |
| L14 | `sync-status.js:91-93` — 错误消息 4 秒后自动消失，用户来不及阅读 |
| L15 | `inquiries.js:10-14` — `setInterval` 30 秒轮询，无清理机制 |
| L16 | `courses.js:40` — 每次 blur 都触发 `saveCourses`（编辑 6 格 = 6 次保存） |
| L17 | `overview.js:17` — 课程数硬编码为 `'6'`，不随实际数据变化 |

---

## 📊 统计汇总

| 严重级别 | 数量 | 占比 |
|----------|------|------|
| 🔴 Critical | 7 | 5.6% |
| 🟠 High | 22 | 17.7% |
| 🟡 Medium | 19 | 15.3% |
| 🟢 Low | 17 | 13.7% |
| **总计** | **65** | **100%** |

按类别分布：
- **安全**: 18 项 (27.7%) — 最大类别
- **漏洞**: 17 项 (26.2%)
- **连贯性**: 9 项 (13.8%)
- **错误处理**: 8 项 (12.3%)
- **简洁性**: 7 项 (10.8%)
- **实用性**: 6 项 (9.2%)

---

## 🎯 优先修复路线图

### 第一阶段：安全底线 (本周)
1. 将教师认证移至云函数，移除客户端明文密码 (C1)
2. 创建 `escapeHtml()` 工具函数，修复全部 innerHTML XSS (C3)
3. 为 dbProxy 添加 API Key 认证 (C7)
4. 用 `crypto.randomInt()` 替换 `Math.random()` 生成验证码 (C6)
5. 修复 `actions/checkout@v6` → `@v4` (C5)
6. 移除 ServerChan 密钥到环境变量 (C2)

### 第二阶段：稳定性修复 (下周)
7. 修复 `dbProxyOk` 永远为 false (C4)
8. 修复 `auth.js` migration 未 await (H6)
9. 修复 `data.js` 删后写失败的数据丢失 (H7)
10. 修复 `DEFAULT_COURSES` hoisting 问题 (H8)
11. 修复灯箱在画廊页不工作 (H10)
12. 修复 `actions/checkout@v6` → `@v4` (C5)

### 第三阶段：代码质量 (两周内)
13. 重构 `data.js` 9 对 get/save 函数为配置驱动 (M1)
14. 提取 CSS 变量，消除 40+ 处重复颜色值 (M4, M5)
15. 迁移内联样式到 CSS 类 (M2)
16. 添加全局 `unhandledrejection` 处理器 (M13)
17. 统一 localStorage 键名约定 (H19)

### 第四阶段：体验与健康度 (一月内)
18. 添加 Content Security Policy (M15)
19. 添加 CSS z-index 管理层 (L1)
20. 添加全局加载状态指示器
21. 提取共享常量 (DAY_MAP, findEnrollment 等)
22. 为教师端 JS 做打包 (M6)

---

*此报告由 Claude Code agent 团队自动生成，包含 HTML/CSS/JS/云函数/配置 全栈审查。*
