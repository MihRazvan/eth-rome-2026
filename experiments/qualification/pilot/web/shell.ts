// Presentation navigation stays available even when a sponsor network is offline.
let cleanupDemo: (() => void) | undefined;
let requestedView = "home";
const el = (id: string) => document.getElementById(id)!;
export async function setView(view: string) {
  const changedView = requestedView !== view;
  requestedView = view;
  if (changedView) window.scrollTo({ top: 0, behavior: "instant" });
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  history.replaceState(null, "", url);
  document.body.dataset.view = view;
  document.querySelectorAll<HTMLElement>("[data-screen]").forEach((node) => {
    node.hidden = node.dataset.screen !== view;
  });
  document
    .querySelectorAll<HTMLButtonElement>(".rail-nav [data-view]")
    .forEach((node) => {
      if (node.dataset.view === view) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });
  el("dd-home").hidden = view !== "home";
  document.querySelector<HTMLElement>(".cutout-shell")!.hidden =
    view === "home";
  el("live-workspace").hidden = !["tasks", "activity", "help"].includes(view);
  window.dispatchEvent(new Event("deaddrop:view"));
  el("cutout-demo").hidden = view !== "demo";
  document.querySelector<HTMLElement>(".workspace-heading")!.hidden =
    view === "demo" || view === "issuer" || view === "home";
  const reviewer = document.body.dataset.role === "reviewer";
  const copy =
    view === "activity"
      ? [
          "Your reviews",
          reviewer
            ? "Track your assignments, deliver reports and collect payment."
            : "Track progress, open reports and approve payment.",
        ]
      : view === "help"
        ? [
            "Your workspace",
            reviewer
              ? "Manage your qualification, wallet and private reports."
              : "Manage your wallet and private reports.",
          ]
        : reviewer
          ? [
              "Find your next review",
              "Prove you qualify. Deliver a private report. Get paid.",
            ]
          : [
              "Post a review task",
              "A second pair of eyes. A report encrypted for both of you.",
            ];
  el("workspace-title").textContent = copy[0];
  el("workspace-description").textContent = copy[1];
  el("post-task").hidden = true;
  el("intro-demo").textContent = "How it works ↗";
  el("intro-demo").hidden = view !== "tasks";
  el("post-task").textContent = reviewer ? "Find a task" : "Post a task";
  el("view-caption").textContent =
    view === "tasks"
      ? reviewer
        ? "REVIEWER / TASKS"
        : "CLIENT / NEW REVIEW"
      : view === "activity"
        ? "ACTIVITY"
        : "SETTINGS";
  if (view === "demo" && !cleanupDemo) {
    const { mountCutoutDemo } = await import("./demo");
    if (requestedView === "demo" && !cleanupDemo)
      cleanupDemo = mountCutoutDemo(el("cutout-demo"));
  }
}
export function revealInWorkspace(target: HTMLElement) {
  const screen = target.closest<HTMLElement>("[data-screen]")?.dataset.screen;
  if (screen && document.body.dataset.view !== screen) void setView(screen);
  let parent: HTMLElement | null = target;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
}
export function mountShell() {
  document.body.dataset.role =
    new URL(location.href).searchParams.get("role") === "reviewer"
      ? "reviewer"
      : "client";
  document.querySelectorAll<HTMLButtonElement>(".rail-nav [data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        void setView(b.dataset.view!);
      }),
  );
  document.querySelector<HTMLAnchorElement>(".skip")!.onclick = (event) => {
    event.preventDefault();
    void setView("tasks");
    el("main").focus();
  };
  document.querySelectorAll<HTMLElement>("[data-home]").forEach(
    (node) =>
      (node.onclick = (event) => {
        event.preventDefault();
        void setView("home");
      }),
  );
  document.querySelectorAll<HTMLButtonElement>("[data-demo]").forEach(
    (node) =>
      (node.onclick = () => {
        void setView("demo");
      }),
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-home-action]")
    .forEach((node) => {
      node.onclick = () => {
        const action = node.dataset.homeAction;
        const target =
          action === "demo"
            ? document.querySelector<HTMLButtonElement>("#dd-home [data-demo]")
            : document.querySelector<HTMLButtonElement>(
                `#dd-home [data-entry="${action}"]`,
              );
        target?.click();
      };
    });
  document.querySelectorAll<HTMLButtonElement>("[data-entry]").forEach(
    (node) =>
      (node.onclick = () => {
        const role = node.dataset.entry!;
        if (role === "issuer") {
          void setView("issuer");
          return;
        }
        const roleButton = el(`start-${role}`) as HTMLButtonElement;
        if (roleButton.disabled) {
          document
            .querySelectorAll<HTMLElement>("[data-entry-status]")
            .forEach((message) => {
              message.hidden = false;
              message.textContent =
                "Finish the current wallet action before switching roles.";
            });
          return;
        }
        document
          .querySelectorAll<HTMLElement>("[data-entry-status]")
          .forEach((message) => {
            message.hidden = true;
            message.textContent = "";
          });
        const url = new URL(location.href);
        url.searchParams.set("role", role);
        history.replaceState(null, "", url);
        document.body.dataset.role = role;
        roleButton.click();
        void setView(node.dataset.entryView || "tasks");
        if (node.dataset.entryView === "help") {
          const pass = document.getElementById("reviewer-help");
          if (pass instanceof HTMLDetailsElement) pass.open = true;
        }
        window.scrollTo({ top: 0, behavior: "instant" });
      }),
  );
  for (const id of ["try-demo", "intro-demo"])
    el(id).onclick = () => {
      void setView("demo");
    };
  el("post-task").onclick = () => {
    void setView("tasks");
    const target = el(
      document.body.dataset.role === "reviewer"
        ? "opportunity-section"
        : "commission",
    );
    target.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    target
      .querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
  };
  const title = el("task-title") as HTMLInputElement;
  const reward = el("task-reward") as HTMLInputElement;
  title.addEventListener("input", () => {
    el("preview-title").textContent = title.value.trim() || "Your next review";
  });
  reward.addEventListener("input", () => {
    el("preview-reward").textContent = reward.value || "0";
  });
  window.addEventListener("cutout:live", () => {
    void setView("tasks");
  });
  window.addEventListener("cutout:activity", () => {
    void setView("activity");
  });
  window.addEventListener("cutout:role", () => {
    void setView("tasks");
  });
  const params = new URL(location.href).searchParams;
  const view = params.get("view");
  void setView(
    view &&
      ["home", "tasks", "activity", "help", "demo", "issuer"].includes(view)
      ? view
      : params.has("role")
        ? "tasks"
        : "home",
  );
}
