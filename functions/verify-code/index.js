/*
  春晓画室 - 邮箱验证码云函数
  功能：发送邮箱验证码 / 校验验证码
  使用 QQ 邮箱 SMTP 发送，无需第三方服务
*/

const cloudbase = require('@cloudbase/node-sdk');
const nodemailer = require('nodemailer');

const app = cloudbase.init({ env: 'chunxiao-d8ghfaw3y0781da11' });
const db = app.database();

// ================================================================
//  邮件配置 —— 从云函数环境变量读取
// ================================================================
const EMAIL_CONFIG = {
  user: process.env.EMAIL_USER || '',
  pass: process.env.EMAIL_PASS || '',  // QQ 邮箱授权码，非密码
  fromName: '春晓画室'
};

// QQ SMTP 服务器（其他邮箱改这里即可）
const SMTP = {
  host: 'smtp.qq.com',
  port: 465,
  secure: true
};

// 验证码配置
const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 5;

// 集合名称
const COLLECTION = 'email_codes';

// 懒加载 —— 首次发邮件时才创建 transporter
var transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.secure,
      auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass
      }
    });
  }
  return transporter;
}

// ================================================================
//  确保 email_codes 集合存在（集合不会自动创建时兜底）
// ================================================================

var collectionEnsured = false;
var collectionExists = null;  // null=未知, true=存在, false=不存在

async function ensureCollection() {
  if (collectionEnsured) return collectionExists;

  // 1. 尝试查询（判断集合是否存在）
  try {
    await db.collection(COLLECTION).where({ email: '_init_' }).limit(1).get();
    collectionExists = true;
    collectionEnsured = true;
    console.log('email_codes collection exists');
    return true;
  } catch (e) {
    var msg = e.message || String(e);
    if (msg.indexOf('ResourceNotFound') >= 0 || msg.indexOf('not exist') >= 0 || msg.indexOf('DATABASE_COLLECTION_NOT_EXIST') >= 0) {
      console.warn('email_codes collection not found, attempting to create...');
      collectionExists = false;
    } else {
      // 其他错误（权限等），假定存在
      console.warn('ensureCollection query error (non-fatal):', msg);
      collectionEnsured = true;
      collectionExists = true;
      return true;
    }
  }

  // 2. 集合不存在，尝试插入一条初始化文档来创建集合
  try {
    var result = await db.collection(COLLECTION).add({
      email: '_init_',
      code: '000000',
      ip: '0.0.0.0',
      createdAt: 0,
      attempts: 0
    });
    console.log('email_codes collection created via insert, id:', result.id);
    // 清理初始化文档
    try {
      await db.collection(COLLECTION).doc(result.id).remove();
    } catch (cleanupErr) {
      console.warn('init doc cleanup failed (non-fatal):', cleanupErr.message);
    }
    collectionExists = true;
    collectionEnsured = true;
    return true;
  } catch (createErr) {
    console.error('Failed to create email_codes collection:', createErr.message || createErr);
    collectionEnsured = true;  // 不再重试
    collectionExists = false;
    return false;
  }
}

// ================================================================
//  生成随机验证码
// ================================================================

function generateCode() {
  var code = '';
  // 使用 crypto.randomInt 替代 Math.random()，提供密码学安全的随机数
  var crypto = require('crypto');
  for (var i = 0; i < CODE_LENGTH; i++) {
    code += crypto.randomInt(0, 10);
  }
  return code;
}

// ================================================================
//  获取客户端 IP
// ================================================================

function getClientIP(context) {
  if (context && context.httpContext && context.httpContext.clientIp) {
    return context.httpContext.clientIp;
  }
  if (context && context.ip) {
    return context.ip;
  }
  return '0.0.0.0';
}

// ================================================================
//  发送验证码邮件
// ================================================================

async function sendVerifyEmail(to, code) {
  var mailOptions = {
    from: '"' + EMAIL_CONFIG.fromName + '" <' + EMAIL_CONFIG.user + '>',
    to: to,
    subject: '您的验证码 - 春晓画室',
    html: [
      '<div style="max-width:480px; margin:0 auto; padding:30px; font-family:\'PingFang SC\',\'Microsoft YaHei\',sans-serif; background:#fdfaf5; border-radius:12px;">',
      '<h2 style="color:#5d4037; text-align:center; margin-bottom:8px;">🌸 春晓画室</h2>',
      '<p style="text-align:center; color:#999; font-size:14px;">家长端验证码</p>',
      '<div style="background:#fff; border-radius:10px; padding:30px; margin:20px 0; text-align:center; box-shadow:0 2px 12px rgba(0,0,0,0.05);">',
      '<p style="color:#888; font-size:14px; margin:0 0 10px;">您的验证码是</p>',
      '<div style="font-size:36px; font-weight:bold; color:#5d4037; letter-spacing:8px; padding:8px; background:#fdfaf5; border-radius:8px; display:inline-block;">',
      code,
      '</div>',
      '<p style="color:#999; font-size:12px; margin-top:14px;">' + CODE_EXPIRY_MINUTES + ' 分钟内有效，请勿泄露</p>',
      '</div>',
      '<p style="color:#bbb; font-size:12px; text-align:center;">如果不是您本人操作，请忽略此邮件。</p>',
      '</div>'
    ].join('')
  };

  return getTransporter().sendMail(mailOptions);
}

