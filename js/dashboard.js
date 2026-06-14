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

  // 家长端：加载个人信息
  if (!isTeacher) {
    loadParentInfo(user);
  }

  // 老师端：加载预约数据
  if (isTeacher) {
    loadInquiries();
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
//  深色模式
// ============================================================
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
