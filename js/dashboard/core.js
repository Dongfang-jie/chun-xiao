/*
  春晓画室 - 管理端核心模块
  功能：登录检查 / 权限 / 侧边栏导航 / 深色模式
  依赖：js/app/config.js, js/app/auth.js, js/app/data.js
*/

// ============================================================
//  工具函数
// ============================================================

/** 初始化家长端顶栏（用户名 + 孩子切换器） */
function initParentHeader(user) {
  if (!user) return;
  var nameEl = document.getElementById('parent-name');
  if (nameEl) {
    nameEl.innerHTML = '👨‍👩‍👧 ' + (user.name || user.email);
  }
  // 更新孩子切换器
  if (typeof updateChildSwitcher === 'function') {
    updateChildSwitcher(user);
  }
}

function getOperatorName() {
  var user = Auth.currentUser();
  return user ? (user.name || user.email) : '未知';
}

function hasAdminPermission() {
  var user = Auth.currentUser();
  return user && (user.role === 'admin' || user.role === 'teacher');
}

// ============================================================
//  深色模式（仪表盘版）
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

// ============================================================
//  子标签切换（学生管理下的子页面）
// ============================================================
function initStudentSubTabs() {
  document.querySelectorAll('.sub-tab').forEach(function(tab) {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.sub-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var sub = tab.dataset.sub;
      document.querySelectorAll('.sub-page').forEach(function(p) { p.classList.remove('active'); });
      var target = document.getElementById('sub-' + sub);
      if (target) target.classList.add('active');

      // 记住当前子标签
      localStorage.setItem('chunxiao-dashboard-subtab', sub);

      // 切换到对应子页面时刷新数据
      if (sub === 'schedule') renderSchedule();
      if (sub === 'attendance') { renderDailyAttendanceTable(document.getElementById('att-date-nav').value); renderAttendanceHistory(); renderAttendanceStats(); }
      if (sub === 'records') { refreshRecordSelects(); renderRecordsList(); }
      if (sub === 'lessonlog') { refreshLogStudentSelects(); renderLessonLog(); updateLessonLogSummary(); renderLowLessonAlerts(); }
      if (sub === 'renewals') { refreshRenewalStudentSelects(); refreshRenewalFilterSelects(); renderRenewalHistory(); }
      if (sub === 'classes') { refreshClassStudentCheckboxes(); }
    });
  });

  // 恢复到上次的子标签
  var savedSub = localStorage.getItem('chunxiao-dashboard-subtab');
  if (savedSub) {
    document.querySelectorAll('.sub-tab').forEach(function(t) { t.classList.remove('active'); });
    var savedSubTab = document.querySelector('.sub-tab[data-sub="' + savedSub + '"]');
    if (savedSubTab) savedSubTab.classList.add('active');
    document.querySelectorAll('.sub-page').forEach(function(p) { p.classList.remove('active'); });
    var subTarget = document.getElementById('sub-' + savedSub);
    if (subTarget) subTarget.classList.add('active');
  }
}

// ============================================================
//  页面入口
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

  // 迁移旧 localStorage key 命名（chunxiao_session → chunxiao-session 等）
  migrateStorageKeys();

  var isTeacher = window.location.pathname.includes('teacher');

  // 检查登录状态
  var user = Auth.currentUser();
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  // 显示用户名（避免日志泄露邮箱，仅显示用户名）
  var userNameEl = document.getElementById(isTeacher ? 'teacher-name' : 'parent-name');
  if (userNameEl) {
    var icon = isTeacher ? '👩‍🏫 ' : '👨‍👩‍👧 ';
    var displayName = escapeHtml(user.name || user.email || '用户');
    var roleBadge = isTeacher ? (hasAdminPermission() ? ' <span style="font-size:0.65em; background:#5d4037; color:#fff; padding:2px 8px; border-radius:10px;">管理员</span>' : ' <span style="font-size:0.65em; background:#d7a86e; color:#5d4037; padding:2px 8px; border-radius:10px;">老师</span>') : '';
    userNameEl.innerHTML = icon + displayName + roleBadge;
  }

  // 老师端：先绑定事件（不依赖数据），再等 CloudBase 同步后渲染
  if (isTeacher) {
    initStudentSubTabs();
    loadStudents();
    loadClasses();
    loadSchedule();
    loadAttendance();
    loadRecords();
    loadLessonLog();
    loadRenewals();
    loadArtworks();
    loadAnnouncements();
    loadCourses();
    loadInquiries();
    updateOverview();
  }

  // ===== 核心：从 CloudBase 同步数据（每次加载都检查时间戳），再刷新界面 =====
  DataStore.pullFromCloud().then(function() {
    console.log('✅ CloudBase 双向同步完成');

    if (isTeacher) {
      // 同步后刷新所有界面（用云端最新数据）
      renderStudents();
      renderClasses();
      renderSchedule();
      // 刷新点名页：每日点名表 + 历史 + 统计
      var attDateNav = document.getElementById('att-date-nav');
      if (attDateNav) renderDailyAttendanceTable(attDateNav.value);
      renderAttendanceHistory();
      renderAttendanceStats();
      refreshRecordSelects();
      renderRecordsList();
      refreshLogStudentSelects();
      renderLessonLog();
      updateLessonLogSummary();
      renderLowLessonAlerts();
      refreshRenewalStudentSelects();
      refreshRenewalFilterSelects();
      renderRenewalHistory();
      refreshClassStudentCheckboxes();
      renderArtworks();
      renderAnnouncements();
      renderCourses();
      // 首次初始化：同步后仍无课程数据 → 写入默认值（此时云端也无数据，不会冲突）
      if (!localStorage.getItem('chunxiao-courses')) {
        saveCourses(DEFAULT_COURSES);
        renderCourses();
      }
      updateOverview();
    } else {
      // 家长端：同步后加载所有模块
      initParentHeader(user);
      loadParentInfo(user);
      loadChildManagement(user);
      loadParentOverview(user);
      loadParentSchedule(user);
      loadParentAttendance(user);
      loadParentLessonLog(user);
      loadParentAnnouncements();
    }
  });

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

      // 记住当前页面，刷新后恢复
      localStorage.setItem('chunxiao-dashboard-page', pageName);

      // 切换到数据管理页时加载统计
      if (pageName === 'datamgmt' && typeof loadDataMgmt === 'function') {
        loadDataMgmt();
      }
    });
  });

  // 刷新后恢复到上次的页面
  var savedPage = localStorage.getItem('chunxiao-dashboard-page');
  if (savedPage) {
    sidebarLinks.forEach(function (l) { l.classList.remove('active'); });
    var savedLink = document.querySelector('.sidebar-link[data-page="' + savedPage + '"]');
    if (savedLink) savedLink.classList.add('active');
    document.querySelectorAll('.dash-page').forEach(function (page) {
      page.classList.remove('active');
    });
    var target = document.getElementById('page-' + savedPage);
    if (target) target.classList.add('active');

    // 恢复到数据管理页时加载统计
    if (savedPage === 'datamgmt' && typeof loadDataMgmt === 'function') {
      loadDataMgmt();
    }
  }

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
