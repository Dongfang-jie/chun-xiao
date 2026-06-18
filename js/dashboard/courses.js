/*
  春晓画室 - 管理端课程管理模块
*/

var DEFAULT_COURSES = [
  { name: '儿童创意画', age: '4岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '中国画',     age: '8岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '素描',       age: '10岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '色彩',       age: '10岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '硬笔书法',   age: '6岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' },
  { name: '软笔书法',   age: '6岁以上', duration: '120分钟', time: '咨询画室安排', capacity: '0/8' }
];

function getCourses() {
  var saved = localStorage.getItem('chunxiao-courses');
  return saved ? JSON.parse(saved) : DEFAULT_COURSES;
}
function saveCourses(list) {
  localStorage.setItem('chunxiao-courses', JSON.stringify(list));
}

function loadCourses() {
  renderCourses();

  if (!localStorage.getItem('chunxiao-courses')) {
    saveCourses(DEFAULT_COURSES);
  }
}

function renderCourses() {
  var tbody = document.querySelector('#courses-table tbody');
  if (!tbody) return;

  var list = getCourses();
  var html = '';
  var editable = hasAdminPermission() ? ' contenteditable="true"' : '';
  var editHint = hasAdminPermission() ? '点击单元格编辑' : '仅管理员可编辑';
  list.forEach(function(c, idx) {
    html += '<tr>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="name">' + c.name + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="age">' + c.age + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="duration">' + c.duration + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="time">' + c.time + '</td>';
    html += '<td' + editable + ' class="editable" data-idx="' + idx + '" data-field="capacity">' + c.capacity + '</td>';
    html += '<td><span style="color:#999; font-size:0.8em;">' + editHint + '</span></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;

  tbody.querySelectorAll('.editable').forEach(function(cell) {
    cell.addEventListener('blur', function() {
      var idx = parseInt(cell.dataset.idx);
      var field = cell.dataset.field;
      var value = cell.textContent.trim();
      var list = getCourses();
      if (list[idx]) {
        list[idx][field] = value;
        saveCourses(list);
        cell.style.background = '#f0ffe0';
        setTimeout(function() { cell.style.background = ''; }, 1500);
      }
    });
  });
}
