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
//  生成随机验证码
// ================================================================

function generateCode() {
  var code = '';
  for (var i = 0; i < CODE_LENGTH; i++) {
    code += Math.floor(Math.random() * 10);
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
  var action = event.action;
  var email = (event.email || '').trim().toLowerCase();

  if (!email && action !== 'ping') {
    return { success: false, message: '邮箱不能为空' };
  }

  try {
    if (action === 'ping') {
      return { success: true, message: 'verify-code ok', config: {
        hasEmailUser: !!EMAIL_CONFIG.user,
        hasEmailPass: !!EMAIL_CONFIG.pass
      }};
    }

    if (action === 'send') {
      return await handleSend(email, context);
    }

    if (action === 'verify') {
      var code = (event.code || '').trim();
      if (!code) return { success: false, message: '验证码不能为空' };
      return await handleVerify(email, code, context);
    }

    return { success: false, message: 'unknown action: ' + action };
  } catch (e) {
    console.error('verify-code error:', e);
    return { success: false, message: e.message || '服务异常' };
  }
};

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
    return { success: false, message: '邮件服务未配置，请联系管理员' };
  }

  // --- 1. 同一邮箱 60 秒限制 ---
  try {
    var recentQuery = await db.collection('email_codes')
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

  // --- 2. 同一 IP 每小时 5 次限制 ---
  try {
    var oneHourAgo = now - 3600000;
    var ipQuery = await db.collection('email_codes')
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

  // --- 3. 生成验证码 ---
  var code = generateCode();

  // --- 4. 发送邮件 ---
  try {
    await sendVerifyEmail(email, code);
    console.log('Verification email sent to', email);
  } catch (e) {
    console.error('Email send error:', e.message);
    return { success: false, message: '邮件发送失败，请稍后再试' };
  }

  // --- 5. 存储验证码 ---
  try {
    await db.collection('email_codes').add({
      email: email,
      code: code,
      ip: ip,
      createdAt: now,
      attempts: 0
    });
  } catch (e) {
    console.warn('code storage failed (non-fatal):', e.message);
  }

  return { success: true, message: '验证码已发送，请检查邮箱' };
}

// ================================================================
//  校验验证码
// ================================================================

async function handleVerify(email, code, context) {
  var now = Date.now();

  // --- 1. 查找验证码记录 ---
  var query;
  try {
    query = await db.collection('email_codes')
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
    await db.collection('email_codes').doc(record._id).update({ attempts: newAttempts });
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
    await db.collection('email_codes').doc(record._id).remove();
  } catch (e) {
    console.warn('remove used code failed (non-fatal):', e.message);
  }

  return { success: true, message: '验证通过' };
}
