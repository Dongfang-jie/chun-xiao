/*
  春晓画室 - CloudBase 数据同步层
  本地 localStorage 缓存 + CloudBase 远程同步
  get 函数同步返回（读缓存），save 函数本地+远程双写
*/

var DataStore = {
  _collections: CLOUDBASE_CONFIG.collections,

  // ========== 从 CloudBase 拉取全部数据 ==========
  syncAllFromCloud: async function () {
    var db = getDB();
    if (!db) { console.warn('⚠️ CloudBase 未就绪，使用本地数据'); return; }

    var _ = DataStore._collections;
    var tasks = [
      { key: 'chunxiao-students',      col: _.students },
      { key: 'chunxiao-classes',       col: _.classes },
      { key: 'chunxiao-attendance',    col: _.attendance },
      { key: 'chunxiao-records',       col: _.records },
      { key: 'chunxiao-lesson-corrections', col: _.corrections },
      { key: 'chunxiao-artworks',      col: _.artworks },
      { key: 'chunxiao-announcements', col: _.announcements },
      { key: 'chunxiao-inquiries',     col: _.inquiries }
    ];

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      try {
        var res = await db.collection(t.col).limit(500).get();
        if (res.data && res.data.length > 0) {
          // CloudBase 返回的文档包含 _id，去掉后保存
          var items = res.data.map(function(doc) {
            var item = {};
            for (var k in doc) { if (k !== '_id' && k !== '_openid') item[k] = doc[k]; }
            return item;
          });
          localStorage.setItem(t.key, JSON.stringify(items));
          console.log('✅ 同步 ' + t.col + ': ' + items.length + ' 条');
        }
      } catch (e) {
        console.warn('⚠️ 同步 ' + t.col + ' 失败:', e.message);
      }
    }
  },

  // ========== 单集合同步到 CloudBase ==========
  _syncOneToCloud: async function (collection, key) {
    var db = getDB();
    if (!db) return;
    var list = JSON.parse(localStorage.getItem(key) || '[]');

    try {
      // 先删全部旧数据
      var old = await db.collection(collection).limit(500).get();
      if (old.data) {
        for (var i = 0; i < old.data.length; i++) {
          try { await db.collection(collection).doc(old.data[i]._id).remove(); } catch(e) {}
        }
      }
      // 再全部写入新数据
      for (var j = 0; j < list.length; j++) {
        try { await db.collection(collection).add(list[j]); } catch(e) {}
      }
    } catch (e) {
      console.warn('⚠️ 上传 ' + collection + ' 失败:', e.message);
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

// --- 课程（基本不变，可以在 CloudBase 创建后就不用改了） ---
function getCourses() {
  return JSON.parse(localStorage.getItem('chunxiao-courses') || '[]');
}
function saveCourses(list) {
  localStorage.setItem('chunxiao-courses', JSON.stringify(list));
}
