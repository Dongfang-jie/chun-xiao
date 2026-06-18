/*
  春晓画室 - 管理端作品管理模块
  功能：CRUD / 筛选搜索 / 卡片表格视图切换 / 批量删除 / CSV导出 / CloudBase云存储上传
*/

// ============================================================
//  模块状态
// ============================================================
var _currentArtworkView = 'card';       // 'card' | 'table'
var _artworkSelectedIds = {};           // { id: true } 批量选中
var _artworkUrlCache = {};              // { fileID: tempURL } cloud:// 缓存
var _pendingImageBlob = null;           // 待上传的压缩图片 Blob
var _editingImageValue = null;          // 编辑模式下的原始 image 值

// ============================================================
//  入口
// ============================================================
function loadArtworks() {
  populateStudentFilter();
  renderArtworks();

  // ---------- 筛选事件 ----------
  var searchEl = document.getElementById('aw-search');
  if (searchEl) searchEl.addEventListener('input', function () { renderArtworks(); });

  var typeEl = document.getElementById('aw-filter-type');
  if (typeEl) typeEl.addEventListener('change', function () { renderArtworks(); });

  var studentEl = document.getElementById('aw-filter-student');
  if (studentEl) studentEl.addEventListener('change', function () { renderArtworks(); });

  var sortEl = document.getElementById('aw-filter-sort');
  if (sortEl) sortEl.addEventListener('change', function () { renderArtworks(); });

  // ---------- 视图切换 ----------
  document.querySelectorAll('.view-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      _currentArtworkView = btn.dataset.view;
      _artworkSelectedIds = {};
      updateBatchBar();
      renderArtworks();
    });
  });

  // ---------- 添加按钮 ----------
  var addBtn = document.getElementById('add-artwork-btn');
  if (addBtn) {
    addBtn.onclick = function () {
      document.getElementById('artwork-form-wrap').style.display = 'block';
      document.getElementById('artwork-form-title').textContent = '添加作品';
      document.getElementById('aw-edit-id').value = '';
      document.getElementById('a-title').value = '';
      document.getElementById('a-student').value = '';
      document.getElementById('a-student-id').value = '';
      document.getElementById('a-type').value = '美术';
      document.getElementById('a-image').value = '';
      document.getElementById('a-image-file').value = '';
      document.getElementById('artwork-preview-wrap').style.display = 'none';
      document.getElementById('artwork-upload-progress').style.display = 'none';
      _pendingImageBlob = null;
      _editingImageValue = null;
    };
  }

  // ---------- 取消按钮 ----------
  var cancelBtn = document.getElementById('artwork-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = function () {
      document.getElementById('artwork-form-wrap').style.display = 'none';
      resetArtworkForm();
    };
  }

  // ---------- 文件选择 → 压缩预览 ----------
  var fileInput = document.getElementById('a-image-file');
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      var file = fileInput.files[0];
      if (!file) return;
      compressAndPreviewImage(file);
    });
  }

  // ---------- 清除预览 ----------
  var clearBtn = document.getElementById('artwork-preview-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      document.getElementById('a-image-file').value = '';
      document.getElementById('artwork-preview-wrap').style.display = 'none';
      _pendingImageBlob = null;
    });
  }

  // ---------- 保存按钮 ----------
  var saveBtn = document.getElementById('artwork-save-btn');
  if (saveBtn) {
    saveBtn.onclick = function () { saveArtwork(); };
  }

  // ---------- 导出CSV ----------
  var exportBtn = document.getElementById('export-artworks-btn');
  if (exportBtn) exportBtn.onclick = exportArtworksCSV;

  // ---------- 批量删除 ----------
  var batchDelBtn = document.getElementById('batch-delete-btn');
  if (batchDelBtn) {
    batchDelBtn.onclick = function () {
      var ids = Object.keys(_artworkSelectedIds);
      if (!ids.length) return;
      deleteArtworks(ids.map(Number));
    };
  }

  // ---------- 取消选择 ----------
  var batchClearBtn = document.getElementById('batch-clear-btn');
  if (batchClearBtn) {
    batchClearBtn.onclick = function () {
      _artworkSelectedIds = {};
      updateBatchBar();
      renderArtworks();
    };
  }

  // ---------- 学生姓名输入 → 联动 studentId ----------
  var studentInput = document.getElementById('a-student');
  if (studentInput) {
    studentInput.addEventListener('input', function () {
      var val = studentInput.value.trim();
      var students = getStudents();
      var match = null;
      for (var i = 0; i < students.length; i++) {
        if (students[i].name === val) { match = students[i]; break; }
      }
      document.getElementById('a-student-id').value = match ? match.id : '';
    });
  }
}

