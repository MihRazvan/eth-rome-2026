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
          "Your work.",
          "Every step.",
          "Follow your funded tasks, open delivered reports, and check payment receipts.",
        ]
      : view === "help"
        ? [
            "Your workspace.",
            "Your keys.",
            "Connect your wallet and report storage. Your private keys stay on your device.",
          ]
        : reviewer
          ? [
              "Your expertise.",
              "Less exposure.",
              "Find a funded task. Prove you qualify without sharing your credential identifier. Deliver privately.",
            ]
          : [
              "Good work.",
              "Less exposure.",
              "Hire a qualified reviewer. Keep their credential details private, and the report between the two of you.",
            ];
  el("workspace-title").replaceChildren(
    document.createTextNode(copy[0]),
    document.createElement("br"),
  );
  const emphasis = document.createElement("em");
  emphasis.textContent = copy[1];
  el("workspace-title").append(emphasis);
  el("workspace-description").textContent = copy[2];
  el("rail-caption").textContent = reviewer
    ? "Let your work speak."
    : "Make room for good work.";
  el("post-task").textContent = reviewer ? "Find a task" : "Post a task";
  el("view-caption").textContent =
    view === "tasks"
      ? "A SECOND SET OF EYES. ON YOUR TERMS."
      : view === "activity"
        ? "THE WORK, FROM START TO FINISH."
        : "A LITTLE SETUP. THEN GOOD WORK.";
  if (view === "demo" && !cleanupDemo) {
    const { mountCutoutDemo } = await import("./demo");
    if (requestedView === "demo" && !cleanupDemo)
      cleanupDemo = mountCutoutDemo(el("cutout-demo"));
  }
}
export function revealInWorkspace(target: HTMLElement) {
  const screen = target.closest<HTMLElement>("[data-screen]")?.dataset.screen;
  if (screen && document.body.dataset.view !== screen) void setView(screen);
  const details = target.closest("details");
  if (details) details.open = true;
}
export function mountShell() {
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
