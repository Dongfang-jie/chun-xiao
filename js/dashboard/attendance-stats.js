/*
  春晓画室 - 管理端点名历史与出勤统计
*/

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

      var restoreInfo = [];
      var studentList = getStudents();
      att.records.forEach(function(r) {
        if (r.deducted > 0 && r.status === 'present') {
          var s = studentList.find(function(x) { return x.id === r.studentId; });
          if (s) restoreInfo.push(s.name + '（恢复' + r.deducted + '课次）');
        }
      });

      var confirmMsg = '确定撤销该次点名？';
      if (restoreInfo.length > 0) { confirmMsg += '\n\n将恢复以下学员的课次：\n' + restoreInfo.join('\n'); }
      if (!confirm(confirmMsg)) return;

      var cls = getClasses().find(function(c) { return c.id === att.classId; });
      studentList.forEach(function(s) { normalizeStudentEnrollments(s); });
      att.records.forEach(function(r) {
        if (r.deducted > 0 && r.status === 'present') {
          var s = studentList.find(function(x) { return x.id === r.studentId; });
          if (s) {
            var enr = (s.enrollments || []).find(function(e) { return cls && e.course === cls.course; }) || (s.enrollments && s.enrollments[0]);
            if (enr) { enr.consumedLessons = Math.max(0, (enr.consumedLessons || 0) - r.deducted); }
          }
        }
      });
      studentList.forEach(function(s) { normalizeStudentEnrollments(s); });
      saveStudents(studentList);
      saveAttendance(getAttendance().filter(function(a) { return a.id != id; }));
      renderAttendanceHistory();
      renderAttendanceStats();
      renderLessonLog();
      updateLessonLogSummary();
      renderLowLessonAlerts();
      renderStudents();
      updateOverview();
    });
  });
}

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

  var classStats = {};
  attendance.forEach(function(a) {
    if (!classStats[a.classId]) { classStats[a.classId] = { present: 0, leave: 0, absent: 0, total: 0 }; }
    a.records.forEach(function(r) {
      classStats[a.classId].total++;
      if (r.status === 'present') classStats[a.classId].present++;
      else if (r.status === 'leave') classStats[a.classId].leave++;
      else classStats[a.classId].absent++;
    });
  });

  var studentStats = {};
  attendance.forEach(function(a) {
    a.records.forEach(function(r) {
      if (!studentStats[r.studentId]) { studentStats[r.studentId] = { present: 0, leave: 0, absent: 0, total: 0 }; }
      studentStats[r.studentId].total++;
      if (r.status === 'present') studentStats[r.studentId].present++;
      else if (r.status === 'leave') studentStats[r.studentId].leave++;
      else studentStats[r.studentId].absent++;
    });
  });

  var global = { present: 0, leave: 0, absent: 0, total: 0 };
  Object.keys(studentStats).forEach(function(sid) {
    global.present += studentStats[sid].present;
    global.leave += studentStats[sid].leave;
    global.absent += studentStats[sid].absent;
    global.total += studentStats[sid].total;
  });
  var globalRate = global.total > 0 ? Math.round(global.present / global.total * 100) : 0;

  var html = '';
  html += '<div class="detail-stats-row" style="margin-bottom:20px;">';
  html += '<div class="detail-stat-mini"><div class="mini-number green">' + globalRate + '%</div><div class="mini-label">📈 总出勤率</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number brown">' + global.total + '</div><div class="mini-label">📋 总点名次数</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number green">' + global.present + '</div><div class="mini-label">✅ 出勤</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number orange">' + global.leave + '</div><div class="mini-label">⭕ 请假</div></div>';
  html += '<div class="detail-stat-mini"><div class="mini-number red">' + global.absent + '</div><div class="mini-label">❌ 缺勤</div></div>';
  html += '</div>';

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

  html += '<h4 style="color:#5d4037; margin-bottom:10px;">👨‍🎓 按学员</h4>';
  var studentKeys = Object.keys(studentStats);
  var activeStudentKeys = studentKeys.filter(function(sid) {
    var s = students.find(function(x) { return x.id == parseInt(sid); });
    return s && s.status === '在读';
  });
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
