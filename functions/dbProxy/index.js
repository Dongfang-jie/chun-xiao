/*
  数据库代理云函数
  使用 @cloudbase/node-sdk（Web 端云函数，非微信小程序）
  以管理员权限代理数据库读写，完全绕过集合安全规则
*/
const cloudbase = require('@cloudbase/node-sdk');

// 使用云函数环境注入的临时凭证（TENCENTCLOUD_SECRETID/KEY/SESSIONTOKEN）
// 这些凭证具有管理员权限，可以完全绕过数据库安全规则
// SYMBOL_CURRENT_ENV 不会自动绑定凭证，需显式传入
const app = cloudbase.init({
  env: 'chunxiao-d8ghfaw3y0781da11',
  secretId: process.env.TENCENTCLOUD_SECRETID,
  secretKey: process.env.TENCENTCLOUD_SECRETKEY,
  sessionToken: process.env.TENCENTCLOUD_SESSIONTOKEN
});

const db = app.database();

// API Key 认证 — 仅对 HTTP 访问服务生效（callFunction 自带 CloudBase Auth）
const API_KEY = process.env.DB_PROXY_API_KEY || 'chunxiao-dbproxy-2026';

function isHttpAccess(event) {
  // HTTP 访问服务: event.body 是 JSON 字符串, event.headers 存在
  // callFunction: event 直接是数据对象
  return typeof event.body === 'string' && event.headers;
}

function checkHttpAuth(event) {
  var headers = event.headers || {};
  var token = headers['x-api-key'] || headers['X-API-Key'] || '';
  return token === API_KEY;
}

exports.main = async (event, context) => {
  // HTTP 访问服务需要 API Key 认证
  if (isHttpAccess(event) && !checkHttpAuth(event)) {
    return { success: false, message: '未授权访问：缺少有效的 API Key' };
  }
  // 兼容 HTTP 访问服务模式：event.body 是 JSON 字符串，需要解析
  var body = event;
  if (typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch (_) { body = event; }
  }
  const { action, collection, items } = body;

  try {
    // 一次性备份全部 10 个集合（供 GitHub Actions 脚本调用）
    if (action === 'backupAll') {
      const COLLECTIONS = [
        'students', 'classes', 'attendance', 'records', 'corrections',
        'artworks', 'announcements', 'inquiries', 'renewals', 'courses'
      ];

      const backup = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'CloudBase 云函数自动备份 (dbProxy)',
        collections: {}
      };

      let totalItems = 0;
      const failed = [];

      for (const colName of COLLECTIONS) {
        const key = 'chunxiao-' + (colName === 'corrections' ? 'lesson-corrections' : colName);
        try {
          const res = await db.collection(colName).where({ _type: '_sync' }).get();

          if (res.data && res.data.length > 0 && res.data[0].items) {
            backup.collections[key] = res.data[0].items;
            totalItems += res.data[0].items.length;
          } else {
            backup.collections[key] = [];
          }
        } catch (e) {
          backup.collections[key] = [];
          const isNotExist = e.message && (
            e.message.indexOf('not exist') >= 0 ||
            e.message.indexOf('not found') >= 0 ||
            e.message.indexOf('does not exist') >= 0
          );
          if (!isNotExist) {
            failed.push({ collection: colName, error: e.message || String(e) });
          }
        }
      }

      return {
        success: failed.length === 0,
        totalItems: totalItems,
        totalCollections: COLLECTIONS.length,
        failed: failed,
        backup: backup
      };
    }

    if (action === 'notify') {
      // 微信通知转发 — 通过 ServerChan 发送预约提醒
      // ServerChan Key 存储在云函数环境变量，不暴露到客户端
      var serverKey = process.env.SERVERCHAN_KEY || '';
      if (!serverKey) {
        return { success: false, message: '通知服务未配置' };
      }
      var notifyTitle = body.title || '';
      var notifyContent = body.content || '';
      if (!notifyTitle || !notifyContent) {
        return { success: false, message: '标题和内容不能为空' };
      }
      try {
        var https = require('https');
        var qs = require('querystring');
        var postData = qs.stringify({ title: notifyTitle, desp: notifyContent });
        var notifyResult = await new Promise(function (resolve, reject) {
          var req = https.request({
            hostname: 'sctapi.ftqq.com',
            path: '/' + serverKey + '.send',
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(postData, 'utf-8')
            },
            timeout: 10000
          }, function (res) {
            var chunks = [];
            res.on('data', function (c) { chunks.push(c); });
            res.on('end', function () {
              resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf-8') });
            });
          });
          req.on('error', function (e) { reject(e); });
          req.on('timeout', function () { req.destroy(); reject(new Error('timeout')); });
          req.write(postData);
          req.end();
        });
        return { success: true, serverStatus: notifyResult.status };
      } catch (e) {
        return { success: false, message: '通知发送失败: ' + (e.message || String(e)) };
      }
    }

    if (action === 'ping') {
      // 诊断：检查凭证和数据库连通性
      var hasSecretId = !!process.env.TENCENTCLOUD_SECRETID;
      var hasSecretKey = !!process.env.TENCENTCLOUD_SECRETKEY;
      var hasToken = !!process.env.TENCENTCLOUD_SESSIONTOKEN;
      var dbResult = 'unknown';
      try {
        var cnt = await db.collection('students').count();
        dbResult = 'ok, count=' + cnt.total;
        return { success: true, dbResult: dbResult, hasCredentials: hasSecretId && hasSecretKey };
      } catch (e) {
        dbResult = 'denied: ' + (e.message || String(e));
        return { success: false, message: dbResult, hasCredentials: hasSecretId && hasSecretKey, hasToken: hasToken };
      }
    }

    if (action === 'read') {
      const res = await db.collection(collection).where({ _type: '_sync' }).get();
      return { success: true, data: res.data };
    }

    if (action === 'write') {
      if (!items || items.length === 0) return { success: true };

      // 删除旧文档
      const old = await db.collection(collection).where({ _type: '_sync' }).get();
      for (const doc of old.data) {
        await db.collection(collection).doc(doc._id).remove();
      }

      // 写入新文档
      await db.collection(collection).add({
        _type: '_sync',
        items: items,
        updatedAt: new Date().toISOString()
      });

      return { success: true };
    }

    return { success: false, message: 'unknown action: ' + action };
  } catch (e) {
    return { success: false, message: String(e) };
  }
};
