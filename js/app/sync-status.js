/*
  春晓画室 - 同步状态气泡（右下角）
  显示：已推送 / 已拉取 / 同步失败 等状态
  依赖：无（独立模块，在 data.js 之后加载）
*/

var SyncBubble = {
  _el: null,
  _timer: null,
  _counts: { pushed: 0, pulled: 0, errors: 0 },
  _queue: [],

  // ========== 初始化 DOM ==========
  init: function () {
    if (document.getElementById('sync-bubble')) return;
    var bubble = document.createElement('div');
    bubble.id = 'sync-bubble';
    bubble.innerHTML =
      '<div class="sync-bubble-inner sync-hidden" id="sync-bubble-inner">' +
        '<div class="sync-bubble-icon idle" id="sync-bubble-icon">☁️</div>' +
        '<div class="sync-bubble-body" id="sync-bubble-body"></div>' +
        '<button class="sync-bubble-close" id="sync-bubble-close" title="关闭">×</button>' +
      '</div>';
    document.body.appendChild(bubble);
    this._el = {
      root: bubble,
      inner: document.getElementById('sync-bubble-inner'),
      icon: document.getElementById('sync-bubble-icon'),
      body: document.getElementById('sync-bubble-body'),
      close: document.getElementById('sync-bubble-close')
    };

    // 手动关闭按钮
    var self = this;
    this._el.close.addEventListener('click', function (e) {
      e.stopPropagation();
      self.hide();
    });
  },

  // ========== 显示消息 ==========
  // type: 'push' | 'pull' | 'error' | 'info'
  show: function (message, type, collection) {
    this.init();
    type = type || 'info';

    // 统计
    if (type === 'push') this._counts.pushed++;
    else if (type === 'pull') this._counts.pulled++;
    else if (type === 'error') this._counts.errors++;

    // 构建显示内容
    var iconClass = '';
    var iconEmoji = '☁️';
    var countHtml = '';
    var total = this._counts.pushed + this._counts.pulled + this._counts.errors;

    switch (type) {
      case 'push':
        iconClass = 'pushing';
        iconEmoji = '📤';
        countHtml = total > 0 ? '<span class="sync-bubble-count">' + total + '</span>' : '';
        break;
      case 'pull':
        iconClass = 'pulling';
        iconEmoji = '📥';
        countHtml = total > 0 ? '<span class="sync-bubble-count">' + total + '</span>' : '';
        break;
      case 'error':
        iconClass = 'error';
        iconEmoji = '⚠️';
        countHtml = this._counts.errors > 0 ? '<span class="sync-bubble-count warn">' + this._counts.errors + '</span>' : '';
        break;
      default:
        iconClass = 'success';
        iconEmoji = '✅';
        break;
    }

    // 更新图标
    var icon = this._el.icon;
    icon.className = 'sync-bubble-icon ' + iconClass;
    icon.textContent = iconEmoji;

    // 更新文字
    this._el.body.innerHTML = message + countHtml;

    // 显示
    var inner = this._el.inner;
    inner.classList.remove('sync-hidden');
    inner.classList.add('pulse');

    // 脉冲结束后移除
    var self = this;
    setTimeout(function () { inner.classList.remove('pulse'); }, 3600);

    // 自动隐藏（8s，给用户足够时间阅读）
    clearTimeout(this._timer);
    this._timer = setTimeout(function () {
      self.hide();
    }, 8000);
  },

  // ========== 快捷方法 ==========
  pushOk: function (collection, count) {
    var label = collectionMap(collection) || collection;
    this.show('<strong>已推送</strong> ' + label + (count ? ' · ' + count + '条' : ''), 'push');
  },
  pushFail: function (collection, reason) {
    var label = collectionMap(collection) || collection;
    this.show('<strong>推送失败</strong> ' + label + (reason ? ': ' + reason : ''), 'error');
  },
  pullOk: function (collection, count) {
    var label = collectionMap(collection) || collection;
    this.show('<strong>已拉取</strong> ' + label + (count ? ' · ' + count + '条' : ''), 'pull');
  },
  pullFail: function (collection, reason) {
    var label = collectionMap(collection) || collection;
    this.show('<strong>拉取失败</strong> ' + label + (reason ? ': ' + reason : ''), 'error');
  },
  syncComplete: function (ok, fail) {
    ok = ok || 0;
    fail = fail || 0;
    var total = ok + fail;
    if (total === 0) return;
    if (fail === 0) {
      this.show('<strong>同步完成</strong> ' + ok + ' 项全部成功 ✅', 'info');
    } else {
      this.show('<strong>同步完成</strong> ' + ok + ' 项成功 · ' + fail + ' 项失败', 'error');
    }
  },

  // ========== 隐藏（缩回气泡） ==========
  hide: function () {
    if (!this._el) return;
    this._el.inner.classList.add('sync-hidden');
    // 恢复空闲图标
    var icon = this._el.icon;
    icon.className = 'sync-bubble-icon idle';
    icon.textContent = '☁️';
  },

  // ========== 重置计数 ==========
  reset: function () {
    this._counts = { pushed: 0, pulled: 0, errors: 0 };
  }
};

// 集合名 → 中文标签
function collectionMap(collection) {
  var map = {
    'students': '学员',
    'classes': '班级',
    'attendance': '点名',
    'records': '上课记录',
    'corrections': '课消日志',
    'artworks': '作品',
    'announcements': '通知',
    'inquiries': '预约查询',
    'renewals': '续费',
    'courses': '课程设置'
  };
  return map[collection] || '';
}
