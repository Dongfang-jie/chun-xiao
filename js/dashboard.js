/*
  春晓画室 - 仪表盘逻辑（Auth 模块版）
  依赖 auth.js
*/

// ============================================================
//  一、页面加载
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

  var isTeacher = window.location.pathname.includes('teacher');

  // 检查登录状态
  var user = Auth.currentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  console.log('✅ 已登录：' + user.email);

  // 显示用户名
  var userNameEl = document.getElementById(isTeacher ? 'teacher-name' : 'parent-name');
  if (userNameEl) {
    var icon = isTeacher ? '👩‍🏫 ' : '👨‍👩‍👧 ';
    userNameEl.textContent = icon + (user.name || user.email);
  }

  // 家长端：加载个人信息 + 画室通知
  if (!isTeacher) {
    loadParentInfo(user);
    loadParentAnnouncements();
  }

  // 老师端：加载所有管理功能
  if (isTeacher) {
    loadInquiries();
    initStudentSubTabs();
    loadStudents();
    loadClasses();
    loadSchedule();
    loadAttendance();
    loadRecords();
    loadArtworks();
    loadAnnouncements();
    loadCourses();
    updateOverview();
  }

  // ==========================================================
  //  侧边栏导航切换
  // ==========================================================
  var sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      sidebarLinks.forEach(function (l) { l.classList.remove('active'); });
      link.classList.add('active');

      var pageName = link.dataset.page;
      document.querySelectorAll('.dash-page').forEach(function (page) {
        page.classList.remove('active');
      });
      var targetPage = document.getElementById('page-' + pageName);
      if (targetPage) {
        targetPage.classList.add('active');
      }
    });
  });

  // ==========================================================
  //  退出登录
  // ==========================================================
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (confirm('确定要退出登录吗？')) {
        Auth.logout();
        window.location.href = 'login.html';
      }
    });
  }

  // ==========================================================
  //  深色模式
  // ==========================================================
  initDashboardDarkMode();

});

// ============================================================
//  家长个人信息
// ============================================================
function loadParentInfo(user) {
  var infoEl = document.getElementById('parent-info');
  if (!infoEl) return;

  infoEl.innerHTML = ''
    + '<p><strong>👤 家长姓名：</strong>' + (user.name || '--') + '</p>'
    + '<p><strong>📧 邮箱：</strong>' + (user.email || '--') + '</p>'
    + '<p><strong>👶 孩子姓名：</strong>' + (user.childName || '--') + '</p>'
    + '<p><strong>📅 登录时间：</strong>' + (user.loginTime ? new Date(user.loginTime).toLocaleString('zh-CN') : '--') + '</p>';
}

// ============================================================
//  家长端 - 画室通知
// ============================================================
function loadParentAnnouncements() {
  var container = document.getElementById('parent-announcements');
  if (!container) return;

  var list = JSON.parse(localStorage.getItem('chunxiao-announcements') || '[]');

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">📭 暂无通知</p>';
    return;
  }

  var html = '';
  list.forEach(function(a) {
    html += [
      '<div style="background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:12px; box-shadow:0 1px 6px rgba(0,0,0,0.05); border-left:4px solid #d7a86e;">',
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">',
      '<h4 style="color:#5d4037; margin:0;">📢 ' + a.title + '</h4>',
      '<span style="color:#999; font-size:0.8em;">' + a.time + '</span>',
      '</div>',
      '<p style="margin-top:8px; color:#666; line-height:1.7;">' + a.content.replace(/\n/g, '<br>') + '</p>',
      '</div>'
    ].join('');
  });
  container.innerHTML = html;
}

// ============================================================
//  预约查询（老师端）
// ============================================================
function loadInquiries() {
  renderInquiries();
  updateInquiryStats();
  updateInquiryBadge();

  // 定时刷新（30秒检查一次，应对多标签页同时操作）
  setInterval(function() {
    renderInquiries();
    updateInquiryStats();
    updateInquiryBadge();
  }, 30000);

  // 清空按钮
  var clearBtn = document.getElementById('clear-inquiries');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      if (confirm('确定要清空所有预约记录吗？此操作不可恢复。')) {
        localStorage.removeItem('chunxiao-inquiries');
        renderInquiries();
        updateInquiryStats();
        updateInquiryBadge();
      }
    });
  }
}

function getInquiries() {
  return JSON.parse(localStorage.getItem('chunxiao-inquiries') || '[]');
}

function saveInquiries(list) {
  localStorage.setItem('chunxiao-inquiries', JSON.stringify(list));
}

