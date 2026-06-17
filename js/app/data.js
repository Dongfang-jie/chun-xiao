/*
  春晓画室 - 数据层
  策略：localStorage 为主，CloudBase 为备份
  get 函数同步返回（读本地缓存）
  save 函数本地存储 + 异步推 CloudBase
*/

var DataStore = {
  // ========== 从 CloudBase 拉取全部数据（仅首次/数据为空时） ==========
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
      // 本地已有数据 → 跳过，本地优先
      if (localStorage.getItem(m.key)) continue;

      try {
        var res = await db.collection(m.col).where({ _type: '_sync' }).get();
        if (res.data && res.data.length > 0 && res.data[0].items) {
          localStorage.setItem(m.key, JSON.stringify(res.data[0].items));
        }
      } catch (e) {
        console.warn('CloudBase 拉取失败:', m.col, e.message);
      }
    }
  },

  // ========== 单个集合推送到 CloudBase ==========
  _pushToCloud: async function (collection, key) {
    var db = getDB();
    if (!db) return;
    var list = JSON.parse(localStorage.getItem(key) || '[]');

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
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('CloudBase 推送失败:', collection, e.message);
    }
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