// ============================================================
//  填充学生筛选下拉 + datalist
// ============================================================
function populateStudentFilter() {
  var students = getStudents();
  students.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh'); });

  // 筛选下拉
  var filterSelect = document.getElementById('aw-filter-student');
  if (filterSelect) {
    var filterHtml = '<option value="">全部学生</option>';
    students.forEach(function (s) {
      filterHtml += '<option value="' + s.id + '">' + s.name + '</option>';
    });
    filterSelect.innerHTML = filterHtml;
  }

  // 表单 datalist
  var datalist = document.getElementById('student-list');
  if (datalist) {
    var dlHtml = '';
    students.forEach(function (s) {
      dlHtml += '<option value="' + s.name + '">';
    });
    datalist.innerHTML = dlHtml;
  }
}

// ============================================================
//  筛选参数
// ============================================================
function getArtworkFilters() {
  var searchEl = document.getElementById('aw-search');
  var typeEl = document.getElementById('aw-filter-type');
  var studentEl = document.getElementById('aw-filter-student');
  var sortEl = document.getElementById('aw-filter-sort');

  return {
    search: searchEl ? searchEl.value.trim().toLowerCase() : '',
    type: typeEl ? typeEl.value : '',
    studentId: studentEl ? studentEl.value : '',
    sort: sortEl ? sortEl.value : 'newest'
  };
}

// ============================================================
//  执行筛选 + 排序
// ============================================================
function applyArtworkFilters(list) {
  var f = getArtworkFilters();
  var filtered = list;

  // 搜索：匹配标题和学生名
  if (f.search) {
    filtered = filtered.filter(function (a) {
      return a.title.toLowerCase().indexOf(f.search) !== -1 ||
             a.student.toLowerCase().indexOf(f.search) !== -1;
    });
  }

  // 类型
  if (f.type) {
    filtered = filtered.filter(function (a) { return a.type === f.type; });
  }

  // 学生（按 studentId 或 student 名匹配）
  if (f.studentId) {
    var sid = parseInt(f.studentId);
    var students = getStudents();
    var targetName = '';
    for (var i = 0; i < students.length; i++) {
      if (students[i].id === sid) { targetName = students[i].name; break; }
    }
    filtered = filtered.filter(function (a) {
      if (a.studentId && a.studentId === sid) return true;
      if (targetName && a.student === targetName) return true;
      return false;
    });
  }

  // 排序（默认 newest: id 降序；oldest: id 升序；student: 学生名拼音）
  if (f.sort === 'oldest') {
    filtered.sort(function (a, b) { return a.id - b.id; });
  } else if (f.sort === 'student') {
    filtered.sort(function (a, b) { return a.student.localeCompare(b.student, 'zh'); });
  } else {
    // newest：显式按 id 降序，防止云端数据乱序
    filtered.sort(function (a, b) { return b.id - a.id; });
  }

  return filtered;
}

// ============================================================
//  主渲染
// ============================================================
function renderArtworks() {
  var container = document.getElementById('artworks-list');
  var countEl = document.getElementById('artwork-count');
  var resultEl = document.getElementById('artwork-filter-result');
  if (!container) return;

  var allList = getArtworks();
  var list = applyArtworkFilters(allList);

  if (countEl) countEl.textContent = allList.length;

  // 筛选结果提示
  if (resultEl) {
    var f = getArtworkFilters();
    var hasFilter = f.search || f.type || f.studentId;
    if (hasFilter) {
      resultEl.style.display = 'inline';
      resultEl.textContent = '找到 ' + list.length + ' 件（共 ' + allList.length + ' 件）';
    } else {
      resultEl.style.display = 'none';
    }
  }

  // 空状态
  if (allList.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">暂无作品，点击"+ 添加作品"开始</p>';
    return;
  }
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px;">😕 没有匹配的作品，试试调整筛选条件</p>';
    return;
  }

  // 按视图模式渲染
  if (_currentArtworkView === 'table') {
    renderTableView(list, container);
  } else {
    renderCardView(list, container);
  }

  // 恢复选中状态
  syncCheckboxes();

  // 异步解析 cloud:// 图片
  resolveCloudImages(list);
}

