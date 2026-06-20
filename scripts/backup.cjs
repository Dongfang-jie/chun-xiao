/*
  春晓画室 - CloudBase 数据自动备份脚本
  使用 @cloudbase/js-sdk 匿名登录直连数据库（与浏览器端方式一致）
  用法: node scripts/backup.cjs
  依赖: Node.js 18+, @cloudbase/js-sdk
*/

'use strict';

const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
const ENV_ID = 'chunxiao-d8ghfaw3y0781da11';
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUP_AGE_DAYS = 30;

// 10 个数据集合 — 输出使用 localStorage key，查询使用 CloudBase 集合名
const COLLECTIONS = [
  { key: 'chunxiao-students',           col: 'students' },
  { key: 'chunxiao-classes',            col: 'classes' },
  { key: 'chunxiao-attendance',         col: 'attendance' },
  { key: 'chunxiao-records',            col: 'records' },
  { key: 'chunxiao-lesson-corrections', col: 'corrections' },
  { key: 'chunxiao-artworks',           col: 'artworks' },
  { key: 'chunxiao-announcements',      col: 'announcements' },
  { key: 'chunxiao-inquiries',          col: 'inquiries' },
  { key: 'chunxiao-renewals',           col: 'renewals' },
  { key: 'chunxiao-courses',            col: 'courses' }
];

// ========== Node.js polyfills（js-sdk 需要的浏览器 API） ==========

// localStorage
class NodeStorage {
  constructor() { this._data = new Map(); }
  getItem(key) { return this._data.get(key) || null; }
  setItem(key, value) { this._data.set(key, value); }
  removeItem(key) { this._data.delete(key); }
  clear() { this._data.clear(); }
  get length() { return this._data.size; }
  key(index) { return Array.from(this._data.keys())[index] || null; }
}

// XMLHttpRequest（js-sdk 内部可能用于网络请求）
class NodeXMLHttpRequest {
  constructor() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.onreadystatechange = null;
    this._method = 'GET';
    this._url = '';
    this._headers = {};
    this._body = null;
  }
  open(method, url) {
    this._method = method;
    this._url = url;
    this.readyState = 1;
  }
  setRequestHeader(key, value) {
    this._headers[key] = value;
  }
  send(body) {
    this._body = body;
    const self = this;
    (async () => {
      try {
        const opts = { method: self._method, headers: self._headers };
        if (body) opts.body = body;
        const res = await fetch(self._url, opts);
        self.status = res.status;
        self.responseText = await res.text();
        self.readyState = 4;
        if (self.onreadystatechange) self.onreadystatechange();
      } catch (e) {
        self.status = 0;
        self.responseText = '';
        self.readyState = 4;
        if (self.onreadystatechange) self.onreadystatechange();
      }
    })();
  }
}

// 注入全局
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = new NodeStorage();
if (typeof globalThis.XMLHttpRequest === 'undefined') globalThis.XMLHttpRequest = NodeXMLHttpRequest;
if (typeof globalThis.btoa === 'undefined') globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
if (typeof globalThis.atob === 'undefined') globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

// ========== 工具函数 ==========

function todayStr() {
  const bj = new Date(Date.now() + 8 * 3600000);
  return bj.toISOString().slice(0, 10);
}

// ========== 主流程 ==========

async function main() {
  console.log('🌸 春晓画室 - 数据自动备份');
  console.log('================================');
  console.log('');

  // 1. 初始化 CloudBase SDK
  console.log('🔌 初始化 CloudBase SDK...');
  const cloudbase = require('@cloudbase/js-sdk');

  const app = cloudbase.init({ env: ENV_ID });
  const db = app.database();
  const auth = app.auth({ persistence: 'local' });

  // 2. 匿名登录
  console.log('🔑 匿名登录...');
  try {
    const loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.signInAnonymously();
      console.log('   ✅ 匿名登录成功');
    } else {
      console.log('   ✅ 已有登录态');
    }
  } catch (e) {
    console.error('   ❌ 登录失败:', e.message);
    process.exit(1);
  }
  console.log('');

  // 3. 拉取全部集合
  const backup = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    exportedBy: 'GitHub Actions 自动备份',
    collections: {}
  };

  let totalItems = 0;
  const failedCollections = [];

  for (let i = 0; i < COLLECTIONS.length; i++) {
    const col = COLLECTIONS[i];
    try {
      process.stdout.write('📥 拉取 ' + col.key + '... ');
      const res = await db.collection(col.col).where({ _type: '_sync' }).get();

      if (res.data && res.data.length > 0 && res.data[0].items) {
        const items = res.data[0].items;
        backup.collections[col.key] = items;
        totalItems += items.length;
        console.log('✅ ' + items.length + ' 条');
      } else {
        backup.collections[col.key] = [];
        console.log('⚠️ 无数据');
      }
    } catch (e) {
      // 集合不存在 → 视为空（CloudBase 懒创建，首次写入才建表）
      if (e.message && e.message.indexOf('not exist') >= 0) {
        backup.collections[col.key] = [];
        console.log('⚠️ 集合未创建（视为空）');
      } else {
        console.error('❌ 失败: ' + e.message);
        backup.collections[col.key] = [];
        failedCollections.push(col.key);
      }
    }
  }

  console.log('');
  console.log('📊 总计: ' + totalItems + ' 条记录');
  if (failedCollections.length > 0) {
    console.log('⚠️  失败集合: ' + failedCollections.join(', '));
  }
  console.log('');

  // 4. 写入备份文件
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const date = todayStr();
  const backupFile = path.join(BACKUP_DIR, 'data-' + date + '.json');
  const latestFile = path.join(BACKUP_DIR, 'latest.json');

  const json = JSON.stringify(backup, null, 2);
  fs.writeFileSync(backupFile, json, 'utf-8');
  fs.writeFileSync(latestFile, json, 'utf-8');

  const sizeKB = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1);
  console.log('💾 备份已保存: backups/data-' + date + '.json (' + sizeKB + ' KB)');
  console.log('💾 最新备份: backups/latest.json');
  console.log('');

  // 5. 清理旧备份
  let files;
  try {
    files = fs.readdirSync(BACKUP_DIR).filter(function(f) { return f.startsWith('data-') && f.endsWith('.json'); });
  } catch (e) { files = []; }

  const cutoff = Date.now() - MAX_BACKUP_AGE_DAYS * 86400000;
  let cleaned = 0;

  for (let i = 0; i < files.length; i++) {
    const fp = path.join(BACKUP_DIR, files[i]);
    let stat;
    try { stat = fs.statSync(fp); } catch (e) { continue; }
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log('🧹 清理了 ' + cleaned + ' 个过期备份（>' + MAX_BACKUP_AGE_DAYS + '天）');
  }

  // 6. 登出
  try { await auth.signOut(); } catch (e) { /* ignore */ }

  console.log('');
  if (failedCollections.length > 0) {
    console.error('❌ 部分集合备份失败');
    process.exit(1);
  } else {
    console.log('✅ 备份完成');
  }
}

main().catch(function(e) {
  console.error('❌ 备份脚本异常:', e.message);
  console.error(e.stack);
  process.exit(1);
});
