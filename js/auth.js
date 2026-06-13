/*
  春晓画室 - 认证模块（纯前端版）
  老师密码在下面改，家长注册信息存 localStorage
  以后换后端：只替换这个文件即可
*/

// ============================================================
//  配置区（⚠️ 改老师密码在这里！）
// ============================================================
var AUTH_CONFIG = {
  teacherEmail: '756924037@qq.com',
  teacherPassword: 'Changeme123',  // ⚠️ 改成你自己的密码！
  teacherName: '老师',
  storageKey: 'chunxiao_users',    // localStorage 的键名
  sessionKey: 'chunxiao_session',  // 当前登录会话
};

// ============================================================
//  核心 API（给其他页面调用）
// ============================================================
var Auth = {

  // ---------- 登录 ----------
  login: function (email, password) {
    var users = this._getUsers();

    // 先检查是否是老师
    if (email === AUTH_CONFIG.teacherEmail && password === AUTH_CONFIG.teacherPassword) {
      var teacherUser = {
        email: email,
        name: AUTH_CONFIG.teacherName,
        role: 'teacher',
        loginTime: new Date().toISOString(),
      };
      this._setSession(teacherUser);
      return teacherUser;
    }

    // 再检查是否是注册过的家长
    var found = users.find(function (u) {
      return u.email === email && u.password === password;
    });
    if (found) {
      var parentUser = {
        email: found.email,
        name: found.name,
        childName: found.childName,
        role: 'parent',
        loginTime: new Date().toISOString(),
      };
      this._setSession(parentUser);
      return parentUser;
    }

    // 登录失败
    throw new Error('邮箱或密码错误');
  },

  // ---------- 注册（仅家长） ----------
  register: function (name, email, password, childName) {
    var users = this._getUsers();

    // 检查邮箱是否已注册
    if (email === AUTH_CONFIG.teacherEmail) {
      throw new Error('该邮箱无法注册');
    }
    var exists = users.find(function (u) { return u.email === email; });
    if (exists) {
      throw new Error('该邮箱已被注册');
    }

    // 保存新用户
    var newUser = {
      name: name,
      email: email,
      password: password,   // 实际项目中应该加密，小画室够用
      childName: childName,
      role: 'parent',
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    this._saveUsers(users);

    // 自动登录
    var sessionUser = {
      email: newUser.email,
      name: newUser.name,
      childName: newUser.childName,
      role: 'parent',
      loginTime: new Date().toISOString(),
    };
    this._setSession(sessionUser);
    return sessionUser;
  },

  // ---------- 登出 ----------
  logout: function () {
    localStorage.removeItem(AUTH_CONFIG.sessionKey);
  },

  // ---------- 获取当前用户 ----------
  currentUser: function () {
    var data = localStorage.getItem(AUTH_CONFIG.sessionKey);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  // ==========================================================
  //  内部方法（不对外暴露）
  // ==========================================================

  _getUsers: function () {
    var data = localStorage.getItem(AUTH_CONFIG.storageKey);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  },

  _saveUsers: function (users) {
    localStorage.setItem(AUTH_CONFIG.storageKey, JSON.stringify(users));
  },

  _setSession: function (user) {
    // 不存密码到 session
    var session = {
      email: user.email,
      name: user.name,
      childName: user.childName,
      role: user.role,
      loginTime: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_CONFIG.sessionKey, JSON.stringify(session));
  },
};
