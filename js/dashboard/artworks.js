/*
  春晓画室 - 管理端作品管理模块
*/

function loadArtworks() {
  renderArtworks();
  var addBtn = document.getElementById('add-artwork-btn');
  if (addBtn) {
    addBtn.onclick = function() {
      document.getElementById('artwork-form-wrap').style.display = 'block';
      document.getElementById('artwork-form-title').textContent = '添加作品';
      document.getElementById('a-title').value = '';
      document.getElementById('a-student').value = '';
      document.getElementById('a-type').value = '美术';
      document.getElementById('a-image').value = '';
      document.getElementById('a-image-file').value = '';
      document.getElementById('artwork-preview-wrap').style.display = 'none';
    };
  }
  var cancelBtn = document.getElementById('artwork-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = function() {
      document.getElementById('artwork-form-wrap').style.display = 'none';
      resetArtworkForm();
    };
  }

  var fileInput = document.getElementById('a-image-file');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      var file = fileInput.files[0];
      if (!file) return;
      compressAndPreviewImage(file);
    });
  }

  var clearBtn = document.getElementById('artwork-preview-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      document.getElementById('a-image-file').value = '';
      document.getElementById('artwork-preview-wrap').style.display = 'none';
    });
  }

  var saveBtn = document.getElementById('artwork-save-btn');
  if (saveBtn) {
    saveBtn.onclick = function() {
      var title = document.getElementById('a-title').value.trim();
      var student = document.getElementById('a-student').value.trim();
      if (!title || !student) { alert('请填写作品名称和学生姓名'); return; }

      var previewWrap = document.getElementById('artwork-preview-wrap');
      var previewImg = document.getElementById('artwork-preview-img');
      var imageData = previewImg.src;
      var urlValue = document.getElementById('a-image').value.trim();
      var finalImage;

      if (previewWrap.style.display !== 'none' && imageData && imageData.indexOf('data:image') === 0) {
        finalImage = imageData;
      } else if (urlValue) {
        finalImage = urlValue;
      } else {
        finalImage = 'https://placehold.co/400x300/e8d8c8/5d4037?text=' + encodeURIComponent(title);
      }

      var artwork = {
        id: Date.now(),
        title: title, student: student,
        type: document.getElementById('a-type').value,
        image: finalImage,
        addedAt: new Date().toISOString(),
        addedBy: getOperatorName()
      };

      var list = getArtworks();
      list.unshift(artwork);
      saveArtworks(list);
      document.getElementById('artwork-form-wrap').style.display = 'none';
      resetArtworkForm();
      renderArtworks();
      updateOverview();
    };
  }
}

function resetArtworkForm() {
  document.getElementById('a-image-file').value = '';
  document.getElementById('artwork-preview-img').src = '';
  document.getElementById('artwork-preview-wrap').style.display = 'none';
  document.getElementById('a-image').value = '';
}

function compressAndPreviewImage(file) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var maxW = 800;
      var w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }

      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      var dataUrl = canvas.toDataURL('image/jpeg', 0.75);

      var previewWrap = document.getElementById('artwork-preview-wrap');
      var previewImg = document.getElementById('artwork-preview-img');
      var previewSize = document.getElementById('artwork-preview-size');
      previewImg.src = dataUrl;
      previewWrap.style.display = 'block';

      var sizeKB = Math.round(dataUrl.length * 3 / 4 / 1024);
      previewSize.textContent = '已压缩至 ' + w + '×' + h + ' · ≈' + sizeKB + 'KB';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderArtworks() {
  var container = document.getElementById('artworks-list');
  var countEl = document.getElementById('artwork-count');
  if (!container) return;

  var list = getArtworks();
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#999; padding:40px; width:100%;">暂无作品，点击"+ 添加作品"开始</p>';
    return;
  }

  container.className = 'card-container';
  container.style.justifyContent = 'flex-start';
  var html = '';
  list.forEach(function(a) {
    html += [
      '<div class="card" style="flex:0 1 280px; max-width:280px;">',
      '<img src="' + a.image + '" alt="' + a.title + '" class="card-img" style="height:180px;">',
      '<div class="card-body">',
      '<h4>' + a.title + '</h4>',
      '<p>👦 ' + a.student + ' | ' + a.type + (a.addedBy ? ' | 🖊️ ' + a.addedBy : '') + '</p>',
      (hasAdminPermission() ? '<a href="#" class="del-artwork" data-id="' + a.id + '" style="color:#e88; font-size:0.85em;">🗑️ 删除</a>' : ''),
      '</div></div>'
    ].join('');
  });
  container.innerHTML = html;

  container.querySelectorAll('.del-artwork').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var id = parseInt(btn.dataset.id);
      if (!confirm('确定删除该作品吗？')) return;
      var list = getArtworks().filter(function(a) { return a.id != id; });
      saveArtworks(list);
      renderArtworks();
      updateOverview();
    });
  });
}
