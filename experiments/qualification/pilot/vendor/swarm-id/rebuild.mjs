/** Rebuild the browser-only Swarm ID parent client from pinned upstream source.
 * All tools/dependencies install in a fresh temporary directory with scripts off.
 * Only the files in this vendor directory are written. No auth or public uploads.
 */
import { mkdtemp, readFile, writeFile, mkdir, copyFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const here = dirname(fileURLToPath(import.meta.url));
const pin = '59c376991b2c4c9962dfec72f6ac84115f393114';
const workspace = await mkdtemp(join(tmpdir(), 'review-pass-swarm-id-'));
const source = join(workspace, 'source'); const buildDir = join(workspace, 'build');
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(source); await mkdir(buildDir);
run('git', ['init', '--quiet'], source);
run('git', ['remote', 'add', 'origin', 'https://github.com/snaha/swarm-id.git'], source);
run('git', ['fetch', '--quiet', '--depth', '1', 'origin', pin], source);
run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], source);
if (run('git', ['rev-parse', 'HEAD'], source).toString().trim() !== pin) throw new Error('Unexpected upstream source revision');
await copyFile(join(here, 'build-package.json'), join(buildDir, 'package.json'));
await copyFile(join(here, 'build-package-lock.json'), join(buildDir, 'package-lock.json'));
run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], buildDir);
await symlink(join(buildDir, 'node_modules'), join(source, 'node_modules'), 'dir');
const { build } = await import(pathToFileURL(join(buildDir, 'node_modules/esbuild/lib/main.js')).href);
const output = join(workspace, 'client.js');
const result = await build({
  absWorkingDir: workspace, entryPoints: [join(source, 'lib/src/swarm-id-client.ts')],
  alias: { '@ethersphere/bee-js': join(buildDir, 'node_modules/@ethersphere/bee-js/dist/mjs/utils/typed-bytes.js') },
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  treeShaking: true, metafile: true, legalComments: 'inline', outfile: output,
  banner: { js: '// Swarm ID parent client0.4.1, Copyright2026 The Swarm Authors, Apache-2.0.\n// Rebuilt from59c376991b2c4c9962dfec72f6ac84115f393114; dependency notices: ./licenses/.\n// Bee primitive-only alias removes the unused Axios/HTTP client. See PROVENANCE.md.' },
});
const paths = Object.keys(result.metafile.inputs);
if (paths.some(path => /(?:^|\/)axios(?:\/|$)/.test(path))) throw new Error('Unexpected Axios in browser bundle');
const packages = new Map(); const sources = [];
for (const path of paths) {
  const fullPath = join(workspace, path); const bytes = await readFile(fullPath);
  const nodePart = path.lastIndexOf('/node_modules/');
  if (nodePart >= 0) {
    const relative = path.slice(nodePart + '/node_modules/'.length);
    const parts = relative.split('/'); const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    const packageDir = join(workspace, path.slice(0, nodePart), 'node_modules', name);
    const pkg = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
    packages.set(`${name}@${pkg.version}`, { name, version: pkg.version, license: pkg.license, dir: packageDir });
    sources.push({ path: `${name}@${pkg.version}/${relative.slice(name.length + 1)}`, sha256: hash(bytes) });
  } else sources.push({ path: path.replace(/^source\//, 'swarm-id/'), sha256: hash(bytes) });
}
await mkdir(join(here, 'licenses'), { recursive: true });
await copyFile(join(source, 'LICENSE'), join(here, 'licenses/swarm-id-APACHE-2.0.txt'));
for (const pkg of packages.values()) {
  let license;
  for (const candidate of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'license.md', 'COPYING']) {
    try { license = await readFile(join(pkg.dir, candidate)); break; } catch {}
  }
  if (!license && pkg.name === 'cafe-utility' && pkg.license === 'MIT') {
    const distributed = await readFile(join(pkg.dir, 'package.json'), 'utf8');
    license = Buffer.from('The published npm package declares MIT and includes no separate license or copyright notice.\nThe distributed package metadata is preserved below without invented authorship.\nMIT license reference: https://spdx.org/licenses/MIT.html\n\n' + distributed);
    pkg.licenseNotice = 'MIT declaration preserved from package.json; no standalone notice distributed';
  }
  if (!license) throw new Error(`Missing dependency license: ${pkg.name}`);
  await writeFile(join(here, 'licenses', `${pkg.name.replaceAll('/', '__').replace('@', '')}-${pkg.version}.txt`), license);
}
const bundled = await readFile(output); await writeFile(join(here, 'client.js'), bundled);
await writeFile(join(here, 'manifest.json'), JSON.stringify({
  upstream: 'https://github.com/snaha/swarm-id', version: '0.4.1', sourceCommit: pin,
  sourceChanges: [], resolutionChange: 'Bee barrel resolves to the same package typed-bytes primitive module',
  esbuild: '0.28.0', axiosInputs: 0, outputBytes: bundled.length, outputSha256: hash(bundled),
  buildLockSha256: hash(await readFile(join(here, 'build-package-lock.json'))),
  packages: [...packages.values()].map(({ dir, ...pkg }) => pkg).sort((a, b) => a.name.localeCompare(b.name)),
  inputs: sources.sort((a, b) => a.path.localeCompare(b.path)),
}, null, 2) + '\n');
console.log(JSON.stringify({ outputBytes: bundled.length, outputSha256: hash(bundled), axiosInputs: 0, temporaryWorkspace: workspace }));
