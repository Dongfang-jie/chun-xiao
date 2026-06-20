/*
  春晓画室 - CloudBase 云存储工具
  提供作品图片的上传、获取临时访问URL、删除
  依赖：js/app/config.js（getApp, getAuth）
*/

var ArtworkStorage = {
  // 确保已登录（匿名即可，CloudBase Storage 要求 auth != null）
  _ensureAuth: async function () {
    try {
      var auth = getAuth();
      if (!auth) return false;
      var loginState = await auth.getLoginState();
      if (!loginState) {
        await auth.signInAnonymously();
      }
      return true;
    } catch (e) {
      console.warn('ArtworkStorage: 登录失败', e.message);
      return false;
    }
  },

  // 上传文件到 CloudBase Storage
  // file: File 或 Blob 对象
  // 返回: { success: true, fileID: 'cloud://...' } | { success: false, error: '...' }
  upload: async function (file) {
    var app = getApp();
    if (!app) return { success: false, error: 'CloudBase 未初始化' };

    var authed = await ArtworkStorage._ensureAuth();
    if (!authed) return { success: false, error: '登录失败' };

    // MIME 类型 → 扩展名映射（支持常见图片格式）
    var mimeToExt = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
      'image/gif': 'gif', 'image/bmp': 'bmp', 'image/svg+xml': 'svg'
    };
    var ext = mimeToExt[file.type] || 'jpg';
    var path = 'artworks/' + Date.now() + '_' + (ArtworkStorage._counter = (ArtworkStorage._counter || 0) + 1) + '_' + Math.random().toString(36).substring(2, 6) + '.' + ext;

    try {
      var result = await app.storage.from().upload(path, file, {
        contentType: file.type || 'image/' + (ext === 'png' ? 'png' : 'jpeg')
      });
      if (result.error) {
        console.error('ArtworkStorage 上传失败:', result.error);
        return { success: false, error: result.error.message || '上传失败' };
      }
      logDebug('ArtworkStorage 上传成功:', result.data.id);
      return { success: true, fileID: result.data.id };
    } catch (e) {
      console.error('ArtworkStorage 上传异常:', e.message);
      return { success: false, error: e.message || '上传失败' };
    }
  },

  // 批量获取临时访问 URL
  // fileIDs: ['cloud://...']  返回: {} 对象 { fileID: tempURL, ... }
  getUrls: async function (fileIDs) {
    var app = getApp();
    if (!app || !fileIDs || !fileIDs.length) return {};

    // 去重 + 只处理 cloud:// 前缀
    var seen = {};
    var unique = [];
    fileIDs.forEach(function (id) {
      if (id && id.indexOf('cloud://') === 0 && !seen[id]) {
        seen[id] = true;
        unique.push(id);
      }
    });
    if (!unique.length) return {};

    var authed = await ArtworkStorage._ensureAuth();
    if (!authed) return {};

    var fileList = unique.map(function (id) {
      return { fileID: id, maxAge: 86400 };
    });

    try {
      var res = await app.getTempFileURL({ fileList: fileList });
      var map = {};
      if (res && res.fileList) {
        res.fileList.forEach(function (f) {
          if (f.tempFileURL) {
            map[f.fileID] = f.tempFileURL;
          }
        });
      }
      return map;
    } catch (e) {
      console.warn('ArtworkStorage 获取临时URL失败:', e.message);
      return {};
    }
  },

  // 批量删除云存储文件
  // fileIDs: ['cloud://...']  静默失败（文件可能已被删）
  remove: async function (fileIDs) {
    var app = getApp();
    if (!app || !fileIDs || !fileIDs.length) return;

    var cloudIDs = fileIDs.filter(function (id) {
      return id && id.indexOf('cloud://') === 0;
    });
    if (!cloudIDs.length) return;

    var authed = await ArtworkStorage._ensureAuth();
    if (!authed) return;

    try {
      await app.storage.from().remove(cloudIDs);
      logDebug('ArtworkStorage 已删除:', cloudIDs.length + '个文件');
    } catch (e) {
      console.warn('ArtworkStorage 删除文件失败:', e.message);
    }
  },

  // 判断图片字段是否需异步解析
  // 返回 true 表示是 cloud:// 需要调 getUrls
  isCloudId: function (imageField) {
    return imageField && imageField.indexOf('cloud://') === 0;
  },

  // 获取可直接用于 <img src> 的 URL
  // imageField: 原始 image 字段值
  // urlCache: getUrls() 返回的 { fileID: tempURL } 映射
  resolveSrc: function (imageField, urlCache) {
    if (!imageField) {
      return 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent('作品');
    }
    // cloud:// → 从缓存取
    if (imageField.indexOf('cloud://') === 0) {
      if (urlCache && urlCache[imageField]) return urlCache[imageField];
      // 还没解析完，先返回占位符
      return 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent('加载中');
    }
    // data:image 或 https:// 直接返回
    return imageField;
  }
};
