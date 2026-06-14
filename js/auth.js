/*
  春晓画室 - 认证模块（纯前端版）
  老师密码在下面改，家长注册信息存 localStorage
  以后换后端：只替换这个文件即可
*/

// ============================================================
//  配置区（⚠️ 改老师密码在这里！）
// ============================================================
var AUTH_CONFIG = {
  // 老师列表（添加老师：复制下面三行，改邮箱、密码、名字）
  teachers: [
    { email: '756924037@qq.com', password: '756924', name: '张校长' },
    { email: '953034984@qq.com', password: '454657', name: '郑校长' },
    // { email: 'teacher3@qq.com', password: '123456', name: '王老师' },
  ],
  storageKey: 'chunxiao_users',    // localStorage 的键名
  sessionKey: 'chunxiao_session',  // 当前登录会话

  // 手机通知（Server酱）：去 https://sct.ftqq.com 微信扫码登录，获取 SendKey
  // 支持多个老师，每个老师一个 SendKey，有人填表时全部都能收到微信通知
  // 手机通知（Server酱）：去 https://sct.ftqq.com 微信扫码获取 SendKey
  // 支持多个老师，有人填预约表单时微信全部收到通知
  notifyKeys: [
    'SCT364390TgpWv9nIL4dE2g1frC1DCIrzq',  // 张校长
    // '',  // 郑校长
  ],
};

// ============================================================
//  核心 API（给其他页面调用）
// ============================================================
var Auth = {

  // ---------- 登录 ----------
  login: function (email, password) {
    var users = this._getUsers();

    // 先检查是否是老师
    var teacher = AUTH_CONFIG.teachers.find(function (t) {
      return t.email === email && t.password === password;
    });
    if (teacher) {
      var teacherUser = {
        email: teacher.email,
        name: teacher.name,
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

    // 检查是否撞了老师邮箱
    var isTeacher = AUTH_CONFIG.teachers.find(function (t) {
      return t.email === email;
    });
    if (isTeacher) {
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
