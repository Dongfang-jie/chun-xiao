/*
  春晓画室 - 管理端课消日志模块（日志 + 手动调整 + 低课次告警）
*/

function loadLessonLog() {
  refreshLogStudentSelects();
  renderLessonLog();
  updateLessonLogSummary();
  renderLowLessonAlerts();
  var dateEl = document.getElementById('log-manual-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

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
  // 标准化 enrollments（兼容旧数据）
  students.forEach(function(s) { normalizeStudentEnrollments(s); });

  var html = '<option value="">全部学员</option>' +
    students.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
  var filterSel = document.getElementById('log-filter-student');
  if (filterSel) { var prev = filterSel.value; filterSel.innerHTML = html; filterSel.value = prev; }

  var manualSel = document.getElementById('log-manual-student');
  if (manualSel) {
    manualSel.innerHTML = '<option value="">-- 选择 --</option>' +
      students.map(function(s) {
        var remaining = (s.totalLessons || 0) - (s.consumedLessons || 0);
        return '<option value="' + s.id + '">' + s.name + '（剩' + remaining + '节）</option>';
      }).join('');
    // 选择学员时更新课程下拉
    manualSel.onchange = function() {
      var sid = parseInt(manualSel.value);
      var courseSel = document.getElementById('log-manual-course');
      if (!courseSel) return;
      if (!sid) { courseSel.innerHTML = '<option value="">先选学员</option>'; return; }
      var s = students.find(function(x) { return x.id === sid; });
      if (!s || !s.enrollments || !s.enrollments.length) {
        courseSel.innerHTML = '<option value="">无课程</option>';
        return;
      }
      courseSel.innerHTML = s.enrollments.map(function(e) {
        var eRemaining = (e.totalLessons || 0) - (e.consumedLessons || 0);
        return '<option value="' + e.course + '">' + e.course + '（剩' + eRemaining + '节）</option>';
      }).join('');
    };
    // 初始触发一次（如果已有选中值）
    if (manualSel.value) manualSel.onchange();
  }
}

function getFilteredLog() {
  var students = getStudents();
  var classes = getClasses();
  var corrections = getLessonCorrections();
  var attendance = getAttendance();
  var filterStudentId = document.getElementById('log-filter-student') ? document.getElementById('log-filter-student').value : '';
  var filterFrom = document.getElementById('log-filter-from') ? document.getElementById('log-filter-from').value : '';
  var filterTo = document.getElementById('log-filter-to') ? document.getElementById('log-filter-to').value : '';

  var log = [];

  attendance.forEach(function(a) {
    a.records.forEach(function(r) {
      if (r.deducted > 0) {
        var s = students.find(function(x) { return x.id === r.studentId; });
        var cls = classes.find(function(c) { return c.id === a.classId; });
        log.push({
          id: 'att-' + a.id + '-' + r.studentId,
          date: a.date, studentId: r.studentId,
          studentName: s ? s.name : '(已删)',
          className: cls ? cls.name : '(已删)',
          type: '点名扣课', amount: r.deducted,
          reason: r.status === 'present' ? '出勤扣课' : (r.status === 'leave' ? '请假扣课' : '缺勤扣课'),
          operator: a.operator || ''
        });
      }
    });
  });

  corrections.forEach(function(c) {
    var s = students.find(function(x) { return x.id === c.studentId; });
    log.push({
      id: 'corr-' + c.id, date: c.date, studentId: c.studentId,
      studentName: s ? s.name : '(已删)', className: '--', type: '手动调整',
      amount: c.amount, reason: c.reason || '手动调整', course: c.course || '', operator: c.operator || ''
    });
  });

  if (filterStudentId) { log = log.filter(function(l) { return l.studentId === parseInt(filterStudentId); }); }
  if (filterFrom) { log = log.filter(function(l) { return l.date >= filterFrom; }); }
  if (filterTo) { log = log.filter(function(l) { return l.date <= filterTo; }); }

  log.sort(function(a, b) { return b.date.localeCompare(a.date) || (b.id < a.id ? -1 : 1); });
  return log;
}

function renderLessonLog() {
  var container = document.getElementById('lessonlog-table-wrap');
  if (!container) return;

  var log = getFilteredLog();

  if (log.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无课消记录，点名扣课次后自动生成</p>';
    return;
  }

  var html = '<table><thead><tr>';
  html += '<th>日期</th><th>学员</th><th>班级</th><th>类型</th><th>扣除课次</th><th>原因</th><th>操作</th>';
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
    var reasonText = l.course ? '[' + l.course + '] ' + l.reason : l.reason;
    html += '<td style="font-size:0.85em; color:#888;">' + reasonText + (l.operator ? ' <span style="color:#bbb; font-size:0.85em;">· ' + l.operator + '</span>' : '') + '</td>';
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

  container.querySelectorAll('.log-student-link').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      showStudentDetail(parseInt(link.dataset.sid));
    });
  });

  container.querySelectorAll('.del-correction').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('删除该手动调整记录？将撤销对应的课次变动。')) return;
      deleteManualCorrection(id);
    });
  });
}

