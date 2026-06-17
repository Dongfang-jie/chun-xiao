/*
  春晓画室 - 管理端通知发布模块
*/

function loadAnnouncements() {
  var formWrap = document.getElementById('announce-form-wrap');
  if (formWrap && !hasAdminPermission()) formWrap.style.display = 'none';
  renderAnnouncements();
  var publishBtn = document.getElementById('publish-ann-btn');
  if (publishBtn) {
    publishBtn.onclick = function() {
      var title = document.getElementById('ann-title').value.trim();
      var content = document.getElementById('ann-content').value.trim();
      var msgEl = document.getElementById('ann-msg');
      if (!title || !content) {
        msgEl.textContent = '⚠️ 标题和内容都不能为空';
        msgEl.style.color = '#e88';
        return;
      }
      var ann = {
        id: Date.now(),
        title: title, content: content,
        time: new Date().toLocaleString('zh-CN'),
        author: getOperatorName()
      };
      var list = getAnnouncements();
      list.unshift(ann);
      saveAnnouncements(list);
      document.getElementById('ann-title').value = '';
      document.getElementById('ann-content').value = '';
      msgEl.textContent = '✅ 通知已发布！家长端可见';
      msgEl.style.color = '#5a9';
      renderAnnouncements();
      updateOverview();
    };
  }
}

function renderAnnouncements() {
  var container = document.getElementById('announcements-list');
  if (!container) return;

  var list = getAnnouncements();
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无通知</p>';
    return;
  }

  var html = '';
  list.forEach(function(a) {
    html += [
      '<div style="background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:12px; box-shadow:0 1px 6px rgba(0,0,0,0.05);">',
      '<div style="display:flex; justify-content:space-between; align-items:center;">',
      '<h4 style="color:#5d4037; margin:0;">📢 ' + a.title + '</h4>',
      '<span style="color:#999; font-size:0.8em;">' + a.time + ' · ' + a.author + '</span>',
      '</div>',
      '<p style="margin-top:8px; color:#666; line-height:1.7;">' + a.content.replace(/\n/g, '<br>') + '</p>',
      (hasAdminPermission() ? '<a href="#" class="del-ann" data-id="' + a.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>' : ''),
      '</div>'
    ].join('');
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-ann').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该通知吗？')) return;
      var list = getAnnouncements().filter(function(a) { return a.id != id; });
      saveAnnouncements(list);
      renderAnnouncements();
    });
  });
}
