#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C

FORGEJO="http://git.home.richardkrikler.at:3000"
REPO="richardkrikler/yt-player"

echo "Updating OS..."
apt-get update -qq && apt-get upgrade -y -qq

echo "Installing dependencies..."
apt-get install -y curl jq >/dev/null 2>&1

echo "Installing Node.js 24..."
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null 2>&1
apt-get install -y nodejs >/dev/null 2>&1

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
curl -fsSL "${FORGEJO}/${REPO}/raw/tag/${LATEST}/.env.example" -o /opt/yt-player/.env
chown -R yt-player:yt-player /opt/yt-player

echo "Creating systemd service..."
cat >/etc/systemd/system/yt-player.service <<EOF
[Unit]
Description=YT Player
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/yt-player/app
EnvironmentFile=/opt/yt-player/.env
Environment=DATABASE_URL=/opt/yt-player/data/yt-player.db
ExecStart=/usr/bin/node /opt/yt-player/app/server/index.mjs
Restart=on-failure
RestartSec=5
User=yt-player
Group=yt-player

[Install]
WantedBy=multi-user.target
EOF
systemctl enable -q yt-player

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
echo "  1. Edit /opt/yt-player/.env"
echo "  2. systemctl start yt-player"
echo ""
