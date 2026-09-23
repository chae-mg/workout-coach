import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL(process.env.WORKOUT_PREVIEW === 'gas' ? '../dist/preview/' : '../apps/web/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT는 0~65535 범위의 정수여야 합니다.');
  process.exit(1);
}
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    // Serve only browser assets. Repository metadata and tests are not public routes.
    if (!(relative === 'index.html' || /^(src|public)\//.test(relative))) {
      response.writeHead(404).end('Not found');
      return;
    }
    const target = resolve(root, relative);
    if (!target.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const type = types[extname(target)];
    if (!type) { response.writeHead(404).end('Not found'); return; }
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`포트 ${port}를 이미 사용 중입니다. 실행 중인 앱은 http://${host}:${port}에서 확인하거나 PORT를 다른 값으로 지정해 주세요.`);
  } else {
    console.error(`로컬 서버를 시작하지 못했습니다: ${error.message}`);
  }
  process.exitCode = 1;
});
server.listen(port, host, () => {
  const actualPort = server.address().port;
  console.log(`Workout Coach: http://${host}:${actualPort}`);
  if (process.send) process.send({ port: actualPort });
});
