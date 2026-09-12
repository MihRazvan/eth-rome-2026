// SPDX-License-Identifier: MIT
// Exploratory build: original relation/prover files are copied, never modified.
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const source = resolve(here, '../prover');
const output = resolve(root, process.env.REVIEW_PASS_BROWSER_PROBE_DIR ?? '.runtime/browser-probe');
const stage = resolve(output, 'source');
await mkdir(stage, { recursive: true });
const hashes = {};
for (const file of ['go.mod', 'go.sum', 'circuit.go', 'credential.go', 'main.go']) {
  let bytes = await readFile(resolve(source, file));
  hashes[file] = createHash('sha256').update(bytes).digest('hex');
  if (file === 'main.go') bytes = Buffer.from(bytes.toString().replace('func main() {', 'func cliMain() {'));
  await writeFile(resolve(stage, file), bytes);
}
await copyFile(resolve(here, 'bridge.go.txt'), resolve(stage, 'bridge.go'));
const start = performance.now();
execFileSync('go', ['build', '-trimpath', '-ldflags=-s -w', '-o', resolve(output, 'prover.wasm'), '.'], {
  cwd: stage, env: { ...process.env, GOOS: 'js', GOARCH: 'wasm' }, stdio: 'inherit',
});
const goroot = execFileSync('go', ['env', 'GOROOT'], { cwd: stage, encoding: 'utf8' }).trim();
await rm(resolve(output, 'wasm_exec.js'), { force: true });
await rm(resolve(output, 'GO-LICENSE'), { force: true });
await copyFile(resolve(goroot, 'lib/wasm/wasm_exec.js'), resolve(output, 'wasm_exec.js'));
await copyFile(resolve(goroot, 'LICENSE'), resolve(output, 'GO-LICENSE'));
hashes['bridge.go.txt'] = createHash('sha256').update(await readFile(resolve(here, 'bridge.go.txt'))).digest('hex');
hashes['worker.js'] = createHash('sha256').update(await readFile(resolve(here, 'worker.js'))).digest('hex');
const wasm = await readFile(resolve(output, 'prover.wasm'));
const manifest = { status: 'BROWSER_PROVER_PROBE_ONLY', go: execFileSync('go', ['version'], { cwd: stage, encoding: 'utf8' }).trim(), sourceHashes: hashes,
  wasmBytes: wasm.length, wasmSha256: createHash('sha256').update(wasm).digest('hex'), buildMs: Math.round(performance.now() - start) };
await writeFile(resolve(output, 'build.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest));
