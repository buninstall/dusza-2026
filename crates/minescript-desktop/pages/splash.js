const shell = window.__MINESCRIPT__ ?? { url: `${window.location.origin}/` };
const stage = document.querySelector(".stage");
const status = document.getElementById("status");
const detail = document.getElementById("detail");
const retry = document.getElementById("retry");
const RETRY_SECONDS = 10;
let countdown = 0;
let timer = 0;

function healthUrl() {
  return new URL("/api/health", shell.url).toString();
}

async function probe() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(healthUrl(), {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.type === "opaque") {
      return "ok";
    }
    if (response.status === 401) {
      return "denied";
    }
    return response.status < 500 ? "ok" : "offline";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timeout);
  }
}

function showOffline() {
  stage.dataset.state = "offline";
  status.textContent = "A bánya most nem érhető el.";
  countdown = RETRY_SECONDS;
  tick();
  timer = setInterval(tick, 1000);
  retry.focus();
}

function showDenied() {
  stage.dataset.state = "offline";
  status.textContent = "A szerver kapuja elutasította a belépést.";
  detail.textContent =
    "Ellenőrizd a MINESCRIPT_GATEWAY_TOKEN környezeti változót, majd indítsd újra az alkalmazást.";
  retry.focus();
}

function tick() {
  if (countdown <= 0) {
    connect();
    return;
  }
  detail.textContent = `Ellenőrizd az internetkapcsolatot. Újrapróbálás ${countdown} másodperc múlva.`;
  countdown -= 1;
}

async function connect() {
  clearInterval(timer);
  stage.dataset.state = "loading";
  status.textContent = navigator.onLine
    ? "Kapcsolódás a bányához…"
    : "Nincs internetkapcsolat, várakozás…";
  const result = await probe();
  if (result === "ok") {
    status.textContent = "Leszállás a tárnába…";
    window.location.replace(shell.url);
  } else if (result === "denied") {
    showDenied();
  } else {
    showOffline();
  }
}

retry.addEventListener("click", connect);
window.addEventListener("online", connect);
connect();
