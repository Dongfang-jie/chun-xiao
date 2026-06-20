/*
  春晓画室 - 管理端数据管理模块
  功能：数据统计 / 一键备份 / 一键恢复 / 单集合导出
  依赖：data.js（DataStore.exportAllData / DataStore.importAllData）
*/

// 集合元数据（col 字段对应 CloudBase 集合名，用于同步操作）
var DATA_COLLECTIONS = [
  { key: 'chunxiao-students',           col: 'students',      label: '👨‍🎓 学员',           icon: '👨‍🎓' },
  { key: 'chunxiao-classes',            col: 'classes',       label: '📦 班级',           icon: '📦' },
  { key: 'chunxiao-attendance',         col: 'attendance',    label: '📋 考勤',           icon: '📋' },
  { key: 'chunxiao-records',            col: 'records',       label: '📝 上课记录',       icon: '📝' },
  { key: 'chunxiao-lesson-corrections', col: 'corrections',   label: '🔧 课次调整',       icon: '🔧' },
  { key: 'chunxiao-artworks',           col: 'artworks',      label: '🖼️ 作品',           icon: '🖼️' },
  { key: 'chunxiao-announcements',      col: 'announcements', label: '📢 通知',           icon: '📢' },
  { key: 'chunxiao-inquiries',          col: 'inquiries',     label: '📩 预约',           icon: '📩' },
  { key: 'chunxiao-renewals',           col: 'renewals',      label: '💰 续费',           icon: '💰' },
  { key: 'chunxiao-courses',            col: 'courses',       label: '📚 课程设置',       icon: '📚' }
];

// ========== 加载数据管理页面 ==========
function loadDataMgmt() {
  renderDataStats();
}

// ========== 渲染数据统计面板 ==========
function renderDataStats() {
  var tbody = document.getElementById('datamgmt-stats-tbody');
  if (!tbody) return;

  var totalRecords = 0;
  var html = '';

  DATA_COLLECTIONS.forEach(function(col) {
    var raw = localStorage.getItem(col.key);
    var list = raw ? safeParseJSON(col.key, []) : [];
    var count = list.length;
    totalRecords += count;
    var syncedTime = localStorage.getItem(col.key + '_synced') || '-';
    var status = syncedTime !== '-' ? '✅' : '⚠️';

    html += '<tr>';
    html += '<td>' + escapeHtml(col.icon + ' ' + col.label) + '</td>';
    html += '<td><strong>' + count + '</strong> 条</td>';
    html += '<td style="font-size:0.8em;color:#888;">' + escapeHtml(status + ' ' + syncedTime) + '</td>';
    html += '<td>';
    html += '<button class="dm-export-json-btn" data-key="' + col.key + '" style="padding:4px 10px; font-size:0.8em; border:1px solid #d7a86e; background:#fff; border-radius:4px; cursor:pointer; margin-right:4px;">📥 JSON</button>';
    html += '<button class="dm-export-csv-btn" data-key="' + col.key + '" style="padding:4px 10px; font-size:0.8em; border:1px solid #d7a86e; background:#fff; border-radius:4px; cursor:pointer;">📊 CSV</button>';
    html += '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;

  // 更新总览
  var totalEl = document.getElementById('datamgmt-total-records');
  if (totalEl) totalEl.textContent = totalRecords;

  // 渲染危险操作区（清空按钮）
  var dangerList = document.getElementById('datamgmt-danger-list');
  if (dangerList) {
    var dangerHtml = '';
    DATA_COLLECTIONS.forEach(function(col) {
      dangerHtml += '<div style="display:flex; align-items:center; gap:8px; padding:6px 0;">';
      dangerHtml += '<span style="min-width:140px;">' + col.icon + ' ' + col.label + '</span>';
      dangerHtml += '<button class="dm-clear-btn" data-key="' + col.key + '">🗑️ 清空</button>';
      dangerHtml += '</div>';
    });
    dangerList.innerHTML = dangerHtml;

    // 绑定清空按钮
    dangerList.querySelectorAll('.dm-clear-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        clearCollection(this.dataset.key);
      });
    });
  }

  // 绑定导出按钮事件
  tbody.querySelectorAll('.dm-export-json-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      exportSingleJSON(this.dataset.key);
    });
  });
  tbody.querySelectorAll('.dm-export-csv-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      exportSingleCSV(this.dataset.key);
    });
  });
}

