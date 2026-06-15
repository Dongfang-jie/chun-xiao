/*
  春晓画室 - 登录页逻辑
  依赖 auth.js
*/

document.addEventListener('DOMContentLoaded', function () {

  // ========== 页面元素 ==========
  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');
  var loginError = document.getElementById('login-error');
  var registerError = document.getElementById('register-error');
  var showRegister = document.getElementById('show-register');
  var backToLogin = document.getElementById('back-to-login');
  var registerHint = document.getElementById('register-hint');

  // 如果已登录，直接跳转
  var savedUser = Auth.currentUser();
  if (savedUser) {
    if (savedUser.role === 'teacher') {
      window.location.href = 'teacher-dashboard.html';
    } else {
      window.location.href = 'parent-dashboard.html';
    }
    return;
  }

  // ========== 角色标签切换 ==========
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

  // ========== 表单切换 ==========
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

  // ========== 登录 ==========
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      loginError.textContent = '登录中...';

      try {
        var user = await Auth.login(email, password);

        // 检查角色是否匹配（admin 也是老师端）
        if (currentRole === 'teacher' && user.role === 'parent') {
          Auth.logout();
          loginError.textContent = '该账号不是老师，请使用家长端登录';
          return;
        }
        if (currentRole === 'parent' && user.role !== 'parent') {
          Auth.logout();
          loginError.textContent = '该账号不是家长，请使用老师端登录';
          return;
        }

        // 跳转
        if (currentRole === 'teacher') {
          window.location.href = 'teacher-dashboard.html';
        } else {
          window.location.href = 'parent-dashboard.html';
        }
      } catch (err) {
        loginError.textContent = err.message;
      }
    });
  }

  // ========== 注册 ==========
  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var name = document.getElementById('reg-name').value.trim();
      var email = document.getElementById('reg-email').value.trim();
      var password = document.getElementById('reg-password').value;
      var childName = document.getElementById('reg-child').value.trim();

      if (password.length < 6) {
        registerError.textContent = '密码至少需要 6 位';
        return;
      }

      registerError.textContent = '注册中...';

      try {
        await Auth.register(name, email, password, childName);
        window.location.href = 'parent-dashboard.html';
      } catch (err) {
        registerError.textContent = err.message;
      }
    });
  }

});
