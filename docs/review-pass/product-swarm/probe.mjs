// Run from repository root after the integrator pins @snaha/swarm-id0.4.1:
// node docs/review-pass/product-swarm/probe.mjs
// Browser import and unauthenticated initialization only. No connect or uploads.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('@playwright/test');
const bundle = await readFile(require.resolve('@snaha/swarm-id'));
const server = createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/sdk.js' ? 'text/javascript' : 'text/html');
  res.end(req.url === '/sdk.js' ? bundle : '<!doctype html><title>Read-only SDK probe</title>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(async () => {
    const { SwarmIdClient } = await import('/sdk.js');
    const methods = ['initialize', 'connect', 'disconnect', 'uploadData', 'downloadData',
      'deriveAppSecret', 'actUploadData', 'actDownloadData', 'actAddGrantees',
      'actRevokeGrantees', 'actGetGrantees'];
    const client = new SwarmIdClient({ iframeOrigin: 'https://swarm-id.snaha.net', metadata: { name: 'Review Pass read-only probe' } });
    let initialized;
    let timer;
    try {
      await Promise.race([client.initialize(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('20 second deadline')), 20_000);
      })]);
      initialized = { ok: true, connected: !!client.connectionInfo?.identity,
        canUpload: client.connectionInfo?.canUpload, uploadMode: client.connectionInfo?.uploadMode };
    } catch (error) {
      initialized = { ok: false, name: error.name, message: error.message };
    } finally { clearTimeout(timer); client.destroy(); }
    return { browserImport: true,
      methods: Object.fromEntries(methods.map(method => [method, typeof SwarmIdClient.prototype[method]])), initialized };
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); server.close(); }
