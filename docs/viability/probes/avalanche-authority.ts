/** Public eth_call simulations only, no state overrides or transaction publication. */
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseAbi,
  type Address,
} from "viem";
import { readFile, writeFile } from "node:fs/promises";
const pin = JSON.parse(
  await readFile(new URL("./avalanche-quotes.json", import.meta.url), "utf8"),
);
const client = createPublicClient({
  transport: http("https://api.avax.network/ext/bc/C/rpc", {
    timeout: 12000,
    retryCount: 0,
  }),
});
const blockNumber = BigInt(pin.blockNumber),
  address: Address = pin.source.proxy;
const abi = parseAbi([
  "function cancelUnlockRequest(uint256)",
  "function getUnlockRequestCount(address) view returns(uint256)",
]);
const requesters = pin.queueSample.sampledRequests.filter(
  (x: any) => BigInt(x.count.value ?? "0") > 0n,
);
const observations = [];
for (const r of requesters) {
  const requester: Address = r.user;
  const code = await client.getCode({ address: requester, blockNumber });
  let cancellation: string;
  try {
    await client.call({
      account: requester,
      to: address,
      data: encodeFunctionData({
        abi,
        functionName: "cancelUnlockRequest",
        args: [0n],
      }),
      blockNumber,
    });
    cancellation = "eth_call succeeded";
  } catch {
    cancellation = "eth_call reverted or unavailable";
  }
  const unchangedCount = await client.readContract({
    address,
    abi,
    functionName: "getUnlockRequestCount",
    args: [requester],
    blockNumber,
  });
  observations.push({
    requester,
    codePresent: Boolean(code && code !== "0x"),
    cancellation,
    requestCountAtSameBlock: unchangedCount.toString(),
    snapshotCount: r.count.value,
  });
}
await writeFile(
  new URL("./avalanche-authority.json", import.meta.url),
  JSON.stringify(
    {
      blockNumber: String(blockNumber),
      blockHash: pin.blockHash,
      observations,
      limits: [
        "eth_call simulates cancellation in ephemeral state only; no request was actually cancelled and returned token deltas were not independently traced.",
        "No code at a sampled address does not establish an independent user or exclude delegated smart-wallet authorization.",
        "Source indexes requests by msg.sender; old request ownership cannot be imported with a token approval.",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    simulations: observations.length,
    succeeded: observations.filter(
      (x) => x.cancellation === "eth_call succeeded",
    ).length,
  }),
);
