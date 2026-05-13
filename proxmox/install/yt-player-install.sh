#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C

FORGEJO="http://git.home.richardkrikler.at:3000"
REPO="richardkrikler/yt-player"

echo "Updating OS..."
apt-get update -qq && apt-get upgrade -y -qq

echo "Installing dependencies..."
apt-get install -y curl jq debian-keyring debian-archive-keyring apt-transport-https >/dev/null 2>&1

echo "Installing Node.js 24..."
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null 2>&1
apt-get install -y nodejs >/dev/null 2>&1

echo "Installing Caddy..."
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
chmod o+r /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y caddy >/dev/null 2>&1

echo "Fetching latest release..."
LATEST=$(curl -fsSL "${FORGEJO}/api/v1/repos/${REPO}/releases/latest" | jq -r '.tag_name')
if [[ -z "$LATEST" || "$LATEST" == "null" ]]; then
  echo "ERROR: Could not fetch release from ${FORGEJO}" >&2
  exit 1
fi

echo "Creating service user..."
adduser --system --shell /bin/bash --gecos 'YT Player' \
  --group --disabled-password --home /home/yt-player yt-player

echo "Installing yt-player ${LATEST}..."
mkdir -p /opt/yt-player/{app,data}
curl -fsSL "${FORGEJO}/${REPO}/releases/download/${LATEST}/yt-player.tar.gz" \
  | tar -xz -C /opt/yt-player/app
echo "$LATEST" >/opt/yt-player/version

echo "Configuring environment..."
curl -fsSL "${FORGEJO}/${REPO}/raw/tag/${LATEST}/.env.example" -o /opt/yt-player/.env
# Pin the database path
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=/opt/yt-player/data/yt-player.db|" /opt/yt-player/.env
# Generate required secrets
sed -i "s|^NUXT_SESSION_PASSWORD=.*|NUXT_SESSION_PASSWORD=$(openssl rand -hex 32)|" /opt/yt-player/.env
sed -i "s|^NUXT_TOKEN_ENCRYPTION_KEY=.*|NUXT_TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)|" /opt/yt-player/.env

chown -R yt-player:yt-player /opt/yt-player

echo "Creating yt-player service..."
cat >/etc/systemd/system/yt-player.service <<EOF
[Unit]
Description=YT Player
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/yt-player/app
EnvironmentFile=/opt/yt-player/.env
ExecStart=/usr/bin/node /opt/yt-player/app/server/index.mjs
Restart=on-failure
RestartSec=5
User=yt-player
Group=yt-player

[Install]
WantedBy=multi-user.target
EOF
systemctl enable -q yt-player

echo "Configuring Caddy..."
cat >/etc/caddy/Caddyfile <<'EOF'
yt-player.home.richardkrikler.at {
    reverse_proxy localhost:3000
    tls internal
}
EOF
systemctl enable -q caddy
systemctl reload-or-restart caddy

echo "Creating update command..."
cat >/usr/bin/update <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
FORGEJO="http://git.home.richardkrikler.at:3000"
REPO="richardkrikler/yt-player"
CURRENT=$(cat /opt/yt-player/version 2>/dev/null || echo "none")
LATEST=$(curl -fsSL "${FORGEJO}/api/v1/repos/${REPO}/releases/latest" | jq -r '.tag_name')
[[ -z "$LATEST" || "$LATEST" == "null" ]] && { echo "ERROR: Could not reach Forgejo" >&2; exit 1; }
[[ "$CURRENT" == "$LATEST" ]] && { echo "Already at ${LATEST} — nothing to do."; exit 0; }
echo "Updating yt-player ${CURRENT} → ${LATEST}..."
systemctl stop yt-player
curl -fsSL "${FORGEJO}/${REPO}/releases/download/${LATEST}/yt-player.tar.gz" \
  | tar -xz -C /opt/yt-player/app
chown -R yt-player:yt-player /opt/yt-player/app
echo "$LATEST" >/opt/yt-player/version
systemctl start yt-player
echo "Done — now at ${LATEST}."
SCRIPT
chmod +x /usr/bin/update

echo "Configuring console auto-login..."
mkdir -p /etc/systemd/system/container-getty@1.service.d
cat >/etc/systemd/system/container-getty@1.service.d/override.conf <<'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin root --noclear --keep-baud tty%I 115200,38400,9600 $TERM
EOF
systemctl daemon-reload

echo ""
echo "Install complete (${LATEST})."
echo "  Secrets and DB path are pre-configured."
echo "  Add Google API credentials to /opt/yt-player/.env, then:"
echo "    systemctl start yt-player"
echo "  Access: https://yt-player.home.richardkrikler.at  (trust Caddy CA — see README)"
echo ""
