export type Role = "client" | "reviewer";
export type Readiness = {
  owner?: string;
  key: boolean;
  gas: bigint | null;
  balance: bigint | null;
};
export function nextStep(
  role: Role,
  connected: boolean,
  state: Readiness,
  storageReady: boolean,
  reward: bigint,
  local: boolean,
) {
  if (!connected)
    return {
      target: "connect",
      title: "Connect your payment wallet",
      text: "You approve the transactions. Start with a test wallet; all payments here use test assets.",
    };
  if (state.gas === null || state.balance === null)
    return {
      target: "refresh",
      title: "Check your wallet",
      text: "Read your balance and report-key status before continuing.",
    };
  if (state.gas === 0n)
    return {
      target: "funding-help",
      title: "Add gas for transactions",
      text: local
        ? "This local wallet needs test ETH. Ask the demo operator to fund this address on the local chain."
        : "Get test AVAX on Fuji, then check your balance again.",
    };
  if (!storageReady)
    return {
      target: "connect-storage",
      title: "Connect document storage",
      text: "Sign in through Swarm ID to connect a storage drive. Deaddrop never asks you to paste storage IDs or private keys. Your drive needs available upload capacity.",
    };
  if (role === "client" && state.balance < reward)
    return {
      target: local ? "mint" : "funding-help",
      title: "Add the review reward",
      text: local
        ? "Get local test tokens to fund your chosen reward."
        : "Get canonical Fuji test USDC from Circle. Gas and the review reward are separate balances.",
    };
  return role === "client"
    ? {
        target: "commission",
        title: "Set the scope and fund your review",
        text: "Write the scope and fund the reward. Private report access is enabled automatically if this browser needs it.",
      }
    : {
        target: "opportunity-section",
        title: "Choose a funded review",
        text: "Choose a task. Your private access, task proof and report encryption are prepared as you accept; confirm the required transactions in your wallet.",
      };
}
export function deadlineEligibility(
  status: string,
  now: number,
  accept: bigint,
  submit: bigint,
  review: bigint,
) {
  const t = BigInt(Math.floor(now));
  return {
    accept: status === "Open" && t < accept,
    submit: status === "Accepted" && t <= submit,
    dispute: status === "Submitted" && t <= review,
    claim: status === "Submitted" && t > review,
    refund:
      (status === "Open" && t >= accept) ||
      (status === "Accepted" && t > submit),
  };
}

/** Never replace a different browser key as an incidental part of accepting work. */
export function documentKeySetup(binding:{publicKey:string;expiresAt:number},localKey:string,now:number):"ready"|"register"|"confirm-replacement" {
  if(binding.publicKey === "0x")return "register";
  if(binding.publicKey.toLowerCase() !== localKey.toLowerCase())return "confirm-replacement";
  return binding.expiresAt > now ? "ready" : "register";
}