// ============================================================
//  卡片视图
// ============================================================
function renderCardView(list, container) {
  container.className = 'card-container';
  container.style.justifyContent = 'flex-start';

  var html = '';
  list.forEach(function (a) {
    var displayUrl = getDisplayUrl(a.image);
    var checked = _artworkSelectedIds[a.id] ? ' checked' : '';
    var dateStr = a.addedAt ? new Date(a.addedAt).toLocaleDateString('zh-CN') : '';

    html += '<div class="card artwork-card" style="flex:0 1 280px; max-width:280px;" data-aw-id="' + a.id + '">';
    html += '<input type="checkbox" class="card-checkbox aw-check" data-id="' + a.id + '"' + checked + '>';
    html += '<img src="' + displayUrl + '" alt="' + a.title + '" class="card-img aw-card-img" style="height:180px;" data-fileid="' + a.image + '" loading="lazy" onclick="openArtworkLightbox(\'' + a.id + '\')">';
    html += '<div class="card-body">';
    html += '<h4>' + a.title + '</h4>';
    html += '<p>👦 ' + a.student + ' | ' + a.type + '</p>';
    html += '<p style="font-size:0.8em; color:#999;">📅 ' + dateStr + (a.addedBy ? ' | 🖊️ ' + a.addedBy : '') + '</p>';
    html += '<div class="card-actions">';
    html += '<a href="#" class="edit-link edit-artwork" data-id="' + a.id + '">✏️ 编辑</a>';
    html += '<a href="#" class="del-link del-artwork" data-id="' + a.id + '">🗑️ 删除</a>';
    html += '</div></div></div>';
  });
  container.innerHTML = html;

  // 绑定编辑
  container.querySelectorAll('.edit-artwork').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      editArtwork(parseInt(btn.dataset.id));
    });
  });

  // 绑定删除
  container.querySelectorAll('.del-artwork').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该作品吗？')) return;
      deleteArtworks([id]);
    });
  });

  // 绑定 checkbox
  container.querySelectorAll('.aw-check').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var id = parseInt(cb.dataset.id);
      if (cb.checked) { _artworkSelectedIds[id] = true; }
      else { delete _artworkSelectedIds[id]; }
      updateBatchBar();
    });
  });
}

// ============================================================
//  表格视图
// ============================================================
function renderTableView(list, container) {
  container.className = 'artwork-table-wrap';

  var html = '<table class="artwork-table"><thead><tr>';
  html += '<th style="width:36px;">☐</th>';
  html += '<th style="width:70px;">图片</th>';
  html += '<th>作品名称</th>';
  html += '<th>学生</th>';
  html += '<th>类型</th>';
  html += '<th>日期</th>';
  html += '<th>操作</th>';
  html += '</tr></thead><tbody>';

  list.forEach(function (a) {
    var displayUrl = getDisplayUrl(a.image);
    var checked = _artworkSelectedIds[a.id] ? ' checked' : '';
    var dateStr = a.addedAt ? new Date(a.addedAt).toLocaleDateString('zh-CN') : '';

    html += '<tr data-aw-id="' + a.id + '">';
    html += '<td><input type="checkbox" class="table-checkbox aw-check" data-id="' + a.id + '"' + checked + '></td>';
    html += '<td><img src="' + displayUrl + '" class="table-thumb aw-card-img" data-fileid="' + a.image + '" onclick="openArtworkLightbox(\'' + a.id + '\')" loading="lazy"></td>';
    html += '<td><span class="table-name-link" onclick="openArtworkLightbox(\'' + a.id + '\')">' + a.title + '</span></td>';
    html += '<td>' + a.student + '</td>';
    html += '<td>' + a.type + '</td>';
    html += '<td>' + dateStr + '</td>';
    html += '<td class="table-actions">';
    html += '<a href="#" class="edit-link edit-artwork" data-id="' + a.id + '" title="编辑">✏️</a> ';
    html += '<a href="#" class="del-link del-artwork" data-id="' + a.id + '" title="删除">🗑️</a>';
    html += '</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;

  // 绑定编辑
  container.querySelectorAll('.edit-artwork').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      editArtwork(parseInt(btn.dataset.id));
    });
  });

  // 绑定删除
  container.querySelectorAll('.del-artwork').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该作品吗？')) return;
      deleteArtworks([id]);
    });
  });

  // 绑定 checkbox
  container.querySelectorAll('.aw-check').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var id = parseInt(cb.dataset.id);
      if (cb.checked) { _artworkSelectedIds[id] = true; }
      else { delete _artworkSelectedIds[id]; }
      updateBatchBar();
    });
  });
}

