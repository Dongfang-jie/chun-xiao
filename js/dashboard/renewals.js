/*
  春晓画室 - 管理端续费模块
  功能：续费表单 / 续费历史 / 自动更新学员课次
*/

function loadRenewals() {
  refreshRenewalStudentSelects();
  renderRenewalHistory();

  var dateEl = document.getElementById('renewal-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];

  // 选择学员时更新课程下拉
  var studentSel = document.getElementById('renewal-student');
  if (studentSel) {
    studentSel.onchange = function() {
      refreshRenewalCourseSelect();
    };
  }

  // 保存按钮
  var saveBtn = document.getElementById('renewal-save-btn');
  if (saveBtn) {
    if (!hasAdminPermission()) { saveBtn.style.display = 'none'; }
    else saveBtn.onclick = saveRenewal;
  }

  // 筛选按钮
  var filterBtn = document.getElementById('renewal-filter-btn');
  if (filterBtn) filterBtn.onclick = function() { renderRenewalHistory(); };
  var clearFilterBtn = document.getElementById('renewal-filter-clear-btn');
  if (clearFilterBtn) clearFilterBtn.onclick = function() {
    document.getElementById('renewal-filter-student').value = '';
    document.getElementById('renewal-filter-course').value = '';
    document.getElementById('renewal-filter-from').value = '';
    document.getElementById('renewal-filter-to').value = '';
    renderRenewalHistory();
  };

  // 初始化筛选下拉
  refreshRenewalFilterSelects();
}

// 刷新续费表单中的学员下拉
function refreshRenewalStudentSelects() {
  var students = getStudents();
  // 标准化 enrollments（兼容旧数据）
  students.forEach(function(s) { normalizeStudentEnrollments(s); });

  var sel = document.getElementById('renewal-student');
  if (!sel) return;
  var prev = sel.value;
  sel.innerHTML = '<option value="">-- 选择学员 --</option>' +
    students.map(function(s) {
      var remaining = (s.totalLessons || 0) - (s.consumedLessons || 0);
      var statusLabel = s.status === '休学' ? ' [休学]' : s.status === '结课' ? ' [结课]' : '';
      return '<option value="' + s.id + '">' + s.name + statusLabel + '（剩' + remaining + '节）</option>';
    }).join('');
  sel.value = prev;
  refreshRenewalCourseSelect();
}

// 刷新续费表单中的课程下拉（根据选中学员）
function refreshRenewalCourseSelect() {
  var studentId = parseInt(document.getElementById('renewal-student').value);
  var courseSel = document.getElementById('renewal-course');
  if (!courseSel) return;
  if (!studentId) {
    courseSel.innerHTML = '<option value="">先选学员</option>';
    return;
  }
  var students = getStudents();
  var s = students.find(function(x) { return x.id === studentId; });
  if (!s || !s.enrollments || !s.enrollments.length) {
    courseSel.innerHTML = '<option value="">无报名课程</option>';
    return;
  }
  normalizeStudentEnrollments(s);
  courseSel.innerHTML = s.enrollments.map(function(e) {
    var eRemaining = (e.totalLessons || 0) - (e.consumedLessons || 0);
    return '<option value="' + e.course + '">' + e.course + '（总' + e.totalLessons + ' · 已消' + (e.consumedLessons || 0) + ' · 剩' + eRemaining + '节）</option>';
  }).join('');
}

// 保存续费记录
function saveRenewal() {
  var studentId = parseInt(document.getElementById('renewal-student').value);
  var course = document.getElementById('renewal-course').value;
  var addedLessons = parseInt(document.getElementById('renewal-lessons').value) || 0;
  var date = document.getElementById('renewal-date').value;
  var note = document.getElementById('renewal-note').value.trim();
  var msgEl = document.getElementById('renewal-msg');

  if (!studentId) { msgEl.textContent = '⚠️ 请选择学员'; msgEl.style.color = '#e88'; return; }
  if (!course) { msgEl.textContent = '⚠️ 请选择续费课程'; msgEl.style.color = '#e88'; return; }
  if (!date) { msgEl.textContent = '⚠️ 请选择日期'; msgEl.style.color = '#e88'; return; }
  if (addedLessons <= 0) { msgEl.textContent = '⚠️ 请输入有效的续费课次数'; msgEl.style.color = '#e88'; return; }

  var students = getStudents();
  var s = students.find(function(x) { return x.id === studentId; });
  if (!s) { msgEl.textContent = '⚠️ 学员不存在'; msgEl.style.color = '#e88'; return; }

  normalizeStudentEnrollments(s);
  var enr = (s.enrollments || []).find(function(e) { return e.course === course; });
  if (!enr) {
    // 如果学员没有该课程的报名记录，则自动创建
    s.enrollments.push({ course: course, totalLessons: addedLessons, consumedLessons: 0 });
    enr = s.enrollments[s.enrollments.length - 1];
  } else {
    enr.totalLessons = (enr.totalLessons || 0) + addedLessons;
  }
  normalizeStudentEnrollments(s);
  saveStudents(students);

  // 保存续费记录
  var opName = getOperatorName();
  var renewals = getRenewals();
  renewals.unshift({
    id: Date.now(),
    studentId: studentId,
    studentName: s.name,
    course: course,
    addedLessons: addedLessons,
    date: date,
    operator: opName,
    note: note || '',
    createdAt: new Date().toISOString()
  });
  saveRenewals(renewals);

  // 清空表单
  document.getElementById('renewal-student').value = '';
  document.getElementById('renewal-course').innerHTML = '<option value="">先选学员</option>';
  document.getElementById('renewal-lessons').value = '';
  document.getElementById('renewal-note').value = '';
  document.getElementById('renewal-date').value = new Date().toISOString().split('T')[0];

  msgEl.textContent = '✅ 续费成功！' + s.name + ' · ' + course + ' +' + addedLessons + '课次';
  msgEl.style.color = '#5a9';

  renderRenewalHistory();
  renderStudents();
  updateOverview();
  if (typeof renderLowLessonAlerts === 'function') renderLowLessonAlerts();
}

// 渲染续费历史
function renderRenewalHistory() {
  var container = document.getElementById('renewal-history-list');
  if (!container) return;

  var renewals = getRenewals();
  var students = getStudents();

  // 筛选
  var filterStudentEl = document.getElementById('renewal-filter-student');
  var filterCourseEl = document.getElementById('renewal-filter-course');
  var filterDateFromEl = document.getElementById('renewal-filter-from');
  var filterDateToEl = document.getElementById('renewal-filter-to');

  var filterStudentId = filterStudentEl ? filterStudentEl.value : '';
  var filterCourse = filterCourseEl ? filterCourseEl.value : '';
  var filterFrom = filterDateFromEl ? filterDateFromEl.value : '';
  var filterTo = filterDateToEl ? filterDateToEl.value : '';

  var filtered = renewals;
  if (filterStudentId) { filtered = filtered.filter(function(r) { return r.studentId === parseInt(filterStudentId); }); }
  if (filterCourse) { filtered = filtered.filter(function(r) { return r.course === filterCourse; }); }
  if (filterFrom) { filtered = filtered.filter(function(r) { return r.date >= filterFrom; }); }
  if (filterTo) { filtered = filtered.filter(function(r) { return r.date <= filterTo; }); }

  // 统计
  var totalAdded = filtered.reduce(function(sum, r) { return sum + r.addedLessons; }, 0);
  var summaryEl = document.getElementById('renewal-summary');
  if (summaryEl) {
    summaryEl.textContent = '共 ' + filtered.length + ' 笔续费记录，累计 +' + totalAdded + ' 课次';
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无续费记录</p>';
    return;
  }

  var html = '<table><thead><tr>';
  html += '<th>日期</th><th>学员</th><th>课程</th><th>续费课次</th><th>备注</th><th>操作人</th>';
  if (hasAdminPermission()) html += '<th>操作</th>';
  html += '</tr></thead><tbody>';

  filtered.forEach(function(r) {
    var s = students.find(function(x) { return x.id === r.studentId; });
    var sName = s ? s.name : (r.studentName || '(已删)');
    html += '<tr>';
    html += '<td>' + escapeHtml(r.date || '') + '</td>';
    html += '<td>' + escapeHtml(sName || '') + '</td>';
    html += '<td>' + escapeHtml(r.course || '') + '</td>';
    html += '<td style="font-weight:bold; color:#5a9;">+' + r.addedLessons + ' 课次</td>';
    html += '<td style="font-size:0.85em; color:#888;">' + escapeHtml(r.note || '--') + '</td>';
    html += '<td style="font-size:0.85em; color:#bbb;">' + escapeHtml(r.operator || '') + '</td>';
    if (hasAdminPermission()) {
      html += '<td><a href="#" class="del-renewal" data-id="' + r.id + '" style="color:#e88; font-size:0.85em;">删除</a></td>';
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // 绑定删除按钮
  if (hasAdminPermission()) {
    container.querySelectorAll('.del-renewal').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var id = parseInt(btn.dataset.id);
        if (!confirm('确定删除该续费记录？将撤销对应的课次增加。')) return;
        deleteRenewal(id);
      });
    });
  }
}

