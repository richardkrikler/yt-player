#!/usr/bin/env bash

# Copyright (c) 2021-2026 community-scripts ORG
# Author: richardkrikler
# License: MIT | https://github.com/community-scripts/ProxmoxVE/raw/main/LICENSE
# Source: http://git.home.richardkrikler.at:3000/richardkrikler/yt-player

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

FORGEJO="http://git.home.richardkrikler.at:3000"
REPO="richardkrikler/yt-player"

NODE_VERSION="24" setup_nodejs

msg_info "Setting up directories"
mkdir -p /opt/yt-player/{app,data}
msg_ok "Set up directories"

msg_info "Fetching latest release"
LATEST=$(curl -fsSL "${FORGEJO}/api/v1/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | cut -d'"' -f4)
if [[ -z "$LATEST" ]]; then
  msg_error "Could not fetch release info from ${FORGEJO}"
  exit 1
fi
curl -fsSL "${FORGEJO}/${REPO}/releases/download/${LATEST}/yt-player.tar.gz" \
  | tar -xz -C /opt/yt-player/app
echo "$LATEST" >/opt/yt-player/version
msg_ok "Installed ${LATEST}"

msg_info "Creating environment file"
curl -fsSL "${FORGEJO}/${REPO}/raw/tag/${LATEST}/.env.example" -o /opt/yt-player/.env
msg_ok "Created environment file"

msg_info "Creating service"
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
User=nobody
Group=nogroup

[Install]
WantedBy=multi-user.target
EOF
chown -R nobody:nogroup /opt/yt-player/data
$STD systemctl enable -q --now yt-player
msg_ok "Created and started service"

motd_ssh
customize
# customize() writes /usr/bin/update pointing to community-scripts GitHub.
# Overwrite it to point to our Forgejo instance instead.
echo "bash -c \"\$(curl -fsSL ${FORGEJO}/${REPO}/raw/branch/main/ct/yt-player.sh)\"" >/usr/bin/update
chmod +x /usr/bin/update
cleanup_lxc
