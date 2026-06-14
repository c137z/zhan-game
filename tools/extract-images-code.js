// ============================================================
//  斩 — 从 code/index.html 提取 base64 图片并替换为外部引用
//  用法: node tools/extract-images-code.js
//  输出: code/assets/img/ + 原地修改 code/index.html
// ============================================================

var fs = require('fs');
var path = require('path');

var SRC = path.join(__dirname, '..', 'code', 'index.html');
var DST_DIR = path.join(__dirname, '..', 'code', 'assets', 'img');

if (!fs.existsSync(DST_DIR)) fs.mkdirSync(DST_DIR, { recursive: true });

var html = fs.readFileSync(SRC, 'utf-8');
var re = /url\(data:image\/([^;]+);base64,([^\)]+)\)/g;
var seen = {};
var idx = 0;
var count = 0;
var match;

html = html.replace(re, function(full, ext, b64) {
  if (seen[b64]) return 'url(assets/img/' + seen[b64] + ')';

  var fext = ext === 'jpeg' ? 'jpg' : ext;
  var filename = 'img_' + pad(idx, 2) + '.' + fext;
  idx++;
  seen[b64] = filename;

  var data = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(DST_DIR, filename), data);
  console.log(filename + ' (' + (data.length / 1024).toFixed(1) + 'KB)');
  count++;

  return 'url(assets/img/' + filename + ')';
});

fs.writeFileSync(SRC, html, 'utf-8');
var size = (fs.statSync(SRC).size / 1024 / 1024).toFixed(2);
console.log('\n替换了 ' + count + ' 张 base64 → code/assets/img/');
console.log('code/index.html 现在: ' + size + 'MB');

function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
