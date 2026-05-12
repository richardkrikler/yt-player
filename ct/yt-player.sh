#!/usr/bin/env bash
source <(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/misc/build.func)
# Copyright (c) 2021-2026 community-scripts ORG
# Author: yourname
# License: MIT | https://github.com/community-scripts/ProxmoxVE/raw/main/LICENSE
# Source: https://forgejo.yourdomain.local/youruser/yt-player

APP="yt-player"
var_tags="${var_tags:-media;nuxt}"
var_disk="${var_disk:-4}"
var_cpu="${var_cpu:-1}"
var_ram="${var_ram:-512}"
var_os="${var_os:-debian}"
var_version="${var_version:-13}"
var_unprivileged="${var_unprivileged:-1}"

header_info "$APP"
variables
color
catch_errors

function update_script() {
  header_info
  check_container_storage
  check_container_resources
  if [[ ! -d /opt/yt-player ]]; then
    msg_error "No ${APP} Installation Found!"
    exit
  fi

  FORGEJO="http://git.home.richardkrikler.at:3000"
  REPO="richardkrikler/yt-player"

  CURRENT=$(cat /opt/yt-player/version 2>/dev/null || echo "none")
  LATEST=$(curl -fsSL "${FORGEJO}/api/v1/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | cut -d'"' -f4)

  if [[ -z "$LATEST" ]]; then
    msg_error "Could not reach Forgejo — check network or FORGEJO URL in /usr/local/bin/update"
    exit
  fi
  if [[ "$CURRENT" == "$LATEST" ]]; then
    msg_ok "Already on ${LATEST} — nothing to do."
    exit
  fi

  msg_info "Updating ${APP} ${CURRENT} → ${LATEST}"
  systemctl stop yt-player
  curl -fsSL "${FORGEJO}/${REPO}/releases/download/${LATEST}/yt-player.tar.gz" \
    | tar -xz -C /opt/yt-player/app
  echo "$LATEST" >/opt/yt-player/version
  systemctl start yt-player
  msg_ok "Updated to ${LATEST}"
  exit
}

start
build_container
description

msg_ok "Completed Successfully!\n"
echo -e "${CREATING}${GN}${APP} setup has been successfully initialized!${CL}"
echo -e "${INFO}${YW} Access it using the following URL:${CL}"
echo -e "${TAB}${GATEWAY}${BGN}http://${IP}:3000${CL}"
