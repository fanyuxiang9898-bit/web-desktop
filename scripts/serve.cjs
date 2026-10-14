const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/demo/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !/^\/(demo|dist)\//.test(pathname === '/' ? '/demo/index.html' : pathname)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, body) => { res.writeHead(err ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(err ? 'Not found' : body); });
});
server.listen(4178, '127.0.0.1', () => console.log('Web Desktop demo: http://127.0.0.1:4178'));
