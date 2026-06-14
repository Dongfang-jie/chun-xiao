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
    userNameEl.textContent = icon + (user.name || user.email);
  }

  // 家长端：加载个人信息 + 画室通知
  if (!isTeacher) {
    loadParentInfo(user);
    loadParentAnnouncements();
  }

  // 老师端：加载所有管理功能
  if (isTeacher) {
    loadInquiries();
    loadStudents();
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

  // 清空按钮
  var clearBtn = document.getElementById('clear-inquiries');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
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
function getStudents() {
  return JSON.parse(localStorage.getItem('chunxiao-students') || '[]');
}
function saveStudents(list) {
  localStorage.setItem('chunxiao-students', JSON.stringify(list));
}

function loadStudents() {
  renderStudents();
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

      var student = {
        id: editId || Date.now(),
        name: name,
        age: document.getElementById('s-age').value.trim() || '--',
        course: document.getElementById('s-course').value || '--',
        parent: document.getElementById('s-parent').value.trim() || '--',
        phone: document.getElementById('s-phone').value.trim() || '--',
        status: document.getElementById('s-status').value,
        addedAt: new Date().toISOString()
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

function renderStudents() {
  var container = document.getElementById('students-list');
  var countEl = document.getElementById('student-count');
  if (!container) return;

  var list = getStudents();
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无学生，点击"+ 添加学生"开始</p>';
    return;
  }

  var html = '<table><thead><tr><th>姓名</th><th>年龄</th><th>课程</th><th>家长</th><th>电话</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  list.forEach(function(s) {
    var statusColor = s.status === '在读' ? '#5a9' : s.status === '休学' ? '#e88' : '#999';
    html += '<tr>';
    html += '<td><strong>' + s.name + '</strong></td>';
    html += '<td>' + s.age + '</td>';
    html += '<td>' + s.course + '</td>';
    html += '<td>' + s.parent + '</td>';
    html += '<td>' + s.phone + '</td>';
    html += '<td><span style="color:' + statusColor + '; font-weight:bold;">' + s.status + '</span></td>';
    html += '<td>';
    html += '<a href="#" class="edit-student" data-id="' + s.id + '">✏️</a> ';
    html += '<a href="#" class="del-student" data-id="' + s.id + '" style="color:#e88;">🗑️</a>';
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
        addedAt: new Date().toISOString()
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
      '<p>👦 ' + a.student + ' | ' + a.type + '</p>',
      '<a href="#" class="del-artwork" data-id="' + a.id + '" style="color:#e88; font-size:0.85em;">🗑️ 删除</a>',
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
        author: (Auth.currentUser() || {}).name || '老师'
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
      '<a href="#" class="del-ann" data-id="' + a.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>',
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
  list.forEach(function(c, idx) {
    html += '<tr>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="name">' + c.name + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="age">' + c.age + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="duration">' + c.duration + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="time">' + c.time + '</td>';
    html += '<td contenteditable="true" class="editable" data-idx="' + idx + '" data-field="capacity">' + c.capacity + '</td>';
    html += '<td><span style="color:#999; font-size:0.8em;">点击单元格编辑</span></td>';
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
