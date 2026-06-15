/*
  数据库代理云函数 - 以管理员权限读写，绕过集合安全规则
  调用方式:
    read: { action: 'read', collection: 'students' }
    write: { action: 'write', collection: 'students', items: [...] }
*/
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event, context) => {
  const { action, collection, items } = event;

  try {
    if (action === 'read') {
      // 读取同步数据
      const res = await db.collection(collection).where({ _type: '_sync' }).get();
      return { success: true, data: res.data };
    }

    if (action === 'write') {
      if (!items || items.length === 0) {
        return { success: true, message: 'no items to sync' };
      }
      // 删除旧的同步文档
      const old = await db.collection(collection).where({ _type: '_sync' }).get();
      for (const doc of old.data) {
        try { await db.collection(collection).doc(doc._id).remove(); } catch (e) {}
      }
      // 写入新的同步文档
      const addRes = await db.collection(collection).add({
        data: {
          _type: '_sync',
          items: items,
          updatedAt: new Date().toISOString()
        }
      });
      return { success: true, id: addRes._id };
    }

    return { success: false, message: 'unknown action: ' + action };
  } catch (e) {
    return { success: false, message: e.message || e.code || 'unknown error' };
  }
};