function renderInquiries() {
  var container = document.getElementById('inquiries-list');
  if (!container) return;

  var list = getInquiries();

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">🎉 暂无预约记录</p>';
    return;
  }

  var html = '<div style="display:flex; flex-wrap:wrap; gap:16px;">';

  list.forEach(function(item, index) {
    var unreadClass = item.read ? '' : 'inquiry-unread';
    var unreadDot = item.read ? '' : ' <span style="color:#e88; font-size:0.8em;">● 新</span>';

    html += [
      '<div class="inquiry-card ' + unreadClass + '" data-index="' + index + '" style="flex:1 1 350px; min-width:300px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);',
      item.read ? '' : 'border-left:4px solid #e88;',
      'cursor:pointer; transition:all 0.2s;">',
      '<div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px;">',
      '<h4 style="color:#5d4037; margin:0;">👤 ' + item.parentName + unreadDot + '</h4>',
      '<span style="color:#999; font-size:0.8em;">' + item.time + '</span>',
      '</div>',
      '<div style="margin-top:12px; display:grid; grid-template-columns:auto 1fr; gap:6px 12px; font-size:0.9em;">',
      '<span style="color:#888;">📱 电话：</span><span style="color:#5d4037; font-weight:bold;">' + item.phone + '</span>',
      '<span style="color:#888;">👶 孩子：</span><span>' + item.childName + '（' + item.childAge + '）</span>',
      '<span style="color:#888;">🎯 课程：</span><span>' + item.courses + '</span>',
      '<span style="color:#888;">💬 留言：</span><span style="color:#666;">' + item.message + '</span>',
      '</div>',
      '<div style="margin-top:10px; font-size:0.8em; color:#999;">',
      item.read ? '✅ 已读' : '👆 点击标记为已读',
      '</div>',
      '</div>'
    ].join('');
  });

  html += '</div>';
  container.innerHTML = html;

  // 点击标记已读
  container.querySelectorAll('.inquiry-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var idx = parseInt(card.dataset.index);
      var list = getInquiries();
      if (list[idx] && !list[idx].read) {
        list[idx].read = true;
        saveInquiries(list);
        renderInquiries();
        updateInquiryStats();
        updateInquiryBadge();
      }
    });
  });
}

function updateInquiryStats() {
  var list = getInquiries();
  var unread = list.filter(function(i) { return !i.read; }).length;

  // 更新统计卡片中的"未读消息"
  var statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length >= 4) {
    statNumbers[3].textContent = unread;
  }
}

function updateInquiryBadge() {
  var badge = document.getElementById('inquiry-badge');
  if (!badge) return;

  var unread = getInquiries().filter(function(i) { return !i.read; }).length;

  if (unread > 0) {
    badge.textContent = unread;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

// ============================================================
//  子标签切换
// ============================================================
function initStudentSubTabs() {
  document.querySelectorAll('.sub-tab').forEach(function(tab) {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.sub-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var sub = tab.dataset.sub;
      document.querySelectorAll('.sub-page').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('sub-' + sub).classList.add('active');

      // 切换到课表/点名时刷新数据
      if (sub === 'schedule') renderSchedule();
      if (sub === 'attendance') { refreshAttendanceSelects(); renderAttendanceHistory(); }
      if (sub === 'records') { refreshRecordSelects(); renderRecordsList(); }
      if (sub === 'classes') { refreshClassStudentCheckboxes(); }
    });
  });
}

// ============================================================
//  班级管理
// ============================================================
function getClasses() {
  return JSON.parse(localStorage.getItem('chunxiao-classes') || '[]');
}
function saveClasses(list) {
  localStorage.setItem('chunxiao-classes', JSON.stringify(list));
}

function loadClasses() {
  renderClasses();
  var addBtn = document.getElementById('add-class-btn');
  if (addBtn) addBtn.onclick = function() { showClassForm(); };
  var cancelBtn = document.getElementById('class-cancel-btn');
  if (cancelBtn) cancelBtn.onclick = function() { document.getElementById('class-form-wrap').style.display = 'none'; };
  var saveBtn = document.getElementById('class-save-btn');
  if (saveBtn) saveBtn.onclick = function() { saveClass(); };
}

function showClassForm(editData) {
  document.getElementById('class-form-wrap').style.display = 'block';
  document.getElementById('c-edit-id').value = editData ? editData.id : '';
  document.getElementById('class-form-title').textContent = editData ? '编辑班级' : '创建班级';
  document.getElementById('c-name').value = editData ? editData.name : '';
  document.getElementById('c-course').value = editData ? editData.course : '';
  document.getElementById('c-day').value = editData ? editData.day : '';
  document.getElementById('c-time').value = editData ? editData.timeSlot : '';
  document.getElementById('c-room').value = editData ? editData.room : '';
  refreshClassStudentCheckboxes(editData ? editData.studentIds : []);
}