// ============================================================
//  获取显示用 URL（优先缓存，cloud:// 未解析时用占位符）
// ============================================================
function getDisplayUrl(imageField) {
  if (!imageField) return 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent('作品');
  if (imageField.indexOf('cloud://') === 0) {
    if (_artworkUrlCache[imageField]) return _artworkUrlCache[imageField];
    return 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent('加载中');
  }
  return imageField;
}

// ============================================================
//  异步解析 cloud:// 图片，更新 DOM
// ============================================================
async function resolveCloudImages(list) {
  var cloudIDs = [];
  list.forEach(function (a) {
    if (a.image && a.image.indexOf('cloud://') === 0 && !_artworkUrlCache[a.image]) {
      cloudIDs.push(a.image);
    }
  });
  if (!cloudIDs.length) return;

  var urlMap = await ArtworkStorage.getUrls(cloudIDs);
  // 合并到缓存
  for (var key in urlMap) {
    if (urlMap.hasOwnProperty(key)) {
      _artworkUrlCache[key] = urlMap[key];
    }
  }

  // 更新 DOM 中所有匹配的 img
  var imgs = document.querySelectorAll('.aw-card-img');
  imgs.forEach(function (img) {
    var fid = img.dataset.fileid;
    if (fid && _artworkUrlCache[fid]) {
      img.src = _artworkUrlCache[fid];
    }
  });
}

// ============================================================
//  同步 checkbox 状态（渲染后恢复选中）
// ============================================================
function syncCheckboxes() {
  document.querySelectorAll('.aw-check').forEach(function (cb) {
    var id = parseInt(cb.dataset.id);
    cb.checked = !!_artworkSelectedIds[id];
  });
}

// ============================================================
//  更新批量操作栏
// ============================================================
function updateBatchBar() {
  var bar = document.getElementById('artwork-batch-bar');
  var countEl = document.getElementById('batch-count');
  if (!bar) return;

  var count = Object.keys(_artworkSelectedIds).length;
  if (count > 0) {
    bar.style.display = 'flex';
    countEl.textContent = count;
  } else {
    bar.style.display = 'none';
  }
}

// ============================================================
//  重置表单
// ============================================================
function resetArtworkForm() {
  document.getElementById('a-image-file').value = '';
  document.getElementById('artwork-preview-img').src = '';
  document.getElementById('artwork-preview-wrap').style.display = 'none';
  document.getElementById('artwork-upload-progress').style.display = 'none';
  document.getElementById('a-image').value = '';
  _pendingImageBlob = null;
  _editingImageValue = null;
}

