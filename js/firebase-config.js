/*
  春晓画室 - Firebase 认证模块
  阶段 5: 登录系统

  ⚠️ 使用前你需要：
  1. 去 https://console.firebase.google.com 创建项目
  2. 启用 Email/Password 登录方式
  3. 把下面的 firebaseConfig 替换成你自己的
  4. 详细步骤见 开发文档.md → 阶段 5
*/

// ============================================================
//  第 1 步：加载 Firebase SDK（从谷歌 CDN）
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ============================================================
//  第 2 步：Firebase 配置（⚠️ 替换成你自己的！）
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAHR5M7TH3FChBr2-iOeZoU7tDZ-rcQjqI",
  authDomain: "chun-xiao.firebaseapp.com",
  projectId: "chun-xiao",
  storageBucket: "chun-xiao.firebasestorage.app",
  messagingSenderId: "352574804897",
  appId: "1:352574804897:web:6994ceac433f9f8b64f1e0",
  measurementId: "G-9RHYFETBR4"
};

// ============================================================
//  第 3 步：初始化 Firebase
// ============================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ============================================================
//  第 3.5 步：老师账号白名单
//  只有列表中的邮箱才能以「老师」身份登录
//  ⚠️ 把下面的邮箱改成你的真实邮箱！
// ============================================================
const TEACHER_EMAILS = [
  'teacher@chunxiao.com',   // ← 替换成老师的真实邮箱
  // 如果有多个老师，复制上面一行并改邮箱：
  // 'another-teacher@example.com',
];

// 检查某个邮箱是否是老师
function isTeacherEmail(email) {
  return TEACHER_EMAILS.includes(email.toLowerCase());
}

// ============================================================
//  第 4 步：获取页面元素（仅登录页需要）
// ============================================================
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const showRegister = document.getElementById('show-register');
const backToLogin = document.getElementById('back-to-login');
const registerHint = document.getElementById('register-hint');

// ============================================================
//  第 5 步：角色选择标签切换
// ============================================================
let currentRole = 'parent';  // 默认家长

document.querySelectorAll('.login-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    document.querySelectorAll('.login-tab').forEach(function (t) {
      t.classList.remove('active');
    });
    tab.classList.add('active');
    currentRole = tab.dataset.role;

    // 老师端隐藏注册入口（老师账号由管理员创建）
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
//  第 6 步：登录/注册表单切换
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
//  第 7 步：登录处理
// ============================================================
if (loginForm) {
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();  // 阻止表单默认提交

    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    loginError.textContent = '登录中...';

    signInWithEmailAndPassword(auth, email, password)
      .then(function (userCredential) {
        // 登录成功 → 检查角色权限
        if (currentRole === 'teacher') {
          // 老师端：必须邮箱在白名单中
          if (!isTeacherEmail(email)) {
            // 不是老师 → 踢出去
            signOut(auth);
            loginError.textContent = '该账号不是老师，请使用家长端登录';
            return;
          }
          window.location.href = 'teacher-dashboard.html';
        } else {
          window.location.href = 'parent-dashboard.html';
        }
      })
      .catch(function (error) {
        // 登录失败 → 显示中文错误
        loginError.textContent = getChineseError(error.code);
      });
  });
}

// ============================================================
//  第 8 步：注册处理（仅家长）
// ============================================================
if (registerForm) {
  registerForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = document.getElementById('reg-name').value;
    var email = document.getElementById('reg-email').value;
    var password = document.getElementById('reg-password').value;
    var childName = document.getElementById('reg-child').value;

    registerError.textContent = '注册中...';

    createUserWithEmailAndPassword(auth, email, password)
      .then(function (userCredential) {
        // 注册成功 → 保存家长信息到 localStorage
        var parentInfo = {
          name: name,
          email: email,
          childName: childName,
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem('chunxiao-parent-info', JSON.stringify(parentInfo));
        registerError.textContent = '';
        // 跳转到家长端
        window.location.href = 'parent-dashboard.html';
      })
      .catch(function (error) {
        registerError.textContent = getChineseError(error.code);
      });
  });
}

// ============================================================
//  第 9 步：错误信息中文化
// ============================================================
function getChineseError(code) {
  var map = {
    'auth/email-already-in-use': '该邮箱已被注册',
    'auth/invalid-email': '邮箱格式不正确',
    'auth/operation-not-allowed': '邮箱登录功能未开启，请联系管理员',
    'auth/weak-password': '密码太短，至少需要 6 位',
    'auth/user-disabled': '该账号已被禁用',
    'auth/user-not-found': '账号不存在，请检查邮箱或先注册',
    'auth/wrong-password': '密码错误，请重试',
    'auth/invalid-credential': '邮箱或密码错误',
    'auth/too-many-requests': '登录尝试次数过多，请稍后再试',
    'auth/network-request-failed': '网络连接失败，请检查网络',
  };
  return map[code] || '操作失败：' + code;
}

// ============================================================
//  第 10 步：登录状态监听（用于受保护页面）
//  如果未登录访问 dashboard，自动跳回登录页
// ============================================================
export function requireAuth(expectedRole) {
  // expectedRole: 'teacher' 或 'parent'
  return new Promise(function (resolve, reject) {
    onAuthStateChanged(auth, function (user) {
      if (user) {
        resolve(user);  // 已登录
      } else {
        // 未登录 → 跳回登录页
        window.location.href = 'login.html';
      }
    });
  });
}

// 获取当前用户
export function getCurrentUser() {
  return auth.currentUser;
}

// 登出
export function logoutUser() {
  return signOut(auth);
}