// ========== 一键备份全部数据 ==========
function backupAllData() {
  var data = DataStore.exportAllData();
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var now = new Date();
  var timestamp = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') + '-' +
    String(now.getMinutes()).padStart(2, '0');
  a.href = url;
  a.download = '春晓画室_数据备份_' + timestamp + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showDmMsg('✅ 备份成功！文件已下载（' + (json.length / 1024).toFixed(1) + ' KB）', 'success');
}

// ========== 一键恢复全部数据 ==========
function restoreAllData(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.version) {
        showDmMsg('⚠️ 备份文件格式可能不正确（缺少 version 字段），是否继续？已尝试恢复...', 'warn');
      }
      var result = DataStore.importAllData(data);
      if (result.success) {
        showDmMsg('✅ ' + result.message + '，刷新后数据将同步到 CloudBase', 'success');
        renderDataStats();
      } else {
        showDmMsg('❌ ' + result.message, 'error');
      }
    } catch (err) {
      showDmMsg('❌ JSON 解析失败：' + err.message, 'error');
      console.error('恢复数据失败:', err);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// ========== 单集合导出 JSON ==========
function exportSingleJSON(key) {
  var list = safeParseJSON(key, []);
  var json = JSON.stringify(list, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = key + '_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showDmMsg('✅ 已导出 ' + key + '（' + list.length + ' 条）', 'success');
}

// ========== 单集合导出 CSV ==========
function exportSingleCSV(key) {
  var list = safeParseJSON(key, []);
  if (!list.length) {
    showDmMsg('⚠️ ' + key + ' 无数据，无法导出 CSV', 'warn');
    return;
  }

  var csv = '';
  // 收集所有字段名
  var allKeys = {};
  list.forEach(function(item) {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(function(k) { allKeys[k] = true; });
    }
  });
  var headers = Object.keys(allKeys);

  // UTF-8 BOM（Excel 需要）
  csv = '﻿';
  csv += headers.join(',') + '\n';

  list.forEach(function(item) {
    var row = headers.map(function(h) {
      var val = (item && typeof item === 'object') ? item[h] : item;
      if (val === null || val === undefined) return '';
      var str = String(val);
      // CSV 转义
      if (str.indexOf(',') >= 0 || str.indexOf('"') >= 0 || str.indexOf('\n') >= 0) {
        str = '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    csv += row.join(',') + '\n';
  });

  var label = key;
  for (var i = 0; i < DATA_COLLECTIONS.length; i++) {
    if (DATA_COLLECTIONS[i].key === key) { label = DATA_COLLECTIONS[i].label.replace(/[^一-龥]/g, ''); break; }
  }
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = label + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showDmMsg('✅ 已导出 ' + key + ' CSV（' + list.length + ' 条）', 'success');
}

// ========== 清空单个集合 ==========
function clearCollection(key) {
  var label = key, col = null;
  for (var i = 0; i < DATA_COLLECTIONS.length; i++) {
    if (DATA_COLLECTIONS[i].key === key) { label = DATA_COLLECTIONS[i].label; col = DATA_COLLECTIONS[i].col; break; }
  }
  if (!confirm('⚠️ 确定要清空「' + label + '」的全部数据吗？\n\n此操作不可恢复！建议先备份。')) return;
  if (!confirm('再次确认：清空「' + label + '」？\n\n此操作将同时清空本地和云端数据。')) return;

  // 写入空数组（非 removeItem，确保 _pushToCloud 检测到数据并推送空值到云端）
  var now = new Date().toISOString();
  localStorage.setItem(key, '[]');
  localStorage.setItem(key + '_synced', now);
  // 异步推送到 CloudBase（覆盖为空白）
  if (col && typeof DataStore !== 'undefined') {
    DataStore._pushToCloud(col, key);
  }
  showDmMsg('🗑️ 已清空「' + label + '」（本地 + 云端）', 'warn');
  renderDataStats();
}

// ========== 消息提示 ==========
function showDmMsg(msg, type) {
  var el = document.getElementById('datamgmt-msg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'dm-msg dm-msg-' + (type || 'info');
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 5000);
}

// ========== 事件绑定 ==========
document.addEventListener('DOMContentLoaded', function() {
  // 备份按钮
  var backupBtn = document.getElementById('datamgmt-backup-btn');
  if (backupBtn) {
    backupBtn.addEventListener('click', backupAllData);
  }

  // 恢复文件选择
  var restoreInput = document.getElementById('datamgmt-restore-input');
  if (restoreInput) {
    restoreInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        if (confirm('⚠️ 恢复数据将覆盖当前 ' + DATA_COLLECTIONS.length + ' 个集合的数据。\n\n建议先备份当前数据。是否继续？')) {
          restoreAllData(this.files[0]);
        }
        this.value = '';
      }
    });
  }

});
