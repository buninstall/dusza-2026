const HIDDEN_DEMO_HOSTS = new Set(["minescript.hu", "www.minescript.hu"]);

export function isDemoShownOn(hostname: string): boolean {
  return !HIDDEN_DEMO_HOSTS.has(hostname.toLowerCase().replace(/\.$/, ""));
}

export function isDemoShown(): boolean {
  return typeof window === "undefined" || isDemoShownOn(window.location.hostname);
}
