(() => {
  const shell = __SHELL__;
  if (location.protocol === "tauri:" || location.hostname === "tauri.localhost") {
    Object.defineProperty(window, "__MINESCRIPT__", { value: Object.freeze(shell) });
  }
  const pin = (element) => element?.style.setProperty("overscroll-behavior", "none");
  const root = document.documentElement;
  if (root) {
    root.dataset.shell = "desktop";
    pin(root);
  }
  if (document.body) {
    pin(document.body);
  } else {
    document.addEventListener("DOMContentLoaded", () => pin(document.body), { once: true });
  }
})();
