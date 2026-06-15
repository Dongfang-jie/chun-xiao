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
    var roleBadge = isTeacher ? (hasAdminPermission() ? ' <span style="font-size:0.65em; background:#5d4037; color:#fff; padding:2px 8px; border-radius:10px;">管理员</span>' : ' <span style="font-size:0.65em; background:#d7a86e; color:#5d4037; padding:2px 8px; border-radius:10px;">老师</span>') : '';
    userNameEl.innerHTML = icon + (user.name || user.email) + roleBadge;
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
    loadLessonLog();
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

  // 清空按钮（仅管理员）
  var clearBtn = document.getElementById('clear-inquiries');
  if (clearBtn) {
    if (!hasAdminPermission()) { clearBtn.style.display = 'none'; }
    else clearBtn.addEventListener('click', function() {
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
      if (sub === 'attendance') { renderDailyAttendanceTable(document.getElementById('att-date-nav').value); renderAttendanceHistory(); renderAttendanceStats(); }
      if (sub === 'records') { refreshRecordSelects(); renderRecordsList(); }
      if (sub === 'lessonlog') { refreshLogStudentSelects(); renderLessonLog(); updateLessonLogSummary(); renderLowLessonAlerts(); }
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

  var oldCls = editId ? getClasses().find(function(c) { return c.id == editId; }) : null;
  var opName = getOperatorName();
  var cls = {
    id: editId ? parseInt(editId) : Date.now(),
    name: name,
    course: document.getElementById('c-course').value,
    day: document.getElementById('c-day').value,
    timeSlot: document.getElementById('c-time').value.trim(),
    room: document.getElementById('c-room').value.trim(),
    studentIds: studentIds,
    addedBy: editId ? (oldCls ? oldCls.addedBy : opName) : opName,
    lastModifiedBy: opName
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
      (hasAdminPermission() ? '<a href="#" class="del-class" data-id="' + c.id + '" style="color:#e88;">🗑️ 删除</a>' : ''),
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
  var unscheduledEl = document.getElementById('unscheduled-classes');
  if (!grid) return;
  var classes = getClasses();
  var days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var students = getStudents();

  // 分离已排课和未排课
  var scheduled = classes.filter(function(c) { return c.day; });
  var unscheduled = classes.filter(function(c) { return !c.day; });

  if (scheduled.length === 0 && unscheduled.length === 0) {
    grid.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无班级数据，请先在「班级」中创建班级并设置上课日</p>';
    if (unscheduledEl) unscheduledEl.innerHTML = '';
    return;
  }

  // 收集所有时段并排序
  var timeSlots = [];
  scheduled.forEach(function(c) {
    if (c.timeSlot && timeSlots.indexOf(c.timeSlot) === -1) {
      timeSlots.push(c.timeSlot);
    }
  });
  // 按开始时间排序
  timeSlots.sort(function(a, b) {
    var aStart = a.split('-')[0] || '';
    var bStart = b.split('-')[0] || '';
    return aStart.localeCompare(bStart);
  });

  // 如果没有时段数据，使用默认行
  if (timeSlots.length === 0) {
    timeSlots = ['（未设时段）'];
  }

  // 建立 color index 映射（相同课程名同色）
  var courseColors = {};
  var colorIdx = 0;

  // 今天星期几
  var todayDayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];

  // 构建课表
  var html = '<table class="schedule-table"><thead><tr>';
  html += '<th class="schedule-time-header">时间</th>';
  days.forEach(function(day) {
    var todayClass = day === todayDayName ? ' schedule-today-header' : '';
    html += '<th class="' + todayClass + '">' + day + '</th>';
  });
  html += '</tr></thead><tbody>';

  timeSlots.forEach(function(slot) {
    html += '<tr>';
    html += '<td class="schedule-time-cell">' + slot + '</td>';
    days.forEach(function(day) {
      var dayClasses = scheduled.filter(function(c) { return c.day === day && c.timeSlot === slot; });
      html += '<td>';
      if (dayClasses.length === 0) {
        html += '<span class="schedule-empty-cell">—</span>';
      } else {
        dayClasses.forEach(function(c) {
          var studentCount = c.studentIds ? c.studentIds.length : 0;
          // 按课程名分配颜色
          if (!(c.course in courseColors)) { courseColors[c.course] = colorIdx++ % 6; }
          var cc = courseColors[c.course];
          html += '<div class="schedule-class-card sc-color-' + cc + '">';
          html += '<span class="sc-name">' + c.name + '</span>';
          html += '<span class="sc-meta">' + (c.room || '') + '</span>';
          html += '<span class="sc-count">' + studentCount + '人</span>';
          html += '</div>';
        });
      }
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  // 一节课跨多个时段 — 显示"无时段"的行
  var noSlotScheduled = scheduled.filter(function(c) { return !c.timeSlot; });
  if (noSlotScheduled.length > 0) {
    html += '<table class="schedule-table" style="margin-top:12px;"><thead><tr>';
    html += '<th class="schedule-time-header">时间</th>';
    days.forEach(function(day) {
      var todayClass = day === todayDayName ? ' schedule-today-header' : '';
      html += '<th class="' + todayClass + '">' + day + '</th>';
    });
    html += '</tr></thead><tbody><tr>';
    html += '<td class="schedule-time-cell">未设时段</td>';
    days.forEach(function(day) {
      var dayClasses = noSlotScheduled.filter(function(c) { return c.day === day; });
      html += '<td>';
      if (dayClasses.length === 0) {
        html += '<span class="schedule-empty-cell">—</span>';
      } else {
        dayClasses.forEach(function(c) {
          var studentCount = c.studentIds ? c.studentIds.length : 0;
          if (!(c.course in courseColors)) { courseColors[c.course] = colorIdx++ % 6; }
          var cc = courseColors[c.course];
          html += '<div class="schedule-class-card sc-color-' + cc + '">';
          html += '<span class="sc-name">' + c.name + '</span>';
          html += '<span class="sc-meta">' + (c.room || '') + '</span>';
          html += '<span class="sc-count">' + studentCount + '人</span>';
          html += '</div>';
        });
      }
      html += '</td>';
    });
    html += '</tr></tbody></table>';
  }

  grid.innerHTML = html;

  // 未排课班级提示
  if (unscheduledEl && unscheduled.length > 0) {
    var uhtml = '<div style="background:#fff; border-radius:12px; padding:16px 20px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">';
    uhtml += '<h4 style="color:#e8a040; margin:0 0 8px;">⚠️ 未排课班级（' + unscheduled.length + '个）</h4>';
    uhtml += '<p style="color:#888; font-size:0.9em; margin:0;">';
    uhtml += unscheduled.map(function(c) { return c.name; }).join('、');
    uhtml += ' — 请到「班级」中设置上课日和时段</p></div>';
    unscheduledEl.innerHTML = uhtml;
  } else if (unscheduledEl) {
    unscheduledEl.innerHTML = '';
  }
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
  var today = getLocalDateStr();
  document.getElementById('att-date-nav').value = today;
  renderDailyAttendanceTable(today);
  renderAttendanceHistory();
  renderAttendanceStats();

  // 日期导航
  var dateNav = document.getElementById('att-date-nav');
  if (dateNav) {
    dateNav.addEventListener('change', function() {
      renderDailyAttendanceTable(dateNav.value);
      document.getElementById('attendance-area').style.display = 'none';
    });
  }
  document.getElementById('att-today-btn').addEventListener('click', function() {
    var t = getLocalDateStr();
    document.getElementById('att-date-nav').value = t;
    renderDailyAttendanceTable(t);
    document.getElementById('attendance-area').style.display = 'none';
  });
  document.getElementById('att-week-prev').addEventListener('click', function() {
    changeAttDate(-1);
  });
  document.getElementById('att-week-next').addEventListener('click', function() {
    changeAttDate(1);
  });
}

function changeAttDate(delta) {
  var input = document.getElementById('att-date-nav');
  // 用本地时间解析，避免 UTC 时区偏移
  var parts = input.value.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + delta);
  var newDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  input.value = newDate;
  renderDailyAttendanceTable(newDate);
  document.getElementById('attendance-area').style.display = 'none';
}

// 获取本地日期字符串 (YYYY-MM-DD)
function getLocalDateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// 渲染当日班级点名表
function renderDailyAttendanceTable(date) {
  var container = document.getElementById('attendance-daily-table');
  var labelEl = document.getElementById('att-day-label');
  if (!container) return;

  var classes = getClasses();
  var attendance = getAttendance();

  // 找到当天有课的班级（匹配上课日）
  var dayMap = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6 };
  var d = new Date(date + 'T00:00:00');
  var dayOfWeek = d.getDay();
  var dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var dayName = dayNames[dayOfWeek];

  if (labelEl) {
    labelEl.textContent = date + ' · ' + dayName;
  }

  var todayClasses = classes.filter(function(c) { return c.day === dayName; });

  if (todayClasses.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">' + dayName + '没有安排课程</p>';
    return;
  }

  var students = getStudents();

  var html = '<table class="att-daily-table"><thead><tr>';
  html += '<th>班级</th><th>课程</th><th>时间</th><th>教室</th><th>学员</th><th>状态</th><th>操作</th>';
  html += '</tr></thead><tbody>';

  todayClasses.forEach(function(cls) {
    var existing = attendance.find(function(a) { return a.classId == cls.id && a.date == date; });
    var isDone = !!existing;
    var presentCount = existing ? existing.records.filter(function(r) { return r.status === 'present'; }).length : 0;
    var totalStudents = cls.studentIds ? cls.studentIds.length : 0;
    var rowClass = isDone ? 'att-row-done' : 'att-row-pending';

    html += '<tr class="' + rowClass + '">';
    html += '<td><strong style="color:#5d4037;">' + cls.name + '</strong></td>';
    html += '<td>' + (cls.course || '--') + '</td>';
    html += '<td>' + (cls.timeSlot || '--') + '</td>';
    html += '<td>' + (cls.room || '--') + '</td>';
    html += '<td>' + totalStudents + '人</td>';
    html += '<td><span class="att-status-badge ' + (isDone ? 'att-status-done' : 'att-status-pending') + '">' + (isDone ? '✅ 已点名 ' + presentCount + '/' + totalStudents : '⚪ 未点名') + '</span></td>';
    html += '<td><button class="login-btn att-start-btn" data-cid="' + cls.id + '" data-date="' + date + '" style="width:auto; padding:7px 16px; font-size:0.85em;">' + (isDone ? '📝 重新点名' : '📋 开始点名') + '</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // 绑定点名按钮
  container.querySelectorAll('.att-start-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cid = parseInt(btn.dataset.cid);
      var attDate = btn.dataset.date;
      startAttendanceForClass(cid, attDate);
    });
  });
}

// 对指定班级和日期开始点名
function startAttendanceForClass(classId, date) {
  var area = document.getElementById('attendance-area');
  area.style.display = 'block';

  var cls = getClasses().find(function(c) { return c.id == classId; });
  if (!cls) { area.innerHTML = '<p style="color:#e88;">班级不存在</p>'; return; }

  var students = getStudents().filter(function(s) { return cls.studentIds.indexOf(s.id) !== -1; });
  if (students.length === 0) { area.innerHTML = '<p style="color:#e88; text-align:center;">该班级没有学员，请先在「班级」中分配学员</p>'; return; }

  var existing = getAttendance().find(function(a) { return a.classId == classId && a.date == date; });
  var existingRecords = existing ? existing.records : [];

  var html = '<div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06); border:2px solid #d7a86e;">';
  html += '<h4 style="color:#5d4037; margin-bottom:4px;">📋 ' + cls.name + '</h4>';
  html += '<p style="color:#888; margin:0 0 12px; font-size:0.9em;">' + date + ' · ' + cls.day + ' ' + (cls.timeSlot || '') + ' · ' + (cls.room || '') + '</p>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">';
  html += '<button id="att-all-present" class="login-btn" style="width:auto; padding:6px 16px; font-size:0.85em;">✅ 全部出勤</button>';
  html += '<button id="att-all-leave" class="login-btn" style="width:auto; padding:6px 16px; font-size:0.85em; background:#e8a040; border-color:#e8a040;">⭕ 全部请假</button>';
  html += '<span style="color:#ccc; margin:0 4px;">|</span>';
  html += '<input type="number" id="att-deduct-all" value="0" min="0" style="width:60px; padding:6px; border:2px solid #e8d4c8; border-radius:6px; text-align:center;">';
  html += '<button id="att-deduct-all-btn" class="login-btn" style="width:auto; padding:8px 20px; font-size:0.9em; background:#e65100; border-color:#bf360c; font-weight:bold; letter-spacing:1px; transition:all 0.15s;">📉 全部扣课时</button>';
  html += '<span style="color:#888; font-size:0.8em;">仅扣出勤学员</span>';
  html += '</div>';

  // 查找每个学生最近一次扣课日期
  var allAtt = getAttendance();
  function getLastDeductDate(sid) {
    var latestDate = '';
    allAtt.forEach(function(a) {
      a.records.forEach(function(r) {
        if (r.studentId === sid && r.deducted > 0 && r.status === 'present') {
          if (!latestDate || a.date > latestDate) latestDate = a.date;
        }
      });
    });
    return latestDate;
  }

  html += '<table><thead><tr><th>学员</th><th>总/已消耗/剩余</th><th>上次扣课</th><th>出勤</th><th>请假</th><th>缺勤</th><th>扣课时</th></tr></thead><tbody>';

  students.forEach(function(s) {
    var rec = existingRecords.find(function(r) { return r.studentId == s.id; });
    var status = rec ? rec.status : 'present';
    var deducted = rec ? (rec.deducted || 0) : 0;
    var total = s.totalLessons || 0;
    var consumed = s.consumedLessons || 0;
    var remaining = total - consumed;
    var remainColor = remaining <= 2 ? '#e88' : remaining <= 5 ? '#e8a040' : '#5a9';
    var lastDate = getLastDeductDate(s.id);
    var lastDateDisplay = lastDate ? lastDate : '<span style="color:#ccc;">无记录</span>';
    html += '<tr>';
    html += '<td><strong>' + s.name + '</strong></td>';
    html += '<td style="font-size:0.85em;">总' + total + ' / <span style="color:#e88;">消' + consumed + '</span> / <span style="color:' + remainColor + ';">剩' + remaining + '</span></td>';
    html += '<td style="font-size:0.8em; color:#888;">' + lastDateDisplay + '</td>';
    html += '<td><button class="att-btn att-present' + (status === 'present' ? ' active' : '') + '" data-sid="' + s.id + '" data-st="present">✅</button></td>';
    html += '<td><button class="att-btn att-leave' + (status === 'leave' ? ' active' : '') + '" data-sid="' + s.id + '" data-st="leave">⭕</button></td>';
    html += '<td><button class="att-btn att-absent' + (status === 'absent' ? ' active' : '') + '" data-sid="' + s.id + '" data-st="absent">❌</button></td>';
    html += '<td><input type="number" class="att-deduct" value="' + deducted + '" min="0" data-sid="' + s.id + '" style="width:55px; padding:4px; border:2px solid #e8d4c8; border-radius:4px; text-align:center;"></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  html += '<div style="margin-top:12px; display:flex; gap:8px; align-items:center;">';
  html += '<button id="att-save-btn" class="login-btn" style="width:auto; padding:10px 24px;">💾 保存点名</button>';
  html += '<button id="att-cancel-area-btn" class="logout-btn">收起</button>';
  html += '<span id="att-msg" style="margin-left:12px; font-size:0.9em;"></span>';
  html += '</div>';
  html += '</div>';
  area.innerHTML = html;
  area.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 收起按钮
  document.getElementById('att-cancel-area-btn').addEventListener('click', function() {
    area.style.display = 'none';
  });

  // 全部出勤按钮
  document.getElementById('att-all-present').addEventListener('click', function() {
    area.querySelectorAll('.att-btn').forEach(function(b) {
      if (b.dataset.st === 'present') { b.classList.add('active'); }
      else { b.classList.remove('active'); }
    });
  });

  // 全部请假按钮
  document.getElementById('att-all-leave').addEventListener('click', function() {
    area.querySelectorAll('.att-btn').forEach(function(b) {
      if (b.dataset.st === 'leave') { b.classList.add('active'); }
      else { b.classList.remove('active'); }
    });
    area.querySelectorAll('.att-deduct').forEach(function(input) { input.value = 0; });
  });

  // 全部扣课时
  document.getElementById('att-deduct-all-btn').addEventListener('click', function() {
    var val = parseInt(document.getElementById('att-deduct-all').value) || 0;
    var inputs = area.querySelectorAll('.att-deduct');
    var presentCount = 0;

    inputs.forEach(function(input) {
      var row = input.parentElement.parentElement;
      var activeBtn = row.querySelector('.att-btn.active');
      var status = activeBtn ? activeBtn.dataset.st : 'present';
      // 仅填充出勤学员
      if (status === 'present') {
        input.value = val;
        presentCount++;
        // 输入框闪烁效果
        input.style.transition = 'all 0.15s';
        input.style.background = '#fff3e0';
        input.style.borderColor = '#e65100';
        input.style.transform = 'scale(1.08)';
        setTimeout(function(el) {
          el.style.background = '';
          el.style.borderColor = '';
          el.style.transform = '';
        }, 300, input);
      }
    });

    // 按钮反馈
    var btn = this;
    var origText = btn.textContent;
    btn.textContent = '✅ 已填充 ' + presentCount + ' 人';
    btn.style.background = '#2e7d32';
    btn.style.borderColor = '#1b5e20';
    btn.style.transform = 'scale(1.05)';
    setTimeout(function() {
      btn.textContent = origText;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.style.transform = '';
    }, 1200);

    // 顶部消息提示
    var msgEl = document.getElementById('att-msg');
    if (msgEl) {
      msgEl.textContent = '📌 已填充 ' + presentCount + ' 名出勤学员扣 ' + val + ' 课时，请点击保存';
      msgEl.style.color = '#e65100';
      msgEl.style.fontWeight = 'bold';
    }
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
    var studentDeductions = {};

    area.querySelectorAll('tbody tr').forEach(function(row) {
      var sid = parseInt(row.querySelector('.att-btn').dataset.sid);
      var activeBtn = row.querySelector('.att-btn.active');
      var status = activeBtn ? activeBtn.dataset.st : 'present';
      var deducted = parseInt(row.querySelector('.att-deduct').value) || 0;
      records.push({ studentId: sid, status: status, deducted: deducted });

      if (status === 'present' && deducted > 0) {
        studentDeductions[sid] = (studentDeductions[sid] || 0) + deducted;
      }
    });

    var studentList = getStudents();
    Object.keys(studentDeductions).forEach(function(sid) {
      var s = studentList.find(function(x) { return x.id == parseInt(sid); });
      if (s) { s.consumedLessons = (s.consumedLessons || 0) + studentDeductions[sid]; }
    });
    saveStudents(studentList);

    var all = getAttendance().filter(function(a) { return !(a.classId == classId && a.date == date); });
    all.push({ id: Date.now(), classId: classId, date: date, records: records, operator: getOperatorName() });
    saveAttendance(all);
    document.getElementById('att-msg').textContent = '✅ 点名已保存，课时已更新';
    document.getElementById('att-msg').style.color = '#5a9';
    renderAttendanceHistory();
    renderAttendanceStats();
    renderDailyAttendanceTable(date);
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
    if (a.operator) html += ' · <span style="color:#999; font-size:0.75em;">' + a.operator + '</span>';
    if (hasAdminPermission()) html += ' <a href="#" class="del-att" data-id="' + a.id + '" style="color:#e88; font-size:0.8em;">删除</a>';
    html += '</div>';
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-att').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      var att = getAttendance().find(function(a) { return a.id == id; });
      if (!att) return;

      // 计算将恢复的课时
      var restoreInfo = [];
      var studentList = getStudents();
      att.records.forEach(function(r) {
        if (r.deducted > 0 && r.status === 'present') {
          var s = studentList.find(function(x) { return x.id === r.studentId; });
          if (s) restoreInfo.push(s.name + '（恢复' + r.deducted + '课时）');
        }
      });

      var confirmMsg = '确定撤销该次点名？';
      if (restoreInfo.length > 0) {
        confirmMsg += '\n\n将恢复以下学员的课时：\n' + restoreInfo.join('\n');
      }
      if (!confirm(confirmMsg)) return;

      // 恢复课时
      att.records.forEach(function(r) {
        if (r.deducted > 0 && r.status === 'present') {
          var s = studentList.find(function(x) { return x.id === r.studentId; });
          if (s) {
            s.consumedLessons = Math.max(0, (s.consumedLessons || 0) - r.deducted);
          }
        }
      });
      saveStudents(studentList);

      // 删除点名记录
      saveAttendance(getAttendance().filter(function(a) { return a.id != id; }));
      renderAttendanceHistory();
      renderAttendanceStats();
      renderStudents();
      updateOverview();
    });
  });
}

// ============================================================
//  出勤统计
// ============================================================
function renderAttendanceStats() {
  var container = document.getElementById('attendance-stats');
  if (!container) return;

  var attendance = getAttendance();
  var classes = getClasses();
  var students = getStudents();

  if (attendance.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">点名后将自动生成统计数据</p>';
    return;
  }

  // === 按班级统计 ===
  var classStats = {};
  attendance.forEach(function(a) {
    if (!classStats[a.classId]) {
      classStats[a.classId] = { present: 0, leave: 0, absent: 0, total: 0 };
    }
    a.records.forEach(function(r) {
      classStats[a.classId].total++;
      if (r.status === 'present') classStats[a.classId].present++;
      else if (r.status === 'leave') classStats[a.classId].leave++;
      else classStats[a.classId].absent++;
    });
  });

  // === 按学员统计 ===
  var studentStats = {};
  attendance.forEach(function(a) {
    a.records.forEach(function(r) {
      if (!studentStats[r.studentId]) {
        studentStats[r.studentId] = { present: 0, leave: 0, absent: 0, total: 0 };
      }
      studentStats[r.studentId].total++;
      if (r.status === 'present') studentStats[r.studentId].present++;
      else if (r.status === 'leave') studentStats[r.studentId].leave++;
      else studentStats[r.studentId].absent++;
    });
  });

  // === 全局统计 ===
  var global = { present: 0, leave: 0, absent: 0, total: 0 };
  Object.keys(studentStats).forEach(function(sid) {
    global.present += studentStats[sid].present;
    global.leave += studentStats[sid].leave;
    global.absent += studentStats[sid].absent;
    global.total += studentStats[sid].total;
  });
  var globalRate = global.total > 0 ? Math.round(global.present / global.total * 100) : 0;

  var html = '';

  // 全局概览
  html += '<div class="detail-stats-row" style="margin-bottom:20px;">';
  html += '<div class="detail-stat-mini"><div class="mini-number green">' + globalRate + '%</div><div class="mini-label">📈 总出勤率</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + global.total + '</div><div class="mini-label">📋 总点名次数</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number green">' + global.present + '</div><div class="mini-label">✅ 出勤</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number orange">' + global.leave + '</div><div class="mini-label">⭕ 请假</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number red">' + global.absent + '</div><div class="mini-label">❌ 缺勤</div></div>';
  html += '</div>';

  // 按班级
  html += '<h4 style="color:#5d4037; margin-bottom:10px;">📦 按班级</h4>';
  var classKeys = Object.keys(classStats);
  if (classKeys.length > 0) {
    html += '<div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:20px;">';
    classKeys.forEach(function(cid) {
      var cs = classStats[cid];
      var rate = cs.total > 0 ? Math.round(cs.present / cs.total * 100) : 0;
      var cls = classes.find(function(c) { return c.id == parseInt(cid); });
      var rateColor = rate >= 90 ? '#5a9' : rate >= 70 ? '#e8a040' : '#e88';
      html += '<div style="flex:1 1 220px; min-width:180px; background:#fff; border-radius:10px; padding:14px 18px; box-shadow:0 1px 6px rgba(0,0,0,0.05);">';
      html += '<strong style="color:#5d4037;">' + (cls ? cls.name : '(已删)') + '</strong>';
      html += '<div style="margin-top:6px; font-size:2em; font-weight:bold; color:' + rateColor + ';">' + rate + '%</div>';
      html += '<div style="font-size:0.8em; color:#888;">✅' + cs.present + ' ⭕' + cs.leave + ' ❌' + cs.absent + '（共' + cs.total + '次）</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  // 按学员（在读，有点名记录）
  html += '<h4 style="color:#5d4037; margin-bottom:10px;">👨‍🎓 按学员</h4>';
  var studentKeys = Object.keys(studentStats);
  // 只显示在读学员
  var activeStudentKeys = studentKeys.filter(function(sid) {
    var s = students.find(function(x) { return x.id == parseInt(sid); });
    return s && s.status === '在读';
  });
  // 按出勤率排序（从低到高，低于80%的排前面）
  activeStudentKeys.sort(function(a, b) {
    var rateA = studentStats[a].total > 0 ? studentStats[a].present / studentStats[a].total : 1;
    var rateB = studentStats[b].total > 0 ? studentStats[b].present / studentStats[b].total : 1;
    return rateA - rateB;
  });

  if (activeStudentKeys.length > 0) {
    html += '<table><thead><tr><th>学员</th><th>出勤率</th><th>出勤</th><th>请假</th><th>缺勤</th><th>总计</th></tr></thead><tbody>';
    activeStudentKeys.forEach(function(sid) {
      var ss = studentStats[sid];
      var rate = ss.total > 0 ? Math.round(ss.present / ss.total * 100) : 0;
      var s = students.find(function(x) { return x.id == parseInt(sid); });
      var rateColor = rate >= 90 ? '#5a9' : rate >= 70 ? '#e8a040' : '#e88';
      html += '<tr>';
      html += '<td><strong>' + (s ? s.name : '(已删)') + '</strong></td>';
      html += '<td style="font-weight:bold; color:' + rateColor + ';">' + rate + '%</td>';
      html += '<td>✅ ' + ss.present + '</td>';
      html += '<td>⭕ ' + ss.leave + '</td>';
      html += '<td>❌ ' + ss.absent + '</td>';
      html += '<td>' + ss.total + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:#999; font-size:0.9em;">暂无在读学员的考勤数据</p>';
  }

  container.innerHTML = html;
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
    teacherName: getOperatorName(),
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
      (hasAdminPermission() ? '<a href="#" class="del-rec" data-id="' + r.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>' : ''),
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
//  课消日志
// ============================================================
function getLessonCorrections() {
  return JSON.parse(localStorage.getItem('chunxiao-lesson-corrections') || '[]');
}
function saveLessonCorrections(list) {
  localStorage.setItem('chunxiao-lesson-corrections', JSON.stringify(list));
}

function loadLessonLog() {
  refreshLogStudentSelects();
  renderLessonLog();
  updateLessonLogSummary();
  renderLowLessonAlerts();
  document.getElementById('log-manual-date').value = new Date().toISOString().split('T')[0];

  // 手动调整按钮（仅管理员）
  var addManualBtn = document.getElementById('log-add-manual-btn');
  if (addManualBtn) {
    if (!hasAdminPermission()) { addManualBtn.style.display = 'none'; }
    else addManualBtn.onclick = function() {
      document.getElementById('log-manual-form').style.display = 'block';
      refreshLogStudentSelects();
    };
  }
  var cancelManualBtn = document.getElementById('log-manual-cancel-btn');
  if (cancelManualBtn) cancelManualBtn.onclick = function() {
    document.getElementById('log-manual-form').style.display = 'none';
    document.getElementById('log-manual-msg').textContent = '';
  };
  var saveManualBtn = document.getElementById('log-manual-save-btn');
  if (saveManualBtn) saveManualBtn.onclick = saveManualCorrection;

  // 筛选按钮
  var filterBtn = document.getElementById('log-filter-btn');
  if (filterBtn) filterBtn.onclick = function() { renderLessonLog(); updateLessonLogSummary(); };
  var clearFilterBtn = document.getElementById('log-clear-filter-btn');
  if (clearFilterBtn) clearFilterBtn.onclick = function() {
    document.getElementById('log-filter-student').value = '';
    document.getElementById('log-filter-from').value = '';
    document.getElementById('log-filter-to').value = '';
    renderLessonLog();
    updateLessonLogSummary();
    renderLowLessonAlerts();
  };
}

function refreshLogStudentSelects() {
  var students = getStudents();
  var html = '<option value="">全部学员</option>' +
    students.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
  var filterSel = document.getElementById('log-filter-student');
  if (filterSel) { var prev = filterSel.value; filterSel.innerHTML = html; filterSel.value = prev; }
  var manualSel = document.getElementById('log-manual-student');
  if (manualSel) {
    manualSel.innerHTML = '<option value="">-- 选择 --</option>' +
      students.map(function(s) { return '<option value="' + s.id + '">' + s.name + '（剩' + (s.totalLessons - (s.consumedLessons || 0)) + '节）</option>'; }).join('');
  }
}

function getFilteredLog() {
  var students = getStudents();
  var classes = getClasses();
  var corrections = getLessonCorrections();
  var attendance = getAttendance();
  var filterStudentId = document.getElementById('log-filter-student').value;
  var filterFrom = document.getElementById('log-filter-from').value;
  var filterTo = document.getElementById('log-filter-to').value;

  var log = [];

  // 从点名记录提取
  attendance.forEach(function(a) {
    a.records.forEach(function(r) {
      if (r.deducted > 0) {
        var s = students.find(function(x) { return x.id === r.studentId; });
        var cls = classes.find(function(c) { return c.id === a.classId; });
        log.push({
          id: 'att-' + a.id + '-' + r.studentId,
          date: a.date,
          studentId: r.studentId,
          studentName: s ? s.name : '(已删)',
          className: cls ? cls.name : '(已删)',
          type: '点名扣课',
          amount: r.deducted,
          reason: r.status === 'present' ? '出勤扣课' : (r.status === 'leave' ? '请假扣课' : '缺勤扣课'),
          operator: a.operator || ''
        });
      }
    });
  });

  // 手动调整
  corrections.forEach(function(c) {
    var s = students.find(function(x) { return x.id === c.studentId; });
    log.push({
      id: 'corr-' + c.id,
      date: c.date,
      studentId: c.studentId,
      studentName: s ? s.name : '(已删)',
      className: '--',
      type: '手动调整',
      amount: c.amount,
      reason: c.reason || '手动调整',
      operator: c.operator || ''
    });
  });

  // 筛选
  if (filterStudentId) {
    log = log.filter(function(l) { return l.studentId === parseInt(filterStudentId); });
  }
  if (filterFrom) {
    log = log.filter(function(l) { return l.date >= filterFrom; });
  }
  if (filterTo) {
    log = log.filter(function(l) { return l.date <= filterTo; });
  }

  // 按日期倒序
  log.sort(function(a, b) { return b.date.localeCompare(a.date) || (b.id < a.id ? -1 : 1); });

  return log;
}

function renderLessonLog() {
  var container = document.getElementById('lessonlog-table-wrap');
  if (!container) return;

  var log = getFilteredLog();

  if (log.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无课消记录，点名扣课时后自动生成</p>';
    return;
  }

  var html = '<table><thead><tr>';
  html += '<th>日期</th><th>学员</th><th>班级</th><th>类型</th><th>扣除课时</th><th>原因</th><th>操作</th>';
  html += '</tr></thead><tbody>';

  log.forEach(function(l) {
    var amountColor = l.type === '手动调整' && l.amount < 0 ? '#5a9' : '#e88';
    var amountText = l.amount > 0 ? '-' + l.amount : ('+' + Math.abs(l.amount));
    html += '<tr>';
    html += '<td>' + l.date + '</td>';
    html += '<td><a href="#" class="log-student-link" data-sid="' + l.studentId + '">' + l.studentName + '</a></td>';
    html += '<td>' + l.className + '</td>';
    html += '<td><span class="log-type-badge ' + (l.type === '手动调整' ? 'log-type-manual' : 'log-type-att') + '">' + l.type + '</span></td>';
    html += '<td style="font-weight:bold; color:' + amountColor + ';">' + amountText + '</td>';
    html += '<td style="font-size:0.85em; color:#888;">' + l.reason + (l.operator ? ' <span style="color:#bbb; font-size:0.85em;">· ' + l.operator + '</span>' : '') + '</td>';
    var actionCell = '<span style="color:#ccc; font-size:0.85em;">自动</span>';
    if (l.type === '手动调整' && hasAdminPermission()) {
      actionCell = '<a href="#" class="del-correction" data-id="' + l.id.replace('corr-', '') + '" style="color:#e88; font-size:0.85em;">删除</a>';
    } else if (l.type === '手动调整') {
      actionCell = '<span style="color:#ccc; font-size:0.85em;">手动</span>';
    }
    html += '<td>' + actionCell + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // 点击学员名 → 打开详情
  container.querySelectorAll('.log-student-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      showStudentDetail(parseInt(link.dataset.sid));
    });
  });

  // 删除手动调整
  container.querySelectorAll('.del-correction').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('删除该手动调整记录？将撤销对应的课时变动。')) return;
      deleteManualCorrection(id);
    });
  });
}

function saveManualCorrection() {
  var studentId = parseInt(document.getElementById('log-manual-student').value);
  var date = document.getElementById('log-manual-date').value;
  var amount = parseInt(document.getElementById('log-manual-amount').value) || 0;
  var reason = document.getElementById('log-manual-reason').value.trim();
  var msgEl = document.getElementById('log-manual-msg');

  if (!studentId || !date || amount === 0) {
    msgEl.textContent = '⚠️ 请选择学员、日期并填写非零数量';
    msgEl.style.color = '#e88'; return;
  }

  if (!reason) {
    msgEl.textContent = '⚠️ 请填写调整原因';
    msgEl.style.color = '#e88'; return;
  }

  // 更新学员已消耗课时
  var students = getStudents();
  var s = students.find(function(x) { return x.id === studentId; });
  if (!s) { msgEl.textContent = '⚠️ 学员不存在'; msgEl.style.color = '#e88'; return; }

  var newConsumed = (s.consumedLessons || 0) + amount;
  if (newConsumed < 0) newConsumed = 0;
  if (newConsumed > s.totalLessons && amount > 0) {
    if (!confirm('该操作将使已消耗(' + newConsumed + ')超过总课时(' + s.totalLessons + ')，确定继续？')) return;
  }
  s.consumedLessons = newConsumed;
  saveStudents(students);

  // 保存调整记录
  var corrections = getLessonCorrections();
  corrections.unshift({
    id: Date.now(),
    studentId: studentId,
    date: date,
    amount: amount,
    reason: reason,
    createdAt: new Date().toLocaleString('zh-CN'),
    operator: getOperatorName()
  });
  saveLessonCorrections(corrections);

  msgEl.textContent = '✅ 已保存（' + (amount > 0 ? '扣' + amount + '课时' : '退' + Math.abs(amount) + '课时') + '）';
  msgEl.style.color = '#5a9';
  document.getElementById('log-manual-form').style.display = 'none';
  renderLessonLog();
  updateLessonLogSummary();
  renderLowLessonAlerts();
  renderStudents(); // 刷新学员列表（已消耗数字变化）
  updateOverview();
}

function deleteManualCorrection(id) {
  var corrections = getLessonCorrections();
  var c = corrections.find(function(x) { return x.id === id; });
  if (!c) return;

  // 撤销课时变动
  var students = getStudents();
  var s = students.find(function(x) { return x.id === c.studentId; });
  if (s) {
    s.consumedLessons = Math.max(0, (s.consumedLessons || 0) - c.amount);
    saveStudents(students);
  }

  // 删除记录
  corrections = corrections.filter(function(x) { return x.id !== id; });
  saveLessonCorrections(corrections);
  renderLessonLog();
  updateLessonLogSummary();
  renderLowLessonAlerts();
  renderStudents();
  updateOverview();
}

function updateLessonLogSummary() {
  var log = getFilteredLog();
  var students = getStudents();

  // 累计扣课时
  var totalDeducted = log.reduce(function(sum, l) { return sum + Math.max(0, l.amount); }, 0);

  // 本月扣课时
  var now = new Date();
  var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var monthDeducted = log.filter(function(l) { return l.date.startsWith(thisMonth); })
    .reduce(function(sum, l) { return sum + Math.max(0, l.amount); }, 0);

  // 涉及学员（去重）
  var studentIds = {};
  log.forEach(function(l) { studentIds[l.studentId] = true; });
  var involvedCount = Object.keys(studentIds).length;

  // 低课时学员
  var lowCount = students.filter(function(s) {
    return (s.totalLessons - (s.consumedLessons || 0)) <= 2 && s.status === '在读';
  }).length;

  var totalEl = document.getElementById('log-total-deducted');
  var monthEl = document.getElementById('log-month-deducted');
  var involvedEl = document.getElementById('log-involved-students');
  var lowEl = document.getElementById('log-low-lesson-count');

  if (totalEl) totalEl.textContent = totalDeducted;
  if (monthEl) monthEl.textContent = monthDeducted;
  if (involvedEl) involvedEl.textContent = involvedCount;
  if (lowEl) lowEl.textContent = lowCount;
}

function renderLowLessonAlerts() {
  var container = document.getElementById('low-lesson-alerts');
  if (!container) return;

  var students = getStudents().filter(function(s) {
    return s.status === '在读' && (s.totalLessons - (s.consumedLessons || 0)) <= 2;
  });

  if (students.length === 0) {
    container.innerHTML = '<p style="color:#5a9; font-size:0.9em;">✅ 所有在读学员课时充足</p>';
    return;
  }

  var html = '<div style="display:flex; flex-wrap:wrap; gap:12px;">';
  students.forEach(function(s) {
    var remaining = s.totalLessons - (s.consumedLessons || 0);
    var severity = remaining <= 0 ? '#e88' : '#e8a040';
    html += '<div style="flex:1 1 260px; min-width:220px; background:#fff; border-radius:10px; padding:14px 18px; box-shadow:0 1px 6px rgba(0,0,0,0.05); border-left:4px solid ' + severity + ';">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += '<strong style="color:#5d4037;">' + s.name + '</strong>';
    html += '<span style="color:' + severity + '; font-weight:bold; font-size:1.1em;">剩 ' + remaining + ' 节</span>';
    html += '</div>';
    html += '<p style="margin:4px 0 0; color:#888; font-size:0.85em;">' + s.course + ' · 总' + s.totalLessons + '课时 · 已消' + (s.consumedLessons || 0) + '</p>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
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
// 获取当前操作人姓名
function getOperatorName() {
  var user = Auth.currentUser();
  return user ? (user.name || user.email) : '未知';
}

// 是否管理员（有全部权限）
function hasAdminPermission() {
  return Auth.isAdmin();
}

function getStudents() {
  return JSON.parse(localStorage.getItem('chunxiao-students') || '[]');
}
function saveStudents(list) {
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
}

function loadStudents() {
  renderStudents();

  // 搜索输入（实时筛选）
  var searchInput = document.getElementById('student-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() { renderStudents(); });
  }

  // 课程下拉筛选
  var courseFilter = document.getElementById('student-filter-course');
  if (courseFilter) {
    courseFilter.addEventListener('change', function() { renderStudents(); });
  }

  // 状态下拉筛选
  var statusFilter = document.getElementById('student-filter-status');
  if (statusFilter) {
    statusFilter.addEventListener('change', function() { renderStudents(); });
  }

  // 快速筛选 chips
  document.querySelectorAll('.filter-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      var filter = chip.dataset.filter;
      // 同步更新下拉框
      if (filter === 'active') { document.getElementById('student-filter-status').value = '在读'; }
      else if (filter === 'paused') { document.getElementById('student-filter-status').value = '休学'; }
      else { document.getElementById('student-filter-status').value = ''; }
      renderStudents();
    });
  });

  // 导出CSV
  var exportBtn = document.getElementById('export-students-btn');
  if (exportBtn) {
    if (!hasAdminPermission()) { exportBtn.style.display = 'none'; }
    else exportBtn.onclick = exportStudentsCSV;
  }

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
      document.getElementById('s-lessons').value = '';
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

      var totalLessons = parseInt(document.getElementById('s-lessons').value) || 0;
      // 编辑时保留已消耗课时
      var oldStudent = editId ? getStudents().find(function(s) { return s.id == editId; }) : null;
      var consumed = oldStudent ? (oldStudent.consumedLessons || 0) : 0;

      var opName = getOperatorName();
      var student = {
        id: editId || Date.now(),
        name: name,
        age: document.getElementById('s-age').value.trim() || '--',
        course: document.getElementById('s-course').value || '--',
        parent: document.getElementById('s-parent').value.trim() || '--',
        phone: document.getElementById('s-phone').value.trim() || '--',
        status: document.getElementById('s-status').value,
        totalLessons: totalLessons,
        consumedLessons: consumed,
        addedAt: editId ? (oldStudent ? oldStudent.addedAt : new Date().toISOString()) : new Date().toISOString(),
        addedBy: editId ? (oldStudent ? oldStudent.addedBy : opName) : opName,
        lastModifiedBy: opName
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

// 获取当前筛选条件
function getStudentFilters() {
  var searchEl = document.getElementById('student-search');
  var courseEl = document.getElementById('student-filter-course');
  var statusEl = document.getElementById('student-filter-status');
  var activeChip = document.querySelector('.filter-chip.active');
  var chipFilter = activeChip ? activeChip.dataset.filter : 'all';

  return {
    search: searchEl ? searchEl.value.trim().toLowerCase() : '',
    course: courseEl ? courseEl.value : '',
    status: statusEl ? statusEl.value : '',
    chip: chipFilter
  };
}

// 应用筛选
function applyStudentFilters(list) {
  var f = getStudentFilters();
  var filtered = list;

  // 搜索（姓名或家长）
  if (f.search) {
    filtered = filtered.filter(function(s) {
      return s.name.toLowerCase().indexOf(f.search) !== -1 ||
             (s.parent && s.parent.toLowerCase().indexOf(f.search) !== -1);
    });
  }

  // 课程筛选
  if (f.course) {
    filtered = filtered.filter(function(s) { return s.course === f.course; });
  }

  // 状态筛选（下拉优先，chip 作为快速入口）
  if (f.status) {
    filtered = filtered.filter(function(s) { return s.status === f.status; });
  } else if (f.chip === 'active') {
    filtered = filtered.filter(function(s) { return s.status === '在读'; });
  } else if (f.chip === 'paused') {
    filtered = filtered.filter(function(s) { return s.status === '休学'; });
  } else if (f.chip === 'low') {
    filtered = filtered.filter(function(s) {
      return s.status === '在读' && (s.totalLessons - (s.consumedLessons || 0)) <= 2;
    });
  }

  return filtered;
}

// 导出学生CSV
function exportStudentsCSV() {
  var list = applyStudentFilters(getStudents());
  if (list.length === 0) { alert('没有可导出的学员数据'); return; }

  var header = ['姓名', '年龄', '课程', '家长', '电话', '总课时', '已消耗', '剩余', '状态'];
  var rows = [header.join(',')];
  list.forEach(function(s) {
    var remaining = s.totalLessons - (s.consumedLessons || 0);
    rows.push([
      '"' + s.name + '"',
      s.age,
      '"' + s.course + '"',
      '"' + (s.parent || '') + '"',
      '"' + (s.phone || '') + '"',
      s.totalLessons || 0,
      s.consumedLessons || 0,
      remaining,
      s.status
    ].join(','));
  });

  var csvContent = '﻿' + rows.join('\n'); // BOM for Excel Chinese
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '学员名单_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function renderStudents() {
  var container = document.getElementById('students-list');
  var countEl = document.getElementById('student-count');
  var resultEl = document.getElementById('student-filter-result');
  if (!container) return;

  var allList = getStudents();
  var list = applyStudentFilters(allList);
  if (countEl) countEl.textContent = allList.length;

  // 筛选结果提示
  if (resultEl) {
    var f = getStudentFilters();
    var hasFilter = f.search || f.course || f.status || (f.chip && f.chip !== 'all');
    if (hasFilter) {
      resultEl.style.display = 'block';
      resultEl.textContent = '找到 ' + list.length + ' 名学员（共 ' + allList.length + ' 名）';
    } else {
      resultEl.style.display = 'none';
    }
  }

  if (allList.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无学生，点击"+ 添加学生"开始</p>';
    return;
  }

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">😕 没有匹配的学员，试试调整筛选条件</p>';
    return;
  }

  var html = '<table><thead><tr><th>姓名</th><th>年龄</th><th>课程</th><th>家长</th><th>总课时</th><th>已消耗</th><th>剩余</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  list.forEach(function(s) {
    var total = s.totalLessons || 0;
    var consumed = s.consumedLessons || 0;
    var remaining = total - consumed;
    var remainColor = remaining <= 2 ? '#e88' : remaining <= 5 ? '#e8a040' : '#5a9';
    var statusColor = s.status === '在读' ? '#5a9' : s.status === '休学' ? '#e88' : '#999';
    html += '<tr>';
    html += '<td><a href="#" class="view-student-detail" data-sid="' + s.id + '">' + s.name + '</a></td>';
    html += '<td>' + s.age + '</td>';
    html += '<td>' + s.course + '</td>';
    html += '<td>' + s.parent + '</td>';
    html += '<td>' + total + '</td>';
    html += '<td>' + consumed + '</td>';
    html += '<td style="color:' + remainColor + '; font-weight:bold;">' + remaining + '</td>';
    html += '<td><span style="color:' + statusColor + '; font-weight:bold;">' + s.status + '</span></td>';
    html += '<td>';
    html += '<a href="#" class="edit-student" data-id="' + s.id + '">✏️</a> ';
    if (hasAdminPermission()) html += '<a href="#" class="del-student" data-id="' + s.id + '" style="color:#e88;">🗑️</a>';
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
      document.getElementById('s-lessons').value = s.totalLessons || 0;
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

  // 绑定学生详情（点击姓名）
  container.querySelectorAll('.view-student-detail').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      showStudentDetail(parseInt(link.dataset.sid));
    });
  });
}

// ============================================================
//  学生个人详情弹窗
// ============================================================
function showStudentDetail(studentId) {
  var s = getStudents().find(function(x) { return x.id === studentId; });
  if (!s) return;

  // 获取学生所属班级
  var allClasses = getClasses();
  var studentClasses = allClasses.filter(function(c) {
    return c.studentIds.indexOf(studentId) !== -1;
  });

  // 课消日志（从点名记录中提取）
  var allAttendance = getAttendance();
  var lessonLog = [];
  allAttendance.forEach(function(a) {
    var rec = a.records.find(function(r) { return r.studentId === studentId; });
    if (rec) {
      var cls = allClasses.find(function(c) { return c.id === a.classId; });
      lessonLog.push({
        date: a.date,
        className: cls ? cls.name : '(已删)',
        status: rec.status,
        deducted: rec.deducted || 0
      });
    }
  });
  // 按日期倒序
  lessonLog.sort(function(a, b) { return b.date.localeCompare(a.date); });

  // 出勤统计
  var stats = { present: 0, leave: 0, absent: 0, totalDeducted: 0 };
  lessonLog.forEach(function(log) {
    if (log.status === 'present') stats.present++;
    else if (log.status === 'leave') stats.leave++;
    else if (log.status === 'absent') stats.absent++;
    stats.totalDeducted += log.deducted;
  });
  var totalAtt = stats.present + stats.leave + stats.absent;
  var presentRate = totalAtt > 0 ? Math.round(stats.present / totalAtt * 100) : 0;

  // 上课记录（学生所在班级的上课记录）
  var allRecords = getRecords();
  var classRecords = [];
  studentClasses.forEach(function(cls) {
    allRecords.forEach(function(r) {
      if (r.classId === cls.id) {
        classRecords.push({
          date: r.date,
          className: cls.name,
          content: r.content,
          notes: r.notes,
          time: r.time,
          teacherName: r.teacherName
        });
      }
    });
  });
  classRecords.sort(function(a, b) { return b.date.localeCompare(a.date); });

  // 构建弹窗 HTML
  var total = s.totalLessons || 0;
  var consumed = s.consumedLessons || 0;
  var remaining = total - consumed;
  var progressPercent = total > 0 ? Math.min(100, Math.round(consumed / total * 100)) : 0;
  var barClass = remaining <= 2 ? ' warning' : '';
  var statusColor = s.status === '在读' ? '#5a9' : s.status === '休学' ? '#e88' : '#999';

  var html = '';
  html += '<div class="student-detail-overlay" id="student-detail-overlay">';
  html += '<div class="student-detail-panel">';

  // Header
  html += '<div class="student-detail-header">';
  html += '<h3>👨‍🎓 ' + s.name + ' <span style="font-size:0.65em; color:' + statusColor + '; background:rgba(255,255,255,0.2); padding:2px 10px; border-radius:10px;">' + s.status + '</span></h3>';
  html += '<button class="student-detail-close" id="student-detail-close">✕</button>';
  html += '</div>';

  // Body
  html += '<div class="student-detail-body">';

  // 1. 课时进度条
  html += '<div class="student-lesson-bar-wrap">';
  html += '<div class="student-lesson-bar-header">';
  html += '<span>📊 课时进度</span>';
  html += '<strong>' + (remaining <= 2 ? '⚠️ ' : '') + '剩余 ' + remaining + ' / 总 ' + total + ' 课时</strong>';
  html += '</div>';
  html += '<div class="student-lesson-bar"><div class="student-lesson-bar-fill' + barClass + '" style="width:' + progressPercent + '%;"></div></div>';
  html += '<div class="student-lesson-legend">';
  html += '<span>已消耗：<strong>' + consumed + '</strong> 课时</span>';
  html += '<span>进度：<strong>' + progressPercent + '%</strong></span>';
  html += '</div>';
  html += '</div>';

  // 2. 基本信息
  html += '<div class="detail-section-title">📋 基本信息</div>';
  html += '<div class="detail-info-grid">';
  html += '<div class="detail-info-item"><span class="detail-info-label">年龄</span><span class="detail-info-value">' + (s.age || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">课程</span><span class="detail-info-value">' + (s.course || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">家长姓名</span><span class="detail-info-value">' + (s.parent || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">家长电话</span><span class="detail-info-value">' + (s.phone || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">总课时</span><span class="detail-info-value">' + total + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">已消耗</span><span class="detail-info-value" style="color:#e88;">' + consumed + '</span></div>';
  if (s.lastModifiedBy) html += '<div class="detail-info-item"><span class="detail-info-label">最后修改</span><span class="detail-info-value" style="font-size:0.85em;">🖊️ ' + s.lastModifiedBy + '</span></div>';
  html += '</div>';

  // 3. 所属班级
  html += '<div class="detail-section-title">📦 所属班级 <span class="count-badge">(' + studentClasses.length + '个)</span></div>';
  if (studentClasses.length > 0) {
    html += '<div class="detail-class-chips">';
    studentClasses.forEach(function(cls) {
      html += '<span class="detail-class-chip">' + cls.name + ' · ' + cls.day + ' ' + cls.timeSlot + '</span>';
    });
    html += '</div>';
  } else {
    html += '<p style="color:#999; font-size:0.9em;">尚未分配到班级</p>';
  }

  // 4. 出勤统计
  html += '<div class="detail-section-title">📊 出勤统计 <span class="count-badge">(共' + totalAtt + '次)</span></div>';
  html += '<div class="detail-stats-row">';
  html += '<div class="detail-stat-mini"><div class="mini-number green">' + stats.present + '</div><div class="mini-label">✅ 出勤</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number orange">' + stats.leave + '</div><div class="mini-label">⭕ 请假</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number red">' + stats.absent + '</div><div class="mini-label">❌ 缺勤</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + presentRate + '%</div><div class="mini-label">📈 出勤率</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + stats.totalDeducted + '</div><div class="mini-label">📉 共扣课时</div></div>';
  html += '</div>';

  // 5. 课消日志
  html += '<div class="detail-section-title">📜 课消日志 <span class="count-badge">(' + lessonLog.length + '条)</span></div>';
  if (lessonLog.length > 0) {
    html += '<table class="detail-log-table"><thead><tr><th>日期</th><th>班级</th><th>状态</th><th>扣课时</th></tr></thead><tbody>';
    lessonLog.forEach(function(log) {
      var statusLabel = log.status === 'present' ? '✅ 出勤' : log.status === 'leave' ? '⭕ 请假' : '❌ 缺勤';
      html += '<tr>';
      html += '<td>' + log.date + '</td>';
      html += '<td>' + log.className + '</td>';
      html += '<td>' + statusLabel + '</td>';
      html += '<td style="font-weight:bold; color:' + (log.deducted > 0 ? '#e88' : '#999') + ';">' + (log.deducted > 0 ? '-' + log.deducted : '0') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:#999; font-size:0.9em; text-align:center; padding:16px;">暂无课消记录</p>';
  }

  // 6. 上课记录
  html += '<div class="detail-section-title">📝 上课记录 <span class="count-badge">(' + classRecords.length + '条)</span></div>';
  if (classRecords.length > 0) {
    classRecords.forEach(function(rec) {
      html += '<div class="detail-record-card">';
      html += '<div class="rec-meta"><span>' + rec.className + ' · ' + rec.date + '</span><span>' + rec.time + ' · ' + rec.teacherName + '</span></div>';
      html += '<div class="rec-content">📖 ' + rec.content + '</div>';
      if (rec.notes) html += '<div class="rec-notes">📌 ' + rec.notes + '</div>';
      html += '</div>';
    });
  } else {
    html += '<p style="color:#999; font-size:0.9em; text-align:center; padding:16px;">暂无上课记录</p>';
  }

  html += '</div>'; // body
  html += '</div>'; // panel
  html += '</div>'; // overlay

  // 插入页面
  document.body.insertAdjacentHTML('beforeend', html);

  // ESC 关闭处理器
  var escHandler = function(e) {
    if (e.key === 'Escape') { hideStudentDetail(); }
  };
  document.addEventListener('keydown', escHandler);

  // 重写 hideStudentDetail 以清理 ESC 监听器（在绑定事件之前）
  var _origHide = hideStudentDetail;
  hideStudentDetail = function() {
    document.removeEventListener('keydown', escHandler);
    _origHide();
  };

  // 绑定关闭事件
  document.getElementById('student-detail-close').addEventListener('click', hideStudentDetail);
  document.getElementById('student-detail-overlay').addEventListener('click', function(e) {
    if (e.target === this) hideStudentDetail();
  });
}

function hideStudentDetail() {
  var overlay = document.getElementById('student-detail-overlay');
  if (overlay) overlay.remove();
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
        addedAt: new Date().toISOString(),
        addedBy: getOperatorName()
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
      '<p>👦 ' + a.student + ' | ' + a.type + (a.addedBy ? ' | 🖊️ ' + a.addedBy : '') + '</p>',
      (hasAdminPermission() ? '<a href="#" class="del-artwork" data-id="' + a.id + '" style="color:#e88; font-size:0.85em;">🗑️ 删除</a>' : ''),
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
  // 非管理员隐藏发布表单
  var formWrap = document.getElementById('announce-form-wrap');
  if (formWrap && !hasAdminPermission()) formWrap.style.display = 'none';
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
        author: getOperatorName()
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
      (hasAdminPermission() ? '<a href="#" class="del-ann" data-id="' + a.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>' : ''),
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
  var editable = hasAdminPermission() ? ' contenteditable="true"' : '';
  var editHint = hasAdminPermission() ? '点击单元格编辑' : '仅管理员可编辑';
  list.forEach(function(c, idx) {
    html += '<tr>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="name">' + c.name + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="age">' + c.age + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="duration">' + c.duration + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="time">' + c.time + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="capacity">' + c.capacity + '</td>';
    html += '<td><span style="color:#999; font-size:0.8em;">' + editHint + '</span></td>';
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
