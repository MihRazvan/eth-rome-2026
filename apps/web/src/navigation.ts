/** Only public navigation metadata belongs in a route. Never serialize offer terms or keys. */
export type AppPage = "markets" | "trade" | "portfolio" | "claim";
export type AppRoute = {
  page: AppPage;
  claimId?: string;
  mode: "public" | "private";
  invalidClaim?: boolean;
};
const pages = new Set<AppPage>(["markets", "trade", "portfolio", "claim"]);
export function readRoute(search: string): AppRoute {
  const params = new URLSearchParams(search);
  const page = params.get("view");
  const claimId = params.get("claim");
  const validClaim = claimId !== null && /^[1-9]\d{0,77}$/.test(claimId);
  return {
    page: pages.has(page as AppPage) ? (page as AppPage) : "markets",
    claimId: validClaim ? claimId : undefined,
    invalidClaim: claimId !== null && !validClaim,
    mode: params.get("offers") === "private" ? "private" : "public",
  };
}
export function routeUrl(current: string, route: AppRoute): string {
  const url = new URL(current);
  url.searchParams.set("view", route.page);
  if (route.claimId && /^[1-9]\d{0,77}$/.test(route.claimId))
    url.searchParams.set("claim", route.claimId);
  else if (!route.invalidClaim) url.searchParams.delete("claim");
  url.searchParams.set("offers", route.mode);
  return `${url.pathname}${url.search}${url.hash}`;
}
