# 记忆备份 2026-06-19

> 自动备份于 2026-06-19 会话结束

## 记忆索引

- [课程体系重构](#课程体系重构)
- [课程页面布局与配图](#课程页面布局与配图)
- [首页画室照片](#首页画室照片)
- [作品管理手机端修复](#作品管理手机端修复)
- [Git 提交记录](#git-提交记录本次会话)

---

## 课程体系重构

### 课程变更

| 类别 | 旧课程 | 新课程 | 年龄 | 课时 |
|------|--------|--------|------|------|
| 美术 | ~~水彩入门~~ | **中国画** | 8岁以上 | 120分钟/周 |
| 美术 | ~~动漫插画~~ | **色彩** | 10岁以上 | 120分钟/周 |
| 美术 | 儿童创意画 | 儿童创意画 | 4岁以上（原4-7） | 120分钟/周（原90） |
| 美术 | ~~素描基础~~ | 素描 | 10岁以上（原8-12） | 120分钟/周 |
| 书法 | 硬笔书法 | 硬笔书法 | 6岁以上 | 120分钟/周（原90） |
| 书法 | 软笔书法 | 软笔书法 | 6岁以上（原8+） | 120分钟/周 |

- 全部课程统一每周1次、每次120分钟
- 移除时间表具体时段（周六/周日），改为"咨询画室安排"

### 同步修改文件
- `courses.html` — 课程详情卡片重写
- `js/dashboard/courses.js` — `DEFAULT_COURSES` 更新
- `contact.html` — 课程复选框更新（6门）
- `teacher-dashboard.html` — 学生筛选/表单/班级表单下拉选项更新

---

## 课程页面布局与配图

### 页面结构重排
```
📚 课程体系（课程总览表，原"课程时间总览"改名并移至顶部）
  └── 预约免费试听课气泡链接
🎨 美术课程（4门课详情: 文字左 + 图片右）
✒️ 书法课程（2门课详情: 文字左 + 图片右）
📋 报名流程
```

### 变更要点
- 删除原顶部"课程体系"页面标题 + 介绍段落
- "课程时间总览"表格改名为"课程体系"并移至美术课程上方
- 表底新增圆角气泡链接 → contact.html
- 每个课程卡片：`display: flex` 文字左（flex:2）+ 图片右（flex:1）

### 课程配图
6张图片放入 `images/`：
| 课程 | 文件 |
|------|------|
| 儿童创意画 | `images/儿童创意画.jpg` |
| 中国画 | `images/中国画.jpg` |
| 素描 | `images/素描.jpg` |
| 色彩 | `images/色彩.jpg` |
| 硬笔书法 | `images/硬笔.jpg` |
| 软笔书法 | `images/软笔.jpg` |

图片容器 `.course-image-placeholder`：flex:1 / min-width:200px / height:220px / dashed 边框 → 放入 `<img>` 后 `object-fit: cover`

### CSS 变更
- `.course-detail-vertical`：从 `display:block` 改为 `display:flex`（左文右图）
- 新增 `.course-image-placeholder` 样式
- 响应式：手机端图片自动换行到下排

---

## 首页画室照片

### 关于画室区域
`.about-image` 占位替换为 `.about-gallery` 照片网格：
```html
<div class="about-gallery">
  <div class="about-photo"><img src="images/studio-1.jpg" alt="画室环境" loading="lazy"></div>
</div>
```

### 当前状态
- ✅ `images/studio-1.jpg` — 第1张已添加
- ⏳ `images/studio-2.jpg` — 待补充（1200×800 JPG）
- ⏳ `images/studio-3.jpg` — 待补充（1200×800 JPG）

### 布局
- 桌面：3张并排横列，每张300px高
- 平板：3张并排，240px高
- 手机：纵向堆叠

### CSS 新增
- `.about-gallery` — flex容器
- `.about-photo` — 照片槽 + hover缩放
- 响应式断点覆盖

---

## 作品管理手机端修复

### 问题
教师端作品管理，手机上传只能拍照、不能从相册选择。

### 根因
`teacher-dashboard.html` 第 410 行 file input 带了 `capture="environment"` 属性，强制打开后置摄像头。

### 修复
```diff
- <input type="file" id="a-image-file" accept="image/*" capture="environment" style="display:none;">
+ <input type="file" id="a-image-file" accept="image/*" style="display:none;">
```

---

## Git 提交记录（本次会话）

- `037d137` feat: 重构课程体系 — 新增中国画/色彩，统一120分钟/周，竖向布局，移动课程体系表至顶部
- `5866d1e` feat: 课程介绍页添加6门课程配图（文字左+图片右布局）
- `a5fe4aa` fix: 作品管理手机端支持相册上传（移除capture属性）

---

## 待办提醒

- [[studio-photos-todo]] — 画室照片 studio-2.jpg / studio-3.jpg 待补充
