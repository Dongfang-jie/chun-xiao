/*
  春晓画室 - CloudBase 初始化模块
  环境 ID: chunxiao-d8ghfaw3y0781da11
*/

var CLOUDBASE_CONFIG = {
  env: 'chunxiao-d8ghfaw3y0781da11',
  // 云函数 HTTP 访问地址（绕过 SDK callFunction 的网络问题）
  dbProxyUrl: 'https://chunxiao-d8ghfaw3y0781da11-1443528450.ap-shanghai.app.tcloudbase.com/dbProxy',
  // dbProxy API Key（与云函数环境变量 DB_PROXY_API_KEY 一致）
  dbProxyApiKey: 'chunxiao-dbproxy-2026',
  // 数据集合名（跟 localStorage key 对应）
  collections: {
    students: 'students',
    classes: 'classes',
    attendance: 'attendance',
    records: 'records',
    corrections: 'corrections',
    artworks: 'artworks',
    announcements: 'announcements',
    inquiries: 'inquiries',
    renewals: 'renewals',
    courses: 'courses',
    parents: 'parents'
  }
};

// 初始化 CloudBase
var _app = null;
var _db = null;
var _auth = null;

function getApp() {
  if (!_app) {
    if (typeof cloudbase === 'undefined') {
      console.error('❌ CloudBase SDK 未加载');
      return null;
    }
    _app = cloudbase.init({ env: CLOUDBASE_CONFIG.env });
  }
  return _app;
}

function getDB() {
  if (!_db) {
    var app = getApp();
    if (app) _db = app.database();
  }
  return _db;
}

function getAuth() {
  if (!_auth) {
    var app = getApp();
    if (app) _auth = app.auth({ persistence: 'local' });
  }
  return _auth;
}

// HTML 转义工具函数 — 防止 XSS 攻击
// 使用方式: '&lt;h4&gt;' + escapeHtml(userName) + '&lt;/h4&gt;'
function escapeHtml(str) {
  if (!str) return '';
  if (typeof str !== 'string') str = String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========== 共享常量 ==========

// 星期映射（统一来源，避免 DAY_MAP/DAY_NAMES 在多处重复定义）
var WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
var WEEKDAY_MAP = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };

// localStorage key ↔ CloudBase collection 映射（统一数据源）
// 格式: { key: localStorage键名, col: CloudBase集合名, label: 中文标签 }
var STORAGE_KEY_MAP = [
  { key: 'chunxiao-students',           col: 'students',      label: '学员' },
  { key: 'chunxiao-classes',            col: 'classes',       label: '班级' },
  { key: 'chunxiao-attendance',         col: 'attendance',    label: '考勤' },
  { key: 'chunxiao-records',            col: 'records',       label: '上课记录' },
  { key: 'chunxiao-lesson-corrections', col: 'corrections',   label: '课次调整' },
  { key: 'chunxiao-artworks',           col: 'artworks',      label: '作品' },
  { key: 'chunxiao-announcements',      col: 'announcements', label: '通知' },
  { key: 'chunxiao-inquiries',          col: 'inquiries',     label: '预约' },
  { key: 'chunxiao-renewals',           col: 'renewals',      label: '续费' },
  { key: 'chunxiao-courses',            col: 'courses',       label: '课程设置' }
];

// localStorage key 迁移表（旧 key → 新 key，确保命名统一为 chunxiao- 前缀 + 连字符）
var STORAGE_KEY_MIGRATIONS = {
  'chunxiao_session': 'chunxiao-session',
  'chunxiao_dashboard_subtab': 'chunxiao-dashboard-subtab',
  'chunxiao_dashboard_page': 'chunxiao-dashboard-page'
};

// 页面加载时自动迁移旧 localStorage key
function migrateStorageKeys() {
  var migrated = false;
  Object.keys(STORAGE_KEY_MIGRATIONS).forEach(function (oldKey) {
    var newKey = STORAGE_KEY_MIGRATIONS[oldKey];
    if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey));
      localStorage.removeItem(oldKey);
      migrated = true;
    }
  });
  if (migrated) {
    console.log('🔑 localStorage keys 已迁移至统一命名');
  }
}

// 获取指定集合的 localStorage key
function getStorageKey(collectionName) {
  var entry = STORAGE_KEY_MAP.find(function (m) { return m.col === collectionName; });
  return entry ? entry.key : null;
}

// 获取指定 localStorage key 对应的集合名
function getCollectionName(storageKey) {
  var entry = STORAGE_KEY_MAP.find(function (m) { return m.key === storageKey; });
  return entry ? entry.col : null;
}

/*
 * 脚本加载顺序（依赖链）
 * ===========================
 * 所有页面均需遵循此顺序加载 JS：
 *
 *   1. js/app/config.js       ← CloudBase 初始化、全局常量、工具函数
 *   2. js/app/auth.js          ← 认证模块（依赖 config.js）
 *   3. js/app/data.js          ← 数据层（依赖 config.js, auth.js）
 *   4. js/app/storage.js       ← 云存储（依赖 config.js）
 *   5. js/app/sync-status.js   ← 同步状态 UI（依赖 config.js）
 *   6. js/app/ui.js            ← 公开页 UI（灯箱/深色/回到顶部）
 *   7. js/app/gallery.js       ← 画廊渲染（依赖 config.js, data.js, storage.js）
 *   8. js/dashboard/core.js    ← 仪表盘核心（依赖 config.js, auth.js, data.js）
 *   9. js/dashboard/*.js       ← 各业务模块（依赖 core.js 初始化完成后执行）
 *
 * CloudBase Web SDK 必须在所有自定义脚本之前通过 CDN 加载。
 * 仪表盘页面脚本使用同步加载（<script src>），确保依赖顺序。
 * 公开页面可使用 defer 属性异步加载。
 */
