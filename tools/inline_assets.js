const fs = require('fs');
const path = require('path');

const htmlPath = 'C:/Users/HP/zhan-game/code-mobile/zhan.html';
const imgDir = 'C:/Users/HP/zhan-game/code/assets/img/';
const bgmDir = 'C:/Users/HP/zhan-game/code/assets/bgm_small/';

let html = fs.readFileSync(htmlPath, 'utf8');

const images = [
  { file: 'img_00.jpg' }, { file: 'img_01.jpg' }, { file: 'img_02.jpg' },
  { file: 'img_03.jpg' }, { file: 'img_04.jpg' }, { file: 'img_05.jpg' },
  { file: 'img_06.jpg' }, { file: 'img_07.jpg' }, { file: 'img_08.jpg' },
  { file: 'img_09.jpg' },
];

const bgms = [
  { file: '猫猫冒险.mp3', key: 'adventure' },
  { file: '猫猫迷宫.mp3', key: 'maze' },
  { file: '猫王塔.mp3', key: 'tower' },
];

console.log('Inlining card images...');
for (const img of images) {
  const data = fs.readFileSync(path.join(imgDir, img.file));
  const b64 = data.toString('base64');
  const dataUri = 'url(data:image/jpeg;base64,' + b64 + ')';
  const pattern = 'url(assets/img/' + img.file + ')';
  const count = html.split(pattern).length - 1;
  html = html.split(pattern).join(dataUri);
  console.log('  OK: ' + img.file + ' (' + (data.length/1024).toFixed(0) + 'KB) x' + count);
}

console.log('Inlining BGM (compressed)...');
for (const bgm of bgms) {
  const data = fs.readFileSync(path.join(bgmDir, bgm.file));
  const b64 = data.toString('base64');
  const dataUri = 'data:audio/mpeg;base64,' + b64;
  const pattern = "'assets/bgm/" + bgm.file + "'";
  const count = html.split(pattern).length - 1;
  html = html.split(pattern).join("'" + dataUri + "'");
  console.log('  OK: ' + bgm.file + ' (' + (data.length/1024).toFixed(0) + 'KB) x' + count);
}

fs.writeFileSync(htmlPath, html, 'utf8');
const sizeMB = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2);
console.log('\nDone! Final size: ' + sizeMB + 'MB');
