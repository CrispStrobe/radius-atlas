// SPDX-License-Identifier: MIT
// Local development only. Static hosts serve dist/ directly; they do not run this server.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const built = process.argv[2] === 'dist';
const base = built ? resolve(root, 'dist') : root;
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.md':'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.includes('\0') || pathname.split('/').some(segment => segment.startsWith('.'))) { res.writeHead(403).end(); return; }
    if (pathname === '/') pathname = '/index.html';
    // Explicit allowlist: never expose tooling or unexpected repository files.
    if (!/^\/(?:src\/|data\/|docs\/|index\.html$|config\.json$|favicon\.svg$|build-info\.json$|LICENSE(?:-DATA\.md)?$|THIRD_PARTY_NOTICES\.md$)/.test(pathname)) { res.writeHead(404).end('Not found'); return; }
    let file = resolve(base, '.' + pathname);
    if (!built && /^\/(data\/|config\.json|favicon\.svg)/.test(pathname)) file = resolve(root, 'public', '.' + pathname);
    if (!file.startsWith(base + sep)) { res.writeHead(403).end(); return; }
    if (!(await stat(file)).isFile()) throw new Error('Not a file');
    const bytes = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'text/plain; charset=utf-8',
      'Referrer-Policy':'strict-origin-when-cross-origin', 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch { res.writeHead(404).end('Not found'); }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, '127.0.0.1', () => console.log(`Radius Atlas: http://localhost:${port} (${built ? 'dist' : 'source'})`));
