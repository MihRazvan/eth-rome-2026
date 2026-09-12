// SPDX-License-Identifier: MIT
// Read-only Fuji verifier probe. Private test files are read only to initialize
// a local browser request; they are never logged, served, or written to evidence.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { chromium } from '@playwright/test';
import { createPublicClient, http as rpc, parseAbi, keccak256 } from 'viem';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const operatorRoot = process.env.REVIEW_PASS_OPERATOR_ROOT;
if (!operatorRoot) throw Error('REVIEW_PASS_OPERATOR_ROOT must point at the authorized operator checkout');
const deploymentDir = resolve(operatorRoot, '.runtime/review-pass-fuji');
const manifest = JSON.parse(await readFile(resolve(deploymentDir, 'deployment.json'), 'utf8'));
assert.equal(manifest.chainId, 43113);
assert.equal(manifest.escrow, '0xb431e570d506168711cc1f9f91e325b3114c62af');
assert.equal(manifest.verifier, '0x9c1293e7e499d56fdc52186e7624dcfa04dfcbd1');
const client = createPublicClient({ transport: rpc(manifest.rpcUrl) });
assert.equal(await client.getChainId(), 43113);
const block = await client.getBlock({ blockTag: 'finalized' });
const abi = parseAbi(['function contextFor(uint256) view returns(uint256)', 'function issuerX() view returns(uint256)', 'function issuerY() view returns(uint256)', 'function revocationRoot() view returns(uint256)', 'function nextJob() view returns(uint256)']);
const read = (functionName, args = []) => client.readContract({ address: manifest.escrow, abi, functionName, args, blockNumber: block.number });
const [issuerX, issuerY, revocationRoot, nextJob] = await Promise.all(['issuerX', 'issuerY', 'revocationRoot', 'nextJob'].map(name => read(name)));
const syntheticJobId = nextJob + 1_000_000n;
const context = await read('contextFor', [syntheticJobId]);
const code = await client.getCode({ address: manifest.verifier, blockNumber: block.number });
assert.ok(code);
assert.equal(keccak256(code), manifest.runtimeCodeHashes.verifier);
const artifactNames = ['circuit.r1cs', 'proving.key', 'verifying.key'];
const publicSetup = new Map();
for (const name of artifactNames) {
  const bytes = await readFile(resolve(manifest.setupDir, name));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.setupHashes[name]);
  publicSetup.set(`/${name}`, bytes);
}
const wasmDir = resolve(root, '.runtime/browser-probe');
const build = JSON.parse(await readFile(resolve(wasmDir, 'build.json'), 'utf8'));
const routes = new Map([
  ...[...publicSetup].map(([path, bytes]) => [path, { bytes, type: 'application/octet-stream' }]),
  ['/prover.wasm', { bytes: await readFile(resolve(wasmDir, 'prover.wasm')), type: 'application/wasm' }],
  ['/wasm_exec.js', { bytes: await readFile(resolve(wasmDir, 'wasm_exec.js')), type: 'application/javascript' }],
  ['/worker.js', { bytes: await readFile(resolve(root, 'experiments/qualification/browser-probe/worker.js')), type: 'application/javascript' }],
]);
const requests = [];
const server = http.createServer((req, res) => {
  requests.push({ method: req.method, path: req.url, hasBody: Boolean(req.headers['content-length']) });
  res.setHeader('Content-Security-Policy', req.url === '/worker.js' ? "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'" : "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'self'");
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html'); return res.end('<!doctype html><title>Fuji read-only browser prover probe</title>'); }
  const route = routes.get(req.url);
  if (!route) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', route.type); res.end(route.bytes);
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', () => pageErrors.push('Browser page exception'));
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
  if (!load.ready) throw Error('Actual deployed setup could not initialize in Chromium');
  console.log(JSON.stringify({ stage: 'public-setup-loaded', totalLoadMs: load.totalLoadMs }));
  let holder = JSON.parse(await readFile(resolve(deploymentDir, 'rehearsal/holder.json'), 'utf8'));
  let credential = JSON.parse(await readFile(resolve(deploymentDir, 'rehearsal/credential.json'), 'utf8'));
  const snapshot = JSON.parse(await readFile(resolve(deploymentDir, 'public/snapshot.json'), 'utf8'));
  if (String(snapshot.root) !== String(revocationRoot)) throw Error('Public snapshot differs from finalized escrow root');
  const deadline = block.timestamp + 300n;
  if (BigInt(credential.expiry) < deadline) throw Error('Authorized test credential expires before probe deadline');
  const request = { holder, credential, snapshot, context: String(context), recipient: '0x000000000000000000000000000000000000cafe', deadline: String(deadline), class: '7' };
  const proof = await page.evaluate(request => window.probeCall('prove', { request }), request);
  holder = undefined; credential = undefined; request.holder = undefined; request.credential = undefined;
  await page.evaluate(() => window.probeWorker.terminate());
  if (proof.error) throw Error('Browser proof generation rejected authorized test inputs');
  assert.equal(proof.proofBytes, 256);
  assert.equal(proof.publicInputs.length, 9);
  assert.equal(proof.publicInputs[0], String(issuerX));
  assert.equal(proof.publicInputs[1], String(issuerY));
  assert.equal(proof.publicInputs[2], String(revocationRoot));
  assert.equal(proof.publicInputs[5], String(context));
  assert.equal(proof.publicInputs[6], String(0xcafe));
  const verifyAbi = parseAbi(['function verifyProof(bytes proof, uint256[9] input) view']);
  const verify = publicInputs => client.readContract({ address: manifest.verifier, abi: verifyAbi, functionName: 'verifyProof', args: [proof.proof, publicInputs.map(BigInt)], blockNumber: block.number });
  const verificationStart = performance.now();
  await verify(proof.publicInputs);
  const remoteVerificationMs = performance.now() - verificationStart;
  let alteredRecipientRejected = false;
  try { const altered = [...proof.publicInputs]; altered[6] = String(0xcaff); await verify(altered); } catch { alteredRecipientRejected = true; }
  assert.ok(alteredRecipientRejected);
  assert.ok(requests.every(item => item.method === 'GET' && !item.hasBody));
  assert.equal(pageErrors.length, 0);
  const result = {
    status: 'BROWSER_GENERATED_PROOF_ACCEPTED_BY_DEPLOYED_FUJI_VERIFIER_READ_ONLY', date: new Date().toISOString(), sourceCommit: 'a9d0181640148523b2b9ecbb160fbab76f2455a0',
    scope: 'Cryptographic verifier probe with an explicitly synthetic unfunded job context and synthetic recipient. Not funded escrow acceptance, issuer enrollment UX, a transaction, or an end-to-end product claim.',
    chainId: 43113, rpcUrl: manifest.rpcUrl, block: { number: String(block.number), hash: block.hash, timestamp: String(block.timestamp), tag: 'finalized' },
    verifier: manifest.verifier, escrow: manifest.escrow, verifierRuntimeCodeHash: keccak256(code), syntheticJobId: String(syntheticJobId), fundedJobCountAtProbe: String(nextJob),
    browser: browser.version(), build, setupHashes: Object.fromEntries(artifactNames.map(name => [name, manifest.setupHashes[name]])), load,
    proof: { proofBytes: proof.proofBytes, constraints: proof.constraints, proveMs: proof.proveMs, localVerifyMs: proof.verifyMs, goHeapAllocBytes: proof.goHeapAllocBytes, goSysBytes: proof.goSysBytes },
    deployedVerifier: { accepted: true, operation: 'eth_call via viem readContract at pinned finalized block', elapsedMs: remoteVerificationMs, alteredRecipientRejected },
    privacy: { serverRequests: requests, privateInputsServed: false, privateInputsWrittenToEvidence: false, issuerPrivateKeyRead: false, walletKeyRead: false },
    pageErrors, transactionsSent: 0,
  };
  await writeFile(resolve(here, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  await writeFile(resolve(here, 'public-proof.json'), JSON.stringify({ version: proof.version, testSetup: true, proof: proof.proof, publicInputs: proof.publicInputs, publicInputNames: proof.publicInputNames }, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, loadMs: load.totalLoadMs, proveMs: proof.proveMs, remoteVerificationMs, alteredRecipientRejected, transactionsSent: 0 }));
} finally { await browser.close(); server.close(); }
