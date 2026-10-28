import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MEDIA_DIR = path.join(ROOT_DIR, 'media');

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PORT_ATTEMPTS = 10;
let currentPort = DEFAULT_PORT;
let portAttempts = 0;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4'
};

function isSafeChildPath(parentDir, targetPath) {
  const rel = path.relative(parentDir, targetPath);
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(parsedUrl.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('400 Bad Request');
    return;
  }

  // Security: reject directory traversal and hidden path segments
  const segments = pathname.split('/').filter(Boolean);
  if (pathname.includes('..') || segments.some(s => s.startsWith('.'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  // Routing restricted to public UI and data directories
  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, path.join(SRC_DIR, 'index.html'));
  } else if (pathname.startsWith('/data/')) {
    const targetPath = path.resolve(ROOT_DIR, pathname.slice(1));
    if (isSafeChildPath(DATA_DIR, targetPath)) {
      serveFile(res, targetPath);
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
    }
  } else if (pathname.startsWith('/media/')) {
    const targetPath = path.resolve(ROOT_DIR, pathname.slice(1));
    if (isSafeChildPath(MEDIA_DIR, targetPath)) {
      serveFile(res, targetPath);
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
    }
  } else if (pathname.startsWith('/src/')) {
    const targetPath = path.resolve(SRC_DIR, pathname.slice(5));
    if (isSafeChildPath(SRC_DIR, targetPath)) {
      serveFile(res, targetPath);
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
    }
  } else {
    // Check if the requested file exists in src/
    const targetPath = path.resolve(SRC_DIR, pathname.slice(1));
    if (isSafeChildPath(SRC_DIR, targetPath) && fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      serveFile(res, targetPath);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  }
});

function listen(port) {
  server.listen(port, HOST, () => {
    console.log(`\n========================================`);
    console.log(` Strata Learning Graph UI`);
    console.log(` Local URL: http://${HOST}:${port}`);
    console.log(`========================================\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    portAttempts++;
    if (portAttempts >= MAX_PORT_ATTEMPTS) {
      console.error(`Unable to bind port after ${MAX_PORT_ATTEMPTS} attempts.`);
      process.exit(1);
    }
    const prevPort = currentPort;
    currentPort = prevPort + 1;
    console.log(`Port ${prevPort} in use, attempting ${currentPort}...`);
    listen(currentPort);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

listen(currentPort);
