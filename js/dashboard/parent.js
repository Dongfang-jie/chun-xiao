/*
  春晓画室 - 家长端模块
  功能：总览 / 我的课程 / 上课记录 / 课次明细 / 孩子作品 / 画室通知 / 个人信息
*/

// ============================================================
//  工具函数
// ============================================================

/** 根据家长的 childName 找到对应学生记录 */
function findChildStudent(user) {
  if (!user || !user.children || !user.children.length) return null;
  var idx = user.activeChildIndex || 0;
  var child = user.children[idx] || user.children[0];
  if (!child) return null;
  var students = getStudents();
  // 优先 studentId 精确匹配
  if (child.studentId) {
    var byId = students.find(function (s) { return s.id === child.studentId; });
    if (byId) return byId;
  }
  // Fallback: name 匹配
  return students.find(function (s) { return s.name === child.name; }) || null;
}

// 刷新所有家长端模块
function refreshAllParentModules() {
  var user = Auth.currentUser();
  if (!user) return;
  initParentHeader(user);
  loadParentInfo(user);
  loadChildManagement(user);
  loadParentOverview(user);
  loadParentSchedule(user);
  loadParentAttendance(user);
  loadParentLessonLog(user);
  loadParentArtworks(user);
}

/** 获取学生所在的所有班级 */
function getStudentClasses(studentId) {
  var classes = getClasses();
  return classes.filter(function (c) {
    return c.studentIds && c.studentIds.indexOf(studentId) !== -1;
  });
}

// WEEKDAY_MAP / WEEKDAY_NAMES 已迁移至 js/app/config.js 全局常量 WEEKWEEKDAY_MAP / WEEKWEEKDAY_NAMES

/** 计算下次上课日期 */
function calcNextClassDate(classes) {
  if (!classes || classes.length === 0) return null;
  var now = new Date();
  var today = now.getDay(); // 0=周日
  var bestDate = null;
  var bestClass = null;
  classes.forEach(function (cls) {
    var targetDay = WEEKDAY_MAP[cls.day];
    if (targetDay === undefined) return;
    var daysUntil = targetDay - today;
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0) {
      // 今天有课：检查时间是否已过（简单处理：如果当前时间>17:00则跳到下周）
      // 粗略处理：即使今天有课也显示今天
      daysUntil = 0;
    }
    var d = new Date(now);
    d.setDate(d.getDate() + daysUntil);
    d.setHours(0, 0, 0, 0);
    if (bestDate === null || d < bestDate) {
      bestDate = d;
      bestClass = cls;
    }
  });
  return bestClass ? { date: bestDate, cls: bestClass } : null;
}

/** 格式化日期为 MM-DD */
function fmtShortDate(dateStr) {
  if (!dateStr) return '--';
  var parts = dateStr.split('-');
  return parts[1] + '/' + parts[2];
}

// ============================================================
//  1. 总览
// ============================================================

function loadParentOverview(user) {
  var student = findChildStudent(user);

  // --- 下次上课 ---
  var elNextClass = document.getElementById('ov-next-class');
  if (elNextClass) {
    if (!student) {
      elNextClass.textContent = '--';
    } else {
      var classes = getStudentClasses(student.id);
      var next = calcNextClassDate(classes);
      if (next) {
        var month = next.date.getMonth() + 1;
        var day = next.date.getDate();
        elNextClass.innerHTML = '<span style="font-size:0.5em;">' + month + '月' + day + '日</span><br>' + escapeHtml(next.cls.day || '') + ' ' + escapeHtml(next.cls.timeSlot || '');
        elNextClass.style.fontSize = '1.6em';
      } else {
        elNextClass.innerHTML = '<span style="font-size:0.7em;">待排课</span>';
      }
    }
  }

  // --- 剩余课次 ---
  var elRemaining = document.getElementById('ov-remaining');
  if (elRemaining) {
    if (!student) {
      elRemaining.textContent = '--';
    } else {
      var total = student.totalLessons || 0;
      var consumed = student.consumedLessons || 0;
      var remaining = total - consumed;
      var color = remaining <= 4 ? '#e88' : remaining <= 8 ? '#e8a040' : '#5a9';
      elRemaining.innerHTML = '<span style=\"color:' + color + ';\">' + remaining + '</span><span style=\"font-size:0.4em; color:#999;\"> / ' + total + '</span>';
    }
  }

  // --- 出勤率 ---
  var elAttRate = document.getElementById('ov-att-rate');
  if (elAttRate) {
    if (!student) {
      elAttRate.textContent = '--';
    } else {
      var stats = calcAttendanceStats(student.id);
      elAttRate.textContent = stats.rateDisplay;
    }
  }

  // --- 完成作品数 ---
  loadParentArtworks(user); // 这个函数同时更新作品数和最近作品

  // --- 最新通知 ---
  loadParentOverviewNotices();
}

