// SPDX-License-Identifier: MIT
// Uses explicitly public deterministic test fixtures. Never point at real holder files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { chromium } from '@playwright/test';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const output = resolve(root, process.env.REVIEW_PASS_BROWSER_PROBE_DIR ?? '.runtime/browser-probe');
const requests = [];
const routes = new Map([
  ['/prover.wasm', [resolve(output, 'prover.wasm'), 'application/wasm']],
  ['/wasm_exec.js', [resolve(output, 'wasm_exec.js'), 'application/javascript']],
  ['/worker.js', [resolve(here, 'worker.js'), 'application/javascript']],
  ...['circuit.r1cs', 'proving.key', 'verifying.key'].map(name => [`/${name}`, [resolve(output, 'setup', name), 'application/octet-stream']]),
]);
const server = http.createServer(async (req, res) => {
  requests.push({ method: req.method, path: req.url, hasBody: Boolean(req.headers['content-length']) });
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'");
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Review Pass browser proving probe</title><h1>Actual browser WASM proving</h1>'); }
  const route = routes.get(req.url);
  if (!route) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', route[1]); res.end(await readFile(route[0]));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const load = await page.evaluate(async () => {
    window.probeWorker = new Worker('/worker.js');
    window.probeCall = (action, data) => new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => reject(Error('Worker timeout')), 180_000);
      const listener = ({ data: message }) => { if (message.id === id) { clearTimeout(timer); window.probeWorker.removeEventListener('message', listener); resolve(message.result); } };
      window.probeWorker.addEventListener('message', listener);
      window.probeWorker.postMessage({ id, action, ...data });
    });
    const start = performance.now();
    const setup = await Promise.all(['circuit.r1cs', 'proving.key', 'verifying.key'].map(async name => (await fetch(`/${name}`)).arrayBuffer()));
    const result = await window.probeCall('initialize', { setup });
    return { ...result, totalLoadMs: performance.now() - start, setupBytes: setup.map(buffer => buffer.byteLength) };
  });
  assert.equal(load.ready, true, JSON.stringify(load));
  console.log(JSON.stringify({ stage: 'loaded', ...load }));
  const fixture = async name => JSON.parse(await readFile(resolve(here, '../prover/fixtures', name), 'utf8'));
  const [holder, credential, snapshot, baseline] = await Promise.all(['public-test-holder.json', 'credential.json', 'snapshot.json', 'valid-proof.json'].map(fixture));
  const request = { holder, credential, snapshot, context: baseline.publicInputs[5], recipient: baseline.publicInputs[6], deadline: baseline.publicInputs[4], class: baseline.publicInputs[3] };
  const proof = await page.evaluate(request => window.probeCall('prove', { request }), request);
  assert.equal(proof.error, undefined, JSON.stringify(proof));
  assert.equal(proof.proofBytes, 256);
  assert.deepEqual(proof.publicInputs, baseline.publicInputs);
  console.log(JSON.stringify({ stage: 'proved', proveMs: proof.proveMs, verifyMs: proof.verifyMs, heapBytes: proof.goHeapAllocBytes }));
  const second = await page.evaluate(request => window.probeCall('prove', { request }), { ...request, context: '67890' });
  assert.equal(second.error, undefined);
  assert.notEqual(second.publicInputs[7], proof.publicInputs[7]);
  const invalid = await page.evaluate(request => window.probeCall('prove', { request }), { ...request, class: '8' });
  assert.ok(invalid.error);
  const tampered = await page.evaluate(request => window.probeCall('prove', { request }), { ...request, snapshot: { ...snapshot, root: '1' } });
  assert.ok(tampered.error);
  const malformed = await page.evaluate(request => window.probeCall('prove', { request }), { ...request, holder: { ...holder, unknown: true } });
  assert.ok(malformed.error);
  await page.evaluate(() => window.probeWorker.terminate());
  assert.ok(requests.every(item => item.method === 'GET' && !item.hasBody));
  assert.equal(consoleErrors.length, 0);
  const result = {
    status: 'ACTUAL_CHROMIUM_WASM_PROOF_VERIFIED_LOCALLY', date: new Date().toISOString(), browser: browser.version(),
    environment: 'Loopback asset server; public deterministic test fixtures; fresh single-process test setup; no wallet or public chain transaction',
    build: JSON.parse(await readFile(resolve(output, 'build.json'), 'utf8')),
    setupSha256: Object.fromEntries(await Promise.all(['circuit.r1cs', 'proving.key', 'verifying.key'].map(async name => [name, createHash('sha256').update(await readFile(resolve(output, 'setup', name))).digest('hex')]))),
    load, proof: { proofBytes: proof.proofBytes, constraints: proof.constraints, proveMs: proof.proveMs, verifyMs: proof.verifyMs, goHeapAllocBytes: proof.goHeapAllocBytes, goSysBytes: proof.goSysBytes },
    checks: ['Unchanged public inputs match native fixture', 'Second context changes nullifier', 'Wrong class rejected', 'Tampered snapshot rejected', 'Unknown private input field rejected', 'Only public static GET requests', 'No page exceptions'],
    requests, consoleErrors,
  };
  await writeFile(resolve(output, 'evidence.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(resolve(output, 'browser-proof.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { await browser.close(); server.close(); }
