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
