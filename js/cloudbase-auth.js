/*
  春晓画室 - CloudBase 认证模块
  替换原 auth.js，保持相同的 Auth API
  使用 CloudBase 邮箱密码登录
*/

var AUTH_CONFIG = {
  // 老师列表（用于角色验证，实际认证走 CloudBase）
  teachers: [
    { email: '756924037@qq.com', password: '756924', name: '张校长', role: 'admin' },
    { email: '953034984@qq.com', password: '454657', name: '郑校长', role: 'teacher' }
  ],
  sessionKey: 'chunxiao_session',
  // Server酱通知
  notifyKeys: [
    'SCT364390TgpWv9nIL4dE2g1frC1DCIrzq'
  ]
};

// 获取老师配置
function getTeacherByEmail(email) {
  return AUTH_CONFIG.teachers.find(function (t) {
    return t.email === email;
  });
}

function getOperatorName() {
  var u = Auth.currentUser();
  return u ? u.name : '';
}

var Auth = {
  // 初始化（匿名登录，用于公开页面）
  initAnonymous: async function () {
    try {
      var auth = getAuth();
      if (!auth) return null;
      var loginState = await auth.getLoginState();
      if (!loginState) {
        loginState = await auth.signInAnonymously();
      }
      return loginState;
    } catch (e) {
      console.error('匿名登录失败:', e);
      return null;
    }
  },

  // 登录（老师 + 家长通用）
  login: async function (email, password) {
    var auth = getAuth();

    // 检查是否老师（优先本地密码校验，CloudBase 为辅助）
    var teacher = getTeacherByEmail(email);
    if (teacher) {
      // 本地密码校验
      if (teacher.password !== password) {
        throw new Error('邮箱或密码错误');
      }

      // 尝试 CloudBase 登录/注册（后台同步，不阻塞）
      var uid = null;
      if (auth) {
        try {
          var result = await auth.signInWithEmailAndPassword(email, password);
          uid = result.user.uid;
          console.log('✅ CloudBase 登录成功:', email);
        } catch (cbErr) {
          console.warn('CloudBase 登录失败，尝试注册:', cbErr.message || cbErr.code);
          // 可能账号不存在，尝试自动注册
          try {
            var signUpResult = await auth.signUpWithEmailAndPassword(email, password);
            uid = signUpResult.user.uid;
            console.log('✅ CloudBase 注册成功:', email);
          } catch (cbErr2) {
            console.warn('CloudBase 注册也失败，使用本地模式:', cbErr2.message || cbErr2.code);
          }
        }
      }

      var teacherUser = {
        uid: uid,
        email: teacher.email,
        name: teacher.name,
        role: teacher.role,
        loginTime: new Date().toISOString()
      };
      Auth._setSession(teacherUser);
      return teacherUser;
    }

    // 家长登录
    if (!auth) throw new Error('认证服务未就绪');

    try {
      var parentResult = await auth.signInWithEmailAndPassword(email, password);
      var db = getDB();
      if (db) {
        try {
          var res = await db.collection(CLOUDBASE_CONFIG.collections.parents)
            .where({ uid: parentResult.user.uid }).get();
          if (res.data && res.data.length > 0) {
            var p = res.data[0];
            var parentUser = {
              uid: p.uid,
              email: p.email,
              name: p.name,
              childName: p.childName,
              role: 'parent',
              loginTime: new Date().toISOString()
            };
            Auth._setSession(parentUser);
            return parentUser;
          }
        } catch (dbErr) {
          console.error('获取家长信息失败:', dbErr);
        }
      }
      throw new Error('账号信息不完整，请联系老师');
    } catch (e) {
      if (e.message.indexOf('账号信息') >= 0) throw e;
      throw new Error('邮箱或密码错误');
    }
  },

  // 注册（仅家长）
  register: async function (name, email, password, childName) {
    var auth = getAuth();
    if (!auth) throw new Error('认证服务未就绪');

    // 检查是否撞了老师邮箱
    var isTeacher = getTeacherByEmail(email);
    if (isTeacher) throw new Error('该邮箱无法注册');

    // CloudBase 注册
    try {
      var result = await auth.signUpWithEmailAndPassword(email, password);
    } catch (e) {
      if (e.code === 'EMAIL_ALREADY_EXISTS' || e.message.indexOf('已存在') >= 0) {
        throw new Error('该邮箱已被注册');
      }
      throw new Error('注册失败，请稍后再试');
    }

    // 保存家长资料到数据库
    var parentDoc = {
      uid: result.user.uid,
      name: name,
      email: email,
      childName: childName,
      createdAt: new Date().toISOString()
    };

    var db = getDB();
    if (db) {
      try {
        await db.collection(CLOUDBASE_CONFIG.collections.parents).add(parentDoc);
      } catch (dbErr) {
        console.error('保存家长信息失败:', dbErr);
      }
    }

    // 自动登录
    var sessionUser = {
      uid: result.user.uid,
      email: email,
      name: name,
      childName: childName,
      role: 'parent',
      loginTime: new Date().toISOString()
    };
    Auth._setSession(sessionUser);
    return sessionUser;
  },

  // 登出
  logout: async function () {
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
    try {
      var auth = getAuth();
      if (auth) await auth.signOut();
    } catch (e) {
      // 忽略登出错误
    }
  },

  // 是否管理员
  isAdmin: function () {
    var user = Auth.currentUser();
    return user && user.role === 'admin';
  },

  // 获取当前用户
  currentUser: function () {
    var data = localStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  _setSession: function (user) {
    var session = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      childName: user.childName,
      role: user.role,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(session));
  }
};
