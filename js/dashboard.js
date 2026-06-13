/*
  春晓画室 - 仪表盘逻辑
  阶段 5: 登录系统（老师端 + 家长端共用）
*/

import { requireAuth, logoutUser } from './firebase-config.js';

// ============================================================
//  一、页面加载时检查登录状态
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

  // 判断当前是老师端还是家长端
  var isTeacher = window.location.pathname.includes('teacher');

  // 检查是否已登录（未登录会跳转到 login.html）
  requireAuth(isTeacher ? 'teacher' : 'parent').then(function (user) {
    console.log('✅ 已登录：' + user.email);

    // 显示用户邮箱在顶栏
    var userNameEl = document.getElementById(isTeacher ? 'teacher-name' : 'parent-name');
    if (userNameEl) {
      // 尝试从 localStorage 读取注册时保存的姓名
      var savedInfo = localStorage.getItem('chunxiao-parent-info');
      if (savedInfo) {
        var info = JSON.parse(savedInfo);
        userNameEl.textContent = (isTeacher ? '👩‍🏫 ' : '👨‍👩‍👧 ') + info.name;
      } else {
        userNameEl.textContent = (isTeacher ? '👩‍🏫 ' : '👨‍👩‍👧 ') + user.email;
      }
    }

    // 家长端：加载个人信息
    if (!isTeacher) {
      loadParentInfo();
    }
  }).catch(function (error) {
    console.error('登录检查失败：', error);
  });

  // ==========================================================
  //  二、侧边栏导航切换
  // ==========================================================
  var sidebarLinks = document.querySelectorAll('.sidebar-link');
  sidebarLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      // 切换链接的 active 状态
      sidebarLinks.forEach(function (l) { l.classList.remove('active'); });
      link.classList.add('active');

      // 切换页面内容
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
  //  三、退出登录
  // ==========================================================
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (confirm('确定要退出登录吗？')) {
        logoutUser().then(function () {
          window.location.href = 'login.html';
        }).catch(function (error) {
          alert('退出失败：' + error.message);
        });
      }
    });
  }

  // ==========================================================
  //  四、深色模式（仪表盘也需要）
  // ==========================================================
  initDashboardDarkMode();

});

// ============================================================
//  家长端：加载个人信息
// ============================================================
function loadParentInfo() {
  var infoEl = document.getElementById('parent-info');
  var savedInfo = localStorage.getItem('chunxiao-parent-info');

  if (infoEl && savedInfo) {
    var info = JSON.parse(savedInfo);
    infoEl.innerHTML = ''
      + '<p><strong>👤 家长姓名：</strong>' + (info.name || '--') + '</p>'
      + '<p><strong>📧 邮箱：</strong>' + (info.email || '--') + '</p>'
      + '<p><strong>👶 孩子姓名：</strong>' + (info.childName || '--') + '</p>'
      + '<p><strong>📅 注册时间：</strong>' + (info.createdAt ? new Date(info.createdAt).toLocaleDateString('zh-CN') : '--') + '</p>';
  } else if (infoEl) {
    infoEl.innerHTML = '<p style="color:#999;">暂无个人信息</p>';
  }
}

// ============================================================
//  仪表盘深色模式
// ============================================================
function initDashboardDarkMode() {
  var savedMode = localStorage.getItem('chunxiao-dark-mode');
  if (savedMode === 'dark') {
    document.body.classList.add('dark-mode');
  }

  // 在顶栏添加切换按钮（仪表盘页面的 main.js 可能不在）
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

    headerRight.insertBefore(toggleBtn, document.getElementById('logout-btn'));
  }
}
