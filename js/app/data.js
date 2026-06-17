/*
  春晓画室 - 数据层
  策略：localStorage 为主 + CloudBase 双向同步
  - 每次页面加载从 CloudBase 拉取，比较时间戳决定用谁的
  - 每次保存本地写 + 异步推 CloudBase + 记录同步时间
  - 多设备切换时自动同步最新数据
*/

var DataStore = {
  // ========== 从 CloudBase 拉取数据（每次加载都检查，比较时间戳） ==========
  pullFromCloud: async function () {
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

      try {
        var res = await db.collection(m.col).where({ _type: '_sync' }).get();
        if (res.data && res.data.length > 0 && res.data[0].items) {
          var cloudTime = res.data[0].updatedAt || '';

          // 云端比本地新 → 用云端数据（另一台设备改过）
          if (!localTime || cloudTime > localTime) {
            localStorage.setItem(m.key, JSON.stringify(res.data[0].items));
            localStorage.setItem(m.key + '_synced', cloudTime);
            console.log('☁️ 云端更新 → 本地:', m.col);
          }
          // 本地比云端新 → 推送本地到云端（本设备离线改过）
          else if (localTime > cloudTime) {
            console.log('📤 本地更新 → 云端:', m.col);
            // 推送在下面统一处理
          }
        }
      } catch (e) {
        console.warn('CloudBase 拉取失败:', m.col, e.message);
      }

      // 如果本地有数据但云端没有（首次推送），则推送
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
            // 本地比云端新（或云端没有时间戳）→ 推送
            if (localTime2 && (!ct || localTime2 > ct)) {
              shouldPush = true;
            }
          }
        } catch (e) {
          // 查询失败也尝试推送
          shouldPush = !!localData;
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
  _pushToCloudDirect: async function (collection, key, rawData) {
    var db = getDB();
    if (!db) return;
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
      // 记录同步时间戳，下次拉取时比较
      localStorage.setItem(key + '_synced', now);
    } catch (e) {
      console.warn('CloudBase 推送失败:', collection, e.message);
    }
  },

  // ========== 单个集合推送到 CloudBase ==========
  _pushToCloud: async function (collection, key) {
    var rawData = localStorage.getItem(key);
    if (!rawData) return;
    await DataStore._pushToCloudDirect(collection, key, rawData);
  }
};

// ========== 数据操作方法 ==========

function getStudents()  { return JSON.parse(localStorage.getItem('chunxiao-students') || '[]'); }
function saveStudents(list)  { localStorage.setItem('chunxiao-students', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.students, 'chunxiao-students'); }

function getClasses()   { return JSON.parse(localStorage.getItem('chunxiao-classes') || '[]'); }
function saveClasses(list)   { localStorage.setItem('chunxiao-classes', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.classes, 'chunxiao-classes'); }

function getAttendance() { return JSON.parse(localStorage.getItem('chunxiao-attendance') || '[]'); }
function saveAttendance(list) { localStorage.setItem('chunxiao-attendance', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.attendance, 'chunxiao-attendance'); }

function getRecords()  { return JSON.parse(localStorage.getItem('chunxiao-records') || '[]'); }
function saveRecords(list)  { localStorage.setItem('chunxiao-records', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.records, 'chunxiao-records'); }

function getLessonCorrections() { return JSON.parse(localStorage.getItem('chunxiao-lesson-corrections') || '[]'); }
function saveLessonCorrections(list) { localStorage.setItem('chunxiao-lesson-corrections', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.corrections, 'chunxiao-lesson-corrections'); }

function getArtworks() { return JSON.parse(localStorage.getItem('chunxiao-artworks') || '[]'); }
function saveArtworks(list) { localStorage.setItem('chunxiao-artworks', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.artworks, 'chunxiao-artworks'); }

function getAnnouncements() { return JSON.parse(localStorage.getItem('chunxiao-announcements') || '[]'); }
function saveAnnouncements(list) { localStorage.setItem('chunxiao-announcements', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.announcements, 'chunxiao-announcements'); }

function getInquiries() { return JSON.parse(localStorage.getItem('chunxiao-inquiries') || '[]'); }
function saveInquiries(list) { localStorage.setItem('chunxiao-inquiries', JSON.stringify(list)); DataStore._pushToCloud(CLOUDBASE_CONFIG.collections.inquiries, 'chunxiao-inquiries'); }
