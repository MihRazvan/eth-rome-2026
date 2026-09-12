import { createHolderInBrowser } from "../holder-enrollment";
import {
  parseEnrollmentRequest,
  type EnrollmentRequest,
} from "../enrollment-request";
export function mountEnrollment(
  config: { chainId: number; escrow: string; issuer: string },
  onState: (message: string) => void,
) {
  const $ = (id: string) => document.getElementById(id)!;
  const start = $("prepare-enrollment") as HTMLButtonElement;
  let controller: AbortController | undefined,
    generation = 0;
  let holder: Awaited<ReturnType<typeof createHolderInBrowser>> | undefined;
  let request: EnrollmentRequest | undefined;
  const download = (name: string, value: unknown) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  function clear() {
    generation++;
    controller?.abort();
    controller = undefined;
    holder = undefined;
    request = undefined;
    $("enrollment-downloads").hidden = true;
    start.disabled = false;
    start.hidden = false;
    $("enrollment-status").textContent =
      "Prepare a private pass in this browser, or use the credential and holder backup you already have.";
    onState("Issuer enrollment needed before accepting work");
  }
  start.onclick = async () => {
    if (controller) return;
    if (config.chainId !== 43113) {
      $("enrollment-status").textContent =
        "This enrollment request is for the public Fuji demo. Local rehearsals use their configured issuer.";
      return;
    }
    const current = ++generation;
    controller = new AbortController();
    start.disabled = true;
    holder = undefined;
    request = undefined;
    $("enrollment-downloads").hidden = true;
    const progress = (text: string) => {
      if (current === generation) $("enrollment-status").textContent = text;
    };
    try {
      const prepared = await createHolderInBrowser({
        signal: controller.signal,
        onProgress: progress,
      });
      if (current !== generation) return;
      holder = prepared;
      request = parseEnrollmentRequest({
        format: "cutout-enrollment-request",
        version: 1,
        testOnly: true,
        chainId: config.chainId,
        escrow: config.escrow,
        issuer: config.issuer,
        qualificationClass: "7",
        holderCommitment: holder.holderCommitment,
        createdAt: Math.floor(Date.now() / 1000),
      });
      $("enrollment-downloads").hidden = false;
      start.hidden = true;
      progress(
        "Private pass prepared. Save your private backup first, then share only the enrollment request with the Cutout team. This is not an issued qualification yet.",
      );
      onState("Enrollment prepared · issuer approval still needed");
    } catch {
      if (current === generation)
        progress(
          "Enrollment preparation failed or was canceled. Retry in a current desktop browser; no credential was issued.",
        );
    } finally {
      if (current === generation) {
        controller = undefined;
        start.disabled = false;
      }
    }
  };
  $("save-private-pass").onclick = () => {
    if (holder) download("cutout-private-holder.json", holder);
  };
  $("save-enrollment-request").onclick = () => {
    if (request) download("cutout-enrollment-request.json", request);
  };
  $("copy-enrollment-request").onclick = async () => {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(request, null, 2));
      $("enrollment-status").textContent =
        "Enrollment request copied. Share it privately with the Cutout team. Keep your private holder backup on your device.";
    } catch {
      $("enrollment-status").textContent =
        "Clipboard unavailable. Download the enrollment request instead.";
    }
  };
  $("clear-enrollment").onclick = clear;
  for (const event of ["accountsChanged", "chainChanged", "disconnect"])
    window.ethereum?.on?.(event, clear);
  window.addEventListener("pagehide", clear, { once: true });
  return { clear };
}
