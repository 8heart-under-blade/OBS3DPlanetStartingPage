// Isolated browser-test server, NOT a production/local-edition launcher.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { NOTICE_FILES, repoRoot } from './lib.mjs';
import { verifySite } from './site-lib.mjs';
const root = repoRoot(), portText = process.env.OBS3DSP_BROWSER_PORT || '4173';
if (!/^[1-9]\d{3,4}$/.test(portText) || Number(portText) > 65535) throw new Error('Invalid browser-test port');
const port = Number(portText), reference = JSON.parse(readFileSync(join(root, 'tests/browser/reference.json'), 'utf8'));
if (reference.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(reference.commit)) throw new Error('Invalid browser reference commit');
const scratch = mkdtempSync(join(tmpdir(), 'obs3d-browser-reference-'));
const gitFile = path => execFileSync('git', ['show', `${reference.commit}:${path}`], {cwd: root, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
let server;
try {
  const baseline = JSON.parse(gitFile('docs/source-baseline.json').toString('utf8'));
  const records = new Map(baseline.files.map(file => [file.path, file]));
  for (const path of [...records.keys(), 'LICENSE', ...NOTICE_FILES]) {
    if (!path.split('/').every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..')) throw new Error('Invalid reference path');
    const bytes = gitFile(path), record = records.get(path);
    if (record && (record.bytes !== bytes.length || record.sha256 !== createHash('sha256').update(bytes).digest('hex'))) throw new Error('Committed reference baseline mismatch');
    const target = join(scratch, path); mkdirSync(dirname(target), {recursive: true}); writeFileSync(target, bytes);
  }
  execFileSync(process.execPath, [join(root, 'scripts/site.mjs'), 'build'], {cwd: root, stdio: 'inherit'});
  const verified = verifySite(join(root, 'site'));
  const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8'};
  server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const host = req.headers.host;
    if (![ `127.0.0.1:${port}`, `hosted.obs.test:${port}` ].includes(host)) { res.writeHead(403); res.end(); return; }
    try {
      const url = new URL(req.url, `http://${host}`);
      if (url.origin !== `http://${host}`) { res.writeHead(403); res.end(); return; }
      if (url.pathname === '/health') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({candidate: verified.current, reference: reference.commit})); return;
      }
      let base, relative;
      if (url.pathname.startsWith('/project/')) { base = join(root, 'site'); relative = decodeURIComponent(url.pathname.slice('/project/'.length)); }
      else if (url.pathname.startsWith('/reference/')) { base = scratch; relative = decodeURIComponent(url.pathname.slice('/reference/'.length)); }
      else { res.writeHead(404); res.end(); return; }
      if (!relative || relative.endsWith('/')) relative += 'index.html';
      const file = resolve(base, relative), realBase = realpathSync(base);
      if (!file.startsWith(resolve(base) + sep) || !existsSync(file) || !statSync(file).isFile() || !realpathSync(file).startsWith(realBase + sep)) { res.writeHead(404); res.end(); return; }
      const bytes = readFileSync(file);
      res.setHeader('Content-Type', mime[extname(file)] || 'text/plain; charset=utf-8');
      res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  const stop = () => {
    server.closeAllConnections();
    server.close(() => { rmSync(scratch, {recursive: true, force: true}); process.exit(0); });
  };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  server.once('error', () => { rmSync(scratch, {recursive: true, force: true}); console.error('Browser fixture could not bind its isolated loopback port.'); process.exit(1); });
  server.listen(port, '127.0.0.1', () => console.log(`browser fixture: http://127.0.0.1:${port}/project/editor.html; reference ${reference.commit}`));
} catch {
  rmSync(scratch, {recursive: true, force: true});
  console.error('Browser fixture failed: check the committed reference, source gates and candidate integrity. Details withheld.');
  process.exitCode = 1;
}
