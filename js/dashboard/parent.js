/*
  春晓画室 - 家长端模块
  功能：个人信息 / 孩子作品 / 画室通知
*/

function loadParentInfo(user) {
  var infoEl = document.getElementById('parent-info');
  if (!infoEl) return;

  infoEl.innerHTML = ''
    + '<p><strong>👤 家长姓名：</strong>' + (user.name || '--') + '</p>'
    + '<p><strong>📧 邮箱：</strong>' + (user.email || '--') + '</p>'
    + '<p><strong>👶 孩子姓名：</strong>' + (user.childName || '--') + '</p>'
    + '<p><strong>📅 登录时间：</strong>' + (user.loginTime ? new Date(user.loginTime).toLocaleString('zh-CN') : '--') + '</p>';
}

function loadParentArtworks(user) {
  var childName = user.childName;
  if (!childName) return;

  var allArtworks = JSON.parse(localStorage.getItem('chunxiao-artworks') || '[]');
  var childWorks = allArtworks.filter(function(a) { return a.student === childName; });

  var statEl = document.querySelector('#page-overview .stat-cards .stat-card:first-child .stat-number');
  if (statEl) statEl.textContent = childWorks.length;

  var overviewContainer = document.getElementById('parent-overview-works');
  if (overviewContainer) {
    if (childWorks.length === 0) {
      overviewContainer.innerHTML = '<p style="text-align:center; color:#999; padding:40px; width:100%;">还没有「' + childName + '」的作品，老师添加后自动展示</p>';
    } else {
      var html = '';
      childWorks.slice(0, 4).forEach(function(a) { html += buildParentArtworkCard(a); });
      overviewContainer.innerHTML = html;
    }
  }

  var worksContainer = document.getElementById('parent-child-works');
  var subtitleEl = document.getElementById('parent-works-subtitle');
  if (worksContainer) {
    if (subtitleEl) subtitleEl.textContent = '👶 ' + childName + ' 的课堂作品 · 共 ' + childWorks.length + ' 件';
    if (childWorks.length === 0) {
      worksContainer.innerHTML = '<p style="text-align:center; color:#999; padding:40px; width:100%;">还没有「' + childName + '」的作品，老师添加后自动展示</p>';
    } else {
      var allHtml = '';
      childWorks.forEach(function(a) { allHtml += buildParentArtworkCard(a); });
      worksContainer.innerHTML = allHtml;
    }
  }
}

function buildParentArtworkCard(a) {
  return [
    '<div class="card">',
    '<img src="' + a.image + '" alt="' + a.title + '" class="card-img" onerror="this.src=\'https://placehold.co/400x300/e8d8c8/5d4037?text=作品\'">',
    '<div class="card-body">',
    '<h4>' + a.title + '</h4>',
    '<p>' + a.type + (a.addedAt ? ' | ' + new Date(a.addedAt).toLocaleDateString('zh-CN') : '') + '</p>',
    '</div></div>'
  ].join('');
}

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
