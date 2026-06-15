/*
  数据库代理云函数 - 以管理员权限读写，绕过集合安全规则
  前端调用 cloud.callFunction({ name: 'dbProxy', data: { action, collection, items } })
*/
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

exports.main = async (event, context) => {
  const { action, collection, items } = event;

  try {
    if (action === 'read') {
      const res = await db.collection(collection).where({ _type: '_sync' }).get();
      return { success: true, data: res.data };
    }

    if (action === 'write') {
      if (!items || items.length === 0) {
        return { success: true, message: 'no items' };
      }
      const old = await db.collection(collection).where({ _type: '_sync' }).get();
      for (const doc of old.data) {
        try { await db.collection(collection).doc(doc._id).remove(); } catch (e) {}
      }
      const addRes = await db.collection(collection).add({
        _type: '_sync',
        items: items,
        updatedAt: new Date().toISOString()
      });
      return { success: true, id: addRes.id || addRes._id };
    }

    return { success: false, message: 'unknown action' };
  } catch (e) {
    return { success: false, message: e.message || e.code || String(e) };
  }
};