// 删除续费记录
function deleteRenewal(id) {
  var renewals = getRenewals();
  var r = renewals.find(function(x) { return x.id === id; });
  if (!r) return;

  // 撤销课次增加
  var students = getStudents();
  var s = students.find(function(x) { return x.id === r.studentId; });
  if (s) {
    normalizeStudentEnrollments(s);
    var enr = (s.enrollments || []).find(function(e) { return e.course === r.course; });
    if (enr) {
      enr.totalLessons = Math.max(0, (enr.totalLessons || 0) - r.addedLessons);
      if (enr.totalLessons === 0 && enr.consumedLessons === 0) {
        s.enrollments = s.enrollments.filter(function(e) { return e.course !== r.course; });
      }
    }
    normalizeStudentEnrollments(s);
    saveStudents(students);
  }

  renewals = renewals.filter(function(x) { return x.id !== id; });
  saveRenewals(renewals);

  renderRenewalHistory();
  renderStudents();
  updateOverview();
  if (typeof renderLowLessonAlerts === 'function') renderLowLessonAlerts();
}

// 刷新续费历史筛选下拉
function refreshRenewalFilterSelects() {
  var students = getStudents();
  var renewals = getRenewals();

  // 学员筛选
  var studentFilter = document.getElementById('renewal-filter-student');
  if (studentFilter) {
    var prev = studentFilter.value;
    studentFilter.innerHTML = '<option value="">全部学员</option>' +
      students.map(function(s) { return '<option value="' + s.id + '">' + s.name + '</option>'; }).join('');
    studentFilter.value = prev;
  }

  // 课程筛选
  var courseFilter = document.getElementById('renewal-filter-course');
  if (courseFilter) {
    var prevCourse = courseFilter.value;
    var courses = [];
    renewals.forEach(function(r) { if (courses.indexOf(r.course) === -1) courses.push(r.course); });
    // 也加入当前学生的报名课程
    students.forEach(function(s) {
      normalizeStudentEnrollments(s);
      (s.enrollments || []).forEach(function(e) {
        if (e.course && courses.indexOf(e.course) === -1) courses.push(e.course);
      });
    });
    courseFilter.innerHTML = '<option value="">全部课程</option>' +
      courses.map(function(c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    courseFilter.value = prevCourse;
  }
}

// 从学生列表快速跳转续费（预填学员和课程）
function quickRenewal(studentId, course) {
  // 切换到续费子标签
  document.querySelectorAll('.sub-tab').forEach(function(t) { t.classList.remove('active'); });
  var renewalTab = document.querySelector('.sub-tab[data-sub="renewals"]');
  if (renewalTab) renewalTab.classList.add('active');
  document.querySelectorAll('.sub-page').forEach(function(p) { p.classList.remove('active'); });
  var renewalPage = document.getElementById('sub-renewals');
  if (renewalPage) renewalPage.classList.add('active');

  // 预填表单
  refreshRenewalStudentSelects();
  if (studentId) {
    document.getElementById('renewal-student').value = studentId;
    refreshRenewalCourseSelect();
    if (course) {
      document.getElementById('renewal-course').value = course;
    }
  }
  document.getElementById('renewal-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('renewal-lessons').focus();
  // 滚动到表单
  document.getElementById('renewal-form-wrap').scrollIntoView({ behavior: 'smooth' });
}
