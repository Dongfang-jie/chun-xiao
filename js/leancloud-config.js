/*
  春晓画室 - LeanCloud 认证模块
  使用 LeanCloud (leancloud.cn) 替代 Firebase
  国内手机也能正常访问！
*/

// ============================================================
//  第 1 步：LeanCloud 配置（⚠️ 替换成你自己的！）
//  去 https://console.leancloud.cn 创建应用，获取 AppID 和 AppKey
// ============================================================
AV.init({
  appId: '这里填你的-AppID',
  appKey: '这里填你的-AppKey',
  serverURL: 'https://这里填你的.restapi.lncldglobal.com',
});

// ============================================================
//  第 2 步：页面元素
// ============================================================
var loginForm = document.getElementById('login-form');
var registerForm = document.getElementById('register-form');
var loginError = document.getElementById('login-error');
var registerError = document.getElementById('register-error');
var showRegister = document.getElementById('show-register');
var backToLogin = document.getElementById('back-to-login');
var registerHint = document.getElementById('register-hint');

// ============================================================
//  第 3 步：角色选择标签
// ============================================================
var currentRole = 'parent';

document.querySelectorAll('.login-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.login-tab').forEach(function (t) {
      t.classList.remove('active');
    });
    tab.classList.add('active');
    currentRole = tab.dataset.role;

    if (currentRole === 'teacher') {
      if (registerHint) registerHint.style.display = 'none';
      if (registerForm) registerForm.style.display = 'none';
      if (loginForm) loginForm.style.display = 'block';
    } else {
      if (registerHint) registerHint.style.display = 'block';
    }
  });
});

// ============================================================
//  第 4 步：表单切换
// ============================================================
if (showRegister) {
  showRegister.addEventListener('click', function (e) {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    registerHint.style.display = 'none';
    loginError.textContent = '';
  });
}

if (backToLogin) {
  backToLogin.addEventListener('click', function (e) {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    registerHint.style.display = currentRole === 'teacher' ? 'none' : 'block';
    registerError.textContent = '';
  });
}

// ============================================================
//  第 5 步：登录
// ============================================================
if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    loginError.textContent = '登录中...';

    // LeanCloud 用 email 作为登录账号
    AV.User.logIn(email, password)
      .then(function (user) {
        // 检查角色是否匹配
        var userRole = user.get('role') || 'parent';

        if (currentRole === 'teacher' && userRole !== 'teacher') {
          // 想以老师身份登录但实际是家长 → 踢出去
          AV.User.logOut();
          loginError.textContent = '该账号不是老师，请使用家长端登录';
          return;
        }

        if (currentRole === 'parent' && userRole === 'teacher') {
          // 想以家长身份登录但实际是老师 → 也允许，跳家长端
          window.location.href = 'parent-dashboard.html';
          return;
        }

        // 正常跳转
        if (currentRole === 'teacher') {
          window.location.href = 'teacher-dashboard.html';
        } else {
          window.location.href = 'parent-dashboard.html';
        }
      })
      .catch(function (error) {
        loginError.textContent = getChineseError(error.code || error.message);
      });
  });
}

// ============================================================
//  第 6 步：注册（仅家长）
// ============================================================
if (registerForm) {
  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = document.getElementById('reg-name').value.trim();
    var email = document.getElementById('reg-email').value.trim();
    var password = document.getElementById('reg-password').value;
    var childName = document.getElementById('reg-child').value.trim();

    registerError.textContent = '注册中...';

    // 创建 LeanCloud 用户
    var user = new AV.User();
    user.set('username', email);      // 用邮箱做用户名
    user.set('password', password);
    user.set('email', email);
    user.set('name', name);           // 家长姓名
    user.set('childName', childName); // 孩子姓名
    user.set('role', 'parent');       // 角色：家长

    user.signUp()
      .then(function () {
        registerError.textContent = '';
        window.location.href = 'parent-dashboard.html';
      })
      .catch(function (error) {
        registerError.textContent = getChineseError(error.code || error.message);
      });
  });
}

// ============================================================
//  第 7 步：错误中文化
// ============================================================
function getChineseError(msg) {
  var map = {
    'email already taken': '该邮箱已被注册',
    'username already exists': '该邮箱已被注册',
    'invalid email': '邮箱格式不正确',
    'password too short': '密码太短，至少需要 6 位',
    'invalid login parameters': '邮箱或密码错误',
    'Could not find user': '账号不存在',
    'The username and password mismatch.': '密码错误',
    'network error': '网络连接失败，请检查网络',
  };
  // 精确匹配
  if (map[msg]) return map[msg];
  // 模糊匹配
  for (var key in map) {
    if (msg && msg.indexOf(key) !== -1) return map[key];
  }
  return '操作失败：' + (msg || '未知错误');
}

// ============================================================
//  第 8 步：导出函数（供仪表盘页面使用）
// ============================================================
function getCurrentUser() {
  return AV.User.current();
}

function logoutUser() {
  return AV.User.logOut();
}

function requireAuth() {
  // 检查是否已登录，未登录跳回 login.html
  if (!AV.User.current()) {
    window.location.href = 'login.html';
  }
  return AV.User.current();
}
