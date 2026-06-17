/*
  春晓画室 - 公开页面作品展示模块
  使用统一数据层 getArtworks()，CloudBase 由 DataStore 管理
*/

function buildArtworkCard(a) {
  return [
    '<div class="card">',
    '<img src="' + a.image + '" alt="' + a.title + '" class="card-img" onerror="this.src=\'https://placehold.co/400x300/e8d8c8/5d4037?text=作品\'">',
    '<div class="card-body">',
    '<h4>' + a.title + '</h4>',
    '<p>👦 ' + a.student + ' | ' + a.type + '</p>',
    '</div></div>'
  ].join('');
}

// 画廊页：按类型分组展示
async function renderGalleryArtworks() {
  var artContainer = document.getElementById('artwork-art-list');
  var calligraphyContainer = document.getElementById('artwork-calligraphy-list');
  if (!artContainer && !calligraphyContainer) return;

  await DataStore.pullFromCloud();
  var list = getArtworks();

  var artHtml = '';
  var calHtml = '';
  list.forEach(function(a) {
    var card = buildArtworkCard(a);
    if (a.type === '书法') { calHtml += card; }
    else { artHtml += card; }
  });

  if (artContainer) {
    artContainer.innerHTML = artHtml || '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无美术作品，老师端添加后自动展示</p>';
  }
  if (calligraphyContainer) {
    calligraphyContainer.innerHTML = calHtml || '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无书法作品，老师端添加后自动展示</p>';
  }
}

// 首页：展示最新 N 件作品
function renderLatestArtworks(containerId, count) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var list = getArtworks();
  var html = '';
  list.slice(0, count || 4).forEach(function(a) {
    html += buildArtworkCard(a);
  });
  container.innerHTML = html || '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无作品，老师端添加后自动展示</p>';
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof Auth !== 'undefined') {
    await Auth.initAnonymous();
  }
  await renderGalleryArtworks();
  await renderLatestArtworks('home-artworks', 4);
});
