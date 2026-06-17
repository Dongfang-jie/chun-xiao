/*
  春晓画室 - 管理端学生管理模块
  功能：学员 CRUD / 筛选 / CSV导出 / 详情弹窗
*/

// ============================================================
//  学生管理入口
// ============================================================
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

// ============================================================
//  筛选
// ============================================================
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

function applyStudentFilters(list) {
  var f = getStudentFilters();
  var filtered = list;

  if (f.search) {
    filtered = filtered.filter(function(s) {
      return s.name.toLowerCase().indexOf(f.search) !== -1 ||
             (s.parent && s.parent.toLowerCase().indexOf(f.search) !== -1);
    });
  }

  if (f.course) {
    filtered = filtered.filter(function(s) { return s.course === f.course; });
  }

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

// ============================================================
//  导出CSV
// ============================================================
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

// ============================================================
//  渲染学生列表
// ============================================================
function renderStudents() {
  var container = document.getElementById('students-list');
  var countEl = document.getElementById('student-count');
  var resultEl = document.getElementById('student-filter-result');
  if (!container) return;

  var allList = getStudents();
  var list = applyStudentFilters(allList);
  if (countEl) countEl.textContent = allList.length;

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

  var allClasses = getClasses();
  var studentClasses = allClasses.filter(function(c) {
    return c.studentIds.indexOf(studentId) !== -1;
  });

  var allAttendance = getAttendance();
  var lessonLog = [];
  allAttendance.forEach(function(a) {
    var rec = a.records.find(function(r) { return r.studentId === studentId; });
    if (rec) {
      var cls = allClasses.find(function(c) { return c.id === a.classId; });
      lessonLog.push({ date: a.date, className: cls ? cls.name : '(已删)', status: rec.status, deducted: rec.deducted || 0 });
    }
  });
  lessonLog.sort(function(a, b) { return b.date.localeCompare(a.date); });

  var stats = { present: 0, leave: 0, absent: 0, totalDeducted: 0 };
  lessonLog.forEach(function(log) {
    if (log.status === 'present') stats.present++;
    else if (log.status === 'leave') stats.leave++;
    else if (log.status === 'absent') stats.absent++;
    stats.totalDeducted += log.deducted;
  });
  var totalAtt = stats.present + stats.leave + stats.absent;
  var presentRate = totalAtt > 0 ? Math.round(stats.present / totalAtt * 100) : 0;

  var allRecords = getRecords();
  var classRecords = [];
  studentClasses.forEach(function(cls) {
    allRecords.forEach(function(r) {
      if (r.classId === cls.id) {
        classRecords.push({ date: r.date, className: cls.name, content: r.content, notes: r.notes, time: r.time, teacherName: r.teacherName });
      }
    });
  });
  classRecords.sort(function(a, b) { return b.date.localeCompare(a.date); });

  var total = s.totalLessons || 0;
  var consumed = s.consumedLessons || 0;
  var remaining = total - consumed;
  var progressPercent = total > 0 ? Math.min(100, Math.round(consumed / total * 100)) : 0;
  var barClass = remaining <= 2 ? ' warning' : '';
  var statusColor = s.status === '在读' ? '#5a9' : s.status === '休学' ? '#e88' : '#999';

  var html = '';
  html += '<div class="student-detail-overlay" id="student-detail-overlay">';
  html += '<div class="student-detail-panel">';
  html += '<div class="student-detail-header">';
  html += '<h3>👨‍🎓 ' + s.name + ' <span style="font-size:0.65em; color:' + statusColor + '; background:rgba(255,255,255,0.2); padding:2px 10px; border-radius:10px;">' + s.status + '</span></h3>';
  html += '<button class="student-detail-close" id="student-detail-close">✕</button>';
  html += '</div>';
  html += '<div class="student-detail-body">';

  // 课时进度条
  html += '<div class="student-lesson-bar-wrap">';
  html += '<div class="student-lesson-bar-header"><span>📊 课时进度</span><strong>' + (remaining <= 2 ? '⚠️ ' : '') + '剩余 ' + remaining + ' / 总 ' + total + ' 课时</strong></div>';
  html += '<div class="student-lesson-bar"><div class="student-lesson-bar-fill' + barClass + '" style="width:' + progressPercent + '%;"></div></div>';
  html += '<div class="student-lesson-legend"><span>已消耗：<strong>' + consumed + '</strong> 课时</span><span>进度：<strong>' + progressPercent + '%</strong></span></div>';
  html += '</div>';

  // 基本信息
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

  // 所属班级
  html += '<div class="detail-section-title">📦 所属班级 <span class="count-badge">(' + studentClasses.length + '个)</span></div>';
  if (studentClasses.length > 0) {
    html += '<div class="detail-class-chips">';
    studentClasses.forEach(function(cls) { html += '<span class="detail-class-chip">' + cls.name + ' · ' + cls.day + ' ' + cls.timeSlot + '</span>'; });
    html += '</div>';
  } else {
    html += '<p style="color:#999; font-size:0.9em;">尚未分配到班级</p>';
  }

  // 出勤统计
  html += '<div class="detail-section-title">📊 出勤统计 <span class="count-badge">(共' + totalAtt + '次)</span></div>';
  html += '<div class="detail-stats-row">';
  html += '<div class="detail-stat-mini"><div class="mini-number green">' + stats.present + '</div><div class="mini-label">✅ 出勤</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number orange">' + stats.leave + '</div><div class="mini-label">⭕ 请假</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number red">' + stats.absent + '</div><div class="mini-label">❌ 缺勤</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + presentRate + '%</div><div class="mini-label">📈 出勤率</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + stats.totalDeducted + '</div><div class="mini-label">📉 共扣课时</div></div>';
  html += '</div>';

  // 课消日志
  html += '<div class="detail-section-title">📜 课消日志 <span class="count-badge">(' + lessonLog.length + '条)</span></div>';
  if (lessonLog.length > 0) {
    html += '<table class="detail-log-table"><thead><tr><th>日期</th><th>班级</th><th>状态</th><th>扣课时</th></tr></thead><tbody>';
    lessonLog.forEach(function(log) {
      var statusLabel = log.status === 'present' ? '✅ 出勤' : log.status === 'leave' ? '⭕ 请假' : '❌ 缺勤';
      html += '<tr><td>' + log.date + '</td><td>' + log.className + '</td><td>' + statusLabel + '</td><td style="font-weight:bold; color:' + (log.deducted > 0 ? '#e88' : '#999') + ';">' + (log.deducted > 0 ? '-' + log.deducted : '0') + '</td></tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<p style="color:#999; font-size:0.9em; text-align:center; padding:16px;">暂无课消记录</p>';
  }

  // 上课记录
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

  document.body.insertAdjacentHTML('beforeend', html);

  var escHandler = function(e) { if (e.key === 'Escape') { hideStudentDetail(); } };
  document.addEventListener('keydown', escHandler);

  var _origHide = hideStudentDetail;
  hideStudentDetail = function() {
    document.removeEventListener('keydown', escHandler);
    _origHide();
  };

  document.getElementById('student-detail-close').addEventListener('click', hideStudentDetail);
  document.getElementById('student-detail-overlay').addEventListener('click', function(e) {
    if (e.target === this) hideStudentDetail();
  });
}

function hideStudentDetail() {
  var overlay = document.getElementById('student-detail-overlay');
  if (overlay) overlay.remove();
}
