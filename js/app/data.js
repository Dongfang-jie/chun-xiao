/*
  春晓画室 - 数据层
  策略：localStorage 为主 + CloudBase 双向同步（直接数据库访问，匿名登录）
  - 每次页面加载从 CloudBase 拉取，比较时间戳决定用谁的
  - 每次保存本地写 + 标记 _synced + 异步推 CloudBase
  - 推送失败 _synced 已标记 → 下次 pullFromCloud 检测到本地更新 → 自动重试
  - JSON 解析异常时备份损坏数据，防止数据丢失
*/

// ========== JSON 安全解析（异常降级，防止数据损坏扩散） ==========
function safeParseJSON(key, fallback) {
  fallback = fallback || [];
  var raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('❌ JSON 解析失败 (' + key + '):', e.message);
    // 备份损坏数据以便手动恢复
    var backupKey = key + '_corrupted_' + new Date().toISOString().replace(/[:.]/g, '-');
    try { localStorage.setItem(backupKey, raw); } catch (e2) { /* storage full */ }
    // 显示错误提示
    if (typeof SyncBubble !== 'undefined') {
      SyncBubble.show('<strong>数据读取异常</strong> ' + key + '，原始数据已备份至 ' + backupKey, 'error');
    }
    return fallback;
  }
}

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
      { key: 'chunxiao-renewals',           col: _.renewals },
      { key: 'chunxiao-courses',            col: _.courses }
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
    var list = safeParseJSON(key, []);
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
    var list = safeParseJSON(key, []);
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
  },

  // ========== 一键导出全部数据为 JSON（供数据管理页使用） ==========
  exportAllData: function () {
    var keys = [
      'chunxiao-students', 'chunxiao-classes', 'chunxiao-attendance',
      'chunxiao-records', 'chunxiao-lesson-corrections', 'chunxiao-artworks',
      'chunxiao-announcements', 'chunxiao-inquiries', 'chunxiao-renewals',
      'chunxiao-courses'
    ];
    var data = { version: '2.0', exportedAt: new Date().toISOString(), exportedBy: '', collections: {}, syncedTimestamps: {} };
    var user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser() : null;
    if (user) data.exportedBy = user.name || user.email || '';

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var raw = localStorage.getItem(k);
      data.collections[k] = raw ? safeParseJSON(k, []) : [];
      var ts = localStorage.getItem(k + '_synced');
      if (ts) data.syncedTimestamps[k + '_synced'] = ts;
    }
    return data;
  },

  // ========== 一键恢复全部数据（供数据管理页使用） ==========
  importAllData: function (jsonData) {
    if (!jsonData || !jsonData.collections) {
      return { success: false, message: '备份文件格式不正确（缺少 collections 字段）' };
    }
    var keys = Object.keys(jsonData.collections);
    var restored = 0;
    var now = new Date().toISOString();

    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var items = jsonData.collections[k];
      if (!Array.isArray(items)) continue;
      localStorage.setItem(k, JSON.stringify(items));
      var ts = (jsonData.syncedTimestamps && jsonData.syncedTimestamps[k + '_synced']) || now;
      localStorage.setItem(k + '_synced', ts);
      restored++;

      // 异步推送到 CloudBase
      var col = null;
      var map = {
        'chunxiao-students': 'students', 'chunxiao-classes': 'classes',
        'chunxiao-attendance': 'attendance', 'chunxiao-records': 'records',
        'chunxiao-lesson-corrections': 'corrections', 'chunxiao-artworks': 'artworks',
        'chunxiao-announcements': 'announcements', 'chunxiao-inquiries': 'inquiries',
        'chunxiao-renewals': 'renewals', 'chunxiao-courses': 'courses'
      };
      col = map[k];
      if (col) {
        DataStore._pushToCloud(col, k);
      }
    }
    return { success: true, message: '成功恢复 ' + restored + ' 个数据集合', count: restored };
  }
};

// ========== 数据操作方法 ==========
// 每次保存：立即写 localStorage + 标记 _synced + 异步推 CloudBase
// _synced 在保存时立即标记，确保推送失败后下次 pullFromCloud 能检测并重试
// 所有读取使用 safeParseJSON 防止 JSON 损坏导致数据丢失

function getStudents() {
  return safeParseJSON('chunxiao-students', []);
}
function saveStudents(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
  localStorage.setItem('chunxiao-students_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.students, 'chunxiao-students');
}

function getClasses() {
  return safeParseJSON('chunxiao-classes', []);
}
function saveClasses(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-classes', JSON.stringify(list));
  localStorage.setItem('chunxiao-classes_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.classes, 'chunxiao-classes');
}

function getAttendance() {
  return safeParseJSON('chunxiao-attendance', []);
}
function saveAttendance(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-attendance', JSON.stringify(list));
  localStorage.setItem('chunxiao-attendance_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.attendance, 'chunxiao-attendance');
}

function getRecords() {
  return safeParseJSON('chunxiao-records', []);
}
function saveRecords(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-records', JSON.stringify(list));
  localStorage.setItem('chunxiao-records_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.records, 'chunxiao-records');
}

function getLessonCorrections() {
  return safeParseJSON('chunxiao-lesson-corrections', []);
}
function saveLessonCorrections(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-lesson-corrections', JSON.stringify(list));
  localStorage.setItem('chunxiao-lesson-corrections_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.corrections, 'chunxiao-lesson-corrections');
}

function getArtworks() {
  return safeParseJSON('chunxiao-artworks', []);
}
function saveArtworks(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-artworks', JSON.stringify(list));
  localStorage.setItem('chunxiao-artworks_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.artworks, 'chunxiao-artworks');
}

function getAnnouncements() {
  return safeParseJSON('chunxiao-announcements', []);
}
function saveAnnouncements(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-announcements', JSON.stringify(list));
  localStorage.setItem('chunxiao-announcements_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.announcements, 'chunxiao-announcements');
}

function getInquiries() {
  return safeParseJSON('chunxiao-inquiries', []);
}
function saveInquiries(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-inquiries', JSON.stringify(list));
  localStorage.setItem('chunxiao-inquiries_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.inquiries, 'chunxiao-inquiries');
}

function getRenewals() {
  return safeParseJSON('chunxiao-renewals', []);
}
function saveRenewals(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-renewals', JSON.stringify(list));
  localStorage.setItem('chunxiao-renewals_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.renewals, 'chunxiao-renewals');
}

function getCourses() {
  return safeParseJSON('chunxiao-courses', DEFAULT_COURSES);
}
function saveCourses(list) {
  var now = new Date().toISOString();
  localStorage.setItem('chunxiao-courses', JSON.stringify(list));
  localStorage.setItem('chunxiao-courses_synced', now);
  DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.courses, 'chunxiao-courses');
}

// DEFAULT_COURSES 作为兜底（当 courses 数据全部丢失时）
var DEFAULT_COURSES = [
  { name: '儿童创意画', age: '4岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '中国画',     age: '8岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '素描',       age: '10岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '色彩',       age: '10岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '硬笔书法',   age: '6岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '软笔书法',   age: '6岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' }
];