/** 计算学生考勤统计 */
function calcAttendanceStats(studentId) {
  var attendance = getAttendance();
  var present = 0, leave = 0, absent = 0, totalDeducted = 0;
  attendance.forEach(function (a) {
    a.records.forEach(function (r) {
      if (r.studentId === studentId) {
        if (r.status === 'present') { present++; totalDeducted += (r.deducted || 0); }
        else if (r.status === 'leave') leave++;
        else if (r.status === 'absent') absent++;
      }
    });
  });
  var total = present + leave + absent;
  var rate = total > 0 ? Math.round(present / total * 100) : 0;
  return {
    present: present, leave: leave, absent: absent,
    total: total, rate: rate,
    totalDeducted: totalDeducted,
    rateDisplay: total === 0 ? '--' : rate + '%'
  };
}

/** 总览页最新3条通知 */
function loadParentOverviewNotices() {
  var container = document.getElementById('parent-overview-notices');
  if (!container) return;
  var list = safeParseJSON('chunxiao-announcements', []);
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">📭 暂无通知</p>';
    return;
  }
  var recent = list.slice(0, 3);
  var html = '';
  recent.forEach(function (a) {
    html += [
      '<div class="parent-notice-mini">',
      '<span class="parent-notice-title">' + escapeHtml(a.title || '') + '</span>',
      '<span class="parent-notice-time">' + escapeHtml(a.time || '') + '</span>',
      '</div>'
    ].join('');
  });
  if (list.length > 3) {
    html += '<p style="text-align:center; color:#999; font-size:0.85em;">📌 还有 ' + (list.length - 3) + ' 条通知，点击「画室通知」查看全部</p>';
  }
  container.innerHTML = html;
}

// ============================================================
//  2. 我的课程
// ============================================================

function loadParentSchedule(user) {
  var student = findChildStudent(user);
  var wrap = document.getElementById('parent-schedule-wrap');
  var classList = document.getElementById('parent-class-list');
  if (!wrap) return;

  if (!student) {
    wrap.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">未找到学生信息，请联系老师确认</p>';
    if (classList) classList.innerHTML = '';
    return;
  }

  var classes = getStudentClasses(student.id);
  if (classes.length === 0) {
    wrap.innerHTML = '<p style="text-align:center; color:#999; padding:40px; background:#fff; border-radius:12px;">📅 等待老师排课后查看课表</p>';
    if (classList) classList.innerHTML = '';
    return;
  }

  // 构建周视图表格
  renderParentWeeklySchedule(wrap, classes);

  // 下方班级详情卡片
  if (classList) renderParentClassCards(classList, classes);
}

