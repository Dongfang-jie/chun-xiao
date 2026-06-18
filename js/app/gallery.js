/*
  春晓画室 - 公开页面作品展示模块
  使用统一数据层 getArtworks()，CloudBase 由 DataStore 管理
  支持 cloud:// 云存储图片的异步URL解析
*/

var _galleryUrlCache = {};  // { fileID: tempURL } 公开页面的 cloud:// 缓存

function buildArtworkCard(a) {
  var displayUrl = a.image || '';
  // cloud:// 优先用缓存，否则用占位符
  if (displayUrl.indexOf('cloud://') === 0) {
    if (_galleryUrlCache[displayUrl]) {
      displayUrl = _galleryUrlCache[displayUrl];
    } else {
      displayUrl = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent('加载中');
    }
  }
  if (!displayUrl) {
    displayUrl = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(a.title || '作品');
  }

  return [
    '<div class="card">',
    '<img src="' + displayUrl + '" alt="' + a.title + '" class="card-img gallery-artwork-img" data-fileid="' + (a.image || '') + '" loading="lazy" onerror="var p=this.parentNode;var d=document.createElement(\'div\');d.className=\'card-img card-placeholder\';d.style.background=\'linear-gradient(135deg,#e8d8c8,#d4c0a8)\';d.textContent=this.alt;p.replaceChild(d,this)">',
    '<div class="card-body">',
    '<h4>' + a.title + '</h4>',
    '<p>👦 ' + a.student + ' | ' + a.type + '</p>',
    '</div></div>'
  ].join('');
}

// 解析列表中所有 cloud:// 图片的临时URL并更新DOM
async function resolveGalleryCloudUrls(list) {
  if (!list || !list.length) return;

  var cloudIDs = [];
  list.forEach(function (a) {
    if (a.image && a.image.indexOf('cloud://') === 0 && !_galleryUrlCache[a.image]) {
      cloudIDs.push(a.image);
    }
  });
  if (!cloudIDs.length) return;

  var urlMap = {};
  // ArtworkStorage 可能还未加载（公开页面），直接调 CloudBase API
  if (typeof ArtworkStorage !== 'undefined' && ArtworkStorage.getUrls) {
    urlMap = await ArtworkStorage.getUrls(cloudIDs);
  } else {
    // fallback：直接调 CloudBase SDK
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
      console.warn('公开画廊解析图片URL失败:', e.message);
    }
  }

  // 合并缓存
  for (var key in urlMap) {
    if (urlMap.hasOwnProperty(key)) {
      _galleryUrlCache[key] = urlMap[key];
    }
  }

  // 更新 DOM
  var imgs = document.querySelectorAll('.gallery-artwork-img');
  imgs.forEach(function (img) {
    var fid = img.dataset.fileid;
    if (fid && _galleryUrlCache[fid]) {
      img.src = _galleryUrlCache[fid];
    }
  });
}

// 画廊页：按类型分组展示（美术 / 书法 / 课堂剪影）
async function renderGalleryArtworks() {
  var artContainer = document.getElementById('artwork-art-list');
  var calligraphyContainer = document.getElementById('artwork-calligraphy-list');
  var classroomContainer = document.getElementById('artwork-classroom-list');
  if (!artContainer && !calligraphyContainer && !classroomContainer) return;

  await DataStore.pullFromCloud();
  var list = getArtworks();

  var artHtml = '';
  var calHtml = '';
  var clsHtml = '';
  var artList = [];
  var calList = [];
  var clsList = [];
  list.forEach(function(a) {
    var card = buildArtworkCard(a);
    if (a.type === '书法') {
      calHtml += card;
      calList.push(a);
    } else if (a.type === '课堂剪影') {
      clsHtml += card;
      clsList.push(a);
    } else {
      // 美术 + 旧数据兼容（无 type 或 type='美术' 等）
      artHtml += card;
      artList.push(a);
    }
  });

  if (artContainer) {
    artContainer.innerHTML = artHtml || '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无美术作品，老师端添加后自动展示</p>';
  }
  if (calligraphyContainer) {
    calligraphyContainer.innerHTML = calHtml || '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无书法作品，老师端添加后自动展示</p>';
  }
  if (classroomContainer) {
    classroomContainer.innerHTML = clsHtml || '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无课堂剪影，老师端添加后自动展示</p>';
  }

  // 异步解析 cloud:// 图片
  await resolveGalleryCloudUrls(artList.concat(calList).concat(clsList));
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof Auth !== 'undefined') {
    await Auth.initAnonymous();
  }
  await renderGalleryArtworks();
});
