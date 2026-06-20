/*
  春晓画室 - 管理端课表模块
*/

function loadSchedule() { /* 初次不渲染，切换时渲染 */ }

function renderSchedule() {
  var grid = document.getElementById('schedule-grid');
  var unscheduledEl = document.getElementById('unscheduled-classes');
  if (!grid) return;
  var classes = getClasses();
  var days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var students = getStudents();

  var scheduled = classes.filter(function(c) { return c.day; });
  var unscheduled = classes.filter(function(c) { return !c.day; });

  if (scheduled.length === 0 && unscheduled.length === 0) {
    grid.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无班级数据，请先在「班级」中创建班级并设置上课日</p>';
    if (unscheduledEl) unscheduledEl.innerHTML = '';
    return;
  }

  var timeSlots = [];
  scheduled.forEach(function(c) {
    if (c.timeSlot && timeSlots.indexOf(c.timeSlot) === -1) { timeSlots.push(c.timeSlot); }
  });
  timeSlots.sort(function(a, b) {
    var aStart = a.split('-')[0] || '';
    var bStart = b.split('-')[0] || '';
    return aStart.localeCompare(bStart);
  });
  if (timeSlots.length === 0) { timeSlots = ['（未设时段）']; }

  var courseColors = {};
  var colorIdx = 0;
  var todayDayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];

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
          if (!(c.course in courseColors)) { courseColors[c.course] = colorIdx++ % 6; }
          var cc = courseColors[c.course];
          html += '<div class="schedule-class-card sc-color-' + cc + '">';
          html += '<span class="sc-name">' + escapeHtml(c.name || '') + '</span>';
          html += '<span class="sc-meta">' + escapeHtml(c.room || '') + '</span>';
          html += '<span class="sc-count">' + studentCount + '人</span>';
          html += '</div>';
        });
      }
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';

  // 无时段的行
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
          html += '<span class="sc-name">' + escapeHtml(c.name || '') + '</span>';
          html += '<span class="sc-meta">' + escapeHtml(c.room || '') + '</span>';
          html += '<span class="sc-count">' + studentCount + '人</span>';
          html += '</div>';
        });
      }
      html += '</td>';
    });
    html += '</tr></tbody></table>';
  }

  grid.innerHTML = html;

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
