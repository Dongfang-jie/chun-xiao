/*
  春晓画室 - 仪表盘逻辑（LeanCloud 版）
*/

// ============================================================
//  一、页面加载时检查登录状态
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

  var isTeacher = window.location.pathname.includes('teacher');

  // 检查是否已登录
  var user = AV.User.current();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  console.log('✅ 已登录：' + user.get('email'));

  // 显示用户名在顶栏
  var userNameEl = document.getElementById(isTeacher ? 'teacher-name' : 'parent-name');
  if (userNameEl) {
    var displayName = user.get('name') || user.get('email') || '用户';
    var icon = isTeacher ? '👩‍🏫 ' : '👨‍👩‍👧 ';
    userNameEl.textContent = icon + displayName;
  }

  // 家长端：加载个人信息
  if (!isTeacher) {
    loadParentInfo(user);
  }

  // ==========================================================
  //  二、侧边栏导航切换
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
  //  三、退出登录
  // ==========================================================
  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (confirm('确定要退出登录吗？')) {
        AV.User.logOut().then(function () {
          window.location.href = 'login.html';
        });
      }
    });
  }

  // ==========================================================
  //  四、深色模式
  // ==========================================================
  initDashboardDarkMode();

});

// ============================================================
//  家长端：加载个人信息
// ============================================================
function loadParentInfo(user) {
  var infoEl = document.getElementById('parent-info');
  if (!infoEl) return;

  var name = user.get('name') || '--';
  var email = user.get('email') || '--';
  var childName = user.get('childName') || '--';
  var createdAt = user.get('createdAt');

  infoEl.innerHTML = ''
    + '<p><strong>👤 家长姓名：</strong>' + name + '</p>'
    + '<p><strong>📧 邮箱：</strong>' + email + '</p>'
    + '<p><strong>👶 孩子姓名：</strong>' + childName + '</p>'
    + '<p><strong>📅 注册时间：</strong>' + (createdAt ? new Date(createdAt).toLocaleDateString('zh-CN') : '--') + '</p>';
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
    headerRight.insertBefore(toggleBtn, logoutBtn);
  }
}
