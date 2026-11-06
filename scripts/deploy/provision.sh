#!/usr/bin/env bash
set -Eeuo pipefail
shopt -s inherit_errexit

readonly DOMAIN="${MINESCRIPT_DOMAIN:-csapat13.dusza.cloudsyso.com}"
readonly GATE_USER="${MINESCRIPT_GATE_USER:-csapat13}"
readonly FIRST_REF="${MINESCRIPT_REF:-main}"
readonly ROOT="/srv/minescript"
readonly REPO="$ROOT/repo"
readonly TEMPLATES="$REPO/scripts/deploy/templates"
readonly ENV_DIR="/etc/minescript"
readonly ENV_FILE="$ENV_DIR/minescript.env"
readonly SERVICE_USER="minescript"
DEPLOY_USER="$(id -un)"
readonly DEPLOY_USER
readonly DATABASE="minescript"
readonly SWAPFILE="/swapfile"

export PATH="$HOME/.cargo/bin:$HOME/.bun/bin:$HOME/.local/bin:$PATH"

log() { printf '\033[36m› %s\033[0m\n' "$*"; }
ok() { printf '\033[32m✓ %s\033[0m\n' "$*"; }
die() {
  printf '\033[31m✗ %s\033[0m\n' "$*" >&2
  exit 1
}

[[ "$(id -u)" -ne 0 ]] || die "A telepítő felhasználóval futtasd (nem rootként); a szkript sudo-t használ."
[[ -d "$REPO/.git" ]] || die "Nincs repó itt: $REPO (lásd docs/telepites.md, 1. lépés)."
sudo -n true 2>/dev/null || die "Jelszó nélküli sudo szükséges."

install_template() {
  local source="$1" target="$2" mode="${3:-644}"
  sed -e "s|@DOMAIN@|$DOMAIN|g" -e "s|@USER@|$DEPLOY_USER|g" "$TEMPLATES/$source" | sudo tee "$target" >/dev/null
  sudo chmod "$mode" "$target"
}

setup_packages() {
  log "Csomagok"
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq apache2-utils build-essential curl git openssl unzip >/dev/null
}

setup_swap() {
  if [[ -z "$(swapon --noheadings)" ]]; then
    log "2 GiB swap (a fordítás ne szorítsa ki a MySQL-t)"
    sudo fallocate -l 2G "$SWAPFILE"
    sudo chmod 600 "$SWAPFILE"
    sudo mkswap "$SWAPFILE" >/dev/null
    sudo swapon "$SWAPFILE"
    grep -q "^$SWAPFILE " /etc/fstab || echo "$SWAPFILE none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
    printf 'vm.swappiness=10\n' | sudo tee /etc/sysctl.d/90-minescript.conf >/dev/null
    sudo sysctl -q -p /etc/sysctl.d/90-minescript.conf
  fi
}

setup_toolchain() {
  log "Fordítóeszközök"
  command -v rustup >/dev/null ||
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none --no-modify-path
  command -v bun >/dev/null || curl -fsSL https://bun.sh/install | bash >/dev/null
  install -d "$HOME/.local/bin"
  command -v just >/dev/null ||
    curl --proto "=https" --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to "$HOME/.local/bin"
  if ! command -v wasm-opt >/dev/null; then
    local tag tmp
    tag="$(curl -fsSL https://api.github.com/repos/WebAssembly/binaryen/releases/latest | sed -n 's/.*"tag_name": *"\(version_[0-9]*\)".*/\1/p' | head -n1)"
    tmp="$(mktemp -d)"
    curl -fsSL "https://github.com/WebAssembly/binaryen/releases/download/$tag/binaryen-$tag-x86_64-linux.tar.gz" | tar -xz -C "$tmp"
    rm -rf "$HOME/.local/binaryen"
    mv "$tmp/binaryen-$tag" "$HOME/.local/binaryen"
    ln -sfn "$HOME/.local/binaryen/bin/wasm-opt" "$HOME/.local/bin/wasm-opt"
    rm -rf "$tmp"
  fi
  sudo install -m 755 "$REPO/scripts/deploy/minescriptctl" /usr/local/bin/minescriptctl
  minescriptctl tools
}

