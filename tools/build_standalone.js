// build_standalone.js — 从源文件构建 zhan_standalone.html
// 内联 data.js + core.js + ui.js 到 index.html
var fs = require('fs');
var path = require('path');
var dir = path.resolve(__dirname, '..', 'code');

var dataJS = fs.readFileSync(dir + '/data.js', 'utf8');
var coreJS = fs.readFileSync(dir + '/core.js', 'utf8');
var uiJS = fs.readFileSync(dir + '/ui.js', 'utf8');
var html = fs.readFileSync(dir + '/index.html', 'utf8');

html = html.replace('<script src="data.js"></script>', '<script>\n' + dataJS + '\n</script>');
html = html.replace('<script src="core.js"></script>', '<script>\n' + coreJS + '\n</script>');
html = html.replace('<script src="ui.js"></script>', '<script>\n' + uiJS + '\n</script>');

// 标题改为斩 v14
html = html.replace('<title>斩 v10.0</title>', '<title>斩 v14</title>');

fs.writeFileSync(dir + '/zhan_standalone.html', html, 'utf8');
console.log('✅ zhan_standalone.html (' + html.length + ' bytes)');
