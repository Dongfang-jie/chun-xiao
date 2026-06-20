/*
  春晓画室 - 认证模块
  教师走本地密码 + CloudBase 同步
  家长走本地密码哈希（查 parents 集合验证）
*/

var AUTH_CONFIG = {
  teachers: [
    { email: '756924037@qq.com', passwordHash: 'fc9c07fdd12e7a7c153f8ec5b291461a28b0cabe1b4ea6f474f5b24a4cdbb049', name: '张校长', role: 'admin' },
    { email: '953034984@qq.com', passwordHash: '4274727476bba9a9211eee11fee0ea32fa1823ccd42f14d680db634ad444ca69', name: '郑校长', role: 'teacher' }
  ],
  sessionKey: 'chunxiao-session',
  passwordSalt: 'chunxiao_teacher_2026'
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
      // 老师：SHA-256 哈希校验（密码不存储明文）
      var inputHash = await Auth.sha256(password, AUTH_CONFIG.passwordSalt);
      if (inputHash !== teacher.passwordHash) {
        throw new Error('邮箱或密码错误');
      }

      // CloudBase 后台同步（使用用户输入的明文密码，非阻塞）
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
      // 自动迁移旧格式
      var children = p.children;
      if (!children && p.childName) {
        children = [{ name: p.childName, studentId: null }];
        // 异步更新 CloudBase doc（不阻塞登录）
        try {
          await db.collection(CLOUDBASE_CONFIG.collections.parents).doc(p._id).update({
            children: children, activeChildIndex: 0
          });
        } catch (migErr) { console.warn('迁移 children 失败:', migErr.message); }
      }
      var parentUser = {
        uid: p._id,
        email: p.email,
        name: p.name,
        children: children || [{ name: '孩子', studentId: null }],
        activeChildIndex: typeof p.activeChildIndex === 'number' ? p.activeChildIndex : 0,
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
        throw new Error('账号已创建，但保存家长信息失败，请重新登录或联系画室');
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

  // 获取当前用户（自动迁移旧 childName 格式 + 旧 localStorage key）
  currentUser: function () {
    // 自动迁移旧 localStorage key（仅首次执行，幂等）
    if (typeof migrateStorageKeys === 'function') { migrateStorageKeys(); }
    var data = localStorage.getItem(AUTH_CONFIG.sessionKey) || sessionStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!data) return null;
    try {
      var user = JSON.parse(data);
      if (!user.children && user.childName) {
        user.children = [{ name: user.childName, studentId: null }];
        user.activeChildIndex = 0;
      }
      return user;
    } catch (e) { return null; }
  },

  _setSession: function (user) {
    var session = {
      uid: user.uid,
      email: user.email,
      name: user.name,
      children: user.children || (user.childName ? [{ name: user.childName, studentId: null }] : []),
      activeChildIndex: typeof user.activeChildIndex === 'number' ? user.activeChildIndex : 0,
      role: user.role,
      loginTime: new Date().toISOString()
    };
    var data = JSON.stringify(session);
    localStorage.setItem(AUTH_CONFIG.sessionKey, data);
  },

  // 获取当前孩子对象
  currentChild: function () {
    var user = Auth.currentUser();
    if (!user || !user.children || !user.children.length) return null;
    var idx = user.activeChildIndex || 0;
    return user.children[idx] || user.children[0] || null;
  },

  // 更新孩子列表并同步 CloudBase
  updateChildren: async function (children, activeChildIndex) {
    var user = Auth.currentUser();
    if (!user) throw new Error('未登录');
    user.children = children;
    user.activeChildIndex = activeChildIndex;
    Auth._setSession(user);
    var db = getDB();
    if (db) {
      try {
        var res = await db.collection(CLOUDBASE_CONFIG.collections.parents)
          .where({ email: user.email }).get();
        if (res.data && res.data.length > 0) {
          await db.collection(CLOUDBASE_CONFIG.collections.parents)
            .doc(res.data[0]._id).update({
              children: children,
              activeChildIndex: activeChildIndex
            });
        }
      } catch (e) { console.warn('同步 children 失败:', e.message); }
    }
  },

  // SHA-256 安全哈希（使用 Web Crypto API）
  sha256: async function (password, salt) {
    var input = password + ':' + (salt || '');
    var encoder = new TextEncoder();
    var msgBuffer = encoder.encode(input);
    var hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    var hashArray = new Uint8Array(hashBuffer);
    var hashHex = '';
    for (var i = 0; i < hashArray.length; i++) {
      var hex = hashArray[i].toString(16);
      hashHex += (hex.length === 1 ? '0' : '') + hex;
    }
    return hashHex;
  },

  // 密码哈希（ES5 兼容，用于家长密码 — 旧格式兼容）
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
