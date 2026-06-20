/*
  春晓画室 - 管理端上课记录模块
*/

function loadRecords() {
  refreshRecordSelects();
  renderRecordsList();
  var saveBtn = document.getElementById('record-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveRecord);
  var dateEl = document.getElementById('rec-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
}

function refreshRecordSelects() {
  var sel = document.getElementById('rec-class-select');
  if (!sel) return;
  var classes = getClasses();
  sel.innerHTML = '<option value="">-- 请选择 --</option>' +
    classes.map(function(c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
}

function saveRecord() {
  var classId = parseInt(document.getElementById('rec-class-select').value);
  var date = document.getElementById('rec-date').value;
  var content = document.getElementById('rec-content').value.trim();
  var notes = document.getElementById('rec-notes').value.trim();
  var msgEl = document.getElementById('rec-msg');
  if (!classId || !date || !content) {
    msgEl.textContent = '⚠️ 请填写班级、日期和教学内容';
    msgEl.style.color = '#e88'; return;
  }
  var list = getRecords();
  list.unshift({
    id: Date.now(), classId: classId, date: date,
    content: content, notes: notes,
    teacherName: getOperatorName(),
    time: new Date().toLocaleString('zh-CN')
  });
  saveRecords(list);
  document.getElementById('rec-content').value = '';
  document.getElementById('rec-notes').value = '';
  msgEl.textContent = '✅ 记录已保存';
  msgEl.style.color = '#5a9';
  renderRecordsList();
}

function renderRecordsList() {
  var container = document.getElementById('records-list');
  if (!container) return;
  var list = getRecords();
  if (list.length === 0) { container.innerHTML = '<p style="text-align:center; color:#999; padding:30px;">暂无记录</p>'; return; }

  var classes = getClasses();
  var html = '';
  list.forEach(function(r) {
    var cls = classes.find(function(c) { return c.id == r.classId; });
    html += [
      '<div style="background:#fff; border-radius:10px; padding:16px 20px; margin-bottom:10px; box-shadow:0 1px 6px rgba(0,0,0,0.05); border-left:3px solid #5d4037;">',
      '<div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">',
      '<strong style="color:#5d4037;">' + escapeHtml(cls ? cls.name : '(已删)') + ' · ' + escapeHtml(r.date || '') + '</strong>',
      '<span style="color:#999; font-size:0.8em;">' + escapeHtml(r.time || '') + ' · ' + escapeHtml(r.teacherName || '') + '</span>',
      '</div>',
      '<p style="margin-top:8px; color:#444;">📖 ' + escapeHtml(r.content || '') + '</p>',
      (r.notes ? '<p style="color:#888; font-size:0.9em;">📌 ' + escapeHtml(r.notes || '') + '</p>' : ''),
      (hasAdminPermission() ? '<a href="#" class="del-rec" data-id="' + r.id + '" style="color:#e88; font-size:0.8em;">🗑️ 删除</a>' : ''),
      '</div>'
    ].join('');
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-rec').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!confirm('删除该上课记录？')) return;
      var id = parseInt(btn.dataset.id);
      saveRecords(getRecords().filter(function(r) { return r.id != id; }));
      renderRecordsList();
    });
  });
}
