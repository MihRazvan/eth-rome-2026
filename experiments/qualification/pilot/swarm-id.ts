/** Browser-only Swarm ID transport. Callers encrypt before upload; this adapter
 * never receives a document key or enables native key-bearing references.
 * Uses the pinned parent-only source rebuild in vendor/swarm-id. Its build
 * manifest rejects Axios inputs; retrieval uses bounded native fetch.
 */
export type StorageRef = { reference: string; sha256: `0x${string}` };
export type StorageState = {
  connected: boolean;
  canUpload: boolean;
  mode: "user-stamp" | "subsidised" | "unavailable";
  reason?: "no-stamp" | "stamper-failed" | "not-connected";
};
export const MAX_STORAGE_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
export interface SwarmClientLike {
  connectionInfo: {
    identity?: { id?: string } | null;
    canUpload: boolean;
    uploadMode: StorageState["mode"];
    uploadUnavailableReason?: string;
  };
  initialize(): Promise<void>;
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  destroy(): void;
  uploadData(
    bytes: Uint8Array,
    options: { encrypt: false },
    request: { timeout: number },
  ): Promise<{ reference: string | { toHex(): string } }>;
}
type ClientConfig = {
  containerId?: string;
  buttonConfig?: {
    connectText: string;
    disconnectText: string;
    loadingText: string;
    backgroundColor: string;
    color: string;
    borderRadius: string;
  };
  iframeOrigin: string;
  metadata: { name: string };
  onConnectionChange: () => void;
};
export type StorageDependencies = {
  // Explicit seam for deterministic tests; production callers use the default.
  loadClient?: (config: ClientConfig) => Promise<SwarmClientLike>;
  fetch?: typeof globalThis.fetch;
};
const disconnected = (): StorageState => ({
  connected: false,
  canUpload: false,
  mode: "unavailable",
  reason: "not-connected",
});
const digest = async (bytes: Uint8Array): Promise<`0x${string}`> =>
  `0x${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))), (b) => b.toString(16).padStart(2, "0")).join("")}`;

