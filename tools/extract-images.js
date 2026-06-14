// ============================================================
//  斩 — 从 index.html 提取 base64 图片
//  用法: node tools/extract-images.js
//  输入: code/index.html
//  输出: code-mobile/assets/img/ (20 JPEG)
// ============================================================

var fs = require('fs');
var path = require('path');

var SRC = path.join(__dirname, '..', 'code', 'index.html');
var DST = path.join(__dirname, '..', 'code-mobile', 'assets', 'img');
var MAPPING = path.join(DST, '_mapping.json');

if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });

var html = fs.readFileSync(SRC, 'utf-8');
var re = /background-image:\s*url\(data:image\/([^;]+);base64,([^\)]+)\)/g;
var mapping = {};
var idx = 0;
var match;
var seen = {};

while ((match = re.exec(html)) !== null) {
  var ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  var b64 = match[2];
  // 去重：直接比 base64 字符串
  if (seen[b64]) continue;
  seen[b64] = true;

  var filename = 'img_' + pad(idx, 2) + '.' + ext;
  idx++;
  var data = Buffer.from(b64, 'base64');
  fs.writeFileSync(path.join(DST, filename), data);
  console.log(filename + ' (' + (data.length / 1024).toFixed(1) + 'KB)');

  // 存映射：base64 → filename（后面替换用）
  mapping[b64] = filename;
}

fs.writeFileSync(MAPPING, JSON.stringify(mapping, null, 2));
console.log('\n提取了 ' + idx + ' 张图片 -> code-mobile/assets/img/');
console.log('映射文件: ' + MAPPING);

function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
