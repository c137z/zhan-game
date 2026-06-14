// ============================================================
//  斩 — 手机端单文件打包（全内联）
//  用法: node tools/bundle-mobile.js
//  输入: code-mobile/zhan-mobile.html + assets/img/ + assets/bgm/
//  输出: code-mobile/zhan.html（单文件，图片+BGM 全部 base64 内嵌）
// ============================================================

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', 'code-mobile');
var SRC = path.join(ROOT, 'zhan-mobile.html');
var DST = path.join(ROOT, 'zhan.html');

var html = fs.readFileSync(SRC, 'utf-8');

// 1. 内联图片: url(assets/img/img_XX.jpg) → url(data:image/jpeg;base64,...)
var imgDir = path.join(ROOT, 'assets', 'img');
var imgRe = /url\(assets\/img\/(img_\d+\.jpg)\)/g;

html = html.replace(imgRe, function(full, filename) {
  var file = path.join(imgDir, filename);
  if (!fs.existsSync(file)) return full;
  var b64 = fs.readFileSync(file).toString('base64');
  console.log('内联图片: ' + filename + ' (' + (b64.length / 1024).toFixed(1) + 'KB b64)');
  return 'url(data:image/jpeg;base64,' + b64 + ')';
});

// 2. 内联 BGM: assets/bgm/xxx.mp3 → data:audio/mpeg;base64,...
var bgmDir = path.join(ROOT, 'assets', 'bgm');
var bgmRe = /assets\/bgm\/([^"'\s)]+\.mp3)/g;

html = html.replace(bgmRe, function(full, filename) {
  var file = path.join(bgmDir, filename);
  if (!fs.existsSync(file)) return full;
  var b64 = fs.readFileSync(file).toString('base64');
  var sizeMB = (b64.length * 0.75 / 1024 / 1024).toFixed(1);
  console.log('内联BGM: ' + filename + ' (' + sizeMB + 'MB 解码后)');
  return 'data:audio/mpeg;base64,' + b64;
});

fs.writeFileSync(DST, html, 'utf-8');
var total = (fs.statSync(DST).size / 1024 / 1024).toFixed(1);
console.log('\n✅ code-mobile/zhan.html (' + total + 'MB) — 单文件，可直接打开');
