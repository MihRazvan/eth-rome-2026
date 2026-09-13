// Presentation navigation stays available even when a sponsor network is offline.
let cleanupDemo: (() => void) | undefined;
let requestedView = "tasks";
const el = (id: string) => document.getElementById(id)!;
export async function setView(view: string) {
  requestedView = view;
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
  el("live-workspace").hidden = view === "demo";
  el("cutout-demo").hidden = view !== "demo";
  document.querySelector<HTMLElement>(".workspace-heading")!.hidden =
    view === "demo";
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
              "A qualified reviewer. A report encrypted for both of you.",
            ];
  el("workspace-title").textContent = copy[0];
  el("workspace-description").textContent = copy[1];
  el("post-task").hidden = true;
  el("intro-demo").textContent = "How it works ↗";
  el("intro-demo").hidden = view !== "tasks";
  el("rail-caption").textContent = reviewer
    ? "Let your work speak."
    : "Make room for good work.";
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
  document.body.dataset.role = new URL(location.href).searchParams.get("role") === "reviewer" ? "reviewer" : "client";
  document.querySelectorAll<HTMLButtonElement>(".rail-nav [data-view]").forEach(
    (b) =>
      (b.onclick = () => {
        void setView(b.dataset.view!);
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
  void setView(
    new URL(location.href).searchParams.get("view") === "demo"
      ? "demo"
      : "tasks",
  );
}
