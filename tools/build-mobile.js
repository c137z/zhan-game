// ============================================================
//  斩 — 手机端单文件构建
//  用法: node tools/build-mobile.js
//  前提: 先跑 tools/extract-images.js + tools/compress-bgm.js
//
//  从 code/index.html 生成 code-mobile/zhan-mobile.html：
//    - base64 图片 → 外置文件引用
//    - BGM → 压缩版外部文件
//    - 其他不变
//  输出: code-mobile/zhan-mobile.html（使用时连同 assets/ 一起部署）
// ============================================================

var fs = require('fs');
var path = require('path');

var SRC = path.join(__dirname, '..', 'code', 'index.html');
var DST = path.join(__dirname, '..', 'code-mobile', 'zhan-mobile.html');
var MAPPING = path.join(__dirname, '..', 'code-mobile', 'assets', 'img', '_mapping.json');

var html = fs.readFileSync(SRC, 'utf-8');

// 1. 替换 base64 图片为外置文件
var mapping = {};
try { mapping = JSON.parse(fs.readFileSync(MAPPING, 'utf-8')); } catch(e) {}

if (Object.keys(mapping).length) {
  var re = /url\(data:image\/[^;]+;base64,([^\)]+)\)/g;
  html = html.replace(re, function(match, b64) {
    var filename = mapping[b64];
    if (filename) return 'url(assets/img/' + filename + ')';
    return match; // 没找到映射的保留原样
  });
  var replaced = Object.keys(mapping).length;
  console.log('图片替换: ' + replaced + ' 张 base64 → assets/img/');
}

// 2. 替换 BGM 路径为压缩版
html = html.replace(/assets\/bgm\//g, 'assets/bgm/');

// 3. 写入
fs.writeFileSync(DST, html, 'utf-8');
var size = (fs.statSync(DST).size / 1024 / 1024).toFixed(2);
console.log('构建完成: code-mobile/zhan-mobile.html (' + size + 'MB)');
console.log('部署时连同 code-mobile/assets/ 目录一起拷贝');