/** 渲染孩子的周课表 */
function renderParentWeeklySchedule(wrap, classes) {
  var now = new Date();
  var today = now.getDay(); // 0=周日

  // 找使用的时间段
  var allSlots = [];
  classes.forEach(function (c) {
    if (c.timeSlot && allSlots.indexOf(c.timeSlot) === -1) allSlots.push(c.timeSlot);
  });
  allSlots.sort();
  if (allSlots.length === 0) allSlots = ['--'];

  var html = '<table class="schedule-table"><thead><tr><th class="schedule-time-header">时间</th>';
  for (var d = 0; d < 7; d++) {
    var isToday = (d === today);
    html += '<th' + (isToday ? ' class="schedule-today-header"' : '') + '>' + WEEKDAY_NAMES[d] + '</th>';
  }
  html += '</tr></thead><tbody>';

  allSlots.forEach(function (slot) {
    html += '<tr><td class="schedule-time-cell">' + escapeHtml(slot || '') + '</td>';
    for (var d = 0; d < 7; d++) {
      var dayName = WEEKDAY_NAMES[d];
      var match = null;
      for (var i = 0; i < classes.length; i++) {
        if (classes[i].day === dayName && classes[i].timeSlot === slot) {
          match = classes[i];
          break;
        }
      }
      if (match) {
        var colorIdx = (match.course || '').length % 6;
        html += '<td><span class="schedule-class-card sc-color-' + colorIdx + '">';
        html += '<span class="sc-name">' + escapeHtml(match.name || '') + '</span>';
        html += '<span class="sc-meta">' + escapeHtml(match.course || '') + ' · ' + escapeHtml(match.room || '未设教室') + '</span>';
        html += '</span></td>';
      } else {
        html += '<td class="schedule-empty-cell">—</td>';
      }
    }
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;
}

/** 渲染班级详情卡片 */
function renderParentClassCards(container, classes) {
  var studentCounts = {};
  classes.forEach(function (c) {
    studentCounts[c.id] = (c.studentIds || []).length;
  });

  var html = '<h3 style="color:#5d4037; margin-bottom:12px;">📌 我的班级</h3><div class="parent-class-cards">';
  classes.forEach(function (c) {
    html += [
      '<div class="parent-class-card">',
      '<h4>' + escapeHtml(c.name || '') + '</h4>',
      '<p>📖 ' + escapeHtml(c.course || '--') + '</p>',
      '<p>📅 ' + escapeHtml(c.day || '') + ' ' + escapeHtml(c.timeSlot || '--') + '</p>',
      '<p>📍 ' + escapeHtml(c.room || '未设教室') + '</p>',
      '<p style="color:#999; margin:4px 0; font-size:0.85em;">👥 ' + (studentCounts[c.id] || '--') + ' 名同学</p>',
      '</div>'
    ].join('');
  });
  html += '</div>';
  container.innerHTML = html;
}

// ============================================================
//  3. 上课记录（考勤）
// ============================================================

function loadParentAttendance(user) {
  var student = findChildStudent(user);
  if (!student) {
    document.getElementById('parent-attendance-list').innerHTML = '<p style="text-align:center; color:#999; padding:30px;">未找到学生信息</p>';
    return;
  }

  // 统计卡片
  var stats = calcAttendanceStats(student.id);
  document.getElementById('att-total').textContent = stats.present;
  document.getElementById('att-rate-card').textContent = stats.total === 0 ? '--' : stats.rate + '%';
  document.getElementById('att-leave-count').textContent = stats.leave;
  document.getElementById('att-deduct-total').textContent = stats.totalDeducted;

  // 考勤明细列表
  renderParentAttendanceList(student.id);
}

/** 渲染考勤明细列表 */
function renderParentAttendanceList(studentId) {
  var container = document.getElementById('parent-attendance-list');
  if (!container) return;

  var attendance = getAttendance();
  var classes = getClasses();

  // 收集所有包含该学生的考勤记录
  var entries = [];
  attendance.forEach(function (a) {
    a.records.forEach(function (r) {
      if (r.studentId === studentId) {
        var cls = classes.find(function (c) { return c.id === a.classId; });
        entries.push({
          date: a.date,
          className: cls ? cls.name : '(已删除班级)',
          course: cls ? (cls.course || '') : '',
          status: r.status,
          deducted: r.deducted || 0,
          operator: a.operator || ''
        });
      }
    });
  });

  // 按日期倒序
  entries.sort(function (a, b) { return b.date.localeCompare(a.date); });

  if (entries.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无考勤记录</p>';
    return;
  }

  var html = '<table><thead><tr><th>日期</th><th>班级</th><th>状态</th><th>扣课次</th></tr></thead><tbody>';
  entries.forEach(function (e) {
    var statusLabel, statusColor;
    if (e.status === 'present') { statusLabel = '✅ 出勤'; statusColor = '#5a9'; }
    else if (e.status === 'leave') { statusLabel = '⭕ 请假'; statusColor = '#e8a040'; }
    else { statusLabel = '❌ 缺勤'; statusColor = '#e88'; }

    html += '<tr>';
    html += '<td>' + escapeHtml(e.date || '') + ' <span style="color:#999; font-size:0.8em;">' + getDayOfWeek(e.date) + '</span></td>';
    html += '<td>' + escapeHtml(e.className || '') + '</td>';
    html += '<td><span style="font-weight:bold; color:' + statusColor + ';">' + statusLabel + '</span></td>';
    html += '<td>' + (e.deducted > 0 ? '<span style="color:#e88; font-weight:bold;">-' + e.deducted + '</span>' : '0') + '</td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

/** 从日期字符串获取星期 */
function getDayOfWeek(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  return WEEKDAY_NAMES[d.getDay()];
}

// ============================================================
//  4. 课次明细
// ============================================================

function loadParentLessonLog(user) {
  var student = findChildStudent(user);
  if (!student) {
    document.getElementById('parent-lesson-progress').innerHTML = '<p style="text-align:center; color:#999;">未找到学生信息</p>';
    document.getElementById('parent-lesson-log').innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无记录</p>';
    return;
  }

  renderLessonProgress(student);
  renderParentLessonLog(student.id);
}

/** 渲染课次进度条 */
function renderLessonProgress(student) {
  var container = document.getElementById('parent-lesson-progress');
  if (!container) return;

  var total = student.totalLessons || 0;
  var consumed = student.consumedLessons || 0;
  var remaining = total - consumed;
  var pct = total > 0 ? Math.round(consumed / total * 100) : 0;
  var barColor = remaining <= 4 ? 'warning' : '';

  var html = '<div class="student-lesson-bar-wrap">';
  html += '<div class="student-lesson-bar-header">';
  html += '<span>课次进度</span>';
  html += '<strong>' + consumed + ' / ' + total + ' 已消耗</strong>';
  html += '</div>';
  html += '<div class="student-lesson-bar">';
  html += '<div class="student-lesson-bar-fill ' + barColor + '" style="width:' + pct + '%;"></div>';
  html += '</div>';
  html += '<div class="student-lesson-legend">';
  html += '<span>总课次 <strong>' + total + '</strong></span>';
  html += '<span>已消耗 <strong style="color:#e88;">' + consumed + '</strong></span>';
  html += '<span>剩余 <strong style="color:' + (remaining <= 4 ? '#e88' : remaining <= 8 ? '#e8a040' : '#5a9') + ';">' + remaining + '</strong></span>';
  html += '</div>';

  if (remaining <= 4 && remaining > 0) {
    html += '<p class="parent-lesson-warning">⚠️ 剩余课次不足，请及时续费</p>';
  } else if (remaining <= 0) {
    html += '<p class="parent-lesson-warning">⚠️ 课次已用完，请联系老师续费</p>';
  }

  html += '</div>';
  container.innerHTML = html;
}

/** 渲染消课日志 */
function renderParentLessonLog(studentId) {
  var container = document.getElementById('parent-lesson-log');
  if (!container) return;

  var attendance = getAttendance();
  var corrections = getLessonCorrections();
  var classes = getClasses();
  var entries = [];

  // 从考勤收集
  attendance.forEach(function (a) {
    a.records.forEach(function (r) {
      if (r.studentId === studentId && r.deducted > 0) {
        var cls = classes.find(function (c) { return c.id === a.classId; });
        entries.push({
          date: a.date,
          source: a.operator || '',
          reason: (cls ? cls.name : '(已删班级)') + ' · 点名扣课',
          amount: r.deducted,
          type: 'att'
        });
      }
    });
  });

  // 从手动调整收集
  corrections.forEach(function (c) {
    if (c.studentId === studentId) {
      entries.push({
        date: c.date,
        source: c.operator || '',
        reason: c.reason || '手动调整',
        amount: c.amount || 0,
        type: 'manual'
      });
    }
  });

  // 按日期倒序
  entries.sort(function (a, b) { return b.date.localeCompare(a.date); });

  if (entries.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无消课记录</p>';
    return;
  }

  var html = '<table><thead><tr><th>日期</th><th>事由</th><th>类型</th><th>扣除</th></tr></thead><tbody>';
  entries.forEach(function (e) {
    html += '<tr>';
    html += '<td>' + escapeHtml(e.date || '') + '</td>';
    html += '<td>' + escapeHtml(e.reason || '') + '</td>';
    html += '<td><span class="log-type-badge ' + (e.type === 'att' ? 'log-type-att' : 'log-type-manual') + '">' + (e.type === 'att' ? '点名扣课' : '手动调整') + '</span></td>';
    html += '<td><span style="color:#e88; font-weight:bold;">-' + e.amount + '</span></td>';
    html += '</tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

// ============================================================
//  5. 孩子作品（支持 studentId 匹配 + cloud:// 云存储图片）
// ============================================================

var _parentArtworkUrlCache = {};  // { fileID: tempURL }

function loadParentArtworks(user) {
  var currentChild = Auth.currentChild();
  if (!currentChild) return;
  var childName = currentChild.name;
  var matchedStudent = findChildStudent(user);

  var allArtworks = getArtworks();

  // 筛选：优先 studentId 匹配，fallback 到 student 名匹配
  var childWorks = allArtworks.filter(function (a) {
    if (matchedStudent && a.studentId && a.studentId === matchedStudent.id) return true;
    if (a.student === childName) return true;
    return false;
  });

  var statEl = document.getElementById('ov-works');
  if (statEl) statEl.textContent = childWorks.length;

  var overviewContainer = document.getElementById('parent-overview-works');
  if (overviewContainer) {
    if (childWorks.length === 0) {
      overviewContainer.innerHTML = '<p style="text-align:center; color:#999; padding:40px; width:100%;">还没有「' + escapeHtml(childName || '') + '」的作品，老师添加后自动展示</p>';
    } else {
      var html = '';
      childWorks.slice(0, 4).forEach(function (a) { html += buildParentArtworkCard(a); });
      overviewContainer.innerHTML = html;
    }
  }

  var worksContainer = document.getElementById('parent-child-works');
  var subtitleEl = document.getElementById('parent-works-subtitle');
  if (worksContainer) {
    if (subtitleEl) subtitleEl.textContent = '👶 ' + childName + ' 的课堂作品 · 共 ' + childWorks.length + ' 件';
    if (childWorks.length === 0) {
      worksContainer.innerHTML = '<p style="text-align:center; color:#999; padding:40px; width:100%;">还没有「' + escapeHtml(childName || '') + '」的作品，老师添加后自动展示</p>';
    } else {
      var allHtml = '';
      childWorks.forEach(function (a) { allHtml += buildParentArtworkCard(a); });
      worksContainer.innerHTML = allHtml;
    }
  }

  // 异步解析 cloud:// 图片
  resolveParentArtworkCloudUrls(childWorks);
}

function buildParentArtworkCard(a) {
  var displayUrl = a.image || '';
  if (displayUrl.indexOf('cloud://') === 0) {
    if (_parentArtworkUrlCache[displayUrl]) {
      displayUrl = _parentArtworkUrlCache[displayUrl];
    } else {
      displayUrl = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent('加载中');
    }
  }
  if (!displayUrl) {
    displayUrl = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(a.title || '作品');
  }

  return [
    '<div class="card">',
    '<img src="' + displayUrl + '" alt="' + escapeHtml(a.title || '') + '" class="card-img parent-artwork-img" data-fileid="' + (a.image || '') + '" onerror="this.src=\'https://placehold.co/400x300/e8d8c8/5d4037?text=作品\'">',
    '<div class="card-body">',
    '<h4>' + escapeHtml(a.title || '') + '</h4>',
    '<p>' + escapeHtml(a.type || '') + (a.addedAt ? ' | ' + new Date(a.addedAt).toLocaleDateString('zh-CN') : '') + '</p>',
    '</div></div>'
  ].join('');
}

async function resolveParentArtworkCloudUrls(list) {
  if (!list || !list.length) return;

  var cloudIDs = [];
  list.forEach(function (a) {
    if (a.image && a.image.indexOf('cloud://') === 0 && !_parentArtworkUrlCache[a.image]) {
      cloudIDs.push(a.image);
    }
  });
  if (!cloudIDs.length) return;

  var urlMap = {};
  if (typeof ArtworkStorage !== 'undefined' && ArtworkStorage.getUrls) {
    urlMap = await ArtworkStorage.getUrls(cloudIDs);
  } else {
    // fallback: 直接调 CloudBase SDK
    try {
      var app = getApp();
      if (app) {
        var auth = getAuth();
        if (auth) {
          var loginState = await auth.getLoginState();
          if (!loginState) await auth.signInAnonymously();
        }
        var fileList = cloudIDs.map(function (id) {
          return { fileID: id, maxAge: 86400 };
        });
        var res = await app.getTempFileURL({ fileList: fileList });
        if (res && res.fileList) {
          res.fileList.forEach(function (f) {
            if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL;
          });
        }
      }
    } catch (e) {
      console.warn('家长端解析图片URL失败:', e.message);
    }
  }

  // 合并缓存
  for (var key in urlMap) {
    if (urlMap.hasOwnProperty(key)) {
      _parentArtworkUrlCache[key] = urlMap[key];
    }
  }

  // 更新 DOM
  var imgs = document.querySelectorAll('.parent-artwork-img');
  imgs.forEach(function (img) {
    var fid = img.dataset.fileid;
    if (fid && _parentArtworkUrlCache[fid]) {
      img.src = _parentArtworkUrlCache[fid];
    }
  });
}

// ============================================================
//  6. 画室通知（已有，保留逻辑）
// ============================================================

function loadParentAnnouncements() {
  var container = document.getElementById('parent-announcements');
  if (!container) return;

  var list = safeParseJSON('chunxiao-announcements', []);

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">📭 暂无通知</p>';
    return;
  }

  var html = '';
  list.forEach(function (a) {
    html += [
      '<div style="background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:12px; box-shadow:0 1px 6px rgba(0,0,0,0.05); border-left:4px solid #d7a86e;">',
      '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">',
      '<h4 style="color:#5d4037; margin:0;">📢 ' + escapeHtml(a.title || '') + '</h4>',
      '<span style="color:#999; font-size:0.8em;">' + escapeHtml(a.time || '') + '</span>',
      '</div>',
      '<p style="margin-top:8px; color:#666; line-height:1.7;">' + escapeHtml(a.content || '').replace(/\n/g, '<br>') + '</p>',
      '</div>'
    ].join('');
  });
  container.innerHTML = html;
}

// ============================================================
//  7. 个人信息 + 修改密码
// ============================================================

function loadParentInfo(user) {
  var infoEl = document.getElementById('parent-info');
  if (!infoEl) return;

  var student = findChildStudent(user);
  var currentChild = Auth.currentChild();

  var html = '';
  html += '<p><strong>👤 家长姓名：</strong>' + escapeHtml(user.name || '--') + '</p>';
  html += '<p><strong>📧 邮箱：</strong>' + escapeHtml(user.email || '--') + '</p>';
  html += '<p><strong>👶 当前孩子：</strong>' + escapeHtml(currentChild ? currentChild.name : '--') + '</p>';
  if (user.children && user.children.length > 1) {
    html += '<p style="font-size:0.85em; color:#999;">共 ' + user.children.length + ' 个孩子</p>';
  }

  if (student) {
    html += '<hr style="border:none; border-top:1px solid #e8d4c8; margin:16px 0;">';
    html += '<p><strong>📊 在读状态：</strong>' + escapeHtml(student.status || '--') + '</p>';
    html += '<p><strong>📖 主修课程：</strong>' + escapeHtml(student.course || '--') + '</p>';
    html += '<p><strong>📚 总课次：</strong>' + (student.totalLessons || 0) + '</p>';
    html += '<p><strong>✅ 已消耗：</strong>' + (student.consumedLessons || 0) + '</p>';
    html += '<p><strong>⭐ 剩余：</strong>' + ((student.totalLessons || 0) - (student.consumedLessons || 0)) + '</p>';
  } else if (currentChild) {
    html += '<hr style="border:none; border-top:1px solid #e8d4c8; margin:16px 0;">';
    html += '<p style="color:#e8a040;">⚠️ 未关联学生，请在下方关联或等待老师添加</p>';
  }

  html += '<hr style="border:none; border-top:1px solid #e8d4c8; margin:16px 0;">';
  html += '<p><strong>📅 登录时间：</strong>' + (user.loginTime ? new Date(user.loginTime).toLocaleString('zh-CN') : '--') + '</p>';

  infoEl.innerHTML = html;

  // 修改密码按钮事件
  var pwdBtn = document.getElementById('pwd-change-btn');
  if (pwdBtn) {
    pwdBtn.addEventListener('click', function () {
      changePassword();
    });
  }
}

/** 修改密码 */
async function changePassword() {
  var newPwd = document.getElementById('pwd-new').value.trim();
  var confirmPwd = document.getElementById('pwd-confirm').value.trim();
  var msgEl = document.getElementById('pwd-msg');
  if (!msgEl) return;

  if (!newPwd || newPwd.length < 6) {
    msgEl.textContent = '⚠️ 密码至少6位';
    msgEl.style.color = '#e88';
    return;
  }
  if (newPwd !== confirmPwd) {
    msgEl.textContent = '⚠️ 两次密码不一致';
    msgEl.style.color = '#e88';
    return;
  }

  var user = Auth.currentUser();
  if (!user) {
    msgEl.textContent = '⚠️ 登录状态异常，请重新登录';
    msgEl.style.color = '#e88';
    return;
  }

  // 教师账户不支持在线改密码
  if (user.role === 'teacher' || user.role === 'admin') {
    msgEl.textContent = '⚠️ 教师账户暂不支持在线修改密码';
    msgEl.style.color = '#e8a040';
    return;
  }

  // 家长：本地更新密码哈希
  msgEl.textContent = '⏳ 修改中...';
  msgEl.style.color = '#999';

  try {
    var db = getDB();
    if (!db) throw new Error('数据库未就绪');

    // 查找家长的 parents 文档
    var res = await db.collection('parents').where({ email: user.email }).get();
    if (!res.data || res.data.length === 0) {
      throw new Error('未找到账户信息');
    }

    var docId = res.data[0]._id;
    var passwordHash = Auth.hashPassword(newPwd);

    await db.collection('parents').doc(docId).update({ passwordHash: passwordHash });

    msgEl.textContent = '✅ 密码修改成功';
    msgEl.style.color = '#5a9';
    document.getElementById('pwd-new').value = '';
    document.getElementById('pwd-confirm').value = '';
  } catch (err) {
    msgEl.textContent = '⚠️ 修改失败：' + (err.message || '请重新登录后再试');
    msgEl.style.color = '#e88';
  }
}

// ============================================================
//  8. 孩子管理（多孩子支持）
// ============================================================

/** 渲染孩子管理列表 */
function loadChildManagement(user) {
  var listEl = document.getElementById('child-list');
  if (!listEl) return;
  if (!user || !Array.isArray(user.children)) return;

  var students = getStudents();
  var activeIdx = user.activeChildIndex || 0;

  var html = '';
  user.children.forEach(function (child, i) {
    var student = null;
    if (child.studentId) {
      student = students.find(function (s) { return s.id === child.studentId; });
    }
    if (!student) {
      student = students.find(function (s) { return s.name === child.name; });
    }
    var isActive = i === activeIdx;
    var linked = !!student;

    html += '<div class="child-row' + (isActive ? ' active' : '') + '">';
    html += '<span class="child-row-name">👶 ' + escapeHtml(child.name || '') + '</span>';
    html += '<span class="child-row-badge ' + (linked ? 'linked' : 'unlinked') + '">' + (linked ? '已关联 ' + escapeHtml(student.name || '') : '未关联学生') + '</span>';
    if (!isActive) {
      html += '<button class="child-row-switch" data-index="' + i + '">设为当前</button>';
    } else {
      html += '<span style="font-size:0.8em; color:#d7a86e;">当前</span>';
    }
    if (user.children.length > 1) {
      html += '<button class="child-row-remove" data-index="' + i + '" title="删除">✕</button>';
    }
    html += '</div>';
  });
  listEl.innerHTML = html;

  // 绑定切换按钮事件
  listEl.querySelectorAll('.child-row-switch').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(this.dataset.index);
      switchActiveChild(idx);
    });
  });

  // 绑定删除按钮事件
  listEl.querySelectorAll('.child-row-remove').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(this.dataset.index);
      removeChild(idx);
    });
  });

  // 添加孩子按钮
  var addBtn = document.getElementById('add-child-btn');
  if (addBtn) {
    addBtn.onclick = showAddChildForm;
  }

  // 确认添加
  var confirmBtn = document.getElementById('confirm-add-child-btn');
  if (confirmBtn) {
    confirmBtn.onclick = addChild;
  }

  // 取消添加
  var cancelBtn = document.getElementById('cancel-add-child-btn');
  if (cancelBtn) {
    cancelBtn.onclick = hideAddChildForm;
  }

  // 更新顶栏切换器
  updateChildSwitcher(user);
}

