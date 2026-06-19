/*
  春晓画室 - 管理端学生管理模块
  功能：学员 CRUD / 筛选 / CSV导出 / 详情弹窗
  支持多课程报名（enrollments 数组）
*/

// ============================================================
//  课程选项 & Enrollment 工具函数
// ============================================================
var COURSE_OPTIONS_HTML = [
  '<option value="">选择课程</option>',
  '<option>儿童创意画</option>',
  '<option>中国画</option>',
  '<option>素描</option>',
  '<option>色彩</option>',
  '<option>硬笔书法</option>',
  '<option>软笔书法</option>'
].join('');

// 兼容旧数据：无 enrollments 的 student 自动迁移
function normalizeStudentEnrollments(s) {
  if (!s.enrollments || !s.enrollments.length) {
    s.enrollments = [{ course: s.course || '--', totalLessons: s.totalLessons || 0, consumedLessons: s.consumedLessons || 0 }];
  }
  // 确保顶层字段与 enrollments 同步
  s.course = s.enrollments.map(function(e) { return e.course; }).join('、');
  s.totalLessons = s.enrollments.reduce(function(sum, e) { return sum + (e.totalLessons || 0); }, 0);
  s.consumedLessons = s.enrollments.reduce(function(sum, e) { return sum + (e.consumedLessons || 0); }, 0);
}

// 渲染报名课程行（用于编辑回填）
function renderEnrollmentRows(enrollments) {
  var wrap = document.getElementById('enrollments-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!enrollments || !enrollments.length) {
    enrollments = [{ course: '', totalLessons: 0, consumedLessons: 0 }];
  }
  enrollments.forEach(function(e, i) {
    addEnrollmentRow(e.course || '', e.totalLessons || 0, e.consumedLessons || 0, enrollments.length === 1);
  });
}

// 添加一个 enrollment 行到表单
function addEnrollmentRow(course, totalLessons, consumedLessons, hideRemove) {
  var wrap = document.getElementById('enrollments-wrap');
  if (!wrap) return;
  var consumedDisplay = consumedLessons > 0 ? ' <span style="font-size:0.75em; color:#e88;">(已消' + consumedLessons + '节)</span>' : '';
  var removeStyle = hideRemove ? 'visibility:hidden;' : '';
  var row = document.createElement('div');
  row.className = 'enrollment-row';
  row.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:6px;';
  row.innerHTML = '<select class="e-course" style="flex:1; min-width:130px; padding:8px; border:2px solid #e8d4c8; border-radius:6px;">' + COURSE_OPTIONS_HTML + '</select>'
    + '<input type="number" class="e-lessons" placeholder="总课次" min="0" value="' + (totalLessons || '') + '" style="flex:1; min-width:100px; padding:8px; border:2px solid #e8d4c8; border-radius:6px;">'
    + '<span class="e-consumed-info">' + consumedDisplay + '</span>'
    + '<button type="button" class="e-remove-btn" onclick="removeEnrollmentRow(this)" style="' + removeStyle + ' padding:4px 8px; background:#e88; color:#fff; border:none; border-radius:4px; cursor:pointer;">✕</button>';
  wrap.appendChild(row);
  var sel = row.querySelector('.e-course');
  if (sel && course) sel.value = course;
}

