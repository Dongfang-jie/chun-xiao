/*
  春晓画室 - 数据层
  策略：localStorage 为主 + CloudBase 双向同步（直接数据库访问，匿名登录）
  - 每次页面加载从 CloudBase 拉取，比较时间戳决定用谁的
  - 每次保存本地写 + 标记 _synced + 异步推 CloudBase
  - 推送失败 _synced 已标记 → 下次 pullFromCloud 检测到本地更新 → 自动重试
*/

var DataStore = {
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
      console.log('🔍 数据库直连测试:', pingRes.data && pingRes.data.length > 0 ? '✅ 可读' : '⚠️ 无数据');
    } catch (e) {
      console.error('🔍 数据库直连失败:', e.message);
    }

    var _ = CLOUDBASE_CONFIG.collections;
    var map = [
      { key: 'chunxiao-students',           col: _.students },
      { key: 'chunxiao-classes',            col: _.classes },
      { key: 'chunxiao-attendance',         col: _.attendance },
      { key: 'chunxiao-records',            col: _.records },
      { key: 'chunxiao-lesson-corrections', col: _.corrections },
      { key: 'chunxiao-artworks',           col: _.artworks },
      { key: 'chunxiao-announcements',      col: _.announcements },
      { key: 'chunxiao-inquiries',          col: _.inquiries }
    ];

    for (var i = 0; i < map.length; i++) {
      var m = map[i];
      var localTime = localStorage.getItem(m.key + '_synced') || '';
      var localHasData = !!localStorage.getItem(m.key);

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
                console.log('☁️ 云端更新 → 本地:', m.col);
              }
            } else {
              // 旧数据迁移：标记本地时间，触发下方推送（上传到云端）
              console.log('📦 检测到旧版本数据，本地优先 → 将推送至云端:', m.col);
            }
          }
        }
      } catch (e) {
        console.warn('CloudBase 拉取失败:', m.col, e.message);
      }

      // 本地有数据且比云端新 → 推送本地到云端
      var localData = localStorage.getItem(m.key);
      if (localData) {
        var localTime2 = localStorage.getItem(m.key + '_synced') || '';
        var shouldPush = false;

        try {
          var checkRes = await db.collection(m.col).where({ _type: '_sync' }).get();

          if (!checkRes.data || checkRes.data.length === 0) {
            // 云端没有数据 → 推送
            shouldPush = true;
          } else {
            var ct = checkRes.data[0].updatedAt || '';
            // 本地 _synced 比云端 updatedAt 新 → 推送
            // 或者本地有数据但无 _synced（旧数据迁移）→ 推送
            if (!localTime2 || localTime2 > ct) {
              shouldPush = true;
            }
          }
        } catch (e) {
          // 查询失败，有本地数据就尝试推送
          shouldPush = true;
        }

        if (shouldPush) {
          try {
            await DataStore._pushToCloudDirect(m.col, m.key, localData);
          } catch (e) {
            console.warn('CloudBase 自动推送失败:', m.col, e.message);
          }
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
      return true;
    } catch (e) {
      console.warn('CloudBase 推送失败:', collection, e.message);
      return false;
    }
  },

  // ========== 单个集合推送到 CloudBase（带自动重试） ==========
  _pushToCloud: async function (collection, key, attempt) {
    attempt = attempt || 0;
    var rawData = localStorage.getItem(key);
    if (!rawData) return;

    var ok = await DataStore._pushToCloudDirect(collection, key, rawData);
    if (!ok && attempt < 2) {
      console.warn('🔄 推送失败，3秒后重试 (' + (attempt + 1) + '/2):', collection);
      setTimeout(function () {
        DataStore._pushToCloud(collection, key, attempt + 1);
      }, 3000);
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
