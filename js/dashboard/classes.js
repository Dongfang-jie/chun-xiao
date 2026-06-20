/*
  春晓画室 - 管理端班级管理模块
  功能：班级 CRUD / 学员分配
*/

function loadClasses() {
  renderClasses();
  var addBtn = document.getElementById('add-class-btn');
  if (addBtn) addBtn.onclick = function() { showClassForm(); };
  var cancelBtn = document.getElementById('class-cancel-btn');
  if (cancelBtn) cancelBtn.onclick = function() { document.getElementById('class-form-wrap').style.display = 'none'; };
  var saveBtn = document.getElementById('class-save-btn');
  if (saveBtn) saveBtn.onclick = function() { saveClass(); };
}

function showClassForm(editData) {
  document.getElementById('class-form-wrap').style.display = 'block';
  document.getElementById('c-edit-id').value = editData ? editData.id : '';
  document.getElementById('class-form-title').textContent = editData ? '编辑班级' : '创建班级';
  document.getElementById('c-name').value = editData ? editData.name : '';
  document.getElementById('c-course').value = editData ? editData.course : '';
  document.getElementById('c-day').value = editData ? editData.day : '';
  document.getElementById('c-time').value = editData ? editData.timeSlot : '';
  document.getElementById('c-room').value = editData ? editData.room : '';
  refreshClassStudentCheckboxes(editData ? editData.studentIds : []);
}

function refreshClassStudentCheckboxes(selectedIds) {
  var container = document.getElementById('class-student-checkboxes');
  if (!container) return;
  selectedIds = selectedIds || [];
  var students = getStudents();
  if (students.length === 0) {
    container.innerHTML = '<span style="color:#999;">暂无学员，请先在「学员」中添加</span>';
    return;
  }
  container.innerHTML = students.map(function(s) {
    var checked = selectedIds.indexOf(s.id) !== -1 ? ' checked' : '';
    return '<label style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; background:#fdfaf5; border-radius:14px; cursor:pointer; font-size:0.9em;">'
      + '<input type="checkbox" value="' + s.id + '"' + checked + '> ' + s.name + '</label>';
  }).join('');
}

function saveClass() {
  var name = document.getElementById('c-name').value.trim();
  if (!name) { alert('请输入班级名称'); return; }
  var editId = document.getElementById('c-edit-id').value;
  var checks = document.querySelectorAll('#class-student-checkboxes input:checked');
  var studentIds = Array.prototype.map.call(checks, function(cb) { return parseInt(cb.value); });

  var oldCls = editId ? getClasses().find(function(c) { return c.id == editId; }) : null;
  var opName = getOperatorName();
  var cls = {
    id: editId ? parseInt(editId) : Date.now(),
    name: name,
    course: document.getElementById('c-course').value,
    day: document.getElementById('c-day').value,
    timeSlot: document.getElementById('c-time').value.trim(),
    room: document.getElementById('c-room').value.trim(),
    studentIds: studentIds,
    addedBy: editId ? (oldCls ? oldCls.addedBy : opName) : opName,
    lastModifiedBy: opName
  };
  var list = getClasses();
  if (editId) { list = list.map(function(c) { return c.id == editId ? cls : c; }); }
  else { list.unshift(cls); }
  saveClasses(list);
  document.getElementById('class-form-wrap').style.display = 'none';
  renderClasses();
}

function renderClasses() {
  var container = document.getElementById('classes-list');
  var countEl = document.getElementById('class-count');
  if (!container) return;
  var list = getClasses();
  if (countEl) countEl.textContent = list.length;
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无班级，点击"+ 创建班级"开始</p>';
    return;
  }
  var students = getStudents();
  var html = '<div style="display:flex; flex-wrap:wrap; gap:16px;">';
  list.forEach(function(c) {
    var studentNames = c.studentIds.map(function(sid) {
      var s = students.find(function(x) { return x.id == sid; });
      return s ? s.name : '';
    }).filter(Boolean).join('、');
    html += [
      '<div style="flex:1 1 340px; min-width:280px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);">',
      '<h4 style="color:#5d4037; margin:0 0 8px;">📦 ' + escapeHtml(c.name || '') + '</h4>',
      '<p style="margin:4px 0; color:#666;"><strong>课程：</strong>' + escapeHtml(c.course || '--') + '</p>',
      '<p style="margin:4px 0; color:#666;"><strong>时间：</strong>' + escapeHtml(c.day || '--') + ' ' + escapeHtml(c.timeSlot || '') + '</p>',
      '<p style="margin:4px 0; color:#666;"><strong>教室：</strong>' + escapeHtml(c.room || '--') + '</p>',
      '<p style="margin:4px 0; color:#666;"><strong>学员：</strong>' + escapeHtml(studentNames || '（未分配）') + '</p>',
      '<div style="margin-top:8px;">',
      '<a href="#" class="edit-class" data-id="' + c.id + '">✏️ 编辑</a> ',
      (hasAdminPermission() ? '<a href="#" class="del-class" data-id="' + c.id + '" style="color:#e88;">🗑️ 删除</a>' : ''),
      '</div></div>'
    ].join('');
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.edit-class').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      var c = getClasses().find(function(x) { return x.id == id; });
      if (c) showClassForm(c);
    });
  });
  container.querySelectorAll('.del-class').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (!confirm('确定删除该班级吗？')) return;
      var id = parseInt(btn.dataset.id);
      saveClasses(getClasses().filter(function(c) { return c.id != id; }));
      renderClasses();
    });
  });
}
