/*
  春晓画室 - CloudBase 初始化模块
  环境 ID: chunxiao-d8ghfaw3y0781da11
*/

var CLOUDBASE_CONFIG = {
  env: 'chunxiao-d8ghfaw3y0781da11',
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
    teachers: 'teachers',
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
