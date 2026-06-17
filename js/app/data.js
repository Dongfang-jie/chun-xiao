/*
  春晓画室 - 数据层
  策略：localStorage 为主 + CloudBase 双向同步（通过 dbProxy 云函数，管理员权限）
  - 每次页面加载通过 dbProxy 从 CloudBase 拉取，比较时间戳决定用谁的
  - 每次保存本地写 + 异步通过 dbProxy 推 CloudBase + 记录同步时间
  - dbProxy 以管理员权限运行，完全绕过集合安全规则 → 多设备同步无障碍
*/

var DataStore = {
  // ========== 从 CloudBase 拉取数据（每次加载都检查，比较时间戳） ==========
  pullFromCloud: async function () {
    var app = getApp();
    if (!app) return;

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
        // 通过 dbProxy 云函数读取（管理员权限，不受安全规则限制）
        var res = await app.callFunction({
          name: 'dbProxy',
          data: { action: 'read', collection: m.col }
        });

        if (res.result && res.result.success && res.result.data && res.result.data.length > 0) {
          var doc = res.result.data[0];
          if (doc.items) {
            var cloudTime = doc.updatedAt || '';

            // 云端比本地新 → 用云端数据
            if (!localTime || cloudTime > localTime) {
              localStorage.setItem(m.key, JSON.stringify(doc.items));
              localStorage.setItem(m.key + '_synced', cloudTime);
              console.log('☁️ 云端更新 → 本地:', m.col);
            }
          }
        }
      } catch (e) {
        console.warn('CloudBase 拉取失败:', m.col, e.message);
      }

      // 如果本地有数据且比云端新（或云端为空），则推送
      var localData = localStorage.getItem(m.key);
      if (localData) {
        var localTime2 = localStorage.getItem(m.key + '_synced') || '';
        var shouldPush = false;

        try {
          var checkRes = await app.callFunction({
            name: 'dbProxy',
            data: { action: 'read', collection: m.col }
          });

          if (!checkRes.result || !checkRes.result.success || !checkRes.result.data || checkRes.result.data.length === 0) {
            // 云端没有数据 → 推送
            shouldPush = true;
          } else {
            var ct = checkRes.result.data[0].updatedAt || '';
            if (localTime2 && (!ct || localTime2 > ct)) {
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

  // ========== 通过 dbProxy 云函数推送到 CloudBase ==========
  _pushToCloudDirect: async function (collection, key, rawData) {
    var app = getApp();
    if (!app) return;
    var list = JSON.parse(rawData || localStorage.getItem(key) || '[]');
    var now = new Date().toISOString();

    try {
      var res = await app.callFunction({
        name: 'dbProxy',
        data: { action: 'write', collection: collection, items: list }
      });

      if (res.result && res.result.success) {
        localStorage.setItem(key + '_synced', now);
        console.log('📤 已推送:', collection, list.length + '条');
      } else {
        console.warn('CloudBase 推送失败:', collection, (res.result && res.result.message) || '未知错误');
      }
    } catch (e) {
      console.warn('CloudBase 推送异常:', collection, e.message);
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
