// SPDX-License-Identifier: MIT
// Uses authorized private operator test inputs in local browser memory only.
// No wallet/issuer keys, deployments, transactions or remote private-file uploads.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createPublicClient, http, parseAbi, keccak256 } from 'viem';
const here = dirname(fileURLToPath(import.meta.url));
const origin = 'https://review-pass-ethrome-2026.vercel.app';
const operatorRoot = process.env.REVIEW_PASS_OPERATOR_ROOT;
if (!operatorRoot) throw Error('Authorized operator checkout path is required');
const deployDir = resolve(operatorRoot, '.runtime/review-pass-fuji');
const deployment = JSON.parse(await readFile(resolve(deployDir, 'deployment.json'), 'utf8'));
const build = JSON.parse(await readFile(resolve(operatorRoot, '.runtime/review-pass-vercel/build-evidence.json'), 'utf8'));
const forbidden = [];
const scrub = value => forbidden.reduce((text, secret) => text.split(secret).join('[REDACTED]'), String(value)).slice(0, 1000);
const network = [], failures = [], consoleErrors = [], pageErrors = [], assetHeaders = {};
let outboundPrivateMatches = 0;
const browser = await chromium.launch();
let stage = 'open-production-origin';
try {
  const page = await browser.newPage();
  page.on('request', request => {
    const url = new URL(request.url());
    const body = request.postData() ?? '';
    if (forbidden.some(secret => request.url().includes(secret) || body.includes(secret))) outboundPrivateMatches++;
    network.push({ method: request.method(), origin: url.origin, path: url.pathname, hasBody: Boolean(body) });
  });
  page.on('requestfailed', request => failures.push({ path: new URL(request.url()).pathname, error: scrub(request.failure()?.errorText ?? 'request failed') }));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(scrub(message.text())); });
  page.on('pageerror', error => pageErrors.push(scrub(error.message)));
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/prover/')) assetHeaders[path] = { status: response.status(), csp: response.headers()['content-security-policy'] ?? null, contentType: response.headers()['content-type'] ?? null };
  });
  const initial = await page.goto(origin, { waitUntil: 'domcontentloaded' });
  const documentCSP = initial.headers()['content-security-policy'];
  const config = await page.evaluate(async () => {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw Error('Public config unavailable');
    return response.json();
  });
  assert.equal(config.status, 'active', 'Production deployment is not active');
  assert.equal(config.chainId, 43113);
  assert.equal(config.verifier, deployment.verifier);
  assert.equal(config.escrow, deployment.escrow);
  assert.equal(config.browserProver.verifier, config.verifier);
  const setupNames = ['circuit.r1cs', 'proving.key', 'verifying.key'];
  for (const name of setupNames) {
    const descriptor = config.browserProver.files.find(item => item.name === name);
    assert.equal(descriptor.sha256.replace(/^0x/, ''), deployment.setupHashes[name]);
  }
  stage = 'download-production-prover-and-snapshot';
  const assets = await page.evaluate(async ({ descriptors, gatewayUrl, snapshotRef }) => {
    const digest = async bytes => '0x' + [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
    window.hostedSetup = [];
    const results = [];
    for (const name of ['circuit.r1cs', 'proving.key', 'verifying.key', 'worker.js', 'wasm_exec.js', 'prover.wasm']) {
      const response = await fetch(`/prover/${name}`, { redirect: 'error', credentials: 'omit' });
      if (!response.ok) throw Error(`Public prover asset unavailable: ${name}`);
      const bytes = await response.arrayBuffer();
      const hash = await digest(bytes);
      const expected = descriptors.find(item => item.name === name);
      if (expected && (expected.bytes !== bytes.byteLength || expected.sha256 !== hash)) throw Error(`Public prover asset hash mismatch: ${name}`);
      if (expected) window.hostedSetup.push(bytes);
      results.push({ name, bytes: bytes.byteLength, sha256: hash });
    }
    const response = await fetch('/api/snapshot', { redirect: 'error' });
    if (!response.ok) throw Error('Current public issuer snapshot unavailable');
    const bytes = await response.arrayBuffer();
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    const original = await fetch(`${gatewayUrl}/bytes/${snapshotRef.reference}`, { redirect: 'error', credentials: 'omit' });
    if (!original.ok) throw Error('Independent Swarm snapshot retrieval failed');
    const originalBytes = await original.arrayBuffer();
    const originalHash = await digest(originalBytes);
    if (originalHash !== snapshotRef.sha256) throw Error('Original Swarm snapshot hash mismatch');
    if (JSON.stringify(parsed) !== JSON.stringify(JSON.parse(new TextDecoder().decode(originalBytes)))) throw Error('API snapshot content differs from verified Swarm document');
    return { files: results, snapshot: parsed, snapshotBytes: originalBytes.byteLength, snapshotSha256: originalHash, apiSnapshotBytes: bytes.byteLength, apiSnapshotSha256: await digest(bytes) };
  }, { descriptors: config.browserProver.files, gatewayUrl: config.gatewayUrl, snapshotRef: config.snapshot });
  for (const file of assets.files) {
    const expected = build.files.find(item => item.path === `static/prover/${file.name}`);
    assert.ok(expected, 'Public build inventory omits hosted prover asset');
    assert.equal(file.bytes, expected.bytes);
    assert.equal(file.sha256.replace(/^0x/, ''), expected.sha256);
  }
  assert.equal(assets.snapshotSha256, config.snapshot.sha256);
  stage = 'initialize-actual-hosted-worker';
  const load = await page.evaluate(async () => {
    window.probeWorker = new Worker('/prover/worker.js');
    window.probeCall = (action, data) => new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => reject(Error('Hosted worker operation timed out')), 180_000);
      const fail = () => { clearTimeout(timer); reject(Error('Hosted worker failed; inspect CSP/network evidence')); };
      const listener = ({ data: message }) => { if (message.id === id) { clearTimeout(timer); window.probeWorker.removeEventListener('message', listener); window.probeWorker.removeEventListener('error', fail); resolve(message.result); } };
      window.probeWorker.addEventListener('message', listener);
      window.probeWorker.addEventListener('error', fail, { once: true });
      window.probeWorker.postMessage({ id, action, ...data });
    });
    const start = performance.now();
    const result = await window.probeCall('initialize', { setup: window.hostedSetup });
    window.hostedSetup = undefined;
    return { ...result, workerInitializationMs: performance.now() - start };
  });
  if (!load.ready) throw Error('Production worker rejected setup or could not instantiate WASM');
  console.log(JSON.stringify({ stage: 'hosted-worker-ready', workerInitializationMs: load.workerInitializationMs }));
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const block = await client.getBlock({ blockTag: 'finalized' });
  const abi = parseAbi(['function contextFor(uint256) view returns(uint256)', 'function nextJob() view returns(uint256)', 'function issuerX() view returns(uint256)', 'function issuerY() view returns(uint256)', 'function revocationRoot() view returns(uint256)']);
  const read = (functionName, args = []) => client.readContract({ address: config.escrow, abi, functionName, args, blockNumber: block.number });
  const [nextJob, issuerX, issuerY, root] = await Promise.all(['nextJob', 'issuerX', 'issuerY', 'revocationRoot'].map(name => read(name)));
  const syntheticJobId = nextJob + 2_000_000n;
  const context = await read('contextFor', [syntheticJobId]);
  assert.equal(String(root), assets.snapshot.root);
  const code = await client.getCode({ address: config.verifier, blockNumber: block.number });
  assert.equal(keccak256(code), deployment.runtimeCodeHashes.verifier);
  stage = 'prove-in-hosted-browser-worker';
  let holder = JSON.parse(await readFile(resolve(deployDir, 'rehearsal/holder.json'), 'utf8'));
  let credential = JSON.parse(await readFile(resolve(deployDir, 'rehearsal/credential.json'), 'utf8'));
  forbidden.push(...[holder.holderSecret, holder.holderCommitment, credential.holderCommitment, credential.signature].filter(value => typeof value === 'string' && value.length > 20));
  const deadline = block.timestamp + 300n;
  if (BigInt(credential.expiry) < deadline) throw Error('Authorized test credential expires before probe deadline');
  const request = { holder, credential, snapshot: assets.snapshot, context: String(context), recipient: '0x000000000000000000000000000000000000cafe', deadline: String(deadline), class: '7' };
  const proof = await page.evaluate(request => window.probeCall('prove', { request }), request);
  holder = undefined; credential = undefined; request.holder = undefined; request.credential = undefined;
  await page.evaluate(() => window.probeWorker.terminate());
  if (proof.error) throw Error('Actual hosted worker rejected authorized test inputs');
  assert.equal(proof.proofBytes, 256);
  assert.equal(proof.publicInputs[0], String(issuerX));
  assert.equal(proof.publicInputs[1], String(issuerY));
  assert.equal(proof.publicInputs[2], String(root));
  assert.equal(proof.publicInputs[5], String(context));
  stage = 'read-only-fuji-verification';
  const verifyABI = parseAbi(['function verifyProof(bytes proof, uint256[9] input) view']);
  const verify = inputs => client.readContract({ address: config.verifier, abi: verifyABI, functionName: 'verifyProof', args: [proof.proof, inputs.map(BigInt)], blockNumber: block.number });
  await verify(proof.publicInputs);
  const altered = [...proof.publicInputs]; altered[6] = String(0xcaff);
  await assert.rejects(verify(altered));
  assert.equal(outboundPrivateMatches, 0);
  const result = {
    status: 'PUBLIC_HOSTED_BROWSER_PROOF_ACCEPTED_BY_DEPLOYED_FUJI_VERIFIER', date: new Date().toISOString(), origin, sourceBase: '427018d', hostedBuildRevision: build.sourceRevision,
    scope: 'Fresh Chromium at actual production HTTPS origin, production worker/runtime/WASM/setup/snapshot. Synthetic unfunded assignment and synthetic recipient; no escrow acceptance or wallet transaction.',
    browser: browser.version(), chainId: config.chainId, rpcUrl: config.rpcUrl, verifier: config.verifier, escrow: config.escrow, verifierRuntimeCodeHash: keccak256(code),
    block: { number: String(block.number), hash: block.hash, timestamp: String(block.timestamp), tag: 'finalized' }, syntheticJobId: String(syntheticJobId),
    snapshot: { reference: config.snapshot.reference, bytes: assets.snapshotBytes, sha256: assets.snapshotSha256, root: String(root), apiBytes: assets.apiSnapshotBytes, apiSha256: assets.apiSnapshotSha256, independentGatewayContentMatchedAPI: true },
    artifacts: assets.files, documentCSP, assetHeaders, load,
    proof: { constraints: proof.constraints, proofBytes: proof.proofBytes, proveMs: proof.proveMs, localVerifyMs: proof.verifyMs, goHeapAllocBytes: proof.goHeapAllocBytes, goSysBytes: proof.goSysBytes },
    deployedVerifierAccepted: true, alteredRecipientRejected: true, transactionsSent: 0,
    privacy: { privateInputsOnlyViaLocalBrowserControlChannel: true, privateHTTPMatches: outboundPrivateMatches, issuerOrWalletKeysRead: false },
    network, failures, consoleErrors, pageErrors,
  };
  const encoded = JSON.stringify(result, null, 2) + '\n';
  if (forbidden.some(value => encoded.includes(value))) throw Error('Private material detected in evidence; refusing write');
  const publicProof = JSON.stringify({ version: proof.version, testSetup: true, proof: proof.proof, publicInputs: proof.publicInputs, publicInputNames: proof.publicInputNames }, null, 2) + '\n';
  if (forbidden.some(value => publicProof.includes(value))) throw Error('Private material detected in proof evidence; refusing write');
  await writeFile(resolve(here, 'result.json'), encoded);
  await writeFile(resolve(here, 'public-proof.json'), publicProof);
  console.log(JSON.stringify({ status: result.status, workerInitializationMs: load.workerInitializationMs, proveMs: proof.proveMs, failures: failures.length, consoleErrors: consoleErrors.length, pageErrors: pageErrors.length, transactionsSent: 0 }));
} catch (error) {
  const result = { status: 'HOSTED_PROVER_PROBE_FAILED', date: new Date().toISOString(), origin, stage, error: scrub(error.message), failures, consoleErrors, pageErrors, assetHeaders, network, transactionsSent: 0 };
  await writeFile(resolve(here, 'failure.json'), JSON.stringify(result, null, 2) + '\n');
  throw Error(`Hosted prover probe failed during ${stage}; sanitized failure evidence recorded`);
} finally { await browser.close(); }