/** 更新顶栏孩子切换器 */
function updateChildSwitcher(user) {
  var wrap = document.getElementById('child-switcher-wrap');
  var nameSpan = document.getElementById('active-child-name');
  var switchBtn = document.getElementById('child-switch-btn');
  if (!wrap || !nameSpan) return;

  var child = Auth.currentChild();
  if (child && child.name) {
    wrap.style.display = '';
    nameSpan.textContent = child.name;
    if (user.children && user.children.length > 1) {
      switchBtn.style.display = '';
    } else {
      switchBtn.style.display = 'none';
    }
    // 渲染下拉
    renderChildDropdown(user);
  } else {
    wrap.style.display = 'none';
  }
}

/** 渲染顶栏孩子下拉菜单 */
function renderChildDropdown(user) {
  var dropdown = document.getElementById('child-dropdown');
  var switchBtn = document.getElementById('child-switch-btn');
  if (!dropdown || !switchBtn || !user.children) return;

  var activeIdx = user.activeChildIndex || 0;
  var html = '';
  user.children.forEach(function (child, i) {
    html += '<div class="child-dropdown-item' + (i === activeIdx ? ' active' : '') + '" data-index="' + i + '">👶 ' + escapeHtml(child.name || '') + '</div>';
  });
  dropdown.innerHTML = html;

  // 绑定点击
  dropdown.querySelectorAll('.child-dropdown-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var idx = parseInt(this.dataset.index);
      switchActiveChild(idx);
      dropdown.style.display = 'none';
    });
  });

  // 切换下拉显示
  switchBtn.onclick = function (e) {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? '' : 'none';
  };

  // 点击其他地方关闭（先移除旧监听器，防止重复绑定）
  if (dropdown._closeHandler) {
    document.removeEventListener('click', dropdown._closeHandler);
  }
  dropdown._closeHandler = function () {
    dropdown.style.display = 'none';
  };
  document.addEventListener('click', dropdown._closeHandler);
}

