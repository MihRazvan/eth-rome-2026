import "./demo.css";

/** A self-contained, offline walkthrough. No chain, wallet, issuer or storage calls. */
export function mountCutoutDemo(container: HTMLElement): () => void {
  let alive = true;
  let generation = 0;
  let step = 0;
  let title = "Review our escrow before launch";
  let scope =
    "Check who can approve payment, what happens if a deadline is missed, and whether a private review stays private. Deliver a short report with findings and recommendations.";
  let budget = 10;
  let report =
    "Finding: a client must read a delivered report before approving payment.\n\nRecommendation: make successful decryption a visible step in the approval flow, and give the client a clear way to raise a dispute before the review deadline.\n\nScope note: this is an example review for the guided demo, not a security audit.";
  let key: CryptoKey | undefined;
  let iv: Uint8Array<ArrayBuffer> | undefined;
  let sealed: ArrayBuffer | undefined;
  let opened = false;
  const root = document.createElement("div");
  root.className = "cutout-demo";
  container.replaceChildren(root);
  const stages = [
    "Write the brief",
    "Reserve payment",
    "Prove eligibility",
    "Seal the review",
    "Open the report",
    "Pay for the work",
  ];
  const roles = [
    "Client",
    "Client",
    "Reviewer",
    "Reviewer",
    "Client",
    "Client",
  ];
  const money = () =>
    budget.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const el = <T extends HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const setText = (selector: string, value: string) => {
    el(selector).textContent = value;
  };
  const button = (id: string, label: string, secondary = false) =>
    `<button type="button" class="cd-button${secondary ? " cd-secondary" : ""}" data-demo="${id}">${label}</button>`;
  const person =
    '<svg viewBox="0 0 120 130" aria-hidden="true"><circle cx="60" cy="36" r="24"/><path d="M12 130V108C12 84 33 72 60 72S108 84 108 108V130Z"/></svg>';
  const envelope =
    '<svg viewBox="0 0 260 180" aria-hidden="true"><path d="M18 28H242V154H18Z" fill="#f04e23" stroke="currentColor" stroke-width="2"/><path d="M18 28L130 110L242 28M18 154L91 82M242 154L169 82" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="130" cy="100" r="20" fill="#17150f"/><path d="M123 100V94a7 7 0 0114 0v6M122 99h16v13h-16z" fill="none" stroke="#e8d9b8" stroke-width="2"/></svg>';
  const scissors =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8 16L19 3M16 16L5 3"/></svg>';

  function render(focus = true) {
    if (!alive) return;
    root.innerHTML = `<header class="cd-top"><span class="cd-label"><i></i> Guided demo / browser only</span>${button("live", "Open live workspace ↗", true)}</header>
      <div class="cd-layout"><aside class="cd-sidebar"><p class="cd-kicker">A small job.<br>A complete exchange.</p><h2>Try both<br>sides of<br><em>exchange.</em></h2><p class="cd-intro">Be the client. Be the reviewer. See what each person shares — and what stays private.</p><ol class="cd-steps">${stages.map((name, i) => `<li class="${i === step ? "is-current" : i < step ? "is-complete" : ""}"${i === step ? ' aria-current="step"' : ""}><span>${i < step ? "✓" : String(i + 1).padStart(2, "0")}</span>${name}</li>`).join("")}</ol><div class="cd-honesty"><span class="cd-kicker">What is real here?</span><p>Report encryption and decryption happen in this browser. Credentials, escrow and payment are simulated. Nothing is uploaded or saved.</p></div></aside>
      <main class="cd-main"><div class="cd-role"><span>YOU ARE THE ${roles[step].toUpperCase()}</span><span>${String(step + 1).padStart(2, "0")} / 06</span></div><div class="cd-sheet" data-demo-panel></div><p class="cd-message" role="status" aria-live="polite"></p><footer class="cd-footer"><span>No wallet. No signup. No real funds.</span>${button("restart", "Start again", true)}</footer></main></div>`;
    const panel = el("[data-demo-panel]");
    if (step === 0)
      panel.innerHTML = `<p class="cd-eyebrow">01 / THE BRIEF</p><h3 tabindex="-1">Good work starts<br>with a clear ask.</h3><p class="cd-lead">Give a qualified reviewer something specific to look at. Your brief is public; their report will be private.</p><form data-demo-form><label for="cd-title">Name your task</label><input id="cd-title" maxlength="100" required><label for="cd-scope">What needs a second pair of eyes?</label><textarea id="cd-scope" rows="5" maxlength="4000" required></textarea><div class="cd-budget-row"><div><label for="cd-budget">Review budget</label><div class="cd-amount"><input id="cd-budget" type="number" min="1" max="10000" step="0.01" required><span>demo USDC</span></div></div><p>Reserved up front.<br>Released after approval.</p></div><button class="cd-button" type="submit">Continue to payment <span>↗</span></button></form>`;
    if (step === 1)
      panel.innerHTML = `<p class="cd-eyebrow">02 / SET THE WORK IN MOTION</p><h3 tabindex="-1">Put the budget<br>behind the brief.</h3><div class="cd-task-stub"><span class="cd-kicker">PUBLIC TASK</span><h4 data-task-title></h4><p data-task-scope></p></div><div class="cd-ticket"><div><span class="cd-kicker">RESERVED FOR THE REVIEWER</span><strong>${money()}<small> demo USDC</small></strong></div><span class="cd-stamp">DEMO<br>ESCROW</span></div><p class="cd-lead">In the live product, your payment is held in a smart contract until the work is approved or resolved under its deadlines.</p><p class="cd-note">This button simulates funding. It does not create a transaction or move money.</p>${button("fund", `Reserve ${money()} demo USDC ↗`)}`;
    if (step === 2)
      panel.innerHTML = `<p class="cd-eyebrow">03 / SWITCH HATS</p><h3 tabindex="-1">Show you qualify.<br><em>Keep the rest.</em></h3><p class="cd-lead">You are now the reviewer. A current credential lets you take this task without publishing its reusable identifier.</p><div class="cd-credential"><div class="cd-person">${person}</div><div><span class="cd-kicker">EXAMPLE CREDENTIAL</span><h4>Smart contract reviewer</h4><p>Issued by a demo collective</p><label class="cd-toggle"><input type="checkbox" data-demo-valid checked> Credential is currently valid</label></div><span class="cd-stamp">DEMO<br>PASS</span></div><div class="cd-visibility"><div><span class="cd-kicker">THE CLIENT LEARNS</span><p>You meet this task’s qualification.</p></div><div><span class="cd-kicker">KEPT OUT OF THE PROOF</span><p>Your reusable credential identifier.</p></div></div><p class="cd-note">This is an eligibility simulation. The live workspace generates a zero-knowledge proof; this demo does not. Public wallet activity can still link a reviewer’s jobs.</p>${button("qualify", "Check eligibility & take task ↗")}`;
    if (step === 3)
      panel.innerHTML = `<p class="cd-eyebrow">04 / THE PRIVATE DELIVERY</p><h3 tabindex="-1">Your work is<br>for your client.</h3><p class="cd-lead">Write a short review. We will really encrypt it in this tab before showing the sealed delivery.</p><form data-demo-form><label for="cd-report">Your review report</label><textarea id="cd-report" rows="9" maxlength="12000" required></textarea><div class="cd-seal-note"><span class="cd-mini-envelope">${envelope}</span><p><strong>Plaintext → sealed bytes.</strong><br>A fresh AES-GCM key stays in this tab. Nothing is sent to Swarm in this demo.</p></div><button class="cd-button" type="submit">Encrypt & seal the review ↗</button></form>`;
    if (step === 4)
      panel.innerHTML = `<p class="cd-eyebrow">05 / BACK TO THE CLIENT</p><h3 tabindex="-1">There’s a review<br>with your name on it.</h3><p class="cd-lead">The report is sealed. Open the report to decrypt the exact text you wrote — locally, in your browser.</p><div class="cd-delivery"><div class="cd-sealed-art">${envelope}<span class="cd-kicker">SEALED DELIVERY / AES-GCM</span></div><div class="cd-opened" hidden><span class="cd-kicker">DECRYPTED IN THIS BROWSER</span><pre data-demo-plaintext></pre></div></div><div class="cd-cut-track" data-demo-track><span class="cd-cut-line"></span><button class="cd-cut-grip" type="button" data-demo-cut aria-label="Open the encrypted review">${scissors}</button><span class="cd-cut-hint">SLIDE TO OPEN →</span></div><div class="cd-cut-alternative">${button("open", "Open without dragging", true)}<span>Mouse, touch or keyboard.</span></div><details class="cd-bytes"><summary>Inspect the actual encrypted bytes</summary><code data-demo-ciphertext></code><p>The random key stays in memory. Reloading or restarting discards it.</p></details><div class="cd-approve" hidden><p class="cd-note">Read the review before releasing payment. In the live workspace, a client can also dispute delivery.</p>${button("approve", `Approve & pay ${money()} demo USDC ↗`)}</div>`;
    if (step === 5)
      panel.innerHTML = `<p class="cd-eyebrow">06 / THE EXCHANGE IS COMPLETE</p><h3 tabindex="-1">A private review.<br><em>A fair exchange.</em></h3><div class="cd-receipt"><span class="cd-kicker">DEADDROP / DEMO RECEIPT</span><h4 data-task-title></h4><dl><div><dt>Client received</dt><dd>A decrypted review</dd></div><div><dt>Reviewer earned</dt><dd>${money()} demo USDC</dd></div><div><dt>Remaining escrow</dt><dd>0 demo USDC</dd></div><div><dt>Report encryption</dt><dd>Real · AES-GCM</dd></div><div><dt>Settlement</dt><dd>Simulated · no transaction</dd></div></dl><span class="cd-paid">WORK APPROVED</span></div><p class="cd-lead">That is Deaddrop: qualify for the work, deliver it privately, and get paid. The live workspace connects those steps to testnet contracts and decentralized storage.</p>${button("live", "Explore the live workspace ↗")}<p class="cd-note">Live actions need a funded testnet wallet and the relevant account setup. No real funds are required.</p>`;
    if (step === 0) {
      el<HTMLInputElement>("#cd-title").value = title;
      el<HTMLTextAreaElement>("#cd-scope").value = scope;
      el<HTMLInputElement>("#cd-budget").value = String(budget);
    }
    if (step === 1 || step === 5) setText("[data-task-title]", title);
    if (step === 1) setText("[data-task-scope]", scope);
    if (step === 3) el<HTMLTextAreaElement>("#cd-report").value = report;
    if (step === 4 && sealed) {
      setText(
        "[data-demo-ciphertext]",
        Array.from(new Uint8Array(sealed), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(" "),
      );
      bindCut();
    }
    if (focus) el<HTMLElement>("h3").focus({ preventScroll: true });
  }
  function message(text: string) {
    if (alive) setText(".cd-message", text);
  }
  async function open() {
    if (opened || !key || !iv || !sealed) return;
    const current = generation;
    try {
      const bytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        sealed,
      );
      if (!alive || current !== generation) return;
      const recovered = new TextDecoder().decode(bytes);
      if (recovered !== report)
        throw new Error("Decrypted text did not match the report.");
      opened = true;
      setText("[data-demo-plaintext]", recovered);
      el<HTMLElement>(".cd-sealed-art").hidden = true;
      el<HTMLElement>(".cd-opened").hidden = false;
      el<HTMLElement>(".cd-approve").hidden = false;
      el(".cd-cut-track").classList.add("is-open");
      el<HTMLButtonElement>("[data-demo-cut]").disabled = true;
      el<HTMLButtonElement>('[data-demo="open"]').disabled = true;
      setText(".cd-cut-hint", "OPEN / VERIFIED");
      message(
        "Decrypted successfully. The text matches your original report exactly.",
      );
    } catch {
      message(
        "The review could not be decrypted. Restart the demo to create a fresh sealed delivery.",
      );
    }
  }
  function bindCut() {
    const grip = el<HTMLButtonElement>("[data-demo-cut]");
    const track = el<HTMLElement>("[data-demo-track]");
    let dragging = false;
    let progress = 0;
    grip.addEventListener("pointerdown", (e) => {
      if (opened) return;
      dragging = true;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener("pointermove", (e) => {
      if (!dragging || opened) return;
      const bounds = track.getBoundingClientRect();
      progress = Math.max(
        0,
        Math.min(1, (e.clientX - bounds.left - 24) / (bounds.width - 48)),
      );
      track.style.setProperty("--cut", String(progress));
      if (progress >= 0.96) {
        dragging = false;
        void open();
      }
    });
    const end = () => {
      dragging = false;
      if (!opened) track.style.setProperty("--cut", "0");
    };
    grip.addEventListener("pointerup", end);
    grip.addEventListener("pointercancel", end);
    grip.addEventListener("click", (e) => {
      if (e.detail === 0) void open();
    });
  }
  function reset() {
    generation++;
    step = 0;
    key = undefined;
    iv = undefined;
    sealed = undefined;
    opened = false;
    render();
  }
  const onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-demo]",
    );
    if (!target || target.disabled) return;
    switch (target.dataset.demo) {
      case "live":
        container.dispatchEvent(
          new CustomEvent("cutout:live", { bubbles: true }),
        );
        break;
      case "restart":
        reset();
        break;
      case "fund":
        if (step === 1) {
          step = 2;
          render();
          message(
            `${money()} demo USDC reserved in simulated escrow. You are now the reviewer.`,
          );
        }
        break;
      case "qualify":
        if (step === 2) {
          if (!el<HTMLInputElement>("[data-demo-valid]").checked) {
            message(
              "This credential is not valid. In the live product, a revoked or expired credential cannot qualify for a new task. Enable the example credential to continue.",
            );
            return;
          }
          step = 3;
          render();
          message(
            "Demo eligibility check passed. No zero-knowledge proof was generated.",
          );
        }
        break;
      case "open":
        if (step === 4) void open();
        break;
      case "approve":
        if (step === 4 && opened) {
          step = 5;
          render();
          message("Demo payment complete. No real tokens moved.");
        }
        break;
    }
  };
  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (step === 0) {
      const nextTitle = el<HTMLInputElement>("#cd-title").value.trim();
      const nextScope = el<HTMLTextAreaElement>("#cd-scope").value.trim();
      const nextBudget = Number(el<HTMLInputElement>("#cd-budget").value);
      if (
        !nextTitle ||
        !nextScope ||
        !Number.isFinite(nextBudget) ||
        nextBudget < 1 ||
        nextBudget > 10000
      ) {
        message(
          "Add a task, a brief, and a budget between 1 and 10,000 demo USDC.",
        );
        return;
      }
      title = nextTitle;
      scope = nextScope;
      budget = Math.round(nextBudget * 100) / 100;
      step = 1;
      render();
    } else if (step === 3) {
      const nextReport = el<HTMLTextAreaElement>("#cd-report").value;
      if (!nextReport.trim()) {
        message("Write a review before sealing it.");
        return;
      }
      const submit = el<HTMLButtonElement>('button[type="submit"]');
      submit.disabled = true;
      const current = generation;
      try {
        const nextKey = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        );
        const nextIv = crypto.getRandomValues(new Uint8Array(12));
        const nextSealed = await crypto.subtle.encrypt(
          { name: "AES-GCM", iv: nextIv },
          nextKey,
          new TextEncoder().encode(nextReport),
        );
        if (!alive || current !== generation) return;
        report = nextReport;
        key = nextKey;
        iv = nextIv;
        sealed = nextSealed;
        step = 4;
        render();
        message(
          `Your report is sealed in ${nextSealed.byteLength.toLocaleString()} encrypted bytes. You are now the client.`,
        );
      } catch {
        if (alive && current === generation) {
          submit.disabled = false;
          message(
            "Browser encryption is unavailable. Open this demo over HTTPS or localhost and try again.",
          );
        }
      }
    }
  };
  root.addEventListener("click", onClick);
  root.addEventListener("submit", onSubmit);
  render(false);
  return () => {
    alive = false;
    generation++;
    key = undefined;
    iv = undefined;
    sealed = undefined;
    report = "";
    root.removeEventListener("click", onClick);
    root.removeEventListener("submit", onSubmit);
    root.remove();
  };
}
