import "../../../qualification/runtime/style.css";
import "./pilot.css";
import { mountShell } from "./shell";
mountShell();
import { createSwarmStorage } from "../swarm-id";
import {
  mountSnapshotPublisher,
  type SnapshotPublication,
} from "./publish-snapshot";

async function setupPage(reason: string, publication?: SnapshotPublication) {
  document.body.dataset.role = "client";
  document.getElementById("environment")!.textContent =
    "CUTOUT · PUBLIC TESTNET SETUP IN PROGRESS";
  document.getElementById("connect")!.hidden = true;
  const main = document.getElementById("live-workspace")!;
  main.replaceChildren();
  const section = document.createElement("section");
  section.className = "journey";
  section.innerHTML = `<div><p class="eyebrow">PREPARE FOR THE PUBLIC PILOT</p><h2 id="setup-title">Fund a review. Inspect the result. Approve payment.</h2><p id="setup-role">The client writes a public scope and funds test USDC. A currently qualified reviewer accepts, delivers an encrypted report, and gets paid after approval.</p><p id="setup-reason" role="status"></p><p class="fine">This deployment does not yet accept funded reviews. No sample tasks or simulated transactions are displayed.</p></div><div><h3>Prepare your storage account</h3><p>Connect Swarm ID in this browser. Once your storage credit is active, you can test a real public upload and independent retrieval here.</p><button id="setup-connect" disabled>Connect Swarm ID</button><p id="setup-storage" role="status">Loading the storage connection…</p><button id="setup-upload" disabled>Upload a public test note</button><p class="fine">This uploads a generated, non-sensitive connection test. Your actual review reports will be encrypted in the workspace.</p><pre id="setup-result"></pre></div>`;
  section.querySelector("#setup-reason")!.textContent = reason;
  main.append(section);
  document.getElementById("contracts")!.textContent =
    "Fuji contracts awaiting publication";
  for (const role of ["client", "reviewer"]) {
    document.getElementById(`start-${role}`)!.onclick = () => {
      const reviewer = role === "reviewer";
      document.getElementById("setup-title")!.textContent = reviewer
        ? "Prove qualification. Deliver privately. Get paid."
        : "Fund a review. Inspect the result. Approve payment.";
      document.getElementById("setup-role")!.textContent = reviewer
        ? "Bring a credential from the pilot issuer. Your browser generates a task-specific proof, and you sign acceptance with your payment wallet. Qualification establishes eligibility; the client still evaluates your report."
        : "Write a public scope and fund test USDC. Review the encrypted report and approve payment, or use the agreed dispute process.";
      document
        .querySelectorAll<HTMLButtonElement>("[data-role]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.role === role)),
        );
    };
  }
  const connect = document.getElementById("setup-connect") as HTMLButtonElement;
  const upload = document.getElementById("setup-upload") as HTMLButtonElement;
  const status = document.getElementById("setup-storage")!;
  let working = false;
  let publisher: ReturnType<typeof mountSnapshotPublisher> | undefined;
  const storage = createSwarmStorage({
    gatewayUrl: "https://api.gateway.ethswarm.org",
    onState(state) {
      publisher?.refresh();
      upload.disabled = working || !state.canUpload;
      status.textContent = state.canUpload
        ? "Storage connected and uploads available."
        : state.connected
          ? "Signed in. Uploads are waiting for active postage or storage credit."
          : "Sign in to check your storage credit. Your recovery phrase stays in Swarm ID.";
    },
  });
  window.addEventListener("pagehide", () => {
    publisher?.destroy();
    storage.destroy();
  });
  try {
    await storage.initialize();
    connect.disabled = false;
  } catch {
    status.textContent = "Swarm ID could not initialize. Reload to retry.";
  }
  connect.onclick = async () => {
    connect.disabled = true;
    try {
      await storage.connect();
    } catch {
      status.textContent =
        "Storage connection was not completed. You can retry.";
    } finally {
      connect.disabled = false;
    }
  };
  if (publication)
    publisher = mountSnapshotPublisher(main, storage, publication);
  upload.onclick = async () => {
    working = true;
    upload.disabled = true;
    const result = document.getElementById("setup-result")!;
    result.textContent = "Uploading a public connection test…";
    try {
      const bytes = new TextEncoder().encode(
        JSON.stringify({
          format: "review-pass-public-storage-test",
          version: 1,
          createdAt: new Date().toISOString(),
          nonce: crypto.randomUUID(),
        }),
      );
      const ref = await storage.upload(bytes);
      result.textContent = `Uploaded. Verifying independent retrieval…\nReference: ${ref.reference}\nSHA-256: ${ref.sha256}`;
      await storage.download(ref);
      result.textContent = `Public upload and independent retrieval verified.\nReference: ${ref.reference}\nSHA-256: ${ref.sha256}\nYou can share this public test reference with the demo operator.`;
    } catch {
      result.textContent +=
        "\nThe storage test did not complete. If a reference is shown above, the upload may already exist; keep it for inspection.";
    } finally {
      working = false;
      upload.disabled = !storage.state.canUpload;
    }
  };
}
let activeDeployment = false;
try {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw Error("Unavailable configuration");
  const config = await response.json();
  if (config.status === "pending")
    await setupPage(
      config.reason ||
        "The public contracts and issuer snapshot are being prepared.",
      config.publication,
    );
  else if (config.abi) {
    activeDeployment = true;
    await import("./main");
  } else throw Error("Invalid configuration");
} catch {
  if (activeDeployment) {
    document.getElementById("environment")!.textContent =
      "CUTOUT · CONNECTION UNAVAILABLE";
    document.getElementById("connect")!.hidden = true;
    const message = document.createElement("p");
    message.setAttribute("role", "alert");
    message.textContent =
      "The deployed workspace could not finish loading. Reload to retry its network connections. Existing onchain reviews remain unchanged.";
    const retry = document.createElement("button");
    retry.textContent = "Reload workspace";
    retry.onclick = () => window.location.reload();
    document.getElementById("live-workspace")!.replaceChildren(message, retry);
  } else {
    document.getElementById("environment")!.textContent = "CUTOUT · CONNECTION UNAVAILABLE";
    document.getElementById("connect")!.hidden = true;
    const panel = document.createElement("section");
    panel.className = "journey";
    panel.innerHTML = '<div><h2>We could not connect.</h2><p role="status">Reload to reconnect your workspace. Your onchain tasks and saved browser pass are preserved.</p><button id="retry-workspace" data-ui type="button">Retry connection</button><p class="fine">You can still explore the guided demo from the sidebar.</p></div>';
    panel.querySelector<HTMLButtonElement>("#retry-workspace")!.onclick = () => location.reload();
    document.getElementById("live-workspace")!.replaceChildren(panel);
  }
}
