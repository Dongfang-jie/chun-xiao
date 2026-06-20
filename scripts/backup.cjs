/*
  春晓画室 - CloudBase 数据自动备份脚本
  通过 CloudBase HTTP 访问服务调用 dbProxy 云函数的 backupAll action
  dbProxy 使用 @cloudbase/node-sdk admin 权限，可读取全部集合

  用法: node scripts/backup.cjs
  依赖: Node.js 18+（仅用内置模块，无需 npm install）
*/

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ========== 配置 ==========
// CloudBase HTTP 访问服务地址（与 js/app/config.js 中 dbProxyUrl 一致）
const DB_PROXY_URL = 'https://chunxiao-d8ghfaw3y0781da11-1443528450.ap-shanghai.app.tcloudbase.com/dbProxy';
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUP_AGE_DAYS = 30;
const REQUEST_TIMEOUT_MS = 30000;

// ========== 工具函数 ==========

function todayStr() {
  // 北京时间
  const bj = new Date(Date.now() + 8 * 3600000);
  return bj.toISOString().slice(0, 10);
}

function httpPost(urlString, data) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(urlString);
    var body = JSON.stringify(data);

    var opts = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf-8'),
        'X-API-Key': 'chunxiao-dbproxy-2026'
      },
      timeout: REQUEST_TIMEOUT_MS
    };

    var req = https.request(opts, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var raw = Buffer.concat(chunks).toString('utf-8');
        var status = res.statusCode;

        if (status >= 200 && status < 300) {
          try {
            var wrapper = JSON.parse(raw);
            // CloudBase HTTP 访问服务包装格式: { statusCode, headers, body: "JSON字符串" }
            if (wrapper && typeof wrapper.body === 'string') {
              resolve(JSON.parse(wrapper.body));
            } else {
              resolve(wrapper);
            }
          } catch (e) {
            reject(new Error('JSON 解析失败 (HTTP ' + status + '): ' + raw.slice(0, 200)));
          }
        } else {
          reject(new Error('HTTP ' + status + ': ' + raw.slice(0, 300)));
        }
      });
    });

    req.on('error', function (e) { reject(e); });
    req.on('timeout', function () {
      req.destroy();
      reject(new Error('请求超时 (' + (REQUEST_TIMEOUT_MS / 1000) + 's)'));
    });

    req.write(body);
    req.end();
  });
}

// ========== 主流程 ==========

async function main() {
  console.log('🌸 春晓画室 - 数据自动备份 (dbProxy/backupAll)');
  console.log('================================');
  console.log('');
  console.log('📡 调用 dbProxy 云函数 (backupAll)...');

  var result;
  try {
    result = await httpPost(DB_PROXY_URL, { action: 'backupAll' });
  } catch (e) {
    console.error('   ❌ 调用失败: ' + e.message);
    process.exit(1);
  }

  if (!result) {
    console.error('   ❌ 云函数无响应');
    process.exit(1);
  }

  // 报告部分失败（但不影响已拉取数据的保存）
  var partial = false;
  if (!result.success) {
    partial = true;
    console.log('   ⚠️ 部分集合拉取失败，将保存已获取的数据');
    if (result.failed && result.failed.length > 0) {
      result.failed.forEach(function (f) {
        console.error('      ❌ ' + f.collection + ': ' + f.error);
      });
    }
  }

  console.log('   📊 ' + result.totalItems + ' 条记录 / ' + result.totalCollections + ' 个集合');
  console.log('');

  // 防御：确保 backup 对象存在
  if (!result.backup || typeof result.backup !== 'object') {
    console.error('   ❌ 云函数返回数据格式异常，缺少 backup 字段');
    process.exit(1);
  }

  // 标记部分备份
  if (partial) {
    result.backup.partialBackup = true;
    result.backup.failedCollections = result.failed || [];
  }

  // 写入备份文件
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  var date = todayStr();
  var backupFile = path.join(BACKUP_DIR, 'data-' + date + '.json');
  var latestFile = path.join(BACKUP_DIR, 'latest.json');

  var json = JSON.stringify(result.backup, null, 2);
  fs.writeFileSync(backupFile, json, 'utf-8');
  fs.writeFileSync(latestFile, json, 'utf-8');

  var sizeKB = (Buffer.byteLength(json, 'utf-8') / 1024).toFixed(1);
  console.log('💾 备份已保存: backups/data-' + date + '.json (' + sizeKB + ' KB)');
  console.log('💾 最新备份: backups/latest.json');
  console.log('');

  if (partial) {
    console.log('⚠️ 部分备份（已保存已获取的数据），将以失败退出触发告警');
  }

  // 清理旧备份（>30天）
  var files;
  try {
    files = fs.readdirSync(BACKUP_DIR).filter(function (f) {
      return f.startsWith('data-') && f.endsWith('.json');
    });
  } catch (e) { files = []; }

  var cutoff = Date.now() - MAX_BACKUP_AGE_DAYS * 86400000;
  var cleaned = 0;

  for (var i = 0; i < files.length; i++) {
    var fp = path.join(BACKUP_DIR, files[i]);
    var stat;
    try { stat = fs.statSync(fp); } catch (e) { continue; }
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(fp);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log('🧹 清理了 ' + cleaned + ' 个过期备份（>' + MAX_BACKUP_AGE_DAYS + '天）');
  }

  console.log('');
  if (partial) {
    console.log('⚠️ 部分备份完成（退出码 1）');
    process.exit(1);
  }
  console.log('✅ 备份完成');
}

main().catch(function (e) {
  console.error('❌ 备份脚本异常: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
