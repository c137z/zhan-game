// ============================================================
//  斩 — BGM 压缩工具
//  用法: node tools/compress-bgm.js
//  依赖: ffmpeg（首次运行前安装：winget install ffmpeg  或
//        下载 https://ffmpeg.org/download.html）
//
//  将 code/assets/bgm/*.mp3 压缩为 ~64kbps 单声道，
//  输出到 code-mobile/assets/bgm/
// ============================================================

var fs = require('fs');
var path = require('path');
var execSync = require('child_process').execSync;

var SRC = path.join(__dirname, '..', 'code', 'assets', 'bgm');
var DST = path.join(__dirname, '..', 'code-mobile', 'assets', 'bgm');
var FFMPEG = path.join(__dirname, 'ffmpeg', 'ffmpeg-8.1.1-essentials_build', 'bin', 'ffmpeg.exe');

// 压缩参数：64kbps 单声道，44.1kHz（手机游戏足够）
var BITRATE = '64k';
var OPTS = ['-ac', '1', '-ar', '44100', '-b:a', BITRATE, '-map_metadata', '-1'];

// 检查 ffmpeg
if (!fs.existsSync(FFMPEG)) {
  console.error('未找到 ffmpeg: ' + FFMPEG);
  process.exit(1);
}

var files = fs.readdirSync(SRC).filter(function(f) { return f.endsWith('.mp3'); });

if (!files.length) { console.log('没有 MP3 文件'); process.exit(0); }

if (!fs.existsSync(DST)) fs.mkdirSync(DST, { recursive: true });

files.forEach(function(f) {
  var src = path.join(SRC, f);
  var dst = path.join(DST, f);
  var srcSize = (fs.statSync(src).size / 1024 / 1024).toFixed(1);
  console.log('压缩: ' + f + ' (' + srcSize + 'MB) ...');
  execSync('"' + FFMPEG + '" -i "' + src + '" ' + OPTS.join(' ') + ' "' + dst + '" -y', { stdio: 'inherit' });
  var dstSize = (fs.statSync(dst).size / 1024 / 1024).toFixed(2);
  console.log('  -> ' + dstSize + 'MB');
});

console.log('\n完成。压缩后文件在 code-mobile/assets/bgm/');