// ================================================================
//  主入口
// ================================================================

exports.main = async function (event, context) {
  // 兼容 HTTP 函数模式：body 是 JSON 字符串，需要解析
  var body = event;
  if (typeof event.body === 'string') {
    try { body = JSON.parse(event.body); } catch (_) { body = event; }
  }

  var action = body.action;
  var email = (body.email || '').trim().toLowerCase();

  if (!email && action !== 'ping') {
    return wrapResponse({ success: false, message: '邮箱不能为空' });
  }

  try {
    if (action === 'ping') {
      return wrapResponse({ success: true, message: 'verify-code ok', config: {
        hasEmailUser: !!EMAIL_CONFIG.user,
        hasEmailPass: !!EMAIL_CONFIG.pass
      }});
    }

    if (action === 'send') {
      return wrapResponse(await handleSend(email, context));
    }

    if (action === 'verify') {
      var code = (body.code || '').trim();
      if (!code) return wrapResponse({ success: false, message: '验证码不能为空' });
      return wrapResponse(await handleVerify(email, code, context));
    }

    return wrapResponse({ success: false, message: 'unknown action: ' + action });
  } catch (e) {
    console.error('verify-code error:', e);
    return wrapResponse({ success: false, message: e.message || '服务异常' });
  }
};

// HTTP 模式 / Event 模式统一响应格式
function wrapResponse(data) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
  };
}

// ================================================================
//  发送验证码
// ================================================================

async function handleSend(email, context) {
  var now = Date.now();
  var ip = getClientIP(context);

  // --- 检查邮箱格式 ---
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return { success: false, message: '邮箱格式不正确' };
  }

  // --- 检查配置 ---
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.error('SMTP config missing: EMAIL_USER=' + !!EMAIL_CONFIG.user + ', EMAIL_PASS=' + !!EMAIL_CONFIG.pass);
    return { success: false, message: '邮件服务未配置，请联系管理员' };
  }

  // --- 0. 确保 email_codes 集合存在 ---
  var collReady = await ensureCollection();
  if (!collReady) {
    console.error('email_codes collection unavailable — cannot store or verify codes');
  }

  // --- 1. 同一邮箱 60 秒限制 ---
  if (collReady) {
    try {
      var recentQuery = await db.collection(COLLECTION)
        .where({ email: email })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (recentQuery.data && recentQuery.data.length > 0) {
        var last = recentQuery.data[0];
        if (now - last.createdAt < 60000) {
          var waitSec = Math.ceil((60000 - (now - last.createdAt)) / 1000);
          return { success: false, message: '请 ' + waitSec + ' 秒后再发送' };
        }
      }
    } catch (e) {
      console.warn('rate limit check failed (non-fatal):', e.message);
    }
  }

  // --- 2. 同一 IP 每小时 5 次限制 ---
  if (collReady) {
    try {
      var oneHourAgo = now - 3600000;
      var ipQuery = await db.collection(COLLECTION)
        .where({ ip: ip })
        .get();
      if (ipQuery.data) {
        var ipCount = ipQuery.data.filter(function (r) { return r.createdAt > oneHourAgo; }).length;
        if (ipCount >= 5) {
          return { success: false, message: '发送过于频繁，请1小时后再试' };
        }
      }
    } catch (e) {
      console.warn('IP rate check failed (non-fatal):', e.message);
    }
  }

  // --- 3. 生成验证码 ---
  var code = generateCode();

  // --- 4. 发送邮件 ---
  try {
    await sendVerifyEmail(email, code);
    console.log('Verification email sent to', email);
  } catch (e) {
    // 输出完整错误信息，方便定位问题
    console.error('Email send error:', e.message || e);
    console.error('Error stack:', e.stack || 'no stack');
    if (e.code) console.error('Error code:', e.code);
    if (e.command) console.error('SMTP command:', e.command);
    // 返回真实错误，帮助用户/管理员判断原因
    var errMsg = e.message || String(e);
    // 常见错误翻译
    if (errMsg.indexOf('Invalid login') >= 0 || errMsg.indexOf('535') >= 0) {
      errMsg = '邮箱授权码无效或已过期，请联系管理员更新';
    } else if (errMsg.indexOf('connect') >= 0 || errMsg.indexOf('ETIMEDOUT') >= 0 || errMsg.indexOf('ENOTFOUND') >= 0) {
      errMsg = '邮件服务器连接失败，请稍后再试';
    } else if (errMsg.indexOf('rate') >= 0 || errMsg.indexOf('frequency') >= 0 || errMsg.indexOf('limit') >= 0) {
      errMsg = '发送过于频繁，请稍后再试';
    }
    return { success: false, message: errMsg };
  }

  // --- 5. 存储验证码 ---
  if (collReady) {
    try {
      await db.collection(COLLECTION).add({
        email: email,
        code: code,
        ip: ip,
        createdAt: now,
        attempts: 0
      });
    } catch (e) {
      console.error('code storage failed:', e.message);
      return { success: false, message: '验证码存储失败，请重试' };
    }
  } else {
    console.error('code NOT stored — email_codes collection unavailable');
    return { success: false, message: '验证码服务异常，请联系管理员' };
  }

  return { success: true, message: '验证码已发送，请检查邮箱' };
}

