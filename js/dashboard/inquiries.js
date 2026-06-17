/*
  春晓画室 - 管理端预约查询模块
*/

function loadInquiries() {
  renderInquiries();
  updateInquiryStats();
  updateInquiryBadge();

  setInterval(function() {
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

  list.forEach(function(item, index) {
    var unreadClass = item.read ? '' : 'inquiry-unread';
    var unreadDot = item.read ? '' : ' <span style="color:#e88; font-size:0.8em;">● 新</span>';

    html += [
      '<div class="inquiry-card ' + unreadClass + '" data-index="' + index + '" style="flex:1 1 350px; min-width:300px; background:#fff; border-radius:12px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06);',
      item.read ? '' : 'border-left:4px solid #e88;',
      'cursor:pointer; transition:all 0.2s;">',
      '<div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:8px;">',
      '<h4 style="color:#5d4037; margin:0;">👤 ' + item.parentName + unreadDot + '</h4>',
      '<span style="color:#999; font-size:0.8em;">' + item.time + '</span>',
      '</div>',
      '<div style="margin-top:12px; display:grid; grid-template-columns:auto 1fr; gap:6px 12px; font-size:0.9em;">',
      '<span style="color:#888;">📱 电话：</span><span style="color:#5d4037; font-weight:bold;">' + item.phone + '</span>',
      '<span style="color:#888;">👶 孩子：</span><span>' + item.childName + '（' + item.childAge + '）</span>',
      '<span style="color:#888;">🎯 课程：</span><span>' + item.courses + '</span>',
      '<span style="color:#888;">💬 留言：</span><span style="color:#666;">' + item.message + '</span>',
      '</div>',
      '<div style="margin-top:10px; font-size:0.8em; color:#999;">',
      item.read ? '✅ 已读' : '👆 点击标记为已读',
      '</div>',
      '</div>'
    ].join('');
  });

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('.inquiry-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var idx = parseInt(card.dataset.index);
      var list = getInquiries();
      if (list[idx] && !list[idx].read) {
        list[idx].read = true;
        saveInquiries(list);
        renderInquiries();
        updateInquiryStats();
        updateInquiryBadge();
      }
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
