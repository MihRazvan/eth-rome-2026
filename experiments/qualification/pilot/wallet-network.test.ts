import { test } from "node:test";
import assert from "node:assert/strict";
import { tiramisu } from "@arkiv-network/sdk/chains";
import {
  ensureWalletChain,
  walletErrorMessage,
  WalletNetworkError,
  type WalletProvider,
} from "./wallet-network";

const owner = "0x1234567890123456789012345678901234567890";
const other = "0x2222222222222222222222222222222222222222";
type Step = {
  method: string;
  result?: unknown;
  error?: unknown;
  params?: unknown[];
};
function scripted(steps: Step[]) {
  const calls: string[] = [];
  const provider: WalletProvider = {
    async request(request) {
      calls.push(request.method);
      const step = steps.shift();
      assert.ok(step, `Unexpected request: ${request.method}`);
      assert.equal(request.method, step.method);
      if (step.params) assert.deepEqual(request.params, step.params);
      if (step.error) throw step.error;
      return step.result;
    },
  };
  return { provider, calls, done: () => assert.equal(steps.length, 0) };
}
const start = (): Step[] => [
  { method: "eth_accounts", result: [owner] },
  { method: "eth_chainId", result: "0xa869" },
];
const end = (): Step[] => [
  { method: "eth_accounts", result: [owner] },
  { method: "eth_chainId", result: `0x${tiramisu.id.toString(16)}` },
];

for (const error of [
  { code: 4902, message: "Unknown chain" },
  { code: -32603, data: { originalError: { code: 4902 } } },
  { cause: { error: { code: "4902" } } },
]) {
  test(`adds unknown network with exact SDK metadata: ${JSON.stringify(error)}`, async () => {
    const h = scripted([
      ...start(),
      { method: "wallet_switchEthereumChain", error },
      {
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${tiramisu.id.toString(16)}`,
            chainName: tiramisu.name,
            nativeCurrency: { ...tiramisu.nativeCurrency },
            rpcUrls: [...tiramisu.rpcUrls.default.http],
          },
        ],
      },
      {
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${tiramisu.id.toString(16)}` }],
      },
      ...end(),
    ]);
    assert.equal(await ensureWalletChain(h.provider, tiramisu, owner), owner);
    h.done();
    assert.ok(
      h.calls.every(
        (method) => !method.includes("send") && !method.includes("sign"),
      ),
    );
  });
}

test("already selected network only verifies account and chain", async () => {
  const h = scripted([...end(), ...end()]);
  assert.equal(await ensureWalletChain(h.provider, tiramisu), owner);
  h.done();
});

test("includes an explorer only when present in caller-approved chain metadata", async () => {
  const chain = {
    ...tiramisu,
    blockExplorers: {
      default: {
        name: "Arkiv",
        url: "https://tiramisu.explorer.arkiv.network",
      },
    },
  };
  const h = scripted([
    ...start(),
    { method: "wallet_switchEthereumChain", error: { code: 4902 } },
    {
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: `0x${chain.id.toString(16)}`,
          chainName: chain.name,
          nativeCurrency: { ...chain.nativeCurrency },
          rpcUrls: [...chain.rpcUrls.default.http],
          blockExplorerUrls: [chain.blockExplorers.default.url],
        },
      ],
    },
    { method: "wallet_switchEthereumChain" },
    ...end(),
  ]);
  await ensureWalletChain(h.provider, chain, owner);
  h.done();
});

for (const error of [
  { code: 4001 },
  { code: -32002 },
  { code: 4001, data: { originalError: { code: 4902 } } },
  { code: -32603, cause: { code: -32002 }, data: { code: 4902 } },
]) {
  test(`rejected or pending switch never adds a network: ${JSON.stringify(error)}`, async () => {
    const h = scripted([
      ...start(),
      { method: "wallet_switchEthereumChain", error },
    ]);
    await assert.rejects(
      ensureWalletChain(h.provider, tiramisu, owner),
      (actual) => actual === error,
    );
    h.done();
    assert.equal(
      h.calls.filter((m) => m === "wallet_switchEthereumChain").length,
      1,
    );
    assert.ok(!h.calls.includes("wallet_addEthereumChain"));
  });
}