function refreshClassStudentCheckboxes(selectedIds) {
  var container = document.getElementById('class-student-checkboxes');
  if (!container) return;
  selectedIds = selectedIds || [];
  var students = getStudents();
  if (students.length === 0) {
    container.innerHTML = '<span style="color:#999;">暂无学员，请先在「学员」中添加</span>';
    return;
  }
  container.innerHTML = students.map(function(s) {
    var checked = selectedIds.indexOf(s.id) !== -1 ? ' checked' : '';
    return '<label style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; background:#fdfaf5; border-radius:14px; cursor:pointer; font-size:0.9em;">'
      + '<input type="checkbox" value="' + s.id + '"' + checked + '> ' + s.name + '</label>';
  }).join('');
}

function saveClass() {
  var name = document.getElementById('c-name').value.trim();
  if (!name) { alert('请输入班级名称'); return; }
  var editId = document.getElementById('c-edit-id').value;
  var checks = document.querySelectorAll('#class-student-checkboxes input:checked');
  var studentIds = Array.prototype.map.call(checks, function(cb) { return parseInt(cb.value); });

  var cls = {
    id: editId ? parseInt(editId) : Date.now(),
    name: name,
    course: document.getElementById('c-course').value,
    day: document.getElementById('c-day').value,
    timeSlot: document.getElementById('c-time').value.trim(),
    room: document.getElementById('c-room').value.trim(),
    studentIds: studentIds
  };
  var list = getClasses();
  if (editId) { list = list.map(function(c) { return c.id == editId ? cls : c; }); }
  else { list.unshift(cls); }
  saveClasses(list);
  document.getElementById('class-form-wrap').style.display = 'none';
  renderClasses();
}

function renderClasses() {
  var container = document.getElementById('classes-list');
  var countEl = document.getElementById('class-count');
  if (!container) return;
  var list = getClasses();
  if (countEl) countEl.textContent = list.length;
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无班级，点击"+ 创建班级"开始</p>';
    return;
  }
  var students = getStudents();
  var html = '<div style="display:flex; flex-wrap:wrap; gap:16px;">';
  list.forEach(function(c) {
    var studentNames = c.studentIds.map(function(sid) {
      var s = students.find(function(x) { return x.id == sid; });
      return s ? s.name : '';
    }).filter(Boolean).join('、');
    html += [
      '<div style="flex:1 1 340px; min-width:280px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);">',
      '<h4 style="color:#5d4037; margin:0 0 8px;">📦 ' + c.name + '</h4>',
      '<p style="margin:4px 0; color:#666;"><strong>课程：</strong>' + (c.course || '--') + '</p>',
      '<p style="margin:4px 0; color:#666;"><strong>时间：</strong>' + (c.day || '--') + ' ' + (c.timeSlot || '') + '</p>',
      '<p style="margin:4px 0; color:#666;"><strong>教室：</strong>' + (c.room || '--') + '</p>',
      '<p style="margin:4px 0; color:#666;"><strong>学员：</strong>' + (studentNames || '（未分配）') + '</p>',
      '<div style="margin-top:8px;">',
      '<a href="#" class="edit-class" data-id="' + c.id + '">✏️ 编辑</a> ',
      '<a href="#" class="del-class" data-id="' + c.id + '" style="color:#e88;">🗑️ 删除</a>',
      '</div></div>'
    ].join('');
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.edit-class').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      var c = getClasses().find(function(x) { return x.id == id; });
      if (c) showClassForm(c);
    });
  });
  container.querySelectorAll('.del-class').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!confirm('确定删除该班级吗？')) return;
      var id = parseInt(btn.dataset.id);
      saveClasses(getClasses().filter(function(c) { return c.id != id; }));
      renderClasses();
    });
  });
}

// ============================================================
//  课表
// ============================================================
function loadSchedule() { /* 初次不渲染，切换时渲染 */ }

