/*
  春晓画室 - 管理端预约查询模块
*/

var _inquiryTimer = null;

function loadInquiries() {
  renderInquiries();
  updateInquiryStats();
  updateInquiryBadge();

  // 清理旧定时器，避免多次调用堆积
  if (_inquiryTimer) { clearInterval(_inquiryTimer); }
  _inquiryTimer = setInterval(function() {
    renderInquiries();
    updateInquiryStats();
    updateInquiryBadge();
  }, 30000);

  var clearBtn = document.getElementById('clear-inquiries');
  if (clearBtn) {
    if (!hasAdminPermission()) { clearBtn.style.display = 'none'; }
    else clearBtn.addEventListener('click', function() {
      if (confirm('确定要清空所有预约记录吗？此操作不可恢复。')) {
        localStorage.removeItem('chunxiao-inquiries');
        renderInquiries();
        updateInquiryStats();
        updateInquiryBadge();
      }
    });
  }
}

function renderInquiries() {
  var container = document.getElementById('inquiries-list');
  if (!container) return;

  var list = getInquiries();

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">🎉 暂无预约记录</p>';
    return;
  }

  var html = '<div style="display:flex; flex-wrap:wrap; gap:16px;">';

  list.reverse().forEach(function(item, index) {
    // 关联请求特殊渲染
    if (item.type === 'link_request') {
      var statusColor = item.status === 'approved' ? '#5a9' : (item.status === 'rejected' ? '#e88' : '#e8a040');
      var statusText = item.status === 'approved' ? '✅ 已通过' : (item.status === 'rejected' ? '❌ 已拒绝' : '⏳ 待审批');
      var unreadDot = item.read ? '' : ' <span style="color:#e88; font-size:0.8em;">● 新</span>';

      html += [
        '<div class="inquiry-card" data-index="' + (list.length - 1 - index) + '" style="flex:1 1 350px; min-width:300px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);',
        item.read ? '' : 'border-left:4px solid #d7a86e;',
        '">',
        '<div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px;">',
        '<h4 style="color:#5d4037; margin:0;">🔗 关联请求' + unreadDot + '</h4>',
        '<span style="color:#999; font-size:0.8em;">' + escapeHtml(item.time || '') + '</span>',
        '</div>',
        '<div style="margin-top:12px; display:grid; grid-template-columns:auto 1fr; gap:6px 12px; font-size:0.9em;">',
        '<span style="color:#888;">👤 家长：</span><span style="color:#5d4037; font-weight:bold;">' + escapeHtml(item.parentName || '') + '</span>',
        '<span style="color:#888;">📧 邮箱：</span><span>' + escapeHtml(item.parentEmail || '') + '</span>',
        '<span style="color:#888;">👶 学生：</span><span style="font-weight:bold;">' + escapeHtml(item.studentName || '') + '</span>',
        '<span style="color:#888;">📊 状态：</span><span style="color:' + statusColor + '; font-weight:bold;">' + statusText + '</span>',
        '</div>',
        item.status === 'pending' ?
        '<div style="margin-top:12px; display:flex; gap:8px;">' +
        '<button class="link-approve-btn" data-id="' + item.id + '" style="padding:8px 20px; background:#5a9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✅ 通过</button>' +
        '<button class="link-reject-btn" data-id="' + item.id + '" style="padding:8px 20px; background:#e88; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">❌ 拒绝</button>' +
        '</div>' : '',
        '</div>'
      ].join('');
    } else {
      // 普通预约渲染
      var unreadClass = item.read ? '' : 'inquiry-unread';
      var unreadDot2 = item.read ? '' : ' <span style="color:#e88; font-size:0.8em;">● 新</span>';

      html += [
        '<div class="inquiry-card ' + unreadClass + '" data-index="' + (list.length - 1 - index) + '" style="flex:1 1 350px; min-width:300px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);',
        item.read ? '' : 'border-left:4px solid #e88;',
        'cursor:pointer; transition:all 0.2s;">',
        '<div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px;">',
        '<h4 style="color:#5d4037; margin:0;">👤 ' + escapeHtml(item.parentName || '') + unreadDot2 + '</h4>',
        '<span style="color:#999; font-size:0.8em;">' + escapeHtml(item.time || '') + '</span>',
        '</div>',
        '<div style="margin-top:12px; display:grid; grid-template-columns:auto 1fr; gap:6px 12px; font-size:0.9em;">',
        '<span style="color:#888;">📱 电话：</span><span style="color:#5d4037; font-weight:bold;">' + escapeHtml(item.phone || '') + '</span>',
        '<span style="color:#888;">👶 孩子：</span><span>' + escapeHtml(item.childName || '') + '（' + escapeHtml(item.childAge || '') + '）</span>',
        '<span style="color:#888;">🎯 课程：</span><span>' + escapeHtml(item.courses || '') + '</span>',
        '<span style="color:#888;">💬 留言：</span><span style="color:#666;">' + escapeHtml(item.message || '') + '</span>',
        '</div>',
        '<div style="margin-top:10px; font-size:0.8em; color:#999;">',
        item.read ? '✅ 已读' : '👆 点击标记为已读',
        '</div>',
        '</div>'
      ].join('');
    }
  });

  html += '</div>';
  container.innerHTML = html;

  // 普通预约：点击标记已读
  container.querySelectorAll('.inquiry-card[data-index]').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.tagName === 'BUTTON') return;
      var idx = parseInt(card.dataset.index);
      var list = getInquiries();
      if (list[idx] && !list[idx].read && list[idx].type !== 'link_request') {
        list[idx].read = true;
        saveInquiries(list);
        renderInquiries();
        updateInquiryStats();
        updateInquiryBadge();
      }
    });
  });

  // 审批按钮事件
  container.querySelectorAll('.link-approve-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      approveLinkRequest(parseInt(btn.dataset.id));
    });
  });
  container.querySelectorAll('.link-reject-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      rejectLinkRequest(parseInt(btn.dataset.id));
    });
  });
}

