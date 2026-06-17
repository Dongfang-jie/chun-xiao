/*
  春晓画室 - 预约表单逻辑
  功能：表单校验 / 数据存储 / 微信通知
*/

// 初始化 CloudBase 匿名登录（确保表单能写入数据库）
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof Auth !== 'undefined') {
    await Auth.initAnonymous();
  }
});

(function() {
  var form = document.getElementById('contact-form');
  var successBox = document.getElementById('form-success');
  var msgEl = document.getElementById('form-msg');

  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    var name = document.getElementById('parent-name').value.trim();
    var phone = document.getElementById('phone').value.trim();

    if (!name || !phone) {
      msgEl.textContent = '⚠️ 请至少填写家长姓名和联系电话';
      msgEl.className = 'form-message error';
      return;
    }

    if (!/^1\d{10}$/.test(phone)) {
      msgEl.textContent = '⚠️ 请输入正确的11位手机号码';
      msgEl.className = 'form-message error';
      return;
    }

    var childName = document.getElementById('child-name').value.trim();
    var childAge = document.getElementById('child-age').value;
    var message = document.getElementById('message').value.trim();
    var courses = [];
    var checks = document.querySelectorAll('input[name="course"]:checked');
    checks.forEach(function(cb) { courses.push(cb.value); });

    var inquiry = {
      id: Date.now(),
      time: new Date().toLocaleString('zh-CN'),
      parentName: name,
      phone: phone,
      childName: childName || '(未填)',
      childAge: childAge || '(未填)',
      courses: courses.length > 0 ? courses.join('、') : '(未选)',
      message: message || '(无)',
      read: false
    };

    // 存 localStorage
    var inquiries = JSON.parse(localStorage.getItem('chunxiao-inquiries') || '[]');
    inquiries.unshift(inquiry);
    localStorage.setItem('chunxiao-inquiries', JSON.stringify(inquiries));

    // 同步写 CloudBase
    var db = getDB();
    if (db) {
      db.collection('inquiries').add(inquiry).catch(function(e) {
        console.warn('预约写入 CloudBase 失败:', e.message);
      });
    }

    // 微信通知
    sendPhoneNotify(inquiry);

    form.style.display = 'none';
    successBox.style.display = 'block';
    msgEl.textContent = '';
    successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function sendPhoneNotify(data) {
    var keys = (typeof AUTH_CONFIG !== 'undefined' && AUTH_CONFIG.notifyKeys) ? AUTH_CONFIG.notifyKeys : [];
    keys = keys.filter(function(k) { return k && k.trim(); });
    if (!keys.length) return;

    var title = encodeURIComponent('🌸 春晓画室 - 新预约提醒');
    var content = encodeURIComponent(
      '## 有人预约了免费试听课！\n\n' +
      '| 项目 | 内容 |\n|------|------|\n' +
      '| 👤 家长 | ' + data.parentName + ' |\n' +
      '| 📱 电话 | ' + data.phone + ' |\n' +
      '| 👶 孩子 | ' + data.childName + '（' + data.childAge + '） |\n' +
      '| 🎯 课程 | ' + data.courses + ' |\n' +
      '| 💬 留言 | ' + data.message + ' |\n' +
      '| 🕐 时间 | ' + data.time + ' |\n\n' +
      '> 请尽快联系家长确认试听时间哦～'
    );

    keys.forEach(function(key) {
      var img = new Image();
      img.src = 'https://sctapi.ftqq.com/' + key.trim() + '.send?title=' + title + '&desp=' + content;
    });
  }
})();
