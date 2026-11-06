// Browser test harness (test-only, not used by the site).
// Serves the site locally, launches headless Chrome over the DevTools protocol, and replaces the
// sql.js CDN script with a stand-in that runs the same SQLite engine through this local server.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv', '.svg': 'image/svg+xml' };

const STUB = `
window.initSqlJs = async () => {
  const call = body => {
    const x = new XMLHttpRequest();
    x.open('POST', '/__sql', false);
    x.send(JSON.stringify(body));
    const r = JSON.parse(x.responseText);
    if (r.error) throw new Error(r.error);
    return r;
  };
  class Database {
    constructor() { this.id = Math.random().toString(36).slice(2); call({ id: this.id, op: 'open' }); }
    run(sql) { call({ id: this.id, op: 'run', sql }); return this; }
    prepare(sql) {
      const r = call({ id: this.id, op: 'query', sql });
      let i = -1;
      return { getColumnNames: () => r.columns, step: () => ++i < r.rows.length, get: () => r.rows[i], free() {} };
    }
    close() { call({ id: this.id, op: 'close' }); }
  }
  return { Database };
};`;

export function startServer(port = 8765) {
  const dbs = new Map();
  const server = http.createServer(async (req, res) => {
    if (req.url === '/__sql') {
      let body = '';
      for await (const c of req) body += c;
      const { id, op, sql } = JSON.parse(body);
      let out = {};
      try {
        if (op === 'open') dbs.set(id, new DatabaseSync(':memory:'));
        else if (op === 'close') dbs.delete(id);
        else if (op === 'run') dbs.get(id).exec(sql);
        else {
          const stmt = dbs.get(id).prepare(sql);
          stmt.setReturnArrays(true);
          out = { columns: stmt.columns().map(c => c.name), rows: stmt.all() };
        }
      } catch (e) { out = { error: e.message }; }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise(resolve => server.listen(port, () => resolve(server)));
}

export async function launchBrowser({ width = 1280, height = 900 } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn('google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' });
  let info;
  for (let i = 0; i < 50 && !info; i++) {
    await new Promise(r => setTimeout(r, 200));
    try { info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* not up yet */ }
  }
  if (!info) throw new Error('Chrome did not start');
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let nextId = 1;
  const waiting = new Map();
  const listeners = [];
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach(l => l(msg));
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => send(m, p, sessionId);
  const consoleLog = [];
  listeners.push(async msg => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Fetch.requestPaused') {
      const { requestId, request } = msg.params;
      if (request.url.includes('sql-wasm.js')) {
        await s('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/javascript' }], body: Buffer.from(STUB).toString('base64') });
      } else {
        await s('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') consoleLog.push(`EXCEPTION ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      consoleLog.push(`${msg.params.type}: ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
    }
  });
  await s('Fetch.enable', { patterns: [{ urlPattern: '*cdnjs.cloudflare.com*' }, { urlPattern: '*fonts.googleapis.com*' }, { urlPattern: '*fonts.gstatic.com*' }] });
  await s('Runtime.enable');
  await s('Page.enable');
  await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  if (width < 600) await s('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  const page = {
    consoleLog,
    send: s,
    async goto(url) {
      await s('Page.navigate', { url });
      await page.waitFor('document.readyState === "complete"');
    },
    async eval(expr) {
      const r = await s('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    async waitFor(expr, timeout = 8000) {
      const t0 = Date.now();
      for (;;) {
        try { if (await page.eval(expr)) return; } catch { /* page loading */ }
        if (Date.now() - t0 > timeout) throw new Error(`Timed out waiting for: ${expr}`);
        await new Promise(r => setTimeout(r, 100));
      }
    },
    async center(selector) {
      const r = await page.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({block:'center'}); const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
      if (!r) throw new Error(`No element: ${selector}`);
      return r;
    },
    async click(selector) {
      const { x, y } = await page.center(selector);
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await s('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
    },
    async pair(fromSel, toSel) {
      const r = await page.eval(`(() => {
        const A = document.querySelector(${JSON.stringify(fromSel)}), B = document.querySelector(${JSON.stringify(toSel)});
        if (!A || !B) return { missing: !A ? ${JSON.stringify(fromSel)} : ${JSON.stringify(toSel)} };
        const ya = A.getBoundingClientRect().top + scrollY, yb = B.getBoundingClientRect().top + scrollY;
        scrollTo(0, (ya + yb) / 2 - innerHeight / 2);
        const c = e => { const b = e.getBoundingClientRect(); return { x: b.x + Math.min(b.width / 2, 30), y: b.y + b.height / 2 }; };
        return { a: c(A), b: c(B) };
      })()`);
      if (r.missing) throw new Error(`No element: ${r.missing}`);
      return r;
    },
    async drag(fromSel, toSel, { offsetX = 0 } = {}) {
      const { a, b } = await page.pair(fromSel, toSel);
      await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x, y: a.y });
      await s('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 });
      const steps = 8;
      for (let i = 1; i <= steps; i++) {
        await s('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + (b.x + offsetX - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps, button: 'left', buttons: 1 });
      }
      await s('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x + offsetX, y: b.y, button: 'left', clickCount: 1 });
    },
    async touchDrag(fromSel, toSel) {
      const { a, b } = await page.pair(fromSel, toSel);
      await s('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
      for (let i = 1; i <= 8; i++) {
        await s('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8 }] });
      }
      await s('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
    async key(key, code = key, text) {
      await s('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text, windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Tab' ? 9 : 0 });
      await s('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key === 'Enter' ? 13 : key === 'Tab' ? 9 : 0 });
    },
    async type(text) { await s('Input.insertText', { text }); },
    async screenshot(file, fullPage = true) {
      let clip;
      if (fullPage) {
        const h = await page.eval('document.documentElement.scrollHeight');
        await s('Emulation.setDeviceMetricsOverride', { width, height: Math.min(h, 6000), deviceScaleFactor: 1, mobile: width < 600 });
      }
      const { data } = await s('Page.captureScreenshot', { format: 'png', clip });
      if (fullPage) await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
      const { writeFile } = await import('node:fs/promises');
      await writeFile(file, Buffer.from(data, 'base64'));
    },
  };
  return { page, close: () => { ws.close(); chrome.kill(); } };
}