/** 切换当前孩子 */
async function switchActiveChild(index) {
  var user = Auth.currentUser();
  if (!user || !user.children || index >= user.children.length) return;
  await Auth.updateChildren(user.children, index);
  refreshAllParentModules();
}

/** 删除孩子 */
async function removeChild(index) {
  var user = Auth.currentUser();
  if (!user || !user.children) return;
  if (user.children.length <= 1) {
    alert('至少保留一个孩子信息');
    return;
  }
  var child = user.children[index];
  if (!confirm('确定删除「' + child.name + '」吗？\n\n删除后不会影响孩子的上课记录，你仍然可以重新添加。')) return;

  var newChildren = user.children.filter(function (_, i) { return i !== index; });
  var newIndex = user.activeChildIndex;
  if (index < newIndex || (index === newIndex && newIndex >= newChildren.length)) {
    newIndex = Math.max(0, newIndex - 1);
  }
  await Auth.updateChildren(newChildren, newIndex);
  refreshAllParentModules();
}

/** 显示添加孩子表单 */
function showAddChildForm() {
  var form = document.getElementById('add-child-form-wrap');
  var btn = document.getElementById('add-child-btn');
  if (form) form.style.display = '';
  if (btn) btn.style.display = 'none';

  var searchInput = document.getElementById('new-child-name-search');
  if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  var msg = document.getElementById('add-child-msg');
  if (msg) msg.textContent = '';
}

