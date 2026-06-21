/*
  春晓画室 - 管理端续费模块
  功能：续费表单（多课程同时续费）/ 续费历史 / 自动更新学员课次
*/

function loadRenewals() {
  refreshRenewalStudentSelects();
  renderRenewalHistory();

  var dateEl = document.getElementById('renewal-date');
  if (dateEl && !dateEl.value) dateEl.value = new Date().toISOString().split('T')[0];

  // 选择学员时更新课程输入区域
  var studentSel = document.getElementById('renewal-student');
  if (studentSel) {
    studentSel.onchange = function() {
      refreshRenewalCourseInputs();
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
  refreshRenewalCourseInputs();
}

// 刷新续费表单中的课程输入区域（根据选中学员显示所有报名课程）
function refreshRenewalCourseInputs() {
  var studentId = parseInt(document.getElementById('renewal-student').value);
  var listEl = document.getElementById('renewal-courses-list');
  if (!listEl) return;

  if (!studentId) {
    listEl.innerHTML = '<span style="color:#999;">先选学员</span>';
    return;
  }

  var students = getStudents();
  var s = students.find(function(x) { return x.id === studentId; });
  if (!s || !s.enrollments || !s.enrollments.length) {
    listEl.innerHTML = '<span style="color:#e88;">该学员暂无报名课程，请先在学生管理中设置课程</span>';
    return;
  }

  normalizeStudentEnrollments(s);

  var html = '';
  s.enrollments.forEach(function(e, i) {
    var eRemaining = (e.totalLessons || 0) - (e.consumedLessons || 0);
    html += '<div class="renewal-course-row">';
    html += '<span class="rc-label">' + escapeHtml(e.course) + '<span class="rc-info">（总' + e.totalLessons + ' · 已消' + (e.consumedLessons || 0) + ' · 剩' + eRemaining + '节）</span></span>';
    html += '<input type="number" class="rc-input renewal-lessons-input" data-course="' + escapeHtml(e.course) + '" placeholder="课次" min="0" value="" style="width:100px;">';
    html += '</div>';
  });

  listEl.innerHTML = html;

  // 聚焦第一个输入框
  var firstInput = listEl.querySelector('.renewal-lessons-input');
  if (firstInput) setTimeout(function() { firstInput.focus(); }, 100);
}

// 保存续费记录（支持多课程同时续费）
function saveRenewal() {
  var studentId = parseInt(document.getElementById('renewal-student').value);
  var date = document.getElementById('renewal-date').value;
  var note = document.getElementById('renewal-note').value.trim();
  var msgEl = document.getElementById('renewal-msg');

  if (!studentId) { msgEl.textContent = '⚠️ 请选择学员'; msgEl.style.color = '#e88'; return; }
  if (!date) { msgEl.textContent = '⚠️ 请选择日期'; msgEl.style.color = '#e88'; return; }

  // 收集所有课程输入
  var inputs = document.querySelectorAll('.renewal-lessons-input');
  var courseEntries = [];
  inputs.forEach(function(inp) {
    var course = inp.dataset.course;
    var lessons = parseInt(inp.value) || 0;
    if (course && lessons > 0) {
      courseEntries.push({ course: course, addedLessons: lessons });
    }
  });

  if (courseEntries.length === 0) {
    msgEl.textContent = '⚠️ 请至少为一个课程输入续费课次'; msgEl.style.color = '#e88'; return;
  }

  var students = getStudents();
  var s = students.find(function(x) { return x.id === studentId; });
  if (!s) { msgEl.textContent = '⚠️ 学员不存在'; msgEl.style.color = '#e88'; return; }

  normalizeStudentEnrollments(s);

  // 更新学员的报名课次
  courseEntries.forEach(function(entry) {
    var enr = (s.enrollments || []).find(function(e) { return e.course === entry.course; });
    if (!enr) {
      // 如果学员没有该课程的报名记录，则自动创建
      s.enrollments.push({ course: entry.course, totalLessons: entry.addedLessons, consumedLessons: 0 });
    } else {
      enr.totalLessons = (enr.totalLessons || 0) + entry.addedLessons;
    }
  });
  normalizeStudentEnrollments(s);
  saveStudents(students);

  // 保存续费记录（同一批次用 batchId 关联）
  var opName = getOperatorName();
  var batchId = Date.now();
  var renewals = getRenewals();
  var totalAdded = 0;

  courseEntries.forEach(function(entry) {
    totalAdded += entry.addedLessons;
    renewals.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      batchId: batchId,
      studentId: studentId,
      studentName: s.name,
      course: entry.course,
      addedLessons: entry.addedLessons,
      date: date,
      operator: opName,
      note: note || '',
      createdAt: new Date().toISOString()
    });
  });
  saveRenewals(renewals);

  // 清空表单
  document.getElementById('renewal-student').value = '';
  document.getElementById('renewal-courses-list').innerHTML = '<span style="color:#999;">先选学员</span>';
  document.getElementById('renewal-note').value = '';
  document.getElementById('renewal-date').value = new Date().toISOString().split('T')[0];

  var courseNames = courseEntries.map(function(e) { return e.course + ' +' + e.addedLessons; }).join('，');
  msgEl.textContent = '✅ 续费成功！' + s.name + ' · ' + courseNames + '（共+' + totalAdded + '课次）';
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

  // 按 batchId 分组显示（同批次的多课程续费显示在一起）
  var batches = [];
  var seenBatch = {};
  filtered.forEach(function(r) {
    var bid = r.batchId || r.id; // 兼容旧数据（无 batchId）
    if (!seenBatch[bid]) {
      seenBatch[bid] = true;
      batches.push({ batchId: bid, items: filtered.filter(function(x) { return (x.batchId || x.id) === bid; }) });
    }
  });

  var html = '<table><thead><tr>';
  html += '<th>日期</th><th>学员</th><th>续费课程</th><th>续费课次</th><th>备注</th><th>操作人</th>';
  if (hasAdminPermission()) html += '<th>操作</th>';
  html += '</tr></thead><tbody>';

  batches.forEach(function(batch) {
    var r0 = batch.items[0];
    var s = students.find(function(x) { return x.id === r0.studentId; });
    var sName = s ? s.name : (r0.studentName || '(已删)');

    if (batch.items.length === 1) {
      // 单课程续费
      var r = batch.items[0];
      html += '<tr>';
      html += '<td>' + escapeHtml(r.date || '') + '</td>';
      html += '<td>' + escapeHtml(sName || '') + '</td>';
      html += '<td>' + escapeHtml(r.course || '') + '</td>';
      html += '<td style="font-weight:bold; color:#5a9;">+' + r.addedLessons + ' 课次</td>';
      html += '<td style="font-size:0.85em; color:#888;">' + escapeHtml(r.note || '--') + '</td>';
      html += '<td style="font-size:0.85em; color:#bbb;">' + escapeHtml(r.operator || '') + '</td>';
      if (hasAdminPermission()) {
        html += '<td><a href="#" class="del-renewal" data-batch="' + (r.batchId || r.id) + '" style="color:#e88; font-size:0.85em;">删除</a></td>';
      }
      html += '</tr>';
    } else {
      // 多课程续费 — 首行显示学员和备注，后续行缩进
      var batchTotal = batch.items.reduce(function(sum, x) { return sum + x.addedLessons; }, 0);
      batch.items.forEach(function(r, i) {
        html += '<tr>';
        html += '<td>' + (i === 0 ? escapeHtml(r.date || '') : '') + '</td>';
        html += '<td>' + (i === 0 ? escapeHtml(sName || '') + ' <span style="font-size:0.75em;color:#999;">(' + batch.items.length + '门)</span>' : '') + '</td>';
        html += '<td style="' + (i > 0 ? 'padding-left:16px;' : '') + '">' + (i > 0 ? '└ ' : '') + escapeHtml(r.course || '') + '</td>';
        html += '<td style="font-weight:bold; color:#5a9;">+' + r.addedLessons + ' 课次</td>';
        html += '<td style="font-size:0.85em; color:#888;">' + (i === 0 ? escapeHtml(r.note || '--') : '') + '</td>';
        html += '<td style="font-size:0.85em; color:#bbb;">' + (i === 0 ? escapeHtml(r.operator || '') : '') + '</td>';
        if (hasAdminPermission() && i === 0) {
          html += '<td rowspan="' + batch.items.length + '" style="vertical-align:middle;"><a href="#" class="del-renewal" data-batch="' + (r.batchId || r.id) + '" style="color:#e88; font-size:0.85em;">删除</a></td>';
        }
        html += '</tr>';
      });
    }
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  // 绑定删除按钮（按批次删除）
  if (hasAdminPermission()) {
    container.querySelectorAll('.del-renewal').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        var batchId = parseInt(btn.dataset.batch);
        var batchItems = renewals.filter(function(r) { return (r.batchId || r.id) === batchId; });
        var desc = batchItems.length === 1
          ? batchItems[0].studentName + ' · ' + batchItems[0].course + ' +' + batchItems[0].addedLessons + '节'
          : batchItems[0].studentName + ' · ' + batchItems.length + '门课程';
        if (!confirm('确定删除该续费记录？（' + desc + '）\n将撤销对应的课次增加。')) return;
        deleteRenewalBatch(batchId);
      });
    });
  }
}

