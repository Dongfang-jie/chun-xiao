# 记忆备份 2026-06-18

> 自动备份于 2026-06-18 会话结束

## 记忆索引

- [全集合数据同步修复](#全集合数据同步修复)
- [同步状态气泡](#同步状态气泡)
- [CloudBase 安全规则配置](#cloudbase-安全规则配置)
- [项目架构](#项目架构)

---

## 全集合数据同步修复

### 问题
`students` 可双端同步，但 `classes`、`attendance`、`records`、`corrections`（课消日志）等集合无法同步。

### 根因
CloudBase 数据库安全规则：`students` 已开放读写，其他集合仍是默认规则 `"write": "doc._openid == auth.uid"`。不同设备的匿名会话有不同的 `_openid`，导致跨设备写入被拒。

### 解决方案演进
1. **v1**: 添加 dbProxy 云函数后备通道（`callFunction` + HTTP fetch）—— 绕过安全规则，用 admin 权限读写
2. **v2**: 修复 `pullFromCloud` 中 `_pushToCloudDirect` 不抛异常导致 catch 死代码的 bug
3. **v3**: 修复 dbProxy 拉取到云端更新后仍无条件推送的覆盖 bug（新增 `cloudDataNewer` 标记）
4. **v4（最终）**: 直接在 CloudBase 控制台开放所有业务集合的安全规则，回归直接数据库访问

### 最终架构
```
localStorage 为主
  ↓ saveX() 立即写 + 标记 _synced
  ↓ _pushToCloud → 直接 DB push
  ↓                ↓ 失败 → _pushToCloudViaFn(dbProxy)

拉取:
  pullFromCloud → 直接 DB 读 → 失败 → dbProxy 读
  ↓ 时间戳比较 → 云新用云 / 本地新推送
```

### 修改文件
- `js/app/data.js` — 核心同步逻辑：`_callDbProxy`、`_pushToCloudViaFn`、`pullFromCloud` 重写
- `js/app/config.js` — 新增 `dbProxyUrl`
- `js/dashboard/core.js` — 同步后补齐 `renderSchedule`、`renderDailyAttendanceTable`、`refreshRecordSelects` 等

---

## 同步状态气泡

### 新增文件
`js/app/sync-status.js` — 右下角固定气泡，实时显示同步事件。

### 功能
- `📤 已推送 班级 · 3条` — 推送成功（绿色）
- `📥 已拉取 学员 · 5条` — 拉取成功（紫色）
- `⚠️ 推送失败 上课记录: 权限不足` — 失败（红色）
- 4 秒自动缩回 `☁️` idle
- 脉冲动画提示新事件
- 深色模式适配
- 推送最终失败（3次重试耗尽）时显示持久错误

### 集成
- `data.js` 中所有推送/拉取成功/失败点均调用 `SyncBubble`
- 全部 HTML 页面引入（index、gallery、teacher-dashboard、parent-dashboard、login、contact）

### CSS
- `css/style.css` +70 行（`#sync-bubble` 样式、动画、深色模式）

---

## CloudBase 安全规则配置

### 业务集合（8个）
```json
{
  "read": true,
  "write": "auth != null"
}
```
适用集合：`students`、`classes`、`attendance`、`records`、`corrections`、`artworks`、`announcements`、`inquiries`

### 敏感集合（2个）
```json
{
  "read": "doc._openid == auth.uid",
  "write": "doc._openid == auth.uid"
}
```
适用集合：`parents`（家长密码哈希）、`email_codes`（邮箱验证码）

> ⚠️ **绝对不要开放 parents 和 email_codes**，它们存敏感数据。

---

## 项目架构

### 目录结构（2026-06-18）
```
├── index.html / login.html / parent-dashboard.html / teacher-dashboard.html
├── css/  → style.css（含 sync-bubble 样式）/ login.css / dashboard.css
├── js/
│   ├── app/
│   │   ├── config.js      — CloudBase 初始化 + dbProxyUrl
│   │   ├── auth.js        — 认证（教师硬编码 / 家长邮箱）
│   │   ├── data.js        — 数据层（localStorage + CloudBase 双向同步）
│   │   ├── sync-status.js — 同步状态气泡（右下角）
│   │   ├── ui.js          — 全局 UI（导航/页脚/深色模式/灯箱）
│   │   └── gallery.js     — 画廊页
│   ├── dashboard/
│   │   ├── core.js         — 管理端核心（登录检查/侧边栏/入口）
│   │   ├── overview.js     — 总览
│   │   ├── students.js     — 学员管理
│   │   ├── classes.js      — 班级管理
│   │   ├── schedule.js     — 课表
│   │   ├── attendance.js   — 每日点名
│   │   ├── attendance-stats.js — 考勤统计
│   │   ├── records.js      — 上课记录
│   │   ├── lesson-log.js   — 课消日志
│   │   ├── artworks.js     — 作品管理
│   │   ├── announcements.js — 通知
│   │   ├── courses.js      — 课程管理
│   │   ├── inquiries.js    — 预约查询
│   │   └── parent.js       — 家长端
│   ├── login.js            — 登录页
│   └── contact.js          — 联系页
├── functions/
│   ├── dbProxy/（备用，当前不使用）
│   └── verify-code/（QQ SMTP 发邮箱验证码）
└── cloudbaserc.json
```

### 8 个数据集合
| localStorage Key | CloudBase 集合 | 功能 |
|-----------------|---------------|------|
| chunxiao-students | students | 学员 |
| chunxiao-classes | classes | 班级 |
| chunxiao-attendance | attendance | 点名 |
| chunxiao-records | records | 上课记录 |
| chunxiao-lesson-corrections | corrections | 课消日志 |
| chunxiao-artworks | artworks | 作品 |
| chunxiao-announcements | announcements | 通知 |
| chunxiao-inquiries | inquiries | 预约查询 |

### Git 提交记录（本次会话）
- `8db2922` feat: 全集合数据同步 + 同步状态气泡
- `60160b7` fix: 诊断 dbProxy 可达性 + 修复云端更新后被覆盖的推送逻辑
- `ad71eaa` chore: 移除 dbProxy 连通性诊断，直连已全覆盖
