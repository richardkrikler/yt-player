#!/usr/bin/env bash
set -euo pipefail

FORGEJO="http://git.home.richardkrikler.at:3000"
REPO="richardkrikler/yt-player"
APP="yt-player"

YW='\033[33m' GN='\033[1;92m' RD='\033[01;31m' CL='\033[m'
BFR='\r\033[K'
msg_info()  { printf " ${YW}%s...${CL}" "$1"; }
msg_ok()    { printf "${BFR} ${GN}✔ %s${CL}\n" "$1"; }
msg_error() { printf "${BFR} ${RD}✘ %s${CL}\n" "$1" >&2; exit 1; }

[[ "$(id -u)" -ne 0 ]] && msg_error "Run as root on the Proxmox host"
command -v pct >/dev/null 2>&1  || msg_error "pct not found — run on Proxmox host"
command -v pvesh >/dev/null 2>&1 || msg_error "pvesh not found — run on Proxmox host"

CTID=$(pvesh get /cluster/nextid)
STORAGE=$(pvesm status -content rootdir 2>/dev/null | awk 'NR>1 && $3=="active" {print $1}' | head -1)
[[ -z "$STORAGE" ]] && msg_error "No active rootdir storage found"

# Find or download Debian 13 template
TEMPLATE=$(pveam list local 2>/dev/null | awk '/debian-13-standard/{print $1}' | head -1 | sed 's|local:vztmpl/||')
if [[ -z "$TEMPLATE" ]]; then
  msg_info "Downloading Debian 13 template"
  pveam update >/dev/null 2>&1
  TEMPLATE=$(pveam available --section system 2>/dev/null | awk '/debian-13-standard/{print $2}' | head -1)
  [[ -z "$TEMPLATE" ]] && msg_error "Could not find Debian 13 template"
  pveam download local "$TEMPLATE" >/dev/null 2>&1
  msg_ok "Downloaded Debian 13 template"
fi

msg_info "Creating LXC ${CTID}"
pct create "$CTID" "local:vztmpl/${TEMPLATE}" \
  --hostname "$APP" \
  --cores 1 --memory 512 \
  --rootfs "${STORAGE}:4" \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1 \
  --start 1 >/dev/null 2>&1
msg_ok "Created LXC ${CTID}"

msg_info "Waiting for network"
sleep 8
msg_ok "Network ready"

msg_info "Running installer"
pct exec "$CTID" -- bash -c "$(curl -fsSL "${FORGEJO}/${REPO}/raw/branch/main/proxmox/install/yt-player-install.sh")"
msg_ok "Installation complete"

IP=$(pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}')
printf "\n ${GN}✔ %s is ready!${CL}\n" "$APP"
printf "   Access:  http://%s:3000\n" "$IP"
printf "   Config:  pct exec %s -- nano /opt/yt-player/.env\n" "$CTID"
printf "   Restart: pct exec %s -- systemctl restart yt-player\n\n" "$CTID"
