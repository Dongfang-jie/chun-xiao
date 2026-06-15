/*
  春晓画室 - CloudBase 数据同步层
  本地 localStorage 缓存 + 云函数代理（管理员权限，绕过安全规则）
  get 函数同步返回（读缓存），save 函数本地+远程双写
*/

// 页面上的同步状态显示
function showSyncStatus(msg, color) {
  var el = document.getElementById('cloudbase-sync-status');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cloudbase-sync-status';
    el.style.cssText = 'position:fixed; bottom:12px; right:12px; background:#333; color:#fff; padding:8px 14px; border-radius:8px; font-size:0.8em; z-index:9999; max-width:90vw; word-break:break-all; opacity:0.9;';
    document.body.appendChild(el);
  }
  el.style.background = color || '#333';
  el.textContent = msg;
  el.style.display = 'block';
  if (color === '#2e7d32') {
    setTimeout(function() { el.style.display = 'none'; }, 5000);
  }
}

var DataStore = {
  _collections: CLOUDBASE_CONFIG.collections,

  // ========== 调用云函数（管理员权限，绕过集合安全规则） ==========
  _callFunction: async function (data) {
    var app = getApp();
    if (!app) throw new Error('SDK未加载');
    var res = await app.callFunction({ name: 'dbProxy', data: data });
    if (!res.result || !res.result.success) {
      throw new Error(res.result ? res.result.message : '云函数无响应');
    }
    return res.result;
  },

  // ========== 从 CloudBase 拉取全部数据 ==========
  syncAllFromCloud: async function () {
    var app = getApp();
    if (!app) { showSyncStatus('⚠️ SDK未加载', '#e65100'); return; }

    // 确保有登录态（匿名即可，云函数需要 auth 上下文）
    try {
      var auth = getAuth();
      if (auth) {
        var loginState = await auth.getLoginState();
        if (!loginState) {
          await auth.signInAnonymously();
        }
      }
    } catch (e) { /* 忽略 */ }

    showSyncStatus('☁️ 正在从云端同步...', '#5d4037');

    var _ = DataStore._collections;
    var tasks = [
      { key: 'chunxiao-students',      col: _.students,      label: '学员' },
      { key: 'chunxiao-classes',       col: _.classes,       label: '班级' },
      { key: 'chunxiao-attendance',    col: _.attendance,    label: '点名' },
      { key: 'chunxiao-records',       col: _.records,       label: '上课记录' },
      { key: 'chunxiao-lesson-corrections', col: _.corrections, label: '课时调整' },
      { key: 'chunxiao-artworks',      col: _.artworks,      label: '作品' },
      { key: 'chunxiao-announcements', col: _.announcements, label: '通知' },
      { key: 'chunxiao-inquiries',     col: _.inquiries,     label: '预约' }
    ];

    var totalItems = 0;
    var firstError = '';
    var detailLog = [];
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      try {
        // 通过云函数读取（管理员权限）
        var result = await DataStore._callFunction({ action: 'read', collection: t.col });
        if (result.data && result.data.length > 0 && result.data[0].items) {
          var items = result.data[0].items;
          localStorage.setItem(t.key, JSON.stringify(items));
          totalItems += items.length;
          detailLog.push(t.label + ': ' + items.length + '条');
        } else {
          detailLog.push(t.label + ': 0条');
        }
      } catch (e) {
        var errMsg = (e.message || e.code || JSON.stringify(e)).substring(0, 50);
        if (!firstError) firstError = errMsg;
        detailLog.push(t.label + ': ❌');
      }
    }

    if (totalItems > 0) {
      showSyncStatus('✅ 同步完成: ' + totalItems + ' 条', '#2e7d32');
    } else if (firstError) {
      showSyncStatus('❌ ' + firstError, '#c62828');
    } else {
      showSyncStatus('☁️ 云端暂无数据 (云函数)', '#5d4037');
    }
  },

  // ========== 单集合同步到 CloudBase（通过云函数） ==========
  _syncOneToCloud: async function (collection, key) {
    var list = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.length === 0) return;

    try {
      await DataStore._callFunction({ action: 'write', collection: collection, items: list });
      showSyncStatus('✅ 已上传 ' + collection + '(' + list.length + '条)', '#2e7d32');
    } catch (e) {
      showSyncStatus('❌ 上传失败: ' + (e.message || e.code || JSON.stringify(e)).substring(0, 40), '#c62828');
    }
  },

  syncAllToCloud: async function () {
    var _ = DataStore._collections;
    var tasks = [
      { col: _.students,      key: 'chunxiao-students' },
      { col: _.classes,       key: 'chunxiao-classes' },
      { col: _.attendance,    key: 'chunxiao-attendance' },
      { col: _.records,       key: 'chunxiao-records' },
      { col: _.corrections,   key: 'chunxiao-lesson-corrections' },
      { col: _.artworks,      key: 'chunxiao-artworks' },
      { col: _.announcements, key: 'chunxiao-announcements' },
      { col: _.inquiries,     key: 'chunxiao-inquiries' }
    ];
    for (var i = 0; i < tasks.length; i++) {
      await DataStore._syncOneToCloud(tasks[i].col, tasks[i].key);
    }
    console.log('✅ 全部数据已上传 CloudBase');
  }
};

// ========== 数据操作方法（本地 + 云函数双写） ==========

function getStudents() {
  return JSON.parse(localStorage.getItem('chunxiao-students') || '[]');
}
function saveStudents(list) {
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.students, 'chunxiao-students');
}

function getClasses() {
  return JSON.parse(localStorage.getItem('chunxiao-classes') || '[]');
}
function saveClasses(list) {
  localStorage.setItem('chunxiao-classes', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.classes, 'chunxiao-classes');
}

function getAttendance() {
  return JSON.parse(localStorage.getItem('chunxiao-attendance') || '[]');
}
function saveAttendance(list) {
  localStorage.setItem('chunxiao-attendance', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.attendance, 'chunxiao-attendance');
}

function getRecords() {
  return JSON.parse(localStorage.getItem('chunxiao-records') || '[]');
}
function saveRecords(list) {
  localStorage.setItem('chunxiao-records', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.records, 'chunxiao-records');
}

function getLessonCorrections() {
  return JSON.parse(localStorage.getItem('chunxiao-lesson-corrections') || '[]');
}
function saveLessonCorrections(list) {
  localStorage.setItem('chunxiao-lesson-corrections', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.corrections, 'chunxiao-lesson-corrections');
}

function getArtworks() {
  return JSON.parse(localStorage.getItem('chunxiao-artworks') || '[]');
}
function saveArtworks(list) {
  localStorage.setItem('chunxiao-artworks', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.artworks, 'chunxiao-artworks');
}

function getAnnouncements() {
  return JSON.parse(localStorage.getItem('chunxiao-announcements') || '[]');
}
function saveAnnouncements(list) {
  localStorage.setItem('chunxiao-announcements', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.announcements, 'chunxiao-announcements');
}

function getInquiries() {
  return JSON.parse(localStorage.getItem('chunxiao-inquiries') || '[]');
}
function saveInquiries(list) {
  localStorage.setItem('chunxiao-inquiries', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.inquiries, 'chunxiao-inquiries');
}

// --- 课程：由 dashboard.js 定义（含 DEFAULT_COURSES 回退） ---
