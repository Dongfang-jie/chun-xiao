/*
  春晓画室 - CloudBase 数据同步层
  本地 localStorage 缓存 + CloudBase 远程同步
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
  // 5 秒后自动隐藏成功消息
  if (color === '#2e7d32') {
    setTimeout(function() { el.style.display = 'none'; }, 5000);
  }
}

var DataStore = {
  _collections: CLOUDBASE_CONFIG.collections,

  // ========== 从 CloudBase 拉取全部数据 ==========
  syncAllFromCloud: async function () {
    var db = getDB();
    if (!db) { showSyncStatus('⚠️ SDK未加载', '#e65100'); return; }

    // 确保至少有匿名登录态（否则数据库请求会被拒绝）
    var loginType = 'none';
    try {
      var auth = getAuth();
      if (auth) {
        var loginState = await auth.getLoginState();
        if (!loginState) {
          await auth.signInAnonymously();
          loginType = 'new-anonymous';
          console.log('🟢 同步前补充匿名登录');
        } else {
          loginType = (loginState.loginType || 'existing');
          console.log('🔵 已有登录态:', loginType);
        }
      }
    } catch (e) {
      loginType = 'error:' + (e.message || e.code || '');
      console.warn('登录态检查失败:', loginType);
    }

    showSyncStatus('☁️ 正在从云端同步... (登录态:' + loginType + ')', '#5d4037');

    // ====== SDK 自诊断：用 where 验证读写 ======
    var sdkDiag = '';
    var diagTag = 'diag-' + Date.now();
    try {
      // 先清理旧诊断数据
      try {
        var olds = await db.collection(DataStore._collections.students).where({ _type: '_diag' }).get();
        if (olds.data) {
          for (var oi = 0; oi < olds.data.length; oi++) {
            try { await db.collection(DataStore._collections.students).doc(olds.data[oi]._id).remove(); } catch(e) {}
          }
        }
      } catch(e) {}
      // 写入诊断文档
      var diagData = { _type: '_diag', tag: diagTag, t: Date.now() };
      await db.collection(DataStore._collections.students).add(diagData);
      // 通过 where 查询验证写入了
      var verify = await db.collection(DataStore._collections.students).where({ tag: diagTag }).get();
      if (verify.data && verify.data.length > 0) {
        sdkDiag = 'SDK读写OK';
        // 清理
        try { await db.collection(DataStore._collections.students).doc(verify.data[0]._id).remove(); } catch(e) {}
      } else {
        sdkDiag = 'SDK写后查不到';
      }
    } catch (e) {
      sdkDiag = 'SDK异常:' + (e.message || e.code || JSON.stringify(e)).substring(0, 35);
    }
    console.log('🔧 SDK自诊断:', sdkDiag);
    // ====== SDK 自诊断结束 ======

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
        // 按标记字段查询同步数据
        var res = await db.collection(t.col).where({ _type: '_sync' }).get();
        if (res.data && res.data.length > 0 && res.data[0].items) {
          var items = res.data[0].items;
          localStorage.setItem(t.key, JSON.stringify(items));
          totalItems += items.length;
          detailLog.push(t.label + ': ' + items.length + '条');
          console.log('  ✅ ' + t.col + ' → ' + items.length + ' 条');
        } else {
          detailLog.push(t.label + ': 0条');
          console.log('  ⚪ ' + t.col + ' → 无数据 (res.data=' + (res.data ? res.data.length : 'null') + ')');
        }
      } catch (e) {
        var errMsg = (e.message || e.code || JSON.stringify(e)).substring(0, 60);
        if (!firstError) firstError = errMsg;
        detailLog.push(t.label + ': ❌ ' + errMsg);
        console.error('  ❌ ' + t.col + ' → ' + errMsg);
      }
    }
    console.log('📊 同步结果: ' + detailLog.join(' | '));
    if (totalItems > 0) {
      showSyncStatus('✅ 同步:' + totalItems + '条', '#2e7d32');
    } else if (firstError) {
      showSyncStatus('❌' + firstError.substring(0,40) + ' | 自检:' + sdkDiag, '#c62828');
    } else {
      // 把自检结果直接显示在状态栏，不隐藏
      showSyncStatus('🔧自检:' + sdkDiag + ' | ☁️无数据', '#e65100');
    }
  },

  // ========== 单集合同步到 CloudBase ==========
  _syncOneToCloud: async function (collection, key) {
    var db = getDB();
    if (!db) return;
    var list = JSON.parse(localStorage.getItem(key) || '[]');
    if (list.length === 0) return;

    try {
      // 删掉旧的同步文档
      var old = await db.collection(collection).where({ _type: '_sync' }).get();
      if (old.data) {
        for (var i = 0; i < old.data.length; i++) {
          try { await db.collection(collection).doc(old.data[i]._id).remove(); } catch(e) {}
        }
      }
      // 新增一条同步文档（用 add 让 CloudBase 自动生成 _id）
      await db.collection(collection).add({
        _type: '_sync',
        items: list,
        updatedAt: new Date().toISOString()
      });
      showSyncStatus('✅ 已上传 ' + collection + '(' + list.length + '条)', '#2e7d32');
    } catch (e) {
      showSyncStatus('❌ 上传失败: ' + (e.message || e.code), '#c62828');
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

// ========== 数据操作方法（本地 + CloudBase 双写） ==========

// --- 学员 ---
function getStudents() {
  return JSON.parse(localStorage.getItem('chunxiao-students') || '[]');
}
function saveStudents(list) {
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.students, 'chunxiao-students');
}

// --- 班级 ---
function getClasses() {
  return JSON.parse(localStorage.getItem('chunxiao-classes') || '[]');
}
function saveClasses(list) {
  localStorage.setItem('chunxiao-classes', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.classes, 'chunxiao-classes');
}

// --- 点名 ---
function getAttendance() {
  return JSON.parse(localStorage.getItem('chunxiao-attendance') || '[]');
}
function saveAttendance(list) {
  localStorage.setItem('chunxiao-attendance', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.attendance, 'chunxiao-attendance');
}

// --- 上课记录 ---
function getRecords() {
  return JSON.parse(localStorage.getItem('chunxiao-records') || '[]');
}
function saveRecords(list) {
  localStorage.setItem('chunxiao-records', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.records, 'chunxiao-records');
}

// --- 课时调整 ---
function getLessonCorrections() {
  return JSON.parse(localStorage.getItem('chunxiao-lesson-corrections') || '[]');
}
function saveLessonCorrections(list) {
  localStorage.setItem('chunxiao-lesson-corrections', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.corrections, 'chunxiao-lesson-corrections');
}

// --- 作品 ---
function getArtworks() {
  return JSON.parse(localStorage.getItem('chunxiao-artworks') || '[]');
}
function saveArtworks(list) {
  localStorage.setItem('chunxiao-artworks', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.artworks, 'chunxiao-artworks');
}

// --- 通知 ---
function getAnnouncements() {
  return JSON.parse(localStorage.getItem('chunxiao-announcements') || '[]');
}
function saveAnnouncements(list) {
  localStorage.setItem('chunxiao-announcements', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.announcements, 'chunxiao-announcements');
}

// --- 预约 ---
function getInquiries() {
  return JSON.parse(localStorage.getItem('chunxiao-inquiries') || '[]');
}
function saveInquiries(list) {
  localStorage.setItem('chunxiao-inquiries', JSON.stringify(list));
  DataStore._syncOneToCloud(CLOUDBASE_CONFIG.collections.inquiries, 'chunxiao-inquiries');
}

// --- 课程：由 dashboard.js 定义（含 DEFAULT_COURSES 回退） ---