function renderSchedule() {
  var grid = document.getElementById('schedule-grid');
  if (!grid) return;
  var classes = getClasses();
  var days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var hasData = classes.some(function(c) { return c.day; });

  if (!hasData) {
    grid.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无班级数据，请先在「班级」中创建班级并设置上课日</p>';
    return;
  }

  var html = '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
  days.forEach(function(day) {
    var dayClasses = classes.filter(function(c) { return c.day === day; });
    html += '<div style="flex:1 1 150px; min-width:130px; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.05);">';
    html += '<div style="background:#5d4037; color:#fff; text-align:center; padding:8px; font-weight:bold;">' + day + '</div>';
    if (dayClasses.length === 0) {
      html += '<div style="padding:16px; text-align:center; color:#ccc;">—</div>';
    } else {
      dayClasses.forEach(function(c) {
        html += '<div style="padding:10px 12px; border-bottom:1px solid #f0e6d8; font-size:0.85em;">';
        html += '<strong>' + c.name + '</strong><br>';
        html += '<span style="color:#888;">' + (c.timeSlot || '') + '</span>';
        if (c.room) html += ' <span style="color:#999;">| ' + c.room + '</span>';
        html += '</div>';
      });
    }
    html += '</div>';
  });
  html += '</div>';
  grid.innerHTML = html;
}

// ============================================================
//  点名
// ============================================================
function getAttendance() {
  return JSON.parse(localStorage.getItem('chunxiao-attendance') || '[]');
}
function saveAttendance(list) {
  localStorage.setItem('chunxiao-attendance', JSON.stringify(list));
}

function loadAttendance() {
  refreshAttendanceSelects();
  renderAttendanceHistory();
  var loadBtn = document.getElementById('att-load-btn');
  if (loadBtn) loadBtn.addEventListener('click', startAttendance);
  document.getElementById('att-date').value = new Date().toISOString().split('T')[0];
}

function refreshAttendanceSelects() {
  var sel = document.getElementById('att-class-select');
  if (!sel) return;
  var classes = getClasses();
  sel.innerHTML = '<option value="">-- 请选择 --</option>' +
    classes.map(function(c) { return '<option value="' + c.id + '">' + c.name + '（' + c.day + '）</option>'; }).join('');
}

