import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const routes = {
  '/api/assessments': './api/assessments.mjs',
  '/api/classes': './api/classes.mjs',
  '/api/dashboard': './api/dashboard.mjs',
  '/api/imports': './api/imports.mjs',
  '/api/lookups': './api/lookups.mjs',
  '/api/predictions': './api/predictions.mjs',
  '/api/reports': './api/reports.mjs',
  '/api/settings': './api/settings.mjs',
  '/api/students': './api/students.mjs',
  '/api/subjects': './api/subjects.mjs',
  '/api/users': './api/users.mjs',
};
const mimeTypes = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function queryObject(searchParams) {
  const result = {};
  for (const [key, value] of searchParams) result[key] = result[key] === undefined ? value : [].concat(result[key], value);
  return result;
}

async function handleApi(req, res, pathname, searchParams) {
  if (pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'student_performance' }));
    return;
  }
  let modulePath = routes[pathname];
  const authMatch = pathname.match(/^\/api\/auth\/([^/]+)$/);
  const studentMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
  if (authMatch) {
    modulePath = './api/auth/[action].mjs';
    searchParams.set('action', decodeURIComponent(authMatch[1]));
  } else if (studentMatch) {
    modulePath = './api/students/[id].mjs';
    searchParams.set('id', decodeURIComponent(studentMatch[1]));
  }
  if (!modulePath) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'API endpoint not found.' }));
    return;
  }
  try {
    const { default: handler } = await import(new URL(modulePath, import.meta.url));
    req.query = queryObject(searchParams);
    await handler(req, res);
  } catch (error) {
    console.error('api_route_error', error.status || error.code || 500);
    if (!res.headersSent) res.writeHead(error.status || 500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'The API is not ready. Configure MongoDB and session secrets in Render environment variables.' }));
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('ok');
    return;
  }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname, url.searchParams);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = resolve(root, `.${requested}`);
  const pathFromRoot = relative(resolve(root), filePath);
  if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    if (url.pathname !== '/') {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Unable to load the app.');
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`student_performance listening on ${port}`));
