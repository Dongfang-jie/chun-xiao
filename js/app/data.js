/*
  春晓画室 - 数据层
  策略：localStorage 为主 + CloudBase 双向同步（直接数据库访问，匿名登录）
  - 每次页面加载从 CloudBase 拉取，比较时间戳决定用谁的
  - 每次保存本地写 + 标记 _synced + 异步推 CloudBase
  - 推送失败 _synced 已标记 → 下次 pullFromCloud 检测到本地更新 → 自动重试
*/

var DataStore = {
  // ========== 通过云函数 dbProxy 访问数据库（绕过安全规则） ==========
  // 优先尝试 SDK callFunction，失败则回退到 HTTP fetch
  _callDbProxy: async function (action, collection, items) {
    // 方式1：SDK callFunction
    var app = getApp();
    if (app) {
      try {
        var data = { action: action, collection: collection };
        if (action === 'write' && items) { data.items = items; }
        var result = await app.callFunction({
          name: 'dbProxy',
          data: data
        });
        if (result && result.result) {
          console.log('🔧 dbProxy(callFunction) ' + action + ' 成功:', collection);
          return result.result;
        }
        if (result) console.warn('⚠️ dbProxy callFunction 返回异常:', collection, JSON.stringify(result).substring(0, 200));
      } catch (e) {
        console.warn('dbProxy callFunction 失败:', collection, e.message);
      }
    }

    // 方式2：HTTP fetch 回退（绕过 SDK callFunction 的网络问题）
    var url = CLOUDBASE_CONFIG.dbProxyUrl;
    if (!url) return null;

    try {
      var httpData = { action: action, collection: collection };
      if (action === 'write' && items) { httpData.items = items; }

      var response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(httpData)
      });
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      var wrapper = await response.json();
      // CloudBase HTTP 服务包装格式: { statusCode, headers, body: "JSON字符串" }
      var parsed;
      if (wrapper && typeof wrapper.body === 'string') {
        parsed = JSON.parse(wrapper.body);
      } else {
        parsed = wrapper;
      }
      console.log('🔧 dbProxy(HTTP) ' + action + ' 成功:', collection);
      return parsed;
    } catch (e) {
      console.warn('dbProxy HTTP 调用失败:', collection, e.message);
      return null;
    }
  },

  // ========== 从 CloudBase 拉取数据（每次加载都检查，比较时间戳） ==========
  pullFromCloud: async function () {
    var app = getApp();
    if (!app) return;
    var db = getDB();
    if (!db) return;

    try {
      var auth = getAuth();
      if (auth) {
        var loginState = await auth.getLoginState();
        if (!loginState) await auth.signInAnonymously();
      }
    } catch (e) {
      console.warn('CloudBase 登录失败，使用本地数据');
      return;
    }

    // 诊断：测试数据库直连
    try {
      var pingRes = await db.collection('students').where({ _type: '_sync' }).get();
      console.log('🔍 数据库直连: ✅ 可读');
    } catch (e) {
      console.warn('🔍 数据库直连失败:', e.message);
    }

    // dbProxy 后备通道（仅直接数据库失败时才触发，不提前测试）
    var dbProxyOk = false;

    var _ = CLOUDBASE_CONFIG.collections;
    var map = [
      { key: 'chunxiao-students',           col: _.students },
      { key: 'chunxiao-classes',            col: _.classes },
      { key: 'chunxiao-attendance',         col: _.attendance },
      { key: 'chunxiao-records',            col: _.records },
      { key: 'chunxiao-lesson-corrections', col: _.corrections },
      { key: 'chunxiao-artworks',           col: _.artworks },
      { key: 'chunxiao-announcements',      col: _.announcements },
      { key: 'chunxiao-inquiries',          col: _.inquiries },
      { key: 'chunxiao-renewals',           col: _.renewals }
    ];

    for (var i = 0; i < map.length; i++) {
      var m = map[i];
      var localTime = localStorage.getItem(m.key + '_synced') || '';
      var localHasData = !!localStorage.getItem(m.key);
      var directDbFailed = false;
      var cloudDataNewer = false;  // 标记：云端数据是否比本地新（已更新 localStorage）

      // 尝试直接数据库读取
      try {
        var res = await db.collection(m.col).where({ _type: '_sync' }).get();

        if (res.data && res.data.length > 0) {
          var doc = res.data[0];
          if (doc.items) {
            var cloudTime = doc.updatedAt || '';

            // 迁移：本地有数据但无 _synced（旧版本遗留）→ 本地优先，不覆盖
            var isLegacyData = localHasData && !localTime;

            if (!isLegacyData) {
              // 正常：云端比本地新 → 用云端数据
              if (!localTime || cloudTime > localTime) {
                localStorage.setItem(m.key, JSON.stringify(doc.items));
                localStorage.setItem(m.key + '_synced', cloudTime);
                cloudDataNewer = true;
                console.log('☁️ 云端更新 → 本地:', m.col);
                if (typeof SyncBubble !== 'undefined') SyncBubble.pullOk(m.col, doc.items.length);
              }
            } else {
              console.log('📦 检测到旧版本数据，本地优先 → 将推送至云端:', m.col);
            }
          }
        }
      } catch (e) {
        directDbFailed = true;
        console.warn('⚠️ 直接数据库读取失败 (' + m.col + '):', e.message);

        // 回退到 dbProxy 云函数读取（绕过安全规则）
        if (dbProxyOk) {
          console.log('🔄 尝试 dbProxy 云函数拉取:', m.col);
          try {
            var fnRes = await DataStore._callDbProxy('read', m.col);
            if (fnRes && fnRes.success && fnRes.data && fnRes.data.length > 0) {
              var fnDoc = fnRes.data[0];
              if (fnDoc.items) {
                var fnCloudTime = fnDoc.updatedAt || '';
                var isLegacyData = localHasData && !localTime;
                if (!isLegacyData) {
                  if (!localTime || fnCloudTime > localTime) {
                    localStorage.setItem(m.key, JSON.stringify(fnDoc.items));
                    localStorage.setItem(m.key + '_synced', fnCloudTime);
                    cloudDataNewer = true;
                    console.log('☁️ 云端更新 → 本地(via dbProxy):', m.col);
                    if (typeof SyncBubble !== 'undefined') SyncBubble.pullOk(m.col, fnDoc.items.length);
                  }
                }
              }
            }
          } catch (e2) {
            console.warn('CloudBase 拉取失败(dbProxy):', m.col, e2.message);
          }
        }
      }

      // 本地有数据且比云端新 → 推送本地到云端
      var localData = localStorage.getItem(m.key);
      if (localData) {
        var localTime2 = localStorage.getItem(m.key + '_synced') || '';
        var shouldPush = false;
        var shouldPushViaFn = false;

        if (!directDbFailed) {
          // 直接数据库可用：查询云端时间戳做对比
          try {
            var checkRes = await db.collection(m.col).where({ _type: '_sync' }).get();

            if (!checkRes.data || checkRes.data.length === 0) {
              shouldPush = true;  // 云端无数据 → 推送
            } else {
              var ct = checkRes.data[0].updatedAt || '';
              if (!localTime2 || localTime2 > ct) {
                shouldPush = true;  // 本地更新 → 推送
              }
            }
          } catch (e) {
            // 查询失败 → 有 dbProxy 就通过它推送
            shouldPushViaFn = dbProxyOk;
            if (!dbProxyOk) console.warn('⚠️ 无法检查云端时间戳且 dbProxy 不可达:', m.col);
          }
        } else {
          // 直接数据库已失败，需通过云函数
          // 关键：如果 dbProxy 拉取时发现云端更新（cloudDataNewer=true），则不推送
          if (cloudDataNewer) {
            // 云端数据已更新到本地，无需再推送
            console.log('⏭️ 云端数据更新，跳过推送:', m.col);
          } else if (dbProxyOk) {
            // 云端无数据或本地更新 → 推送
            shouldPushViaFn = true;
          } else {
            console.warn('⚠️ 直接数据库不可用且 dbProxy 不可达，无法推送:', m.col);
          }
        }

        if (shouldPush) {
          var directOk = await DataStore._pushToCloudDirect(m.col, m.key, localData);
          if (!directOk) {
            console.log('🔄 直接推送失败，尝试 dbProxy 云函数:', m.col);
            if (dbProxyOk) await DataStore._pushToCloudViaFn(m.col, m.key, localData);
          }
        } else if (shouldPushViaFn) {
          await DataStore._pushToCloudViaFn(m.col, m.key, localData);
        }
      }
    }
  },

  // ========== 直接推送到 CloudBase（内部方法，pull时也会调用） ==========
  // 返回 true=成功, false=失败（调用方可据此决定是否重试）
  _pushToCloudDirect: async function (collection, key, rawData) {
    var db = getDB();
    if (!db) return false;
    var list = JSON.parse(rawData || localStorage.getItem(key) || '[]');
    var now = new Date().toISOString();

    try {
      // 删旧写新
      var old = await db.collection(collection).where({ _type: '_sync' }).get();
      if (old.data) {
        for (var i = 0; i < old.data.length; i++) {
          try { await db.collection(collection).doc(old.data[i]._id).remove(); } catch (e) {}
        }
      }
      await db.collection(collection).add({
        _type: '_sync',
        items: list,
        updatedAt: now
      });
      // 推送成功：_synced 更新为推送完成时间
      localStorage.setItem(key + '_synced', now);
      console.log('📤 已推送:', collection, list.length + '条');
      if (typeof SyncBubble !== 'undefined') SyncBubble.pushOk(collection, list.length);
      return true;
    } catch (e) {
      console.warn('⚠️ 直接数据库推送失败 (' + collection + '):', e.message);
      return false;
    }
  },

  // ========== 通过 dbProxy 云函数推送（绕过安全规则，回退方案） ==========
  _pushToCloudViaFn: async function (collection, key, rawData) {
    var list = JSON.parse(rawData || localStorage.getItem(key) || '[]');
    var now = new Date().toISOString();

    console.log('🔄 通过 dbProxy 云函数推送:', collection);
    try {
      var result = await DataStore._callDbProxy('write', collection, list);
      if (result && result.success) {
        localStorage.setItem(key + '_synced', now);
        console.log('📤 已推送(via dbProxy):', collection, list.length + '条');
        if (typeof SyncBubble !== 'undefined') SyncBubble.pushOk(collection, list.length);
        return true;
      } else {
        console.warn('❌ dbProxy 推送失败:', collection, result ? result.message : '无响应');
        if (typeof SyncBubble !== 'undefined') SyncBubble.pushFail(collection, result ? result.message : '无响应');
        return false;
      }
    } catch (e) {
      console.warn('❌ dbProxy 推送异常:', collection, e.message);
      return false;
    }
  },

  // ========== 单个集合推送到 CloudBase（带自动重试） ==========
  _pushToCloud: async function (collection, key, attempt) {
    attempt = attempt || 0;
    var rawData = localStorage.getItem(key);
    if (!rawData) return;

    var ok = await DataStore._pushToCloudDirect(collection, key, rawData);
    if (!ok) {
      ok = await DataStore._pushToCloudViaFn(collection, key, rawData);
    }
    if (!ok && attempt < 2) {
      console.warn('🔄 推送失败，3秒后重试 (' + (attempt + 1) + '/2):', collection);
      setTimeout(function () {
        DataStore._pushToCloud(collection, key, attempt + 1);
      }, 3000);
    }
    if (!ok && attempt >= 2) {
      console.error('❌ 推送最终失败（3次重试耗尽）:', collection);
      if (typeof SyncBubble !== 'undefined') {
        var label = (typeof collectionMap === 'function') ? collectionMap(collection) : collection;
        SyncBubble.show('<strong>推送失败</strong> ' + (label || collection) + '（3次重试耗尽，下次页面加载时自动重试）', 'error');
      }
    }
  }
};

