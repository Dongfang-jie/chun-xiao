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

exports.main = async (event, context) => {
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