function startAttendance() {
  var area = document.getElementById('attendance-area');
  var classId = parseInt(document.getElementById('att-class-select').value);
  var date = document.getElementById('att-date').value;
  if (!classId || !date) { area.innerHTML = '<p style="color:#e88; text-align:center;">⚠️ 请选择班级和日期</p>'; return; }

  var cls = getClasses().find(function(c) { return c.id == classId; });
  if (!cls) { area.innerHTML = '<p style="color:#e88;">班级不存在</p>'; return; }

  var students = getStudents().filter(function(s) { return cls.studentIds.indexOf(s.id) !== -1; });
  if (students.length === 0) { area.innerHTML = '<p style="color:#e88; text-align:center;">该班级没有学员，请先在「班级」中分配学员</p>'; return; }

  // 检查是否已点过名
  var existing = getAttendance().find(function(a) { return a.classId == classId && a.date == date; });
  var existingRecords = existing ? existing.records : [];

  var html = '<div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);">';
  html += '<h4 style="color:#5d4037; margin-bottom:12px;">📋 ' + cls.name + ' — ' + date + '</h4>';
  html += '<button id="att-all-present" class="login-btn" style="width:auto; padding:6px 16px; margin-bottom:12px; font-size:0.85em;">✅ 全部出勤</button>';
  html += '<table><thead><tr><th>学员</th><th>出勤</th><th>请假</th><th>缺勤</th></tr></thead><tbody>';

  students.forEach(function(s) {
    var rec = existingRecords.find(function(r) { return r.studentId == s.id; });
    var status = rec ? rec.status : 'present';
    html += '<tr>';
    html += '<td><strong>' + s.name + '</strong></td>';
    html += '<td><button class="att-btn att-present' + (status === 'present' ? ' active' : '') + '" data-sid="' + s.id + '" data-st="present">✅</button></td>';
    html += '<td><button class="att-btn att-leave' + (status === 'leave' ? ' active' : '') + '" data-sid="' + s.id + '" data-st="leave">⭕</button></td>';
    html += '<td><button class="att-btn att-absent' + (status === 'absent' ? ' active' : '') + '" data-sid="' + s.id + '" data-st="absent">❌</button></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<button id="att-save-btn" class="login-btn" style="width:auto; padding:10px 24px; margin-top:12px;">💾 保存点名</button>';
  html += '<span id="att-msg" style="margin-left:12px; font-size:0.9em;"></span>';
  html += '</div>';
  area.innerHTML = html;

  // 全部出勤按钮
  document.getElementById('att-all-present').addEventListener('click', function() {
    area.querySelectorAll('.att-btn').forEach(function(b) {
      if (b.dataset.st === 'present') { b.classList.add('active'); }
      else { b.classList.remove('active'); }
    });
  });

  // 状态按钮切换
  area.querySelectorAll('.att-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var row = btn.parentElement.parentElement;
      row.querySelectorAll('.att-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // 保存
  document.getElementById('att-save-btn').addEventListener('click', function() {
    var records = [];
    area.querySelectorAll('tbody tr').forEach(function(row) {
      var sid = parseInt(row.querySelector('.att-btn').dataset.sid);
      var activeBtn = row.querySelector('.att-btn.active');
      records.push({ studentId: sid, status: activeBtn ? activeBtn.dataset.st : 'present' });
    });

    var all = getAttendance().filter(function(a) { return !(a.classId == classId && a.date == date); });
    all.push({ id: Date.now(), classId: classId, date: date, records: records });
    saveAttendance(all);
    document.getElementById('att-msg').textContent = '✅ 点名已保存';
    document.getElementById('att-msg').style.color = '#5a9';
    renderAttendanceHistory();
  });
}

function renderAttendanceHistory() {
  var container = document.getElementById('attendance-history');
  if (!container) return;
  var list = getAttendance();
  if (list.length === 0) { container.innerHTML = '<p style="color:#999;">暂无记录</p>'; return; }

  var classes = getClasses();
  var students = getStudents();
  list.sort(function(a, b) { return b.id - a.id; });

  var html = '';
  list.slice(0, 10).forEach(function(a) {
    var cls = classes.find(function(c) { return c.id == a.classId; });
    var presentCount = a.records.filter(function(r) { return r.status === 'present'; }).length;
    html += '<div style="background:#fff; border-radius:8px; padding:12px 16px; margin-bottom:8px; box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '<strong>' + (cls ? cls.name : '(已删)') + '</strong> · ' + a.date;
    html += ' · ✅' + presentCount + '/' + a.records.length;
    html += ' <a href="#" class="del-att" data-id="' + a.id + '" style="color:#e88; font-size:0.8em;">删除</a>';
    html += '</div>';
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-att').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!confirm('删除该次点名记录？')) return;
      var id = parseInt(btn.dataset.id);
      saveAttendance(getAttendance().filter(function(a) { return a.id != id; }));
      renderAttendanceHistory();
    });
  });
}

// ============================================================
//  上课记录
// ============================================================
function getRecords() {
  return JSON.parse(localStorage.getItem('chunxiao-records') || '[]');
}
function saveRecords(list) {
  localStorage.setItem('chunxiao-records', JSON.stringify(list));
}

function loadRecords() {
  refreshRecordSelects();
  renderRecordsList();
  var saveBtn = document.getElementById('record-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveRecord);
  document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
}

function refreshRecordSelects() {
  var sel = document.getElementById('rec-class-select');
  if (!sel) return;
  var classes = getClasses();
  sel.innerHTML = '<option value="">-- 请选择 --</option>' +
    classes.map(function(c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
}

function saveRecord() {
  var classId = parseInt(document.getElementById('rec-class-select').value);
  var date = document.getElementById('rec-date').value;
  var content = document.getElementById('rec-content').value.trim();
  var notes = document.getElementById('rec-notes').value.trim();
  var msgEl = document.getElementById('rec-msg');
  if (!classId || !date || !content) {
    msgEl.textContent = '⚠️ 请填写班级、日期和教学内容';
    msgEl.style.color = '#e88'; return;
  }
  var list = getRecords();
  list.unshift({
    id: Date.now(), classId: classId, date: date,
    content: content, notes: notes,
    teacherName: (Auth.currentUser() || {}).name || '老师',
    time: new Date().toLocaleString('zh-CN')
  });
  saveRecords(list);
  document.getElementById('rec-content').value = '';
  document.getElementById('rec-notes').value = '';
  msgEl.textContent = '✅ 记录已保存';
  msgEl.style.color = '#5a9';
  renderRecordsList();
}

function renderRecordsList() {
  var container = document.getElementById('records-list');
  if (!container) return;
  var list = getRecords();
  if (list.length === 0) { container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无记录</p>'; return; }

  var classes = getClasses();
  var html = '';
  list.forEach(function(r) {
    var cls = classes.find(function(c) { return c.id == r.classId; });
    html += [
      '<div style="background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:10px; box-shadow:0 1px 6px rgba(0,0,0,0.05); border-left:3px solid #5d4037;">',
      '<div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">',
      '<strong style="color:#5d4037;">' + (cls ? cls.name : '(已删)') + ' · ' + r.date + '</strong>',
      '<span style="color:#999; font-size:0.8em;">' + r.time + ' · ' + r.teacherName + '</span>',
      '</div>',
      '<p style="margin-top:8px; color:#444;">📖 ' + r.content + '</p>',
      (r.notes ? '<p style="color:#888; font-size:0.9em;">📌 ' + r.notes + '</p>' : ''),
      '<a href="#" class="del-rec" data-id="' + r.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>',
      '</div>'
    ].join('');
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-rec').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!confirm('删除该上课记录？')) return;
      var id = parseInt(btn.dataset.id);
      saveRecords(getRecords().filter(function(r) { return r.id != id; }));
      renderRecordsList();
    });
  });
}

// ============================================================
//  总览统计
// ============================================================
function updateOverview() {
  var students = getStudents();
  var artworks = getArtworks();
  var inquiries = getInquiries();
  var unread = inquiries.filter(function(i) { return !i.read; }).length;

  var statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length >= 4) {
    statNumbers[0].textContent = students.length;
    statNumbers[1].textContent = '6'; // 固定 6 门课
    statNumbers[2].textContent = artworks.length;
    statNumbers[3].textContent = unread;
  }
}

// ============================================================
//  学生管理
// ============================================================
function getStudents() {
  return JSON.parse(localStorage.getItem('chunxiao-students') || '[]');
}
function saveStudents(list) {
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
}

function loadStudents() {
  renderStudents();
  // 添加按钮
  var addBtn = document.getElementById('add-student-btn');
  if (addBtn) {
    addBtn.onclick = function() {
      document.getElementById('student-form-wrap').style.display = 'block';
      document.getElementById('student-form-title').textContent = '添加学生';
      document.getElementById('s-edit-id').value = '';
      document.getElementById('s-name').value = '';
      document.getElementById('s-age').value = '';
      document.getElementById('s-course').value = '';
      document.getElementById('s-parent').value = '';
      document.getElementById('s-phone').value = '';
      document.getElementById('s-status').value = '在读';
    };
  }
  // 取消按钮
  var cancelBtn = document.getElementById('student-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = function() {
      document.getElementById('student-form-wrap').style.display = 'none';
    };
  }
  // 保存按钮
  var saveBtn = document.getElementById('student-save-btn');
  if (saveBtn) {
    saveBtn.onclick = function() {
      var editId = document.getElementById('s-edit-id').value;
      var name = document.getElementById('s-name').value.trim();
      if (!name) { alert('请输入学生姓名'); return; }

      var student = {
        id: editId || Date.now(),
        name: name,
        age: document.getElementById('s-age').value.trim() || '--',
        course: document.getElementById('s-course').value || '--',
        parent: document.getElementById('s-parent').value.trim() || '--',
        phone: document.getElementById('s-phone').value.trim() || '--',
        status: document.getElementById('s-status').value,
        addedAt: new Date().toISOString()
      };

      var list = getStudents();
      if (editId) {
        // 编辑模式
        list = list.map(function(s) { return s.id == editId ? student : s; });
      } else {
        list.unshift(student);
      }
      saveStudents(list);
      document.getElementById('student-form-wrap').style.display = 'none';
      renderStudents();
      updateOverview();
    };
  }
}

function renderStudents() {
  var container = document.getElementById('students-list');
  var countEl = document.getElementById('student-count');
  if (!container) return;

  var list = getStudents();
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无学生，点击"+ 添加学生"开始</p>';
    return;
  }

  var html = '<table><thead><tr><th>姓名</th><th>年龄</th><th>课程</th><th>家长</th><th>电话</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  list.forEach(function(s) {
    var statusColor = s.status === '在读' ? '#5a9' : s.status === '休学' ? '#e88' : '#999';
    html += '<tr>';
    html += '<td><strong>' + s.name + '</strong></td>';
    html += '<td>' + s.age + '</td>';
    html += '<td>' + s.course + '</td>';
    html += '<td>' + s.parent + '</td>';
    html += '<td>' + s.phone + '</td>';
    html += '<td><span style="color:' + statusColor + '; font-weight:bold;">' + s.status + '</span></td>';
    html += '<td>';
    html += '<a href="#" class="edit-student" data-id="' + s.id + '">✏️</a> ';
    html += '<a href="#" class="del-student" data-id="' + s.id + '" style="color:#e88;">🗑️</a>';
    html += '</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  // 绑定编辑按钮
  container.querySelectorAll('.edit-student').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      var s = getStudents().find(function(x) { return x.id == id; });
      if (!s) return;
      document.getElementById('student-form-wrap').style.display = 'block';
      document.getElementById('student-form-title').textContent = '编辑学生 - ' + s.name;
      document.getElementById('s-edit-id').value = s.id;
      document.getElementById('s-name').value = s.name;
      document.getElementById('s-age').value = s.age;
      document.getElementById('s-course').value = s.course;
      document.getElementById('s-parent').value = s.parent;
      document.getElementById('s-phone').value = s.phone;
      document.getElementById('s-status').value = s.status;
    });
  });

  // 绑定删除按钮
  container.querySelectorAll('.del-student').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该学生吗？')) return;
      var list = getStudents().filter(function(s) { return s.id != id; });
      saveStudents(list);
      renderStudents();
      updateOverview();
    });
  });
}

