import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPublicClient, http, parseAbi, keccak256 } from 'viem';
import { avalancheFuji } from 'viem/chains';
const client = createPublicClient({ chain: avalancheFuji, transport: http('https://api.avax-test.network/ext/bc/C/rpc', { timeout: 15000, retryCount: 1 }) });
const address = '0x5425890298aed601595a70AB815c96711a31Bc65';
const report = { observedAt: new Date().toISOString(), readOnly: true, network: 'Avalanche Fuji', token: address, checks: {} };
const checks = report.checks;
checks.chainId = await client.getChainId();
if (checks.chainId !== 43113) throw Error('Wrong chain');
for (const blockTag of ['latest', 'safe', 'finalized', 'pending']) {
  try {
    const b = await client.getBlock({ blockTag });
    checks[blockTag] = { number: b.number.toString(), hash: b.hash, timestamp: b.timestamp.toString() };
  } catch { checks[blockTag] = { unavailable: true }; }
}
const blockNumber = BigInt(checks.finalized?.number ?? checks.latest.number);
report.pinnedBlock = blockNumber.toString();
const code = await client.getCode({ address, blockNumber });
checks.codeBytes = ((code?.length ?? 2) - 2) / 2;
checks.codeHash = keccak256(code);
const abi = parseAbi(['function name() view returns (string)', 'function symbol() view returns (string)', 'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)', 'function paused() view returns (bool)']);
const results = await Promise.allSettled(['name', 'symbol', 'decimals', 'totalSupply', 'paused'].map(async functionName => [functionName, await client.readContract({ address, abi, functionName, blockNumber })]));
for (let i=0; i<results.length; i++) {
  const r = results[i];
  if(r.status === 'fulfilled') checks[r.value[0]] = typeof r.value[1] === 'bigint' ? r.value[1].toString() : r.value[1];
  else checks[['name','symbol','decimals','totalSupply','paused'][i]] = { unavailable: true };
}
report.limitations = ['Read reachability only; no signer, faucet, approvals, transfers or deployments exercised.', 'Code hash identifies proxy bytecode, not proof of current implementation equivalence.', 'Tag reads occur sequentially and are not an atomic comparison.'];
await writeFile(fileURLToPath(new URL('./probe.json', import.meta.url)), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