function saveManualCorrection() {
  var studentId = parseInt(document.getElementById('log-manual-student').value);
  var course = document.getElementById('log-manual-course').value;
  var date = document.getElementById('log-manual-date').value;
  var amount = parseInt(document.getElementById('log-manual-amount').value) || 0;
  var reason = document.getElementById('log-manual-reason').value.trim();
  var msgEl = document.getElementById('log-manual-msg');

  if (!studentId || !date || amount === 0) {
    msgEl.textContent = '⚠️ 请选择学员、日期并填写非零数量';
    msgEl.style.color = '#e88'; return;
  }
  if (!course) {
    msgEl.textContent = '⚠️ 请选择课程';
    msgEl.style.color = '#e88'; return;
  }
  if (!reason) {
    msgEl.textContent = '⚠️ 请填写调整原因';
    msgEl.style.color = '#e88'; return;
  }

  var students = getStudents();
  var s = students.find(function(x) { return x.id === studentId; });
  if (!s) { msgEl.textContent = '⚠️ 学员不存在'; msgEl.style.color = '#e88'; return; }

  normalizeStudentEnrollments(s);
  var enr = (s.enrollments || []).find(function(e) { return e.course === course; });
  if (!enr) { msgEl.textContent = '⚠️ 未找到对应课程报名记录'; msgEl.style.color = '#e88'; return; }

  var newConsumed = (enr.consumedLessons || 0) + amount;
  if (newConsumed < 0) newConsumed = 0;
  if (newConsumed > enr.totalLessons && amount > 0) {
    if (!confirm('该操作将使' + course + '已消耗(' + newConsumed + ')超过总课次(' + enr.totalLessons + ')，确定继续？')) return;
  }
  enr.consumedLessons = newConsumed;
  // 同步顶层字段
  normalizeStudentEnrollments(s);
  saveStudents(students);

  var corrections = getLessonCorrections();
  corrections.unshift({
    id: Date.now(), studentId: studentId, date: date,
    course: course,
    amount: amount, reason: reason,
    createdAt: new Date().toLocaleString('zh-CN'),
    operator: getOperatorName()
  });
  saveLessonCorrections(corrections);

  msgEl.textContent = '✅ 已保存（' + (amount > 0 ? '扣' + amount + '课次' : '退' + Math.abs(amount) + '课次') + ' · ' + course + '）';
  msgEl.style.color = '#5a9';
  document.getElementById('log-manual-form').style.display = 'none';
  renderLessonLog();
  updateLessonLogSummary();
  renderLowLessonAlerts();
  renderStudents();
  updateOverview();
}

function deleteManualCorrection(id) {
  var corrections = getLessonCorrections();
  var c = corrections.find(function(x) { return x.id === id; });
  if (!c) return;

  var students = getStudents();
  var s = students.find(function(x) { return x.id === c.studentId; });
  if (s) {
    normalizeStudentEnrollments(s);
    var enr = c.course ? (s.enrollments || []).find(function(e) { return e.course === c.course; }) : (s.enrollments && s.enrollments[0]);
    if (enr) { enr.consumedLessons = Math.max(0, (enr.consumedLessons || 0) - c.amount); }
    normalizeStudentEnrollments(s);
    saveStudents(students);
  }

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

  var totalDeducted = log.reduce(function(sum, l) { return sum + Math.max(0, l.amount); }, 0);

  var now = new Date();
  var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var monthDeducted = log.filter(function(l) { return l.date.startsWith(thisMonth); })
    .reduce(function(sum, l) { return sum + Math.max(0, l.amount); }, 0);

  var studentIds = {};
  log.forEach(function(l) { studentIds[l.studentId] = true; });
  var involvedCount = Object.keys(studentIds).length;

  var lowCount = 0;
  students.forEach(function(s) {
    if (s.status !== '在读') return;
    normalizeStudentEnrollments(s);
    (s.enrollments || []).forEach(function(enr) {
      if ((enr.totalLessons || 0) - (enr.consumedLessons || 0) <= 2) lowCount++;
    });
  });

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

  var students = getStudents();
  var alerts = [];
  students.forEach(function(s) {
    if (s.status !== '在读') return;
    normalizeStudentEnrollments(s);
    (s.enrollments || []).forEach(function(enr) {
      var remaining = (enr.totalLessons || 0) - (enr.consumedLessons || 0);
      if (remaining <= 2) {
        alerts.push({ name: s.name, course: enr.course, total: enr.totalLessons || 0, consumed: enr.consumedLessons || 0, remaining: remaining });
      }
    });
  });

  if (alerts.length === 0) {
    container.innerHTML = '<p style="color:#5a9; font-size:0.9em;">✅ 所有在读学员课次充足</p>';
    return;
  }

  var html = '<div style="display:flex; flex-wrap:wrap; gap:12px;">';
  alerts.forEach(function(a) {
    var severity = a.remaining <= 0 ? '#e88' : '#e8a040';
    html += '<div style="flex:1 1 260px; min-width:220px; background:#fff; border-radius:10px; padding:14px 18px; box-shadow:0 1px 6px rgba(0,0,0,0.05); border-left:4px solid ' + severity + ';">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += '<strong style="color:#5d4037;">' + a.name + '</strong>';
    html += '<span style="color:' + severity + '; font-weight:bold; font-size:1.1em;">剩 ' + a.remaining + ' 节</span>';
    html += '</div>';
    html += '<p style="margin:4px 0 0; color:#888; font-size:0.85em;">📖 ' + a.course + ' · 总' + a.total + '课次 · 已消' + a.consumed + '</p>';
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}