// 删除一个 enrollment 行
function removeEnrollmentRow(btn) {
  var wrap = document.getElementById('enrollments-wrap');
  if (!wrap) return;
  var rows = wrap.querySelectorAll('.enrollment-row');
  if (rows.length <= 1) return;
  btn.parentElement.remove();
  // 如果删到只剩 1 行，隐藏其删除按钮
  var remaining = wrap.querySelectorAll('.enrollment-row');
  if (remaining.length === 1) {
    var rmBtn = remaining[0].querySelector('.e-remove-btn');
    if (rmBtn) rmBtn.style.visibility = 'hidden';
  }
  // 确保之前隐藏的按钮恢复显示（从 1 行变多行时由 addEnrollmentRow 控制）
}

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
      document.getElementById('s-parent').value = '';
      document.getElementById('s-phone').value = '';
      var sParentEmail = document.getElementById('s-parentEmail');
      if (sParentEmail) sParentEmail.value = '';
      document.getElementById('s-status').value = '在读';
      renderEnrollmentRows([{ course: '', totalLessons: 0, consumedLessons: 0 }]);
    };
  }
  // 添加课程按钮
  var addEnrBtn = document.getElementById('add-enrollment-btn');
  if (addEnrBtn) {
    addEnrBtn.onclick = function() {
      var rows = document.querySelectorAll('#enrollments-wrap .enrollment-row');
      if (rows.length >= 6) { alert('最多支持 6 门课程'); return; }
      // 恢复所有删除按钮可见
      rows.forEach(function(r) {
        var btn = r.querySelector('.e-remove-btn');
        if (btn) btn.style.visibility = 'visible';
      });
      addEnrollmentRow('', 0, 0, false);
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

      var oldStudent = editId ? getStudents().find(function(s) { return s.id == editId; }) : null;
      // 兼容旧数据（编辑时 oldStudent 可能无 enrollments）
      if (oldStudent) normalizeStudentEnrollments(oldStudent);

      // 从表单读取报名课程
      var rows = document.querySelectorAll('#enrollments-wrap .enrollment-row');
      var enrollments = [];
      Array.prototype.forEach.call(rows, function(row) {
        var eCourse = row.querySelector('.e-course').value;
        var eLessons = parseInt(row.querySelector('.e-lessons').value) || 0;
        if (eCourse && eLessons > 0) {
          // 编辑时保留原有 consumedLessons
          var oldEnr = null;
          if (oldStudent && oldStudent.enrollments) {
            oldEnr = oldStudent.enrollments.find(function(e) { return e.course === eCourse; });
          }
          enrollments.push({
            course: eCourse,
            totalLessons: eLessons,
            consumedLessons: oldEnr ? (oldEnr.consumedLessons || 0) : 0
          });
        }
      });

      if (enrollments.length === 0) { alert('请至少填写一门课程和课次'); return; }

      var totalLessons = enrollments.reduce(function(sum, e) { return sum + e.totalLessons; }, 0);
      var consumedLessons = enrollments.reduce(function(sum, e) { return sum + (e.consumedLessons || 0); }, 0);
      var courseStr = enrollments.map(function(e) { return e.course; }).join('、');

      var opName = getOperatorName();
      var student = {
        id: editId || Date.now(),
        name: name,
        age: document.getElementById('s-age').value.trim() || '--',
        course: courseStr || '--',
        parent: document.getElementById('s-parent').value.trim() || '--',
        phone: document.getElementById('s-phone').value.trim() || '--',
        parentEmail: (document.getElementById('s-parentEmail') ? document.getElementById('s-parentEmail').value.trim() : '') || '',
        status: document.getElementById('s-status').value,
        totalLessons: totalLessons,
        consumedLessons: consumedLessons,
        enrollments: enrollments,
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
    filtered = filtered.filter(function(s) { return (s.course || '').indexOf(f.course) !== -1; });
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

  var header = ['姓名', '年龄', '课程', '家长', '电话', '总课次', '已消耗', '剩余', '状态'];
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

  var html = '<table><thead><tr><th>姓名</th><th>年龄</th><th>课程</th><th>家长</th><th>总课次</th><th>已消耗</th><th>剩余</th><th>状态</th><th>操作</th></tr></thead><tbody>';
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
      document.getElementById('s-parent').value = s.parent;
      document.getElementById('s-phone').value = s.phone;
      var sParentEmail2 = document.getElementById('s-parentEmail');
      if (sParentEmail2) sParentEmail2.value = s.parentEmail || '';
      document.getElementById('s-status').value = s.status;
      normalizeStudentEnrollments(s);
      renderEnrollmentRows(s.enrollments);
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

  // 兼容旧数据
  normalizeStudentEnrollments(s);
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

  // 课次进度条（总览）
  html += '<div class="student-lesson-bar-wrap">';
  html += '<div class="student-lesson-bar-header"><span>📊 课次进度（总计）</span><strong>' + (remaining <= 2 ? '⚠️ ' : '') + '剩余 ' + remaining + ' / 总 ' + total + ' 课次</strong></div>';
  html += '<div class="student-lesson-bar"><div class="student-lesson-bar-fill' + barClass + '" style="width:' + progressPercent + '%;"></div></div>';
  html += '<div class="student-lesson-legend"><span>已消耗：<strong>' + consumed + '</strong> 课次</span><span>进度：<strong>' + progressPercent + '%</strong></span></div>';
  html += '</div>';

  // 每门课进度条
  if (s.enrollments && s.enrollments.length > 0) {
    html += '<div class="detail-section-title">📖 分课程进度</div>';
    s.enrollments.forEach(function(enr) {
      var eTotal = enr.totalLessons || 0;
      var eConsumed = enr.consumedLessons || 0;
      var eRemaining = eTotal - eConsumed;
      var ePercent = eTotal > 0 ? Math.min(100, Math.round(eConsumed / eTotal * 100)) : 0;
      var eBarClass = eRemaining <= 2 ? ' warning' : '';
      var eRemainColor = eRemaining <= 2 ? '#e88' : eRemaining <= 5 ? '#e8a040' : '#5a9';
      html += '<div style="margin-bottom:12px;">';
      html += '<div style="display:flex; justify-content:space-between; margin-bottom:2px; font-size:0.9em;">';
      html += '<span><strong>' + enr.course + '</strong></span>';
      html += '<span style="color:' + eRemainColor + ';">剩余 <strong>' + eRemaining + '</strong> / ' + eTotal + ' 课次（已消 ' + eConsumed + '）</span>';
      html += '</div>';
      html += '<div class="student-lesson-bar" style="height:8px;"><div class="student-lesson-bar-fill' + eBarClass + '" style="width:' + ePercent + '%; height:8px;"></div></div>';
      html += '</div>';
    });
  }

  // 基本信息
  html += '<div class="detail-section-title">📋 基本信息</div>';
  html += '<div class="detail-info-grid">';
  html += '<div class="detail-info-item"><span class="detail-info-label">年龄</span><span class="detail-info-value">' + (s.age || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">课程</span><span class="detail-info-value">' + (s.course || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">家长姓名</span><span class="detail-info-value">' + (s.parent || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">家长电话</span><span class="detail-info-value">' + (s.phone || '--') + '</span></div>';
  html += '<div class="detail-info-item"><span class="detail-info-label">总课次</span><span class="detail-info-value">' + total + '</span></div>';
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
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + stats.totalDeducted + '</div><div class="mini-label">📉 共扣课次</div></div>';
  html += '</div>';

  // 课消日志
  html += '<div class="detail-section-title">📜 课消日志 <span class="count-badge">(' + lessonLog.length + '条)</span></div>';
  if (lessonLog.length > 0) {
    html += '<table class="detail-log-table"><thead><tr><th>日期</th><th>班级</th><th>状态</th><th>扣课次</th></tr></thead><tbody>';
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
