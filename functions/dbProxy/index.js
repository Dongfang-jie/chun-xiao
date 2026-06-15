/*
  数据库代理云函数
*/
const cloud = require('wx-server-sdk');
cloud.init({ env: 'chunxiao-d8ghfaw3y0781da11' });
const db = cloud.database();

exports.main = async (event) => {
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
      const old = await db.collection(collection).where({ _type: '_sync' }).get();
      for (const doc of old.data) {
        await db.collection(collection).doc(doc._id).remove();
      }
      await db.collection(collection).add({
        data: { _type: '_sync', items: items, updatedAt: new Date().toISOString() }
      });
      return { success: true };
    }

    return { success: false, message: 'unknown action: ' + action };
  } catch (e) {
    return { success: false, message: String(e) };
  }
};
