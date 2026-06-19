/*
  春晓画室 - 登录页逻辑
  功能：角色切换 / 邮箱密码登录 / 邮箱验证码注册 / 忘记密码 / 密码可见 / 实时校验
  依赖 auth.js
*/

document.addEventListener('DOMContentLoaded', async function () {

  // 初始化匿名登录（CloudBase callFunction 需要登录态）
  if (typeof Auth !== 'undefined') {
    try {
      await Auth.initAnonymous();
      console.log('Anonymous auth initialized for login page');
    } catch (e) {
      console.warn('Anonymous auth init failed (non-fatal):', e.message);
    }
  }

  // ========== HTTP 调用 verify-code Web 函数（内置 CORS 处理） ==========
  var VERIFY_CODE_URL = 'https://chunxiao-d8ghfaw3y0781da11.service.tcloudbase.com/verify-code';

  async function callVerifyCode(data) {
    var response = await fetch(VERIFY_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ': ' + response.statusText);
    }
    return response.json();
  }

  // ========== 页面元素 ==========
  var loginForm    = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');
  var forgotForm   = document.getElementById('forgot-form');

  var loginError    = document.getElementById('login-error');
  var registerError = document.getElementById('register-error');
  var forgotError   = document.getElementById('forgot-error');

  var allForms = [loginForm, registerForm, forgotForm];

  // 注册表单倒计时
  var regCountdown = 0;
  var regTimer = null;

  // ========== 已登录自动跳转 ==========
  var savedUser = Auth.currentUser();
  if (savedUser) {
    if (savedUser.role === 'parent') {
      window.location.href = 'parent-dashboard.html';
    } else {
      window.location.href = 'teacher-dashboard.html';
    }
    return;
  }

  // ================================================================
  //  工具函数
  // ================================================================

  function showForm(form) {
    allForms.forEach(function (f) { if (f) f.classList.remove('active'); });
    if (form) form.classList.add('active');
    [loginError, registerError, forgotError].forEach(function (el) {
      if (el) el.textContent = '';
    });
    document.querySelectorAll('.field-hint').forEach(function (el) { el.textContent = ''; });
    document.querySelectorAll('.login-form input').forEach(function (el) {
      el.classList.remove('input-error', 'input-valid');
    });
  }

  function setBtnLoading(btn, loading) {
    if (!btn) return;
    var textEl = btn.querySelector('.btn-text');
    var spinnerEl = btn.querySelector('.btn-spinner');
    if (loading) {
      btn.disabled = true;
      btn.classList.add('loading');
      if (textEl) textEl.style.display = 'none';
      if (spinnerEl) spinnerEl.style.display = 'inline-block';
    } else {
      btn.disabled = false;
      btn.classList.remove('loading');
      if (textEl) textEl.style.display = '';
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  }

  // ================================================================
  //  密码可见切换（SVG 图标）
  // ================================================================

  function initPwdToggle(toggleBtnId, inputId) {
    var btn = document.getElementById(toggleBtnId);
    var input = document.getElementById(inputId);
    if (!btn || !input) return;
    var iconShow = btn.querySelector('.pwd-icon-show');
    var iconHide = btn.querySelector('.pwd-icon-hide');
    btn.addEventListener('click', function () {
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      if (iconShow) iconShow.style.display = isPassword ? 'none' : '';
      if (iconHide) iconHide.style.display = isPassword ? '' : 'none';
    });
  }
  initPwdToggle('pwd-toggle-login', 'password');
  initPwdToggle('pwd-toggle-reg', 'reg-password');

  // ================================================================
  //  角色标签切换
  // ================================================================

  var currentRole = 'parent';

  var loginRegisterHint = document.getElementById('login-register-hint');

  document.querySelectorAll('.login-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.login-tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      currentRole = tab.dataset.role;
      showForm(loginForm);
      // 老师端隐藏注册入口
      if (loginRegisterHint) {
        loginRegisterHint.style.display = currentRole === 'teacher' ? 'none' : '';
      }
    });
  });

  // ================================================================
  //  表单间导航
  // ================================================================

  var showRegister = document.getElementById('show-register');
  if (showRegister) {
    showRegister.addEventListener('click', function (e) {
      e.preventDefault();
      showForm(registerForm);
    });
  }

  var backToLogin = document.getElementById('back-to-login');
  if (backToLogin) {
    backToLogin.addEventListener('click', function (e) {
      e.preventDefault();
      showForm(loginForm);
    });
  }

  var showForgot = document.getElementById('show-forgot');
  if (showForgot) {
    showForgot.addEventListener('click', function (e) {
      e.preventDefault();
      var loginEmail = document.getElementById('email').value.trim();
      if (loginEmail) document.getElementById('forgot-email').value = loginEmail;
      showForm(forgotForm);
      if (currentRole === 'teacher') {
        document.getElementById('forgot-desc').textContent = '教师账号请联系管理员重置密码';
        var fbtn = document.getElementById('forgot-submit-btn');
        if (fbtn) { fbtn.querySelector('.btn-text').textContent = '请联系管理员'; fbtn.disabled = true; fbtn.style.opacity = '0.6'; }
      } else {
        document.getElementById('forgot-desc').textContent = '输入您的邮箱，我们将发送重置链接';
        var fbtn2 = document.getElementById('forgot-submit-btn');
        if (fbtn2) { fbtn2.querySelector('.btn-text').textContent = '发送重置邮件'; fbtn2.disabled = false; fbtn2.style.opacity = ''; }
      }
    });
  }

  var backFromForgot = document.getElementById('back-from-forgot');
  if (backFromForgot) {
    backFromForgot.addEventListener('click', function (e) {
      e.preventDefault();
      showForm(loginForm);
    });
  }

  // ================================================================
  //  输入实时校验
  // ================================================================

  function validateEmail(email) {
    if (!email) return '请输入邮箱地址';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
    return '';
  }

  function validatePassword(pwd) {
    if (!pwd) return '请输入密码';
    if (pwd.length < 6) return '密码至少需要6位';
    return '';
  }

  function validateRequired(val, label) {
    if (!val || !val.trim()) return '请输入' + label;
    return '';
  }

  function bindBlurValidation(inputId, hintId, validator) {
    var input = document.getElementById(inputId);
    var hint = document.getElementById(hintId);
    if (!input || !hint) return;
    input.addEventListener('blur', function () {
      var msg = validator(input.value.trim());
      hint.textContent = msg;
      if (msg) { input.classList.add('input-error'); input.classList.remove('input-valid'); }
      else if (input.value.trim()) { input.classList.remove('input-error'); input.classList.add('input-valid'); }
      else { input.classList.remove('input-error', 'input-valid'); }
    });
    input.addEventListener('input', function () {
      if (hint.textContent) { hint.textContent = ''; input.classList.remove('input-error', 'input-valid'); }
    });
  }

  // 登录表单校验
  bindBlurValidation('email', 'email-hint', validateEmail);
  bindBlurValidation('password', 'password-hint', validatePassword);

  // 注册表单校验
  bindBlurValidation('reg-name', 'reg-name-hint', function (v) { return validateRequired(v, '家长姓名'); });
  bindBlurValidation('reg-email', 'reg-email-hint', validateEmail);
  bindBlurValidation('reg-email-code', 'reg-email-code-hint', function (v) {
    if (!v) return '请输入验证码';
    if (!/^\d{6}$/.test(v)) return '验证码为6位数字';
    return '';
  });
  bindBlurValidation('reg-password', 'reg-password-hint', function (v) {
    if (!v) return '请设置登录密码';
    if (v.length < 6) return '密码至少需要6位';
    return '';
  });
  bindBlurValidation('reg-child', 'reg-child-hint', function (v) { return validateRequired(v, '孩子姓名'); });

  // 忘记密码表单校验
  bindBlurValidation('forgot-email', 'forgot-email-hint', validateEmail);

  // ================================================================
  //  登录提交
  // ================================================================

  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var submitBtn = document.getElementById('login-submit-btn');

      var emailErr = validateEmail(email);
      var pwdErr = validatePassword(password);
      if (emailErr || pwdErr) { loginError.textContent = emailErr || pwdErr; return; }

      loginError.textContent = '';
      setBtnLoading(submitBtn, true);

      try {
        var user = await Auth.login(email, password);

        if (currentRole === 'teacher' && user.role === 'parent') {
          Auth.logout();
          loginError.textContent = '该账号不是老师，请使用家长端登录';
          setBtnLoading(submitBtn, false);
          return;
        }
        if (currentRole === 'parent' && user.role !== 'parent') {
          Auth.logout();
          loginError.textContent = '该账号不是家长，请使用老师端登录';
          setBtnLoading(submitBtn, false);
          return;
        }

        if (currentRole === 'teacher') {
          window.location.href = 'teacher-dashboard.html';
        } else {
          window.location.href = 'parent-dashboard.html';
        }
      } catch (err) {
        loginError.textContent = err.message;
        setBtnLoading(submitBtn, false);
      }
    });
  }

  // ================================================================
  //  注册表单 - 发送验证码
  // ================================================================

  function updateRegCountdown() {
    var btn = document.getElementById('reg-send-code-btn');
    if (!btn) return;
    if (regCountdown <= 0) {
      btn.disabled = false;
      btn.textContent = '获取验证码';
      return;
    }
    btn.textContent = regCountdown + 's 后重发';
    regCountdown--;
    regTimer = setTimeout(updateRegCountdown, 1000);
  }

  var regSendBtn = document.getElementById('reg-send-code-btn');
  if (regSendBtn) {
    regSendBtn.addEventListener('click', async function () {
      if (regCountdown > 0) return;

      var email = document.getElementById('reg-email').value.trim();
      var hint = document.getElementById('reg-email-hint');

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (hint) { hint.textContent = '请先输入正确的邮箱地址'; hint.style.color = '#e88'; }
        return;
      }
      if (hint) { hint.textContent = ''; }

      regSendBtn.disabled = true;
      regSendBtn.textContent = '发送中...';

      try {
        // 通过 HTTP 直接调用云函数（绕过 SDK callFunction 的网络问题）
        var resp = await callVerifyCode({ action: 'send', email: email });
        if (resp.success) {
          regCountdown = 60;
          updateRegCountdown();
          var codeHint = document.getElementById('reg-email-code-hint');
          if (codeHint) { codeHint.textContent = '验证码已发送，请检查邮箱'; codeHint.style.color = '#5a9'; }
        } else {
          regSendBtn.disabled = false;
          regSendBtn.textContent = '获取验证码';
          if (hint) { hint.textContent = resp.message || '发送失败'; hint.style.color = '#e88'; }
        }
      } catch (err) {
        regSendBtn.disabled = false;
        regSendBtn.textContent = '获取验证码';
        var errMsg = (err && (err.message || err.code)) || '发送失败，请稍后再试';
        if (hint) { hint.textContent = '发送失败：' + errMsg; hint.style.color = '#e88'; }
        console.error('Email code send error:', err);
      }
    });
  }

  // ================================================================
  //  注册提交
  // ================================================================

  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      var name      = document.getElementById('reg-name').value.trim();
      var email     = document.getElementById('reg-email').value.trim();
      var code      = document.getElementById('reg-email-code').value.trim();
      var password  = document.getElementById('reg-password').value;
      var phone     = document.getElementById('reg-phone').value.trim();
      var childName = document.getElementById('reg-child').value.trim();
      var submitBtn = document.getElementById('register-submit-btn');

      if (!name)          { registerError.textContent = '请输入家长姓名'; return; }
      if (!email)         { registerError.textContent = '请输入邮箱地址'; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { registerError.textContent = '邮箱格式不正确'; return; }
      if (!code)          { registerError.textContent = '请输入邮箱验证码'; return; }
      if (!/^\d{6}$/.test(code)) { registerError.textContent = '验证码为6位数字'; return; }
      if (!password || password.length < 6) { registerError.textContent = '请设置密码（至少6位）'; return; }
      if (!childName)     { registerError.textContent = '请输入孩子姓名'; return; }

      registerError.textContent = '';
      setBtnLoading(submitBtn, true);

      try {
        // 1. 校验验证码（通过 HTTP 调用云函数）
        var verifyResp = await callVerifyCode({ action: 'verify', email: email, code: code });
        if (!verifyResp.success) {
          throw new Error(verifyResp.message || '验证码校验失败');
        }

        // 2. 检查邮箱是否已被注册
        var db = getDB();
        if (!db) throw new Error('数据库未就绪');
        try {
          var existing = await db.collection('parents').where({ email: email }).get();
          if (existing.data && existing.data.length > 0) {
            throw new Error('该邮箱已被注册，请直接登录');
          }
        } catch (checkErr) {
          if (checkErr.message.indexOf('已被注册') >= 0) throw checkErr;
          console.warn('检查重复邮箱失败（非致命）:', checkErr.message);
        }

        // 3. 创建家长账号（存入 parents 集合，密码哈希存储）
        var passwordHash = Auth.hashPassword(password);
        var doc = {
          email: email,
          name: name,
          passwordHash: passwordHash,
          phone: phone || '',
          childName: childName,
          children: [{ name: childName, studentId: null }],
          activeChildIndex: 0,
          regMethod: 'email_code',
          createdAt: new Date().toISOString()
        };
        var addResult = await db.collection('parents').add(doc);

        // 4. 创建会话，跳转家长端
        Auth._setSession({
          uid: addResult.id,
          email: email,
          name: name,
          children: [{ name: childName, studentId: null }],
          activeChildIndex: 0,
          role: 'parent',
          loginTime: new Date().toISOString()
        });

        window.location.href = 'parent-dashboard.html';

      } catch (err) {
        registerError.textContent = err.message || '注册失败';
        setBtnLoading(submitBtn, false);
      }
    });
  }

  // ================================================================
  //  忘记密码提交
  // ================================================================

  if (forgotForm) {
    forgotForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      if (currentRole === 'teacher') {
        forgotError.textContent = '教师账号请联系管理员重置密码';
        return;
      }

      var email = document.getElementById('forgot-email').value.trim();
      var submitBtn = document.getElementById('forgot-submit-btn');

      var emailErr = validateEmail(email);
      if (emailErr) { forgotError.textContent = emailErr; return; }

      forgotError.textContent = '';
      setBtnLoading(submitBtn, true);

      try {
        var auth = getAuth();
        if (!auth) throw new Error('认证服务未就绪');

        if (typeof auth.sendPasswordResetEmail === 'function') {
          await auth.sendPasswordResetEmail(email);
        } else if (typeof auth.sendPasswordResetMail === 'function') {
          await auth.sendPasswordResetMail(email);
        } else {
          throw new Error('当前版本不支持在线重置，请联系老师协助');
        }

        forgotError.style.color = '#5a9';
        forgotError.textContent = '✅ 重置邮件已发送，请检查邮箱（含垃圾邮件箱）';
        setBtnLoading(submitBtn, false);

        setTimeout(function () {
          if (forgotError.textContent.indexOf('✅') === 0) {
            showForm(loginForm);
            document.getElementById('email').value = email;
            forgotError.textContent = '';
            forgotError.style.color = '';
          }
        }, 4000);

      } catch (err) {
        forgotError.textContent = '发送失败：' + (err.message || '请稍后再试');
        setBtnLoading(submitBtn, false);
      }
    });
  }

});
