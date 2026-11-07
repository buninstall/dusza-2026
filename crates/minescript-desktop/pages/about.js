const shell = window.__MINESCRIPT__ ?? {};
const setText = (id, text) => {
  const element = document.getElementById(id);
  if (element && text) {
    element.textContent = text;
  }
};
const platforms = { macos: "macOS", windows: "Windows", linux: "Linux" };

setText(
  "version",
  shell.version && `Verzió ${shell.version} · ${platforms[shell.platform] ?? shell.platform}`,
);
setText("shell", shell.tauri && `Tauri ${shell.tauri}`);
setText("link", shell.gateway ? "Fejlesztői átjárón át" : "Közvetlen");

try {
  const server = new URL(shell.url);
  setText("server", server.host);
  document.getElementById("website")?.addEventListener("click", () => {
    window.location.href = server.toString();
  });
} catch {
  document.getElementById("website")?.remove();
}
