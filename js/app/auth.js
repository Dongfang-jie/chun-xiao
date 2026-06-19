/*
  春晓画室 - 认证模块
  教师走本地密码 + CloudBase 同步
  家长走本地密码哈希（查 parents 集合验证）
*/

var AUTH_CONFIG = {
  teachers: [
    { email: '756924037@qq.com', password: '756924', name: '张校长', role: 'admin' },
    { email: '953034984@qq.com', password: '454657', name: '郑校长', role: 'teacher' }
  ],
  sessionKey: 'chunxiao_session',
  notifyKeys: [
    'SCT364390TgpWv9nIL4dE2g1frC1DCIrzq'
  ]
};

function getTeacherByEmail(email) {
  return AUTH_CONFIG.teachers.find(function (t) {
    return t.email === email;
  });
}

var Auth = {
  // 匿名登录（公开页面）
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
    var teacher = getTeacherByEmail(email);
    if (teacher) {
      // 老师：本地密码校验优先
      if (teacher.password !== password) {
        throw new Error('邮箱或密码错误');
      }

      // CloudBase 后台同步（非阻塞）
      var uid = null;
      var auth = getAuth();
      if (auth) {
        try {
          var result = await auth.signInWithEmailAndPassword(email, password);
          uid = result.user.uid;
        } catch (e) {
          console.warn('CloudBase 老师登录同步失败:', e.message || e.code);
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

    // 家长：本地密码验证（查 parents 集合，比哈希）
    var db = getDB();
    if (!db) throw new Error('数据库未就绪');

    try {
      var res = await db.collection(CLOUDBASE_CONFIG.collections.parents)
        .where({ email: email }).get();
      if (!res.data || res.data.length === 0) {
        throw new Error('邮箱或密码错误');
      }
      var p = res.data[0];
      if (!Auth.verifyPassword(password, p.passwordHash)) {
        throw new Error('邮箱或密码错误');
      }
      var parentUser = {
        uid: p._id,
        email: p.email,
        name: p.name,
        childName: p.childName,
        role: 'parent',
        loginTime: new Date().toISOString()
      };
      Auth._setSession(parentUser);
      return parentUser;
    } catch (e) {
      if (e.message === '邮箱或密码错误') throw e;
      if (e.message && e.message.indexOf('账号信息') >= 0) throw e;
      throw new Error('邮箱或密码错误');
    }
  },

  // 注册（仅家长）
  register: async function (name, email, password, childName) {
    var auth = getAuth();
    if (!auth) throw new Error('认证服务未就绪');

    if (getTeacherByEmail(email)) throw new Error('该邮箱无法注册');

    try {
      var result = await auth.signUpWithEmailAndPassword(email, password);
    } catch (e) {
      if (e.code === 'EMAIL_ALREADY_EXISTS' || (e.message && e.message.indexOf('已存在') >= 0)) {
        throw new Error('该邮箱已被注册');
      }
      throw new Error('注册失败，请稍后再试');
    }

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

    var sessionUser = {
      uid: result.user.uid,
      email: email,
      name: name,
      childName: childName,
      role: 'parent',
      loginTime: new Date().toISOString()
    };
    Auth._setSession(sessionUser)
    return sessionUser;
  },

  // 登出
  logout: async function () {
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
    sessionStorage.removeItem(AUTH_CONFIG.sessionKey);
    try {
      var auth = getAuth();
      if (auth) await auth.signOut();
    } catch (e) { /* 忽略 */ }
  },

  // 获取当前用户
  currentUser: function () {
    var data = localStorage.getItem(AUTH_CONFIG.sessionKey) || sessionStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!data) return null;
    try { return JSON.parse(data); } catch (e) { return null; }
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
    var data = JSON.stringify(session);
    localStorage.setItem(AUTH_CONFIG.sessionKey, data);
  },

  // 密码哈希（简单但有效的 ES5 兼容哈希）
  hashPassword: function (password) {
    var salt = 'chunxiao_2026';
    var input = password + salt;
    var hash = 0;
    for (var i = 0; i < input.length; i++) {
      var ch = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash = hash & hash;
    }
    var hashStr = (hash >>> 0).toString(16);
    var combined = hashStr + salt + password.length;
    var hash2 = 0;
    for (var j = 0; j < combined.length; j++) {
      var c = combined.charCodeAt(j);
      hash2 = ((hash2 << 5) - hash2) + c;
      hash2 = hash2 & hash2;
    }
    return 'cx_' + (hash2 >>> 0).toString(16);
  },

  verifyPassword: function (password, hash) {
    if (!password || !hash) return false;
    return Auth.hashPassword(password) === hash;
  }
};
