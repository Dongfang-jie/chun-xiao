/*
  春晓画室 - 管理端点名模块（每日点名 + 点名表单）
*/

function loadAttendance() {
  var today = getLocalDateStr();
  document.getElementById('att-date-nav').value = today;
  renderDailyAttendanceTable(today);
  renderAttendanceHistory();
  renderAttendanceStats();

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
  document.getElementById('att-week-prev').addEventListener('click', function() { changeAttDate(-1); });
  document.getElementById('att-week-next').addEventListener('click', function() { changeAttDate(1); });
}

function changeAttDate(delta) {
  var input = document.getElementById('att-date-nav');
  var parts = input.value.split('-');
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  d.setDate(d.getDate() + delta);
  var newDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  input.value = newDate;
  renderDailyAttendanceTable(newDate);
  document.getElementById('attendance-area').style.display = 'none';
}

function getLocalDateStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderDailyAttendanceTable(date) {
  var container = document.getElementById('attendance-daily-table');
  var labelEl = document.getElementById('att-day-label');
  if (!container) return;

  var classes = getClasses();
  var attendance = getAttendance();

  var d = new Date(date + 'T00:00:00');
  var dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var dayName = dayNames[d.getDay()];

  if (labelEl) { labelEl.textContent = date + ' · ' + dayName; }

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
    html += '<td><strong style="color:#5d4037;">' + escapeHtml(cls.name || '') + '</strong></td>';
    html += '<td>' + escapeHtml(cls.course || '--') + '</td>';
    html += '<td>' + escapeHtml(cls.timeSlot || '--') + '</td>';
    html += '<td>' + escapeHtml(cls.room || '--') + '</td>';
    html += '<td>' + totalStudents + '人</td>';
    html += '<td><span class="att-status-badge ' + (isDone ? 'att-status-done' : 'att-status-pending') + '">' + (isDone ? '✅ 已点名 ' + presentCount + '/' + totalStudents : '⚪ 未点名') + '</span></td>';
    html += '<td><button class="login-btn att-start-btn" data-cid="' + cls.id + '" data-date="' + date + '" style="width:auto; padding:7px 16px; font-size:0.85em;">' + (isDone ? '📝 重新点名' : '📋 开始点名') + '</button></td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  container.querySelectorAll('.att-start-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var cid = parseInt(btn.dataset.cid);
      var attDate = btn.dataset.date;
      startAttendanceForClass(cid, attDate);
    });
  });
}

