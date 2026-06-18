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

---

## 作品管理系统重做（2026-06-18 第二会话）

### 概述
教师端作品管理从简单增删升级为完整 CRUD + CloudBase 云存储 + 筛选/批量/导出。

### 新增文件
- `js/app/storage.js` — CloudBase 云存储工具（upload/getUrls/remove）

### 重写文件
- `js/dashboard/artworks.js` — 完整 CRUD + 筛选搜索 + 卡片/表格双视图 + 批量删除 + CSV 导出 + 图片灯箱 + 云存储上传

### 功能清单
- **完整 CRUD**: 添加 / 编辑 / 删除（单个+批量），编辑保留 lastModifiedAt/lastModifiedBy
- **筛选搜索**: 作品名/学生名搜索 + 类型筛选(美术/书法/课堂剪影/家长端) + 学生筛选 + 3种排序
- **双视图**: 卡片网格 ↔ 表格列表切换
- **批量操作**: 勾选多件 → 批量删除（含云存储文件清理）
- **CSV 导出**: 按当前筛选结果导出
- **CloudBase 云存储**: 图片上传到云端，自动获取临时访问链接，删除时清理
- **图片压缩**: 800px/JPEG 75%，选图后禁用保存按钮防竞态
- **学生关联**: 新增 `studentId` 字段，表单用 `<datalist>` 支持下拉+手动输入
- **后退兼容**: 旧 base64 和外部 URL 图片不受影响；云存储不可用时自动回退 base64
- **图片灯箱**: 复用 style.css 的 `.lightbox-*` 样式

### 数据模型变更
```javascript
// artworks 对象新增字段
studentId: Number|null,   // 关联 students 表 id
lastModifiedAt: String,   // 编辑时间（新增时无此字段）
lastModifiedBy: String    // 编辑人
// image 字段现可存储 cloud:// fileID
```

### 云存储方案
- SDK: CloudBase Web SDK 2.21.0 `app.storage.from().upload()`
- 上传路径: `artworks/{timestamp}_{random}.jpg`
- 显示: 批量调用 `app.getTempFileURL()`，结果缓存到 `_artworkUrlCache`
- 删除: 删作品时 `await ArtworkStorage.remove([fileID])`
- 公开页/家长端: 各自维护 URL 缓存，渲染后异步解析 `cloud://` → 更新 DOM

### 公开画廊改造
- `gallery.js`: `renderGalleryArtworks()` 拆分为 3 路（美术/书法/课堂剪影），`renderLatestArtworks` 移除
- `gallery.html`: 硬编码课堂剪影占位替换为动态容器 `#artwork-classroom-list`，删除"学生作品展示"标题
- 课堂剪影置顶 → 美术 → 书法

### 家长端增强
- `parent.js` `loadParentArtworks`: studentId 优先匹配（查 students 表 → parent/name 关联），fallback 旧字符串匹配
- cloud:// 图片异步解析 + 缓存

### 首页改动
- 删除"学生作品展示"区块（`#home-artworks`）
- 删除美术课程和书法课程卡片区
- 联系我们: 4×1 网格布局 + 微信二维码（张校长二维码.png）
- 预约按钮移到画室信息上方

### contact.html 改动
- 删除"联系我们"页面标题
- 预约表单移到画室信息上方
- 交通指引: 嵌入 OpenStreetMap iframe + 高德地图导航链接

### Bug 修复
1. HTML 孤儿标签 `</table></section>` 删除
2. 图片压缩竞态: 选图后禁用保存按钮，压缩完再启用
3. "最新在前"加显式 `sort(b.id - a.id)` 防云端乱序
4. `ArtworkStorage.remove` 加 `await` 防云文件残留

### Git 提交记录（第二会话）
- `6a91cf3` feat: 重做作品管理系统
- `0278058` fix: 删除画廊标题 + 课堂剪影置顶 + 类型新增
- `cf03066` feat: 作品类型新增'家长端'
- `9aa5856` feat: 首页精简 + 微信二维码 + contact 页调整 + 地图
- `8bf8857` fix: 作品管理 4 个 bug 修复