// ========== 数据操作方法 ==========
// 每次保存：立即写 localStorage + 标记 _synced + 异步推 CloudBase
// _synced 在保存时立即标记，确保推送失败后下次 pullFromCloud 能检测并重试

function getStudents() {
  return JSON.parse(localStorage.getItem('chunxiao-students') || '[]');
}
function saveStudents(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
  localStorage.setItem('chunxiao-students_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.students, 'chunxiao-students');
}

function getClasses() {
  return JSON.parse(localStorage.getItem('chunxiao-classes') || '[]');
}
function saveClasses(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-classes', JSON.stringify(list));
  localStorage.setItem('chunxiao-classes_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.classes, 'chunxiao-classes');
}

function getAttendance() {
  return JSON.parse(localStorage.getItem('chunxiao-attendance') || '[]');
}
function saveAttendance(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-attendance', JSON.stringify(list));
  localStorage.setItem('chunxiao-attendance_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.attendance, 'chunxiao-attendance');
}

function getRecords() {
  return JSON.parse(localStorage.getItem('chunxiao-records') || '[]');
}
function saveRecords(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-records', JSON.stringify(list));
  localStorage.setItem('chunxiao-records_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.records, 'chunxiao-records');
}

function getLessonCorrections() {
  return JSON.parse(localStorage.getItem('chunxiao-lesson-corrections') || '[]');
}
function saveLessonCorrections(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-lesson-corrections', JSON.stringify(list));
  localStorage.setItem('chunxiao-lesson-corrections_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.corrections, 'chunxiao-lesson-corrections');
}

function getArtworks() {
  return JSON.parse(localStorage.getItem('chunxiao-artworks') || '[]');
}
function saveArtworks(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-artworks', JSON.stringify(list));
  localStorage.setItem('chunxiao-artworks_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.artworks, 'chunxiao-artworks');
}

function getAnnouncements() {
  return JSON.parse(localStorage.getItem('chunxiao-announcements') || '[]');
}
function saveAnnouncements(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-announcements', JSON.stringify(list));
  localStorage.setItem('chunxiao-announcements_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.announcements, 'chunxiao-announcements');
}

function getInquiries() {
  return JSON.parse(localStorage.getItem('chunxiao-inquiries') || '[]');
}
function saveInquiries(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-inquiries', JSON.stringify(list));
  localStorage.setItem('chunxiao-inquiries_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.inquiries, 'chunxiao-inquiries');
}

function getRenewals() {
  return JSON.parse(localStorage.getItem('chunxiao-renewals') || '[]');
}
function saveRenewals(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-renewals', JSON.stringify(list));
  localStorage.setItem('chunxiao-renewals_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.renewals, 'chunxiao-renewals');
}