function updateInquiryStats() {
  var list = getInquiries();
  var unread = list.filter(function(i) { return !i.read; }).length;

  var statNumbers = document.querySelectorAll('.stat-number');
  if (statNumbers.length >= 4) { statNumbers[3].textContent = unread; }
}

function updateInquiryBadge() {
  var badge = document.getElementById('inquiry-badge');
  if (!badge) return;

  var unread = getInquiries().filter(function(i) { return !i.read; }).length;

  if (unread > 0) {
    badge.textContent = unread;
    badge.style.display = 'inline';
  } else {
    badge.style.display = 'none';
  }
}

/** 审批通过关联请求 */
async function approveLinkRequest(reqId) {
  var list = getInquiries();
  var req = list.find(function (i) { return i.id === reqId; });
  if (!req || req.status !== 'pending') return;

  if (!confirm('确认通过「' + req.parentName + '」关联「' + req.studentName + '」的请求吗？')) return;

  try {
    // 1. 更新学生 parentEmail
    var students = getStudents();
    var student = students.find(function (s) { return s.id === req.studentId; });
    if (student) {
      student.parentEmail = req.parentEmail;
      saveStudents(students);
    }

    // 2. 更新家长文档的 children 数组
    var db = getDB();
    if (db) {
      var res = await db.collection('parents').where({ email: req.parentEmail }).get();
      if (res.data && res.data.length > 0) {
        var parent = res.data[0];
        var children = parent.children || [];
        if (parent.childName && !parent.children) {
          children = [{ name: parent.childName, studentId: null }];
        }
        // 检查重复
        var exists = children.some(function (c) { return c.studentId === req.studentId || c.name === req.studentName; });
        if (!exists) {
          children.push({ name: req.studentName, studentId: req.studentId });
          await db.collection('parents').doc(parent._id).update({ children: children });
        }
      }
    }

    // 3. 标记请求为已处理
    req.status = 'approved';
    req.read = true;
    saveInquiries(list);
    renderInquiries();
    updateInquiryStats();
    updateInquiryBadge();
  } catch (err) {
    alert('操作失败：' + (err.message || '请稍后再试'));
  }
}

/** 拒绝关联请求 */
function rejectLinkRequest(reqId) {
  var list = getInquiries();
  var req = list.find(function (i) { return i.id === reqId; });
  if (!req || req.status !== 'pending') return;

  if (!confirm('确认拒绝「' + req.parentName + '」关联「' + req.studentName + '」的请求吗？')) return;

  req.status = 'rejected';
  req.read = true;
  saveInquiries(list);
  renderInquiries();
  updateInquiryStats();
  updateInquiryBadge();
}