// ============================================================
//  作品管理
// ============================================================
function getArtworks() {
  return JSON.parse(localStorage.getItem('chunxiao-artworks') || '[]');
}
function saveArtworks(list) {
  localStorage.setItem('chunxiao-artworks', JSON.stringify(list));
}

function loadArtworks() {
  renderArtworks();
  var addBtn = document.getElementById('add-artwork-btn');
  if (addBtn) {
    addBtn.onclick = function() {
      document.getElementById('artwork-form-wrap').style.display = 'block';
      document.getElementById('a-title').value = '';
      document.getElementById('a-student').value = '';
      document.getElementById('a-type').value = '美术';
      document.getElementById('a-image').value = '';
    };
  }
  var cancelBtn = document.getElementById('artwork-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = function() {
      document.getElementById('artwork-form-wrap').style.display = 'none';
    };
  }
  var saveBtn = document.getElementById('artwork-save-btn');
  if (saveBtn) {
    saveBtn.onclick = function() {
      var title = document.getElementById('a-title').value.trim();
      var student = document.getElementById('a-student').value.trim();
      if (!title || !student) { alert('请填写作品名称和学生姓名'); return; }

      var artwork = {
        id: Date.now(),
        title: title,
        student: student,
        type: document.getElementById('a-type').value,
        image: document.getElementById('a-image').value.trim() || 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(title),
        addedAt: new Date().toISOString()
      };

      var list = getArtworks();
      list.unshift(artwork);
      saveArtworks(list);
      document.getElementById('artwork-form-wrap').style.display = 'none';
      renderArtworks();
      updateOverview();
    };
  }
}