setup_layout() {
  log "Felhasználó és könyvtárak"
  id -u "$SERVICE_USER" >/dev/null 2>&1 ||
    sudo useradd --system --user-group --no-create-home --home-dir /var/lib/minescript --shell /usr/sbin/nologin "$SERVICE_USER"
  sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 755 "$ROOT" "$ROOT/releases" "$ROOT/www"
  sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 700 "$ROOT/backups"
  install -m 644 "$TEMPLATES/karbantartas.html" "$ROOT/www/karbantartas.html"
}

setup_mysql() {
  log "MySQL"
  if ! sudo cmp -s "$TEMPLATES/mysql-minescript.cnf" /etc/mysql/mysql.conf.d/zz-minescript.cnf; then
    install_template mysql-minescript.cnf /etc/mysql/mysql.conf.d/zz-minescript.cnf
    sudo systemctl restart mysql
  fi
  if sudo test -s "$ENV_FILE"; then
    ok "A $ENV_FILE már létezik, a jelszó marad."
    return 0
  fi
  local password
  password="$(openssl rand -hex 32)"
  sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$DATABASE'@'127.0.0.1' IDENTIFIED BY '$password';
ALTER USER '$DATABASE'@'127.0.0.1' IDENTIFIED BY '$password';
GRANT ALL PRIVILEGES ON \`$DATABASE\`.* TO '$DATABASE'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  sudo install -d -m 750 -o root -g "$SERVICE_USER" "$ENV_DIR"
  sudo install -m 640 -o root -g "$SERVICE_USER" /dev/null "$ENV_FILE"
  printf 'DATABASE_URL=mysql://%s:%s@127.0.0.1:3306/%s\nHOST=127.0.0.1\nPORT=8080\nTRUST_PROXY=1\n' \
    "$DATABASE" "$password" "$DATABASE" | sudo tee "$ENV_FILE" >/dev/null
  ok "Adatbázis és fiók kész; a kapcsolati adat: $ENV_FILE (root:$SERVICE_USER 640)"
}

setup_systemd() {
  log "systemd egységek"
  install_template minescript.service /etc/systemd/system/minescript.service
  install_template minescript-autodeploy.service /etc/systemd/system/minescript-autodeploy.service
  install_template minescript-autodeploy.timer /etc/systemd/system/minescript-autodeploy.timer
  sudo systemctl daemon-reload
  sudo systemctl enable minescript.service >/dev/null 2>&1
}

setup_apache() {
  log "Apache (a beállítás idejére leáll, így közben sem nyilvános)"
  sudo systemctl stop apache2
  sudo a2dismod -q php8.3 mpm_prefork status autoindex cgi cgid 2>/dev/null || true
  sudo a2enmod -q mpm_event proxy proxy_http headers remoteip deflate alias auth_basic authn_file authz_user reqtimeout >/dev/null
  sudo a2disconf -q serve-cgi-bin 2>/dev/null || true
  install_template apache-hardening.conf /etc/apache2/conf-available/zz-minescript-hardening.conf
  sudo a2enconf -q zz-minescript-hardening >/dev/null
  install_template apache-minescript.conf /etc/apache2/sites-available/minescript.conf
  sudo a2dissite -q 000-default 2>/dev/null || true
  sudo a2ensite -q minescript >/dev/null
  sudo install -d -m 755 /etc/apache2/minescript
  if ! sudo test -s /etc/apache2/minescript/htpasswd; then
    minescriptctl gate passwd "$GATE_USER"
  fi
  minescriptctl gate on
}

setup_packages
setup_swap
setup_toolchain
setup_layout
setup_mysql
setup_systemd
setup_apache
log "Első telepítés"
minescriptctl deploy --force --ref "$FIRST_REF"
minescriptctl status
ok "Kész: https://$DOMAIN (a kapu be van kapcsolva)"
