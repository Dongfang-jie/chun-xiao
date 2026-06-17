/*
  春晓画室 - 公开页面 UI 交互模块
  功能：图片灯箱 / 深色模式 / 回到顶部
*/

// ============================================================
//  一、等页面加载完再执行
// ============================================================
document.addEventListener('DOMContentLoaded', function () {

  // ==========================================================
  //  功能 1：图片灯箱（Lightbox）
  //  点击 .card-img 图片 → 弹出大图覆盖层
  // ==========================================================
  initLightbox();

  // ==========================================================
  //  功能 2：深色模式切换
  // ==========================================================
  initDarkMode();

  // ==========================================================
  //  功能 3：回到顶部按钮
  // ==========================================================
  initBackToTop();
});

// ============================================================
//  功能 1 实现：图片灯箱
// ============================================================
function initLightbox() {
  // 创建灯箱的 HTML 结构（一开始隐藏）
  var overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = ''
    + '<span class="lightbox-close">&times;</span>'
    + '<img class="lightbox-img" src="" alt="">'
    + '<p class="lightbox-caption"></p>';
  document.body.appendChild(overlay);

  var lightboxImg = overlay.querySelector('.lightbox-img');
  var lightboxCaption = overlay.querySelector('.lightbox-caption');

  // 给所有卡片图片绑定点击事件
  var images = document.querySelectorAll('.card-img');
  images.forEach(function (img) {
    img.style.cursor = 'pointer';  // 鼠标变手型，暗示可点击
    img.addEventListener('click', function () {
      lightboxImg.src = img.src;
      // 尝试获取图片下方的文字作为说明
      var cardBody = img.closest('.card');
      if (cardBody) {
        var title = cardBody.querySelector('h4');
        var desc = cardBody.querySelector('p');
        var captionText = '';
        if (title) captionText += title.textContent;
        if (desc) captionText += (captionText ? ' — ' : '') + desc.textContent;
        lightboxCaption.textContent = captionText;
      }
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';  // 防止背景滚动
    });
  });

  // 关闭灯箱的方式 1：点 × 按钮
  overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

  // 关闭灯箱的方式 2：点图片以外的黑色区域
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeLightbox();
  });

  // 关闭灯箱的方式 3：按 ESC 键
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeLightbox();
    }
  });

  function closeLightbox() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';  // 恢复背景滚动
  }
}

// ============================================================
//  功能 2 实现：深色模式
// ============================================================
function initDarkMode() {
  // 创建切换按钮
  var toggleBtn = document.createElement('button');
  toggleBtn.className = 'dark-mode-toggle';
  toggleBtn.title = '切换深色/浅色模式';

  // 检查之前是否保存过偏好
  var savedMode = localStorage.getItem('chunxiao-dark-mode');
  if (savedMode === 'dark') {
    document.body.classList.add('dark-mode');
    toggleBtn.textContent = '☀️';
  } else {
    toggleBtn.textContent = '🌙';
  }

  // 把按钮放到导航栏里
  var nav = document.querySelector('nav');
  if (nav) {
    nav.appendChild(toggleBtn);
  }

  // 点击切换
  toggleBtn.addEventListener('click', function () {
    document.body.classList.toggle('dark-mode');
    var isDark = document.body.classList.contains('dark-mode');
    toggleBtn.textContent = isDark ? '☀️' : '🌙';
    // 记住用户的选择
    localStorage.setItem('chunxiao-dark-mode', isDark ? 'dark' : 'light');
  });
}

// ============================================================
//  功能 3 实现：回到顶部按钮
// ============================================================
function initBackToTop() {
  // 创建按钮
  var btn = document.createElement('button');
  btn.className = 'back-to-top';
  btn.innerHTML = '⬆';
  btn.title = '回到顶部';
  document.body.appendChild(btn);

  // 滚动时判断是否显示按钮
  window.addEventListener('scroll', function () {
    if (window.scrollY > 400) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  });

  // 点击时平滑滚动回顶部
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