/** 隐藏添加孩子表单 */
function hideAddChildForm() {
  var form = document.getElementById('add-child-form-wrap');
  var btn = document.getElementById('add-child-btn');
  if (form) form.style.display = 'none';
  if (btn) btn.style.display = '';
}

/** 确认添加孩子（搜索匹配 → 发送关联请求给教师审批） */
async function addChild() {
  var searchInput = document.getElementById('new-child-name-search');
  var msg = document.getElementById('add-child-msg');
  var searchName = searchInput ? searchInput.value.trim() : '';
  if (!searchName) {
    if (msg) { msg.textContent = '⚠️ 请输入孩子姓名'; msg.style.color = '#e88'; }
    return;
  }

  // 精确匹配学生
  var students = getStudents();
  var matched = students.find(function (s) { return s.name === searchName; });
  if (!matched) {
    if (msg) { msg.textContent = '⚠️ 没有此孩子「' + searchName + '」，请确认姓名正确或联系老师先添加学生档案'; msg.style.color = '#e88'; }
    return;
  }

  var user = Auth.currentUser();
  if (!user) return;

  // 检查是否已经添加过
  if (user.children && user.children.some(function (c) { return c.studentId === matched.id || c.name === matched.name; })) {
    if (msg) { msg.textContent = '⚠️ 该孩子已在你的列表中'; msg.style.color = '#e8a040'; }
    return;
  }

  // 创建关联请求（inquiry type=link_request）
  try {
    var inquiries = (typeof getInquiries === 'function') ? getInquiries() : [];
    var now = new Date();
    var timeStr = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate() + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ':' + String(now.getSeconds()).padStart(2, '0');

    inquiries.push({
      id: Date.now(),
      type: 'link_request',
      parentEmail: user.email,
      parentName: user.name || '',
      childName: searchName,
      studentId: matched.id,
      studentName: matched.name,
      status: 'pending',
      time: timeStr,
      read: false
    });

    if (typeof saveInquiries === 'function') {
      saveInquiries(inquiries);
    }
    if (msg) { msg.textContent = '✅ 已发送关联请求，等待老师审批'; msg.style.color = '#5a9'; }

    // 2 秒后关闭表单
    setTimeout(function () { hideAddChildForm(); }, 2000);
  } catch (err) {
    if (msg) { msg.textContent = '⚠️ 发送失败：' + (err.message || '请稍后再试'); msg.style.color = '#e88'; }
  }
}
