import { encryptJobDocument, decryptJobDocument } from '/cipher.js';
let state, role = 'worker', busy = false;
const keys = new Map();
const $ = s => document.querySelector(s);
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const short = v => `${v.slice(0, 12)}…${v.slice(-6)}`;
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = value => Uint8Array.from(value.match(/../g) ?? [], x => parseInt(x, 16));
const context = id => ({ chainId: state.chainId, contract: state.escrow, jobId: id, version: 1 });
const button = (action, id, label, quiet = false) => `<button data-action="${action}" data-id="${id}" class="${quiet ? 'quiet' : ''}">${label}</button>`;
function render() {
  document.querySelectorAll('[data-role]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
  $('#create').hidden = role !== 'client';
  $('#issuer-actions').hidden = role !== 'issuer';
  $('#qualification').textContent = state.revoked ? 'Qualification revoked' : 'Qualification ready';
  $('#root-state').textContent = `Epoch ${state.epoch} · root ${short(state.root)} · ${state.storage?.environment ?? 'storage not connected'}`;
  $('#balance').textContent = (Number(state.workerBalance) / 1e6).toLocaleString();
  $('#jobs').innerHTML = [...state.jobs].reverse().map(j => {
    const proofReady = state.proof?.jobId === j.id;
    let actions = '';
    if (j.status === 'Open' && role === 'worker') actions = button('prove', j.id, proofReady ? 'Generate a fresh proof' : 'Prove current qualification') + (proofReady ? button('accept', j.id, 'Accept assignment') : '');
    if (j.status === 'Accepted' && role === 'worker') actions = `<label class="fine" for="document-${j.id}">Test review contents — encrypted in this browser</label><textarea id="document-${j.id}" class="doc">Reviewed the allowance flow. Recommend enforcing explicit approval limits and testing expired authorizations.</textarea>` + button('submit-document', j.id, 'Encrypt, store & submit review');
    if (j.status === 'Submitted' && role === 'client') actions = button('retrieve', j.id, 'Retrieve & decrypt review', true) + button('pay', j.id, 'Approve & pay 250 qUSD') + button('dispute', j.id, 'Dispute review', true);
    if (j.status === 'Paid') actions = button('retrieve', j.id, 'Retrieve encrypted review', true);
    if (j.status === 'Disputed') actions = '<p class="fine">Awaiting the trusted test arbitrator. No timeout resolves an open dispute.</p>' + (role === 'client' ? button('resolve', j.id, 'Simulate arbitrator: split 50 / 50', true) : '');
    return `<article class="ticket"><div class="ticket-head"><span>REVIEW / ${String(j.id).padStart(3, '0')}</span><span class="status">${esc(j.status.toUpperCase())}</span></div><div class="ticket-body"><h3>Allowance-flow<br>second opinion.</h3><p class="terms">A confidential technical review for an independent project team. Test qualification class 7, issued by Test Review Collective.</p><div class="reward"><strong>250 <small>qUSD</small></strong><span>FUNDED TEST ASSIGNMENT</span></div><p class="fine">Accept by ${new Date(Number(j.acceptBefore) * 1000).toLocaleTimeString()} · submit by ${new Date(Number(j.submitBefore) * 1000).toLocaleTimeString()}<br>Client review deadline ${new Date(Number(j.reviewBefore) * 1000).toLocaleTimeString()}. Timely submission pays after this deadline unless disputed.</p><div class="actions">${actions || `<p class="fine">${role === 'issuer' ? 'Issuer controls qualification; the client controls work approval.' : 'Switch demo role to continue the assignment.'}</p>`}</div><pre id="retrieved-${j.id}"></pre></div></article>`;
  }).join('');
  $('#statement').innerHTML = state.proof ? state.proof.publicInputNames.map((name, i) => `<div><b>${esc(name)}</b>${esc(state.proof.publicInputs[i])}</div>`).join('') + `<p>256-byte proof · ${state.proof.proveMs.toFixed(1)} ms proving · ${state.proof.totalHelperMs} ms helper total</p>` : 'Generate a proof to inspect its nine public inputs.';
  $('#events').innerHTML = state.events.map(e => `<div>${esc(e.action)}<span>${esc(e.hash ?? (e.proveMs ? `${e.proveMs.toFixed(1)} ms · ${e.bytes} proof bytes` : e.reference ?? 'Local operation'))}${e.gas ? ` · ${e.gas} gas` : ''}</span></div>`).join('');
  document.querySelectorAll('button').forEach(b => b.disabled = busy);
}
async function api(action, id, extra = {}) {
  const response = await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, ...extra }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
async function run(action, id) {
  if (busy) return;
  busy = true; $('#notice').className = ''; $('#notice').textContent = 'Running the local operation…';
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try {
    if (action === 'submit-document') {
      const plaintext = new TextEncoder().encode($(`#document-${id}`).value);
      const encrypted = await encryptJobDocument(plaintext, context(id));
      keys.set(id, encrypted.key);
      state = await api('submit-document', id, { envelope: hex(encrypted.envelope) });
      $('#notice').textContent = 'Review encrypted in this tab, stored on local Bee and submitted onchain. Keep this tab open: the demo key lives here.';
    } else if (action === 'retrieve') {
      if (!keys.has(id)) throw new Error('This tab does not hold the document key. Cross-device key delivery is not implemented in this experiment.');
      const result = await api('retrieve', id);
      const plaintext = await decryptJobDocument(unhex(result.envelope), keys.get(id), context(id));
      $('#notice').textContent = 'Downloaded through a second local Bee node; authenticated and decrypted in this browser.';
      busy = false; render(); $(`#retrieved-${id}`).textContent = new TextDecoder().decode(plaintext); return;
    } else {
      state = await api(action, id);
      $('#notice').textContent = action === 'prove' ? 'Proof generated. No credential serial or holder secret appears in its public statement.' : 'Confirmed on the local test chain.';
    }
  } catch (error) { $('#notice').className = 'error'; $('#notice').textContent = error.message; }
  finally { busy = false; if (action !== 'retrieve') render(); else document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || busy) return;
  if (b.dataset.role) { role = b.dataset.role; render(); }
  else if (b.dataset.action) run(b.dataset.action, b.dataset.id);
});
$('#create').onclick = () => run('create');
$('#revoke').onclick = () => run('revoke');
$('#restore').onclick = () => run('restore');
try { state = await fetch('/api/state').then(r => r.json()); render(); }
catch { $('#notice').className = 'error'; $('#notice').textContent = 'Local helper unavailable. Start the qualification runtime before using this workbench.'; }
