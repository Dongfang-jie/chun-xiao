/*
  春晓画室 - CloudBase 初始化模块
  环境 ID: chunxiao-d8ghfaw3y0781da11
*/

var CLOUDBASE_CONFIG = {
  env: 'chunxiao-d8ghfaw3y0781da11',
  // 云函数 HTTP 访问地址（绕过 SDK callFunction 的网络问题）
  // 路径格式与 login.js 中 verify-code 一致，仅末尾函数名不同
  // 如果 404，请到 CloudBase 控制台 → HTTP 访问服务 → 查看 dbProxy 的实际路径并更新此处
  dbProxyUrl: 'https://chunxiao-d8ghfaw3y0781da11-1443528450.ap-shanghai.app.tcloudbase.com/G:/Ruanjian/Git/dbProxy',
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