// ================================================================
//  校验验证码
// ================================================================

async function handleVerify(email, code, context) {
  var now = Date.now();

  // --- 0. 确保集合存在 ---
  await ensureCollection();

  // --- 1. 查找验证码记录 ---
  var query;
  try {
    query = await db.collection(COLLECTION)
      .where({ email: email })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
  } catch (e) {
    return { success: false, message: '查询验证码失败' };
  }

  if (!query.data || query.data.length === 0) {
    return { success: false, message: '请先获取验证码' };
  }

  var record = query.data[0];

  // --- 2. 检查过期 ---
  if (now - record.createdAt > CODE_EXPIRY_MINUTES * 60000) {
    return { success: false, message: '验证码已过期，请重新获取' };
  }

  // --- 3. 检查尝试次数 ---
  if (record.attempts >= 3) {
    return { success: false, message: '验证码已失效，请重新获取' };
  }

  // --- 4. 更新尝试次数 ---
  var newAttempts = record.attempts + 1;
  try {
    await db.collection(COLLECTION).doc(record._id).update({ attempts: newAttempts });
  } catch (e) {
    console.warn('update attempts failed (non-fatal):', e.message);
  }

  // --- 5. 比对验证码 ---
  if (record.code !== code) {
    var remaining = 3 - newAttempts;
    if (remaining <= 0) {
      return { success: false, message: '验证码已失效，请重新获取' };
    }
    return { success: false, message: '验证码错误，还剩 ' + remaining + ' 次机会' };
  }

  // --- 6. 验证成功，删除已用验证码 ---
  try {
    await db.collection(COLLECTION).doc(record._id).remove();
  } catch (e) {
    console.warn('remove used code failed (non-fatal):', e.message);
  }

  return { success: true, message: '验证通过' };
}

// ================================================================
//  HTTP 服务器模式（Web 函数部署时自动启用）
//  前端直接用 fetch() 调用，不依赖 CloudBase SDK 登录态
// ================================================================

var PORT = process.env.PORT || process.env.SCF_PORT || 8080;

// 仅在直接运行时启动 HTTP 服务器（非 Event 函数 require 模式）
// CloudBase Web 函数通过 scf_bootstrap 直接运行此文件
var isMainModule = require.main === module;

if (isMainModule) {
  var http = require('http');

  var server = http.createServer(async function (req, res) {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    // 仅处理 POST
    if (req.method !== 'POST') {
      res.writeHead(200, corsHeaders());
      res.end(JSON.stringify({ success: false, message: '请使用 POST 请求' }));
      return;
    }

    // 收集请求体
    var chunks = [];
    req.on('data', function (chunk) { chunks.push(chunk); });
    req.on('end', async function () {
      var raw = Buffer.concat(chunks).toString('utf-8');
      var body = {};
      try { body = JSON.parse(raw); } catch (_) { /* 忽略解析错误 */ }

      console.log('HTTP request:', body.action, body.email || '');

      // 构造兼容 event 格式的上下文
      var event = body;
      var context = {
        httpContext: { clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0' }
      };

      var result = await exports.main(event, context);

      // 从 wrapResponse 格式中提取 body
      if (result && result.statusCode) {
        res.writeHead(result.statusCode, result.headers || corsHeaders());
        res.end(result.body || '{}');
      } else {
        res.writeHead(200, corsHeaders());
        res.end(JSON.stringify(result));
      }
    });
  });

  server.listen(PORT, '0.0.0.0', function () {
    console.log('verify-code HTTP server listening on port', PORT);
  });
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
}