function renderArtworks() {
  var container = document.getElementById('artworks-list');
  var countEl = document.getElementById('artwork-count');
  if (!container) return;

  var list = getArtworks();
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无作品，点击"+ 添加作品"开始</p>';
    return;
  }

  container.className = 'card-container';
  container.style.justifyContent = 'flex-start';
  var html = '';
  list.forEach(function(a) {
    html += [
      '<div class="card" style="flex:0 1 280px; max-width:280px;">',
      '<img src="' + a.image + '" alt="' + a.title + '" class="card-img" style="height:180px;">',
      '<div class="card-body">',
      '<h4>' + a.title + '</h4>',
      '<p>👦 ' + a.student + ' | ' + a.type + '</p>',
      '<a href="#" class="del-artwork" data-id="' + a.id + '" style="color:#e88; font-size:0.85em;">🗑️ 删除</a>',
      '</div></div>'
    ].join('');
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-artwork').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该作品吗？')) return;
      var list = getArtworks().filter(function(a) { return a.id != id; });
      saveArtworks(list);
      renderArtworks();
      updateOverview();
    });
  });
}

// ============================================================
//  发布通知
// ============================================================
function getAnnouncements() {
  return JSON.parse(localStorage.getItem('chunxiao-announcements') || '[]');
}
function saveAnnouncements(list) {
  localStorage.setItem('chunxiao-announcements', JSON.stringify(list));
}

function loadAnnouncements() {
  renderAnnouncements();
  var publishBtn = document.getElementById('publish-ann-btn');
  if (publishBtn) {
    publishBtn.onclick = function() {
      var title = document.getElementById('ann-title').value.trim();
      var content = document.getElementById('ann-content').value.trim();
      var msgEl = document.getElementById('ann-msg');
      if (!title || !content) {
        msgEl.textContent = '⚠️ 标题和内容都不能为空';
        msgEl.style.color = '#e88';
        return;
      }
      var ann = {
        id: Date.now(),
        title: title,
        content: content,
        time: new Date().toLocaleString('zh-CN'),
        author: (Auth.currentUser() || {}).name || '老师'
      };
      var list = getAnnouncements();
      list.unshift(ann);
      saveAnnouncements(list);
      document.getElementById('ann-title').value = '';
      document.getElementById('ann-content').value = '';
      msgEl.textContent = '✅ 通知已发布！家长端可见';
      msgEl.style.color = '#5a9';
      renderAnnouncements();
      updateOverview();
    };
  }
}

