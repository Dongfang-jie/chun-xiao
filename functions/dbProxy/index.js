/*
  数据库代理云函数
  使用 @cloudbase/node-sdk（Web 端云函数，非微信小程序）
  以管理员权限代理数据库读写，完全绕过集合安全规则
*/
const cloudbase = require('@cloudbase/node-sdk');

// 使用 SYMBOL_CURRENT_ENV 获取云函数自动注入的管理员权限
// 显式 env ID 字符串无法获得 admin 权限，导致数据库操作 PERMISSION_DENIED
const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV
});

const db = app.database();

exports.main = async (event, context) => {
  const { action, collection, items } = event;

  try {
    if (action === 'ping') {
      // 最简单的数据库连通性测试
      try {
        const cnt = await db.collection('students').count();
        return { success: true, count: cnt.total };
      } catch (e) {
        return { success: false, message: 'db access denied: ' + (e.message || String(e)) };
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