for (const stage of ["add", "switch"] as const) {
  test(`canceling ${stage} ends the attempt without automatic publication or retry`, async () => {
    const canceled = { code: 4001 };
    const h = scripted([
      ...start(),
      { method: "wallet_switchEthereumChain", error: { code: 4902 } },
      {
        method: "wallet_addEthereumChain",
        ...(stage === "add" ? { error: canceled } : {}),
      },
      ...(stage === "switch"
        ? [{ method: "wallet_switchEthereumChain", error: canceled }]
        : []),
    ]);
    let publishes = 0;
    await assert.rejects(
      async () => {
        await ensureWalletChain(h.provider, tiramisu, owner);
        publishes++;
      },
      (error) => error === canceled,
    );
    assert.equal(publishes, 0);
    h.done();
  });
}

test("switch approval does not bypass wrong chain validation", async () => {
  const h = scripted([
    ...start(),
    { method: "wallet_switchEthereumChain" },
    ...start(),
  ]);
  await assert.rejects(
    ensureWalletChain(h.provider, tiramisu, owner),
    /did not select/,
  );
  h.done();
});

test("account changed during network approval blocks the caller", async () => {
  const h = scripted([
    ...start(),
    { method: "wallet_switchEthereumChain" },
    { method: "eth_accounts", result: [other, owner] },
  ]);
  await assert.rejects(
    ensureWalletChain(h.provider, tiramisu, owner),
    /account changed/,
  );
  h.done();
});

test("initial wrong selected account never requests a switch", async () => {
  const h = scripted([{ method: "eth_accounts", result: [other, owner] }]);
  await assert.rejects(
    ensureWalletChain(h.provider, tiramisu, owner),
    /account changed/,
  );
  h.done();
});

for (const accounts of [[], ["invalid"], owner, [owner, "invalid"]]) {
  test(`rejects malformed or unauthorized wallet accounts: ${JSON.stringify(accounts)}`, async () => {
    const h = scripted([{ method: "eth_accounts", result: accounts }]);
    await assert.rejects(
      ensureWalletChain(h.provider, tiramisu, owner),
      /account/,
    );
    h.done();
  });
}

for (const chainId of [
  7738577,
  "7738577",
  "0x",
  "0xZZ",
  "0x0",
  "0x10000000000000000",
]) {
  test(`rejects invalid EIP-1193 chain ID: ${chainId}`, async () => {
    const h = scripted([
      { method: "eth_accounts", result: [owner] },
      { method: "eth_chainId", result: chainId },
    ]);
    await assert.rejects(
      ensureWalletChain(h.provider, tiramisu, owner),
      /invalid network/,
    );
    h.done();
  });
}

test("plain and nested errors produce actionable fixed messages without provider data", () => {
  const secret = "https://rpc.example/private?key=secret";
  assert.match(walletErrorMessage({ code: 4001, message: secret }), /canceled/);
  assert.match(
    walletErrorMessage({ data: { originalError: { code: -32002 } } }),
    /pending/,
  );
  assert.match(
    walletErrorMessage({ code: -32603, cause: { code: 4902 } }),
    /not available/,
  );
  assert.match(
    walletErrorMessage({
      code: -32000,
      message: `insufficient funds ${secret}`,
    }),
    /needs gas/,
  );
  assert.ok(!walletErrorMessage(new Error(secret)).includes(secret));
  assert.equal(
    walletErrorMessage(
      new WalletNetworkError("The client wallet needs test GLM on Tiramisu."),
    ),
    "The client wallet needs test GLM on Tiramisu.",
  );
  assert.match(
    walletErrorMessage(
      new Error("Discovery lease must end before acceptance deadline"),
    ),
    /shorter listing duration/,
  );
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  assert.match(walletErrorMessage(cyclic), /request failed/);
});