function renderAnnouncements() {
  var container = document.getElementById('announcements-list');
  if (!container) return;

  var list = getAnnouncements();
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无通知</p>';
    return;
  }

  var html = '';
  list.forEach(function(a) {
    html += [
      '<div style="background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:12px; box-shadow:0 1px 6px rgba(0,0,0,0.05);">',
      '<div style="display:flex; justify-content:space-between; align-items:center;">',
      '<h4 style="color:#5d4037; margin:0;">📢 ' + a.title + '</h4>',
      '<span style="color:#999; font-size:0.8em;">' + a.time + ' · ' + a.author + '</span>',
      '</div>',
      '<p style="margin-top:8px; color:#666; line-height:1.7;">' + a.content.replace(/\n/g, '<br>') + '</p>',
      '<a href="#" class="del-ann" data-id="' + a.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>',
      '</div>'
    ].join('');
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-ann').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该通知吗？')) return;
      var list = getAnnouncements().filter(function(a) { return a.id != id; });
      saveAnnouncements(list);
      renderAnnouncements();
    });
  });
}

// ============================================================
//  课程管理
// ============================================================
var DEFAULT_COURSES = [
  { name: '儿童创意画', age: '4-7岁', duration: '90分钟', time: '周六 9:00 / 周日 14:00', capacity: '0/8' },
  { name: '素描基础',   age: '8-12岁', duration: '120分钟', time: '周六 14:00 / 周日 9:00', capacity: '0/8' },
  { name: '水彩入门',   age: '8+岁', duration: '120分钟', time: '周日 14:00', capacity: '0/8' },
  { name: '动漫插画',   age: '10+岁', duration: '120分钟', time: '周六 16:00', capacity: '0/8' },
  { name: '硬笔书法',   age: '6+岁', duration: '90分钟', time: '周六 9:00 / 周日 9:00', capacity: '0/8' },
  { name: '软笔书法',   age: '8+岁', duration: '120分钟', time: '周六 14:00', capacity: '0/8' }
];

function getCourses() {
  var saved = localStorage.getItem('chunxiao-courses');
  return saved ? JSON.parse(saved) : DEFAULT_COURSES;
}
function saveCourses(list) {
  localStorage.setItem('chunxiao-courses', JSON.stringify(list));
}

function loadCourses() {
  renderCourses();

  // 确保有默认数据
  if (!localStorage.getItem('chunxiao-courses')) {
    saveCourses(DEFAULT_COURSES);
  }
}

function renderCourses() {
  var tbody = document.querySelector('#courses-table tbody');
  if (!tbody) return;

  var list = getCourses();
  var html = '';
  list.forEach(function(c, idx) {
    html += '<tr>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="name">' + c.name + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="age">' + c.age + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="duration">' + c.duration + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="time">' + c.time + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="capacity">' + c.capacity + '</td>';
    html += '<td><span style="color:#999; font-size:0.8em;">点击单元格编辑</span></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;

  // 监听编辑
  tbody.querySelectorAll('.editable').forEach(function(cell) {
    cell.addEventListener('blur', function() {
      var idx = parseInt(cell.dataset.idx);
      var field = cell.dataset.field;
      var value = cell.textContent.trim();
      var list = getCourses();
      if (list[idx]) {
        list[idx][field] = value;
        saveCourses(list);
        cell.style.background = '#f0ffe0';
        setTimeout(function() { cell.style.background = ''; }, 1500);
      }
    });
  });
}

// ============================================================
//  深色模式
// ============================================================
function initDashboardDarkMode() {
  var savedMode = localStorage.getItem('chunxiao-dark-mode');
  if (savedMode === 'dark') {
    document.body.classList.add('dark-mode');
  }

  var headerRight = document.querySelector('.dash-header-right');
  if (headerRight) {
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'dark-mode-toggle';
    toggleBtn.style.cssText = 'border:2px solid #c9a87c; color:#8d6e63;';
    toggleBtn.title = '切换深色/浅色模式';
    toggleBtn.textContent = savedMode === 'dark' ? '☀️' : '🌙';

    toggleBtn.addEventListener('click', function () {
      document.body.classList.toggle('dark-mode');
      var isDark = document.body.classList.contains('dark-mode');
      toggleBtn.textContent = isDark ? '☀️' : '🌙';
      localStorage.setItem('chunxiao-dark-mode', isDark ? 'dark' : 'light');
    });

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      headerRight.insertBefore(toggleBtn, logoutBtn);
    }
  }
}
