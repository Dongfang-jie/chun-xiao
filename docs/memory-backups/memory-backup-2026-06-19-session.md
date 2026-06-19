# 记忆备份 — 2026-06-19 会话

## 本次改动

### 🆕 学生多课程报名系统（enrollments 数组）
- **数据模型**：Student 新增 `enrollments: [{course, totalLessons, consumedLessons}]`，顶层 `course/totalLessons/consumedLessons` 自动计算兼容旧数据
- **表单UI**：动态 enrollment 行（+ 添加课程 / ✕ 删除），支持 1-6 门课
- **点名扣课次**：按班级课程自动匹配 enrollment（`cls.course → enrollment.course`）
- **详情弹窗**：分课程进度条展示
- **手动调整**：增加课程选择器，扣对应 enrollment
- **低课次预警**：改为按 enrollment 粒度检查
- **旧数据兼容**：`normalizeStudentEnrollments()` 自动迁移无 enrollments 的旧数据
- 涉及文件：`students.js`, `attendance.js`, `attendance-stats.js`, `lesson-log.js`, `teacher-dashboard.html`

### 🔧 全局「课时」→「课次」重命名
- 所有 HTML/CSS/JS/文档中的「课时」替换为「课次」（13个文件，71处）
- 不影响数据字段名（`totalLessons`, `consumedLessons` 保持英文）

### 🔧 点名扣课次默认值改为 1
- 新点名表单扣课次默认=1（原为0）
- 切状态自动设：出勤→1, 请假/缺勤→0

### 🔧 课消日志点名后自动刷新
- 点名保存/删除后调用 `renderLessonLog()` 等，确保日志实时更新

### 🔧 点名日期保持
- 保存点名后使用 `att-date-nav.value` 保持用户选择的日期，不跳回今天

### 🔧 班级学员匹配改为宽松比较
- `indexOf`（===）→ for 循环（==），兼容数字/字符串类型差异
- 错误时显示诊断信息（class studentIds + 学生总数）

## 提交记录
- `61f05ba` fix: 点名保存后保持用户选择的日期，不跳回今天
- `f78168c` fix: 点名班级学员匹配改用宽松比较 + 错误时显示诊断信息
- `5eaa7d7` fix: 点名扣课次默认值改为1，切换状态自动设扣课次
- `5b3c2bf` feat: 学生支持多课程报名(enrollments) + 全局「课时」→「课次」重命名

## 关键代码位置
- `normalizeStudentEnrollments()` → `js/dashboard/students.js:21`
- enrollment 匹配逻辑 → `js/dashboard/attendance.js:148`（form显示）, `js/dashboard/attendance.js:281`（save扣除）
- 课消日志刷新 → `js/dashboard/attendance.js:322-324`
- 扣课次默认值 → `js/dashboard/attendance.js:145`（`deducted = rec ? ... : 1`）
- 日期保持 → `js/dashboard/attendance.js:323`（`navDate.value || date`）
