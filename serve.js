var http=require('http'),fs=require('fs'),root='C:/Users/kyzha/.openclaw/projects/zhan/code/';
var mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
http.createServer(function(req,res){
  var fp=decodeURIComponent(req.url.replace(/\?.*/,'').replace(/^\//,''));
  var file=root+(fp||'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);res.end('404');return}
  var ext=file.slice(file.lastIndexOf('.'));
  res.setHeader('Content-Type',mime[ext]||'text/plain');
  fs.createReadStream(file).pipe(res);
}).listen(8898);
console.log('http://localhost:8898');