export function createSwarmStorage(
  options: {
    onState?: (state: StorageState) => void;
    gatewayUrl?: string;
    containerId?: string;
  } = {},
  dependencies: StorageDependencies = {},
) {
  const gateway = new URL(
    options.gatewayUrl ?? "https://api.gateway.ethswarm.org",
  );
  if (
    gateway.protocol !== "https:" ||
    gateway.username ||
    gateway.password ||
    gateway.search ||
    gateway.hash
  ) {
    throw new Error(
      "Storage retrieval requires an HTTPS gateway without credentials or query parameters",
    );
  }
  gateway.pathname = gateway.pathname.replace(/\/$/, "");
  const fetchBytes = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
  let client: SwarmClientLike | undefined;
  let initializing: Promise<void> | undefined;
  let state = disconnected();
  let session = "";
  let revision = 0;
  let destroyed = false;
  let disconnecting = false;
  const downloads = new Set<AbortController>();
  const alive = () => {
    if (destroyed) throw new Error("Storage client is closed");
  };
  function update(forceDisconnected = false) {
    const info =
      !forceDisconnected && !disconnecting ? client?.connectionInfo : undefined;
    const connected = !!info?.identity;
    const mode =
      connected &&
      info?.canUpload &&
      ["user-stamp", "subsidised"].includes(info.uploadMode)
        ? info.uploadMode
        : "unavailable";
    const next: StorageState = connected
      ? {
          connected,
          canUpload: mode !== "unavailable",
          mode,
          ...(info?.uploadUnavailableReason === "no-stamp" ||
          info?.uploadUnavailableReason === "stamper-failed"
            ? { reason: info.uploadUnavailableReason }
            : {}),
        }
      : disconnected();
    const nextSession = connected ? JSON.stringify(info?.identity) : "";
    if (
      session !== nextSession ||
      JSON.stringify(state) !== JSON.stringify(next)
    )
      revision++;
    session = nextSession;
    state = next;
    options.onState?.({ ...state });
  }
  async function initialize() {
    alive();
    if (initializing) return initializing;
    initializing = (async () => {
      const config: ClientConfig = {
        iframeOrigin: "https://swarm-id.snaha.net",
        metadata: { name: "Deaddrop" },
        ...(options.containerId ? { containerId: options.containerId } : {}),
        buttonConfig: {
          connectText: "Connect storage",
          disconnectText: "Disconnect storage",
          loadingText: "Connecting…",
          backgroundColor: "#F04E23",
          color: "#17150F",
          borderRadius: "0",
        },
        onConnectionChange: () => {
          if (!destroyed) update();
        },
      };
      const loaded = dependencies.loadClient
        ? await dependencies.loadClient(config)
        : (new (await import("./vendor/swarm-id/client.js")).SwarmIdClient(
            config,
          ) as unknown as SwarmClientLike);
      if (destroyed) {
        loaded.destroy();
        alive();
      }
      client = loaded;
      await loaded.initialize();
      alive();
      update();
    })().catch((error) => {
      client?.destroy();
      client = undefined;
      initializing = undefined;
      update(true);
      throw error;
    });
    return initializing;
  }
  function ready() {
    alive();
    if (disconnecting) throw new Error("Storage disconnect is pending");
    if (!client) throw new Error("Initialize storage first");
    return client;
  }
  function checkSession(expected: number) {
    alive();
    update();
    if (revision !== expected)
      throw new Error(
        "Storage account or upload capability changed; reconnect and retry",
      );
  }
  return {
    get state(): StorageState {
      return { ...state };
    },
    initialize,
    async connect() {
      // Initialize before displaying Connect so connect() stays on a user gesture.
      const current = ready();
      await current.connect();
      alive();
      update();
    },
    async disconnect() {
      const current = ready();
      revision++;
      disconnecting = true;
      update(true);
      try {
        await current.disconnect();
      } finally {
        disconnecting = false;
        update(true);
      }
    },
    async upload(input: Uint8Array): Promise<StorageRef> {
      const current = ready();
      update();
      if (!state.connected || !state.canUpload)
        throw new Error(
          "Connect storage and configure usable postage before uploading",
        );
      if (
        !(input instanceof Uint8Array) ||
        input.length === 0 ||
        input.length > MAX_STORAGE_BYTES
      )
        throw new Error("Encrypted upload exceeds the allowed byte size");
      const bytes = Uint8Array.from(input);
      const expected = revision;
      const sha256 = await digest(bytes);
      checkSession(expected);
      const result = await current.uploadData(
        bytes,
        { encrypt: false },
        { timeout: TIMEOUT_MS },
      );
      // Upload may already have occurred. Never commit its result after an account change.
      checkSession(expected);
      const reference =
        typeof result.reference === "string"
          ? result.reference
          : result.reference.toHex();
      if (!/^[a-f0-9]{64}$/i.test(reference))
        throw new Error("Expected a normal 32-byte Swarm reference");
      return { reference: reference.toLowerCase(), sha256 };
    },
    async download(ref: StorageRef): Promise<Uint8Array> {
      alive();
      if (
        !/^[a-f0-9]{64}$/i.test(ref.reference) ||
        !/^0x[a-f0-9]{64}$/i.test(ref.sha256)
      )
        throw new Error("Invalid authenticated storage reference");
      const controller = new AbortController();
      downloads.add(controller);
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const response = await fetchBytes(
          `${gateway.href.replace(/\/$/, "")}/bytes/${ref.reference.toLowerCase()}`,
          {
            signal: controller.signal,
            redirect: "error",
            credentials: "omit",
            referrerPolicy: "no-referrer",
            cache: "no-store",
          },
        );
        if (!response.ok || !response.body)
          throw new Error("Independent Swarm retrieval failed");
        const declared = response.headers.get("content-length");
        if (
          declared !== null &&
          (!/^\d+$/.test(declared) || Number(declared) > MAX_STORAGE_BYTES)
        ) {
          await response.body.cancel();
          throw new Error("Swarm response exceeds the allowed byte size");
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            alive();
            const next = await reader.read();
            if (next.done) break;
            length += next.value.byteLength;
            if (length > MAX_STORAGE_BYTES)
              throw new Error("Swarm response exceeds the allowed byte size");
            chunks.push(next.value);
          }
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        if ((await digest(bytes)) !== ref.sha256.toLowerCase())
          throw new Error(
            "Swarm bytes do not match the onchain document digest",
          );
        alive();
        return bytes;
      } finally {
        clearTimeout(timer);
        downloads.delete(controller);
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      revision++;
      for (const request of downloads) request.abort();
      downloads.clear();
      client?.destroy();
      update(true);
    },
  };
}