// ============================================================
//  压缩图片 + 预览
// ============================================================
function compressAndPreviewImage(file) {
  var saveBtn = document.getElementById('artwork-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ 压缩中...'; }

  var reader = new FileReader();
  reader.onload = function (e) {
    var img = new Image();
    img.onload = function () {
      var maxW = 800;
      var w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }

      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // 预览用 data URL
      var dataUrl = canvas.toDataURL('image/jpeg', 0.75);
      var previewWrap = document.getElementById('artwork-preview-wrap');
      var previewImg = document.getElementById('artwork-preview-img');
      var previewSize = document.getElementById('artwork-preview-size');
      if (previewImg) previewImg.src = dataUrl;
      if (previewWrap) previewWrap.style.display = 'block';
      if (previewSize) previewSize.textContent = '已压缩至 ' + w + '×' + h + ' · ≈' + Math.round(dataUrl.length * 3 / 4 / 1024) + 'KB';

      // 异步生成 Blob 供上传
      canvas.toBlob(function (blob) {
        _pendingImageBlob = blob;
        // 压缩完成，恢复保存按钮
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 保存'; }
      }, 'image/jpeg', 0.75);

      // 选了新文件就清掉 URL 输入（优先文件上传）
      var urlInput = document.getElementById('a-image');
      if (urlInput) urlInput.value = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ============================================================
//  保存（添加 / 编辑）
// ============================================================
async function saveArtwork() {
  var editId = document.getElementById('aw-edit-id').value;
  var title = document.getElementById('a-title').value.trim();
  var student = document.getElementById('a-student').value.trim();
  var studentIdRaw = document.getElementById('a-student-id').value;
  var type = document.getElementById('a-type').value;
  var urlValue = document.getElementById('a-image').value.trim();
  var saveBtn = document.getElementById('artwork-save-btn');

  if (!title || !student) { alert('请填写作品名称和学生姓名'); return; }

  var finalImage = '';
  var previewWrap = document.getElementById('artwork-preview-wrap');

  // 优先级：新上传文件 > 编辑保留旧图 > 外部URL > 占位符
  if (_pendingImageBlob) {
    // 有新的压缩图片 → 尝试上传到云存储
    var storageAvailable = (typeof ArtworkStorage !== 'undefined' && ArtworkStorage.upload);

    if (storageAvailable) {
      var progressEl = document.getElementById('artwork-upload-progress');
      progressEl.style.display = 'block';
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ 上传中...';

      var result = await ArtworkStorage.upload(_pendingImageBlob);

      saveBtn.disabled = false;
      saveBtn.textContent = '💾 保存';
      progressEl.style.display = 'none';

      if (result.success) {
        finalImage = result.fileID;
        // 编辑模式下，旧图片如果是 cloud:// 则删除
        if (editId && _editingImageValue && _editingImageValue.indexOf('cloud://') === 0) {
          await ArtworkStorage.remove([_editingImageValue]);
        }
      } else {
        // 上传失败 → 回退到 base64
        console.warn('云存储上传失败，使用 base64 存储:', result.error);
        finalImage = document.getElementById('artwork-preview-img').src;
        if (finalImage && finalImage.indexOf('data:') !== 0) finalImage = '';
      }
    } else {
      // ArtworkStorage 不可用 → 回退到 base64
      finalImage = document.getElementById('artwork-preview-img').src;
      if (finalImage && finalImage.indexOf('data:') !== 0) finalImage = '';
    }
  } else if (urlValue) {
    // 外部 URL（编辑模式下如果用户清掉预览改用 URL，URL 优先）
    finalImage = urlValue;
  } else if (editId && _editingImageValue) {
    // 编辑模式，没选新文件也没填URL → 保留原图
    finalImage = _editingImageValue;
  } else {
    // 占位符
    finalImage = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(title);
  }

  // 兜底
  if (!finalImage) {
    finalImage = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(title);
  }

  var opName = getOperatorName();
  var now = new Date().toISOString();

  if (editId) {
    // 编辑：更新现有记录
    var oldArtwork = getArtworks().find(function (a) { return a.id == editId; });
    var artwork = {
      id: parseInt(editId),
      title: title,
      student: student,
      studentId: studentIdRaw ? parseInt(studentIdRaw) : (oldArtwork ? oldArtwork.studentId : null),
      type: type,
      image: finalImage,
      addedAt: oldArtwork ? oldArtwork.addedAt : now,
      addedBy: oldArtwork ? oldArtwork.addedBy : opName,
      lastModifiedAt: now,
      lastModifiedBy: opName
    };

    var list = getArtworks().map(function (a) { return a.id == editId ? artwork : a; });
    saveArtworks(list);
  } else {
    // 新增
    var artwork = {
      id: Date.now(),
      title: title,
      student: student,
      studentId: studentIdRaw ? parseInt(studentIdRaw) : null,
      type: type,
      image: finalImage,
      addedAt: now,
      addedBy: opName
    };

    var list = getArtworks();
    list.unshift(artwork);
    saveArtworks(list);
  }

  document.getElementById('artwork-form-wrap').style.display = 'none';
  resetArtworkForm();
  renderArtworks();
  updateOverview();
}

// ============================================================
//  编辑：填充表单
// ============================================================
function editArtwork(id) {
  var a = getArtworks().find(function (x) { return x.id === id; });
  if (!a) return;

  document.getElementById('artwork-form-wrap').style.display = 'block';
  document.getElementById('artwork-form-title').textContent = '编辑作品 - ' + a.title;
  document.getElementById('aw-edit-id').value = a.id;
  document.getElementById('a-title').value = a.title;
  document.getElementById('a-student').value = a.student;
  document.getElementById('a-student-id').value = a.studentId || '';
  document.getElementById('a-type').value = a.type;
  document.getElementById('a-image').value = (a.image && a.image.indexOf('cloud://') !== 0 && a.image.indexOf('data:') !== 0) ? a.image : '';
  document.getElementById('a-image-file').value = '';

  _pendingImageBlob = null;
  _editingImageValue = a.image;

  // 预览现有图片
  var previewWrap = document.getElementById('artwork-preview-wrap');
  var previewImg = document.getElementById('artwork-preview-img');
  var previewSize = document.getElementById('artwork-preview-size');

  if (a.image) {
    var displayUrl = a.image;
    // 如果是 cloud://，优先用缓存
    if (a.image.indexOf('cloud://') === 0 && _artworkUrlCache[a.image]) {
      displayUrl = _artworkUrlCache[a.image];
    }
    previewImg.src = displayUrl;
    previewWrap.style.display = 'block';
    previewSize.textContent = a.image.indexOf('cloud://') === 0 ? '☁️ 云端存储' : (a.image.indexOf('data:') === 0 ? '📦 本地图片' : '🔗 外部链接');
  } else {
    previewWrap.style.display = 'none';
  }
}

// ============================================================
//  删除（单个/批量，含云存储文件清理）
// ============================================================
async function deleteArtworks(ids) {
  if (!ids || !ids.length) return;

  var msg = ids.length === 1 ? '确定删除该作品吗？' : '确定删除选中的 ' + ids.length + ' 件作品吗？此操作不可恢复。';
  if (!confirm(msg)) return;

  var allList = getArtworks();
  var toDelete = [];
  var toKeep = [];

  allList.forEach(function (a) {
    if (ids.indexOf(a.id) !== -1) {
      toDelete.push(a);
    } else {
      toKeep.push(a);
    }
  });

  saveArtworks(toKeep);

  // 清理云存储文件
  var cloudIDs = [];
  toDelete.forEach(function (a) {
    if (a.image && a.image.indexOf('cloud://') === 0) {
      cloudIDs.push(a.image);
    }
  });
  if (cloudIDs.length > 0) {
    await ArtworkStorage.remove(cloudIDs);
  }

  // 清除选中状态
  ids.forEach(function (id) { delete _artworkSelectedIds[id]; });
  updateBatchBar();

  renderArtworks();
  updateOverview();
}

// ============================================================
//  导出CSV
// ============================================================
function exportArtworksCSV() {
  var list = applyArtworkFilters(getArtworks());
  if (list.length === 0) { alert('没有可导出的作品数据'); return; }

  var header = ['学生姓名', '作品名称', '类型', '添加日期', '添加人'];
  var rows = [header.join(',')];
  list.forEach(function (a) {
    rows.push([
      '"' + (a.student || '') + '"',
      '"' + (a.title || '') + '"',
      '"' + (a.type || '') + '"',
      '"' + (a.addedAt ? a.addedAt.split('T')[0] : '') + '"',
      '"' + (a.addedBy || '') + '"'
    ].join(','));
  });

  var csvContent = '﻿' + rows.join('\n'); // BOM for Excel Chinese
  var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = '作品列表_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
//  作品灯箱（点击图片放大查看，复用 style.css 的 .lightbox-* 样式）
// ============================================================
function openArtworkLightbox(artworkId) {
  var a = getArtworks().find(function (x) { return x.id == artworkId; });
  if (!a) return;

  var imgUrl = a.image;
  if (imgUrl && imgUrl.indexOf('cloud://') === 0 && _artworkUrlCache[imgUrl]) {
    imgUrl = _artworkUrlCache[imgUrl];
  }
  if (!imgUrl) {
    imgUrl = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(a.title || '作品');
  }

  // 移除已存在的灯箱（如果有）
  var existing = document.getElementById('aw-lightbox-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay active';
  overlay.id = 'aw-lightbox-overlay';
  overlay.style.display = 'flex';
  overlay.innerHTML = ''
    + '<span class="lightbox-close" id="aw-lightbox-close" style="top:20px; right:35px;">&times;</span>'
    + '<img class="lightbox-img" src="' + imgUrl + '" alt="' + a.title + '">'
    + '<p class="lightbox-caption">'
    + '<strong>' + a.title + '</strong>'
    + ' — 👦 ' + a.student + ' | ' + a.type
    + (a.addedAt ? ' | 📅 ' + new Date(a.addedAt).toLocaleDateString('zh-CN') : '')
    + '</p>';
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function closeLightbox() {
    overlay.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', escHandler);
  }

  var escHandler = function (e) {
    if (e.key === 'Escape') closeLightbox();
  };
  document.addEventListener('keydown', escHandler);

  overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeLightbox();
  });
}
