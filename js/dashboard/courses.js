/*
  春晓画室 - 管理端课程管理模块
  依赖：data.js（getCourses/saveCourses/DEFAULT_COURSES）
*/

function loadCourses() {
  // 仅渲染，不写默认值。默认值初始化推迟到 CloudBase 同步之后，
  // 防止刚刚写入的默认值用最新时间戳覆盖云端已有的自定义课程。
  populateCoursesClassFilter();
  renderCourses();
}

/* 填充班级筛选下拉框 */
function populateCoursesClassFilter() {
  var select = document.getElementById('courses-class-filter');
  if (!select) return;

  var classes = getClasses();
  var currentVal = select.value;

  var html = '<option value="">全部课程</option>';
  classes.forEach(function(cls) {
    if (!cls.course) return;
    var sel = currentVal === cls.course ? ' selected' : '';
    html += '<option value="' + escapeHtml(cls.course) + '"' + sel + '>' + escapeHtml(cls.name) + '（' + escapeHtml(cls.course) + '）</option>';
  });
  select.innerHTML = html;

  // 绑定变更事件（只绑一次）
  if (!select._coursesFilterBound) {
    select._coursesFilterBound = true;
    select.addEventListener('change', function () {
      renderCourses(this.value);
    });
  }
}

/* 渲染课程表，可选按 courseName 筛选 */
function renderCourses(filterCourseName) {
  var tbody = document.querySelector('#courses-table tbody');
  if (!tbody) return;

  var list = getCourses();
  var html = '';
  var editable = hasAdminPermission() ? ' contenteditable="true"' : '';
  var editHint = hasAdminPermission() ? '点击单元格编辑' : '仅管理员可编辑';
  list.forEach(function(c, idx) {
    // 如果设了班级筛选，只显示该班级关联的课程
    if (filterCourseName && c.name !== filterCourseName) return;

    html += '<tr>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="name">' + escapeHtml(c.name || '') + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="age">' + escapeHtml(c.age || '') + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="duration">' + escapeHtml(c.duration || '') + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="time">' + escapeHtml(c.time || '') + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="capacity">' + escapeHtml(c.capacity || '') + '</td>';
    html += '<td><span style="color:#999; font-size:0.8em;">' + editHint + '</span></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;

  var _coursesSaveTimer = null;

  tbody.querySelectorAll('.editable').forEach(function(cell) {
    cell.addEventListener('blur', function() {
      var idx = parseInt(cell.dataset.idx);
      var field = cell.dataset.field;
      var value = cell.textContent.trim();
      var list = getCourses();
      if (list[idx]) {
        list[idx][field] = value;
        // 即时视觉反馈
        cell.style.background = '#f0ffe0';
        setTimeout(function() { cell.style.background = ''; }, 1500);
        // 防抖保存：300ms 内连续编辑只保存最后一次
        clearTimeout(_coursesSaveTimer);
        _coursesSaveTimer = setTimeout(function() {
          saveCourses(list);  // 自动同步 CloudBase
        }, 300);
      }
    });
  });
}
