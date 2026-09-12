// SPDX-License-Identifier: MIT
// Loopback only: fresh browser secrets and disposable native test issuer, no public writes.
// First run build.mjs, build native-prover, and create a fresh setup in the output directory.
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { transform } from 'esbuild';
import { chromium } from '@playwright/test';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const output = resolve(root, process.env.REVIEW_PASS_BROWSER_PROBE_DIR ?? '.runtime/browser-probe');
const moduleSource = (await transform(await readFile(resolve(here, '../pilot/holder-enrollment.ts'), 'utf8'), { loader: 'ts', format: 'esm', target: 'es2022' })).code;
const requests = [], errors = [];
const routes = new Map([
  ['/prover/prover.wasm', [resolve(output, 'prover.wasm'), 'application/wasm']],
  ['/prover/wasm_exec.js', [resolve(output, 'wasm_exec.js'), 'application/javascript']],
  ['/prover/worker.js', [resolve(here, 'worker.js'), 'application/javascript']],
  ...['circuit.r1cs', 'proving.key', 'verifying.key'].map(name => [`/prover/${name}`, [resolve(output, 'setup', name), 'application/octet-stream']]),
]);
const server = http.createServer(async (req, res) => {
  requests.push({ method: req.method, path: req.url, hasBody: Boolean(req.headers['content-length']) });
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'");
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Cutout browser holder probe</title>'); }
  if (req.url === '/holder.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(moduleSource); }
  const route = routes.get(req.url);
  if (!route) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', route[1]); res.end(await readFile(route[0]));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch();
const issuerPath = resolve(output, 'disposable-holder-probe-issuer.json');
const credentialPath = resolve(output, 'disposable-holder-probe-credential.json');
try {
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const enrollment = await page.evaluate(async () => {
    const { createHolderInBrowser } = await import('/holder.js');
    const options = () => ({ signal: new AbortController().signal, onProgress() {} });
    const start = performance.now();
    window.holder = await createHolderInBrowser(options());
    const other = await createHolderInBrowser(options());
    return { ms: performance.now() - start, commitment: window.holder.holderCommitment, distinct: window.holder.holderSecret !== other.holderSecret && window.holder.holderCommitment !== other.holderCommitment };
  });
  assert.equal(enrollment.distinct, true);
  assert.ok(!requests.some(x => /circuit.r1cs|proving.key|verifying.key/.test(x.path)), 'Holder creation must not fetch proving setup');
  const enrollmentRequests = requests.length;
  const cli = args => execFileSync(resolve(output, 'native-prover'), args, { stdio: 'pipe' });
  cli(['issuer-new', '--out', issuerPath]);
  cli(['issue', '--issuer-key', issuerPath, '--commitment', enrollment.commitment, '--index', '42', '--class', '7', '--expiry', '2000000000', '--out', credentialPath]);
  const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
  const snapshot = JSON.parse(await readFile(resolve(here, '../prover/fixtures/snapshot.json'), 'utf8'));
  const proof = await page.evaluate(async ({ credential, snapshot }) => {
    const worker = new Worker('/prover/worker.js');
    const call = (action, payload = {}) => new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => reject(Error('Worker timed out')), 120000);
      const receive = ({ data }) => { if (data.id !== id) return; clearTimeout(timer); worker.removeEventListener('message', receive); resolve(data.result); };
      worker.addEventListener('message', receive);
      worker.postMessage({ id, action, ...payload });
    });
    try {
      // Generate then initialize in one worker: boot is idempotent, setup remains separate.
      const another = await call('holder-new');
      if (another.error) throw Error('Worker holder creation failed');
      const setup = await Promise.all(['circuit.r1cs', 'proving.key', 'verifying.key'].map(async name => (await fetch(`/prover/${name}`)).arrayBuffer()));
      const initialized = await call('initialize', { setup });
      if (!initialized.ready) throw Error('Worker initialization failed');
      const request = { holder: window.holder, credential, snapshot, context: '12345', recipient: '51966', deadline: '1900000000', class: '7' };
      const valid = await call('prove', { request });
      const tampered = await call('prove', { request: { ...request, holder: { ...window.holder, holderSecret: (BigInt(window.holder.holderSecret) + 1n).toString() } } });
      return { valid: !valid.error, proofBytes: valid.proofBytes, proveMs: valid.proveMs, mismatchedSecretRejected: Boolean(tampered.error) };
    } finally { worker.terminate(); window.holder = undefined; }
  }, { credential, snapshot });
  assert.equal(proof.valid, true);
  assert.equal(proof.proofBytes, 256);
  assert.equal(proof.mismatchedSecretRejected, true);
  assert.equal(errors.length, 0);
  assert.ok(requests.every(item => item.method === 'GET' && !item.hasBody));
  const evidence = { status: 'ACTUAL_CHROMIUM_HOLDER_AND_NATIVE_ISSUER_RELATION_VERIFIED', date: new Date().toISOString(), browser: browser.version(), environment: 'Loopback, fresh random browser holders, disposable native issuer and setup; no wallets, existing private keys, public uploads or chain writes', enrollment: { ms: enrollment.ms, distinct: enrollment.distinct, enrollmentRequests }, proof, checks: ['Two independently random bounded holders', 'Holder generation fetches no proving setup', 'Native CLI issues credential using public commitment only', 'Browser holder produces locally verified Groth16 proof', 'Changed holder secret rejected by unchanged relation', 'Generate then initialize preserves worker boot and proving', 'All network requests public static GET only'], requests, errors };
  await writeFile(resolve(output, 'holder-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close(); server.close();
  await rm(issuerPath, { force: true }); await rm(credentialPath, { force: true });
}
