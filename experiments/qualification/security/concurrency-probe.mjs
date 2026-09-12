// SPDX-License-Identifier: MIT
// Reproduce the original helper locking order without role keys, proof files, or blockchain writes.
import http from 'node:http';
import assert from 'node:assert/strict';
const fixed = process.argv.includes("--fixed");
let busy = false, active = 0, maximumActive = 0, opened = 0;
let bothOpened;
const openedPromise = new Promise(resolve => { bothOpened = resolve; });
const server = http.createServer(async (req, res) => {
  if (busy) { res.writeHead(409); res.end(); return; }
  if (++opened === 2) bothOpened();
  let body = ''; for await (const chunk of req) body += chunk;
  if (fixed && busy) { res.writeHead(409); res.end(); return; }
  busy = true;
  try {
    active++; maximumActive = Math.max(maximumActive, active);
    await new Promise(resolve => setTimeout(resolve, 25));
    active--;
    res.end('done');
  } finally { busy = false; }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const requests = [1, 2].map(() => {
  let request;
  const done = new Promise((resolve, reject) => {
    request = http.request({hostname:'127.0.0.1', port, method:'POST'}, response => {response.resume(); response.on('end',resolve);});
    request.on('error', reject); request.flushHeaders();
  });
  return {request, done};
});
try {
  await openedPromise;
  for (const {request} of requests) request.end('{}');
  await Promise.all(requests.map(({done})=>done));
  assert.equal(maximumActive, fixed ? 1 : 2);
  console.log(JSON.stringify({maximumConcurrentActions:maximumActive, scope:fixed ? 'isolated corrected locking pattern; no live helper or chain touched' : 'isolated original locking pattern; no live helper or chain touched'}));
} finally { server.close(); }
