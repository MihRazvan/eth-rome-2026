// SPDX-License-Identifier: MIT
// Probe worker: no network request ever includes holder/credential inputs.
let ready = false;
let wasmBoot;
const bootWASM = () => wasmBoot ??= (async () => {
  importScripts(new URL('wasm_exec.js', self.location.href).href);
  const go = new Go();
  const response = await fetch(new URL('prover.wasm', self.location.href), { credentials: 'omit', redirect: 'error' });
  if (!response.ok) throw Error('Prover unavailable');
  const { instance } = await WebAssembly.instantiateStreaming(response, go.importObject);
  void go.run(instance);
  if (typeof self.reviewPassInitialize !== 'function' || typeof self.reviewPassCreateHolder !== 'function') throw Error('WASM entrypoint unavailable');
})();
self.onmessage = async ({ data }) => {
  const { id, action } = data;
  try {
    if (action === 'initialize') {
      if (ready) throw Error('Worker already initialized');
      await bootWASM();
      const result = JSON.parse(self.reviewPassInitialize(...data.setup.map(buffer => new Uint8Array(buffer))));
      if (result.error) throw Error(result.error);
      ready = true;
      self.postMessage({ id, result });
    } else if (action === 'holder-new') {
      await bootWASM();
      self.postMessage({ id, result: JSON.parse(self.reviewPassCreateHolder()) });
    } else if (action === 'prove') {
      if (!ready) throw Error('Initialize prover first');
      const result = JSON.parse(self.reviewPassProve(JSON.stringify(data.request)));
      // Erases this JS reference only; JS/Go memory is not guaranteed zeroized.
      data.request = undefined;
      self.postMessage({ id, result });
    } else throw Error('Unknown worker action');
  } catch {
    self.postMessage({ id, result: { error: 'Browser prover operation failed' } });
  } finally {
    // Also drop private inputs after failed operations; memory zeroization is not guaranteed.
    data.request = undefined;
  }
};