function startAttendanceForClass(classId, date) {
  var area = document.getElementById('attendance-area');
  area.style.display = 'block';

  var cls = getClasses().find(function(c) { return c.id == classId; });
  if (!cls) { area.innerHTML = '<p style="color:#e88;">班级不存在</p>'; return; }

  var students = getStudents().filter(function(s) {
    for (var i = 0; i < (cls.studentIds || []).length; i++) {
      if (cls.studentIds[i] == s.id) return true;
    }
    return false;
  });
  if (students.length === 0) {
    console.log('⚠️ 点名失败: 班级「' + cls.name + '」studentIds=' + JSON.stringify(cls.studentIds) + ', 学生总数=' + getStudents().length);
    area.innerHTML = '<p style="color:#e88; text-align:center;">该班级没有学员，请先在「班级」中分配学员</p><p style="color:#999; font-size:0.8em;">班级studentIds: ' + JSON.stringify(cls.studentIds) + '<br>学生库共 ' + getStudents().length + ' 人</p>'; return;
  }

  var existing = getAttendance().find(function(a) { return a.classId == classId && a.date == date; });
  var existingRecords = existing ? existing.records : [];

  var html = '<div style="background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06); border:2px solid #d7a86e;">';
  html += '<h4 style="color:#5d4037; margin-bottom:4px;">📋 ' + escapeHtml(cls.name || '') + '</h4>';
  html += '<p style="color:#888; margin:0 0 12px; font-size:0.9em;">' + escapeHtml(date || '') + ' · ' + escapeHtml(cls.day || '') + ' ' + escapeHtml(cls.timeSlot || '') + ' · ' + escapeHtml(cls.room || '') + '</p>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:12px;">';
  html += '<button id="att-all-present" class="login-btn" style="width:auto; padding:6px 16px; font-size:0.85em;">✅ 全部出勤</button>';
  html += '<button id="att-all-leave" class="login-btn" style="width:auto; padding:6px 16px; font-size:0.85em; background:#e8a040; border-color:#e8a040;">⭕ 全部请假</button>';
  html += '<span style="color:#ccc; margin:0 4px;">|</span>';
  html += '<input type="number" id="att-deduct-all" value="0" min="0" style="width:60px; padding:6px; border:2px solid #e8d4c8; border-radius:6px; text-align:center;">';
  html += '<button id="att-deduct-all-btn" class="login-btn" style="width:auto; padding:8px 20px; font-size:0.9em; background:#e65100; border-color:#bf360c; font-weight:bold; letter-spacing:1px; transition:all 0.15s;">📉 全部扣课次</button>';
  html += '<span style="color:#888; font-size:0.8em;">仅扣出勤学员</span>';
  html += '</div>';

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

  html += '<table><thead><tr><th>学员</th><th>总/已消耗/剩余</th><th>上次扣课</th><th>出勤</th><th>请假</th><th>缺勤</th><th>扣课次</th></tr></thead><tbody>';

  students.forEach(function(s) {
    var rec = existingRecords.find(function(r) { return r.studentId == s.id; });
    var status = rec ? rec.status : 'present';
    var deducted = rec ? (rec.deducted || 0) : 1;
    // 匹配该班级课程的 enrollment
    normalizeStudentEnrollments(s);
    var enrollment = (s.enrollments || []).find(function(e) { return e.course === cls.course; }) || (s.enrollments && s.enrollments[0]);
    var total = enrollment ? (enrollment.totalLessons || 0) : (s.totalLessons || 0);
    var consumed = enrollment ? (enrollment.consumedLessons || 0) : (s.consumedLessons || 0);
    var remaining = total - consumed;
    var remainColor = remaining <= 4 ? '#e88' : remaining <= 8 ? '#e8a040' : '#5a9';
    var lastDate = getLastDeductDate(s.id);
    var lastDateDisplay = lastDate ? lastDate : '<span style="color:#ccc;">无记录</span>';
    // 多课程时显示课程名
    var courseLabel = (s.enrollments && s.enrollments.length > 1 && enrollment) ? '<span style="font-size:0.7em; color:#888;">' + escapeHtml(enrollment.course || '') + '</span> ' : '';
    html += '<tr>';
    html += '<td><strong>' + escapeHtml(s.name || '') + '</strong></td>';
    html += '<td style="font-size:0.85em;">' + courseLabel + '总' + total + ' / <span style="color:#e88;">消' + consumed + '</span> / <span style="color:' + remainColor + ';">剩' + remaining + '</span></td>';
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

  document.getElementById('att-cancel-area-btn').addEventListener('click', function() { area.style.display = 'none'; });

  document.getElementById('att-all-present').addEventListener('click', function() {
    var count = 0;
    area.querySelectorAll('.att-btn').forEach(function(b) {
      if (b.dataset.st === 'present') { b.classList.add('active'); count++; }
      else { b.classList.remove('active'); }
    });
    var btn = this;
    var origText = btn.textContent;
    btn.textContent = '✅ 已设 ' + count + ' 人出勤';
    btn.style.background = '#2e7d32';
    btn.style.borderColor = '#1b5e20';
    setTimeout(function() { btn.textContent = origText; btn.style.background = ''; btn.style.borderColor = ''; }, 1000);
  });

  document.getElementById('att-all-leave').addEventListener('click', function() {
    var count = 0;
    area.querySelectorAll('.att-btn').forEach(function(b) {
      if (b.dataset.st === 'leave') { b.classList.add('active'); count++; }
      else { b.classList.remove('active'); }
    });
    area.querySelectorAll('.att-deduct').forEach(function(input) { input.value = 0; });
    var btn = this;
    var origText = btn.textContent;
    btn.textContent = '⭕ 已设 ' + count + ' 人请假';
    btn.style.background = '#5d4037';
    btn.style.borderColor = '#3e2723';
    setTimeout(function() { btn.textContent = origText; btn.style.background = ''; btn.style.borderColor = ''; }, 1000);
  });

  document.getElementById('att-deduct-all-btn').addEventListener('click', function() {
    var val = parseInt(document.getElementById('att-deduct-all').value) || 0;
    var inputs = area.querySelectorAll('.att-deduct');
    var presentCount = 0;
    inputs.forEach(function(input) {
      var row = input.parentElement.parentElement;
      var activeBtn = row.querySelector('.att-btn.active');
      var status = activeBtn ? activeBtn.dataset.st : 'present';
      if (status === 'present') {
        input.value = val;
        presentCount++;
        if (val > 0) {
          input.style.transition = 'all 0.15s';
          input.style.background = '#fff3e0';
          input.style.borderColor = '#e65100';
          input.style.transform = 'scale(1.08)';
          setTimeout(function(el) { el.style.background = ''; el.style.borderColor = ''; el.style.transform = ''; }, 300, input);
        }
      }
    });
    var btn = this;
    var origText = btn.textContent;
    if (val > 0 && presentCount > 0) {
      btn.textContent = '✅ 已填充 ' + presentCount + ' 人';
      btn.style.background = '#2e7d32';
      btn.style.borderColor = '#1b5e20';
      btn.style.transform = 'scale(1.05)';
    } else {
      btn.textContent = '已归零 ' + presentCount + ' 人';
      btn.style.background = '#888';
      btn.style.borderColor = '#666';
      btn.style.transform = 'scale(0.97)';
    }
    setTimeout(function() { btn.textContent = origText; btn.style.background = ''; btn.style.borderColor = ''; btn.style.transform = ''; }, 1200);
    var msgEl = document.getElementById('att-msg');
    if (msgEl) {
      if (val > 0) { msgEl.textContent = '📌 已填充 ' + presentCount + ' 名出勤学员扣 ' + val + ' 课次，请点击保存'; msgEl.style.color = '#e65100'; }
      else { msgEl.textContent = '已清零 ' + presentCount + ' 名学员的扣课次'; msgEl.style.color = '#888'; }
      msgEl.style.fontWeight = 'bold';
    }
  });

  area.querySelectorAll('.att-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var row = btn.parentElement.parentElement;
      row.querySelectorAll('.att-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      // 自动设扣课次：出勤=1，请假/缺勤=0
      var deductInput = row.querySelector('.att-deduct');
      if (deductInput) {
        deductInput.value = (btn.dataset.st === 'present') ? 1 : 0;
      }
    });
  });

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
    // 标准化所有学生 enrollments（兼容旧数据）
    studentList.forEach(function(s) { normalizeStudentEnrollments(s); });

    if (existing) {
      existing.records.forEach(function(r) {
        if (r.deducted > 0 && r.status === 'present') {
          var s = studentList.find(function(x) { return x.id === r.studentId; });
          if (s) {
            var enr = (s.enrollments || []).find(function(e) { return e.course === cls.course; }) || (s.enrollments && s.enrollments[0]);
            if (enr) { enr.consumedLessons = Math.max(0, (enr.consumedLessons || 0) - r.deducted); }
          }
        }
      });
    }

    Object.keys(studentDeductions).forEach(function(sid) {
      var s = studentList.find(function(x) { return x.id == parseInt(sid); });
      if (s) {
        var enr = (s.enrollments || []).find(function(e) { return e.course === cls.course; }) || (s.enrollments && s.enrollments[0]);
        if (enr) { enr.consumedLessons = (enr.consumedLessons || 0) + studentDeductions[sid]; }
      }
    });

    // 同步顶层字段
    studentList.forEach(function(s) { normalizeStudentEnrollments(s); });
    saveStudents(studentList);

    var all = getAttendance().filter(function(a) { return !(a.classId == classId && a.date == date); });
    all.push({ id: Date.now(), classId: classId, date: date, records: records, operator: getOperatorName() });
    saveAttendance(all);
    document.getElementById('att-msg').textContent = '✅ 点名已保存，课次已更新';
    document.getElementById('att-msg').style.color = '#5a9';
    document.getElementById('att-msg').style.fontWeight = '';
    renderAttendanceHistory();
    renderAttendanceStats();
    // 保持用户选择的日期，不跳回今天
    var navDate = document.getElementById('att-date-nav');
    renderDailyAttendanceTable(navDate ? navDate.value : date);
    renderLessonLog();
    updateLessonLogSummary();
    renderLowLessonAlerts();
    renderStudents();
    area.style.display = 'none';
  });
}