// 删除续费批次（支持多课程记录）
function deleteRenewalBatch(batchId) {
  var renewals = getRenewals();
  var batchItems = renewals.filter(function(r) { return (r.batchId || r.id) === batchId; });
  if (!batchItems.length) return;

  var r0 = batchItems[0];

  // 撤销课次增加（按批次中每门课程分别撤销）
  var students = getStudents();
  var s = students.find(function(x) { return x.id === r0.studentId; });
  if (s) {
    normalizeStudentEnrollments(s);
    batchItems.forEach(function(r) {
      var enr = (s.enrollments || []).find(function(e) { return e.course === r.course; });
      if (enr) {
        enr.totalLessons = Math.max(0, (enr.totalLessons || 0) - r.addedLessons);
        if (enr.totalLessons === 0 && (enr.consumedLessons || 0) === 0) {
          s.enrollments = s.enrollments.filter(function(e) { return e.course !== r.course; });
        }
      }
    });
    normalizeStudentEnrollments(s);
    saveStudents(students);
  }

  // 删除批次中的所有记录
  renewals = renewals.filter(function(r) { return (r.batchId || r.id) !== batchId; });
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

// 从学生列表快速跳转续费（预填学员，显示所有课程）
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
    refreshRenewalCourseInputs();
    // 如果传入了课程名，聚焦对应课程的输入框
    if (course) {
      var targetInput = document.querySelector('.renewal-lessons-input[data-course="' + course + '"]');
      if (targetInput) setTimeout(function() { targetInput.focus(); }, 150);
    }
  }
  document.getElementById('renewal-date').value = new Date().toISOString().split('T')[0];
  // 滚动到表单
  document.getElementById('renewal-form-wrap').scrollIntoView({ behavior: 'smooth' });
}
