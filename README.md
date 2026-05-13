# YT Player

A self-hosted, multi-user YouTube playlist manager. Import private and public playlists, cache video metadata locally, and play videos through an embedded YouTube player — with search, random playback, and playlist sharing between users.

---

## Features

- **Private & public playlists** — import your own YouTube playlists via OAuth, or add any public playlist by URL
- **Local cache** — video metadata stored in SQLite; force-refresh on demand
- **Playback** — embedded YouTube iframe player with next / previous / random navigation
- **Search** — full-text search across titles, descriptions, tags, and channel names
- **Sharing** — share playlists with other registered users
- **Role-based access** — `admin` (first registrant) and `user` roles
- **Self-hosted** — runs on a Proxmox LXC via Docker Compose with Caddy reverse proxy

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Nuxt 4 (Vue 3, TypeScript) |
| Runtime | Node.js 24 LTS |
| Package manager | pnpm |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| Auth | `nuxt-auth-utils` — email/password sessions |
| YouTube | Google APIs (YouTube Data API v3) |
| UI | Nuxt UI v4 (Tailwind CSS v4) |
| Deployment | Docker Compose + Caddy on Proxmox LXC |

---

## Local Development

### Prerequisites

- [Node.js 24 LTS](https://nodejs.org/en/download)
- pnpm — `npm i -g pnpm`
- A Google Cloud project with YouTube Data API v3 enabled (see [Google Setup](#google-cloud-console-setup))

### Steps

```bash
# 1. Clone and install
git clone <repo>
cd yt-player
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in all values (see Environment Variables below)

# 3. Start the dev server
pnpm dev
# → http://localhost:3000
```

The SQLite database is created automatically at `./data/yt-player.db` on first run.  
The **first account to register** is automatically assigned the `admin` role.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NUXT_SESSION_PASSWORD` | ✅ | Min 32-char secret for session cookies — `openssl rand -hex 32` |
| `NUXT_TOKEN_ENCRYPTION_KEY` | ✅ | Min 32-char key for AES-256 encryption of OAuth tokens — `openssl rand -hex 32` |
| `NUXT_GOOGLE_CLIENT_ID` | ✅ | OAuth 2.0 client ID from Google Cloud Console |
| `NUXT_GOOGLE_CLIENT_SECRET` | ✅ | OAuth 2.0 client secret |
| `NUXT_GOOGLE_REDIRECT_URI` | ✅ | Must match the redirect URI registered in Google Cloud Console |
| `NUXT_YOUTUBE_API_KEY` | ✅ | API key for fetching public playlists (no OAuth required) |
| `DATABASE_URL` | — | Path to SQLite file (default: `./data/yt-player.db`) |

---

## Google Cloud Console Setup

> Google OAuth is used **only** to connect a YouTube account after login — it is not the app login mechanism. Users log in with email and password.

### 1. Create a Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **Select a project → New Project** — name it (e.g. `yt-player`) and create

### 2. Enable YouTube Data API v3

1. **APIs & Services → Library**
2. Search `YouTube Data API v3` → **Enable**

### 3. Configure OAuth Consent Screen

1. **APIs & Services → OAuth consent screen**
2. User type: **External**
3. Fill in app name, support email, developer email
4. **Scopes** — add only: `https://www.googleapis.com/auth/youtube.readonly`
5. **Test users** — add Google accounts that will connect YouTube while in test mode
6. Save

### 4. Create OAuth 2.0 Credentials

1. **Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs:
   - Local dev: `http://localhost:3000/api/youtube/callback`
   - Production: `https://YOUR_LOCAL_DOMAIN/api/youtube/callback`
4. Copy **Client ID** and **Client Secret** → paste into `.env`

### 5. Create an API Key

1. **Credentials → Create Credentials → API key**
2. Restrict to **YouTube Data API v3** and your server IP
3. Copy the key → `NUXT_YOUTUBE_API_KEY` in `.env`

---

## Release & CI Workflow

Releases are built automatically by Forgejo Actions.

### Publishing a release

```bash
git tag v1.2.3
git push origin v1.2.3
```

Forgejo Actions (`.forgejo/workflows/release.yml`) triggers on every `v*` tag:

1. Checks out the repo inside a `node:24-slim` container
2. Runs `pnpm install && pnpm build`
3. Archives `.output/` → `yt-player.tar.gz`
4. Uploads it as a release asset via `forgejo-release@v2.11.3`

The resulting asset is available at:
```
http://git.home.richardkrikler.at:3000/richardkrikler/yt-player/releases/download/<tag>/yt-player.tar.gz
```

### Updating an installed instance

From inside the LXC:

```bash
update
```

Stops the service, downloads the latest release tarball from Forgejo, extracts it in-place, and restarts. The `/usr/bin/update` script is self-contained and baked in at install time.

---

## Proxmox LXC Deployment

### Install (one-liner on the Proxmox host)

```bash
bash -c "$(curl -fsSL http://git.home.richardkrikler.at:3000/richardkrikler/yt-player/raw/branch/main/proxmox/ct/yt-player.sh)"
```

Creates a Debian 13 LXC, installs Node.js 24 and the latest release, and sets up a systemd service. Defaults:

| | |
|---|---|
| OS | Debian 13 |
| CPU | 1 core |
| RAM | 512 MB |
| Disk | 4 GB |
| Nameserver | `192.168.1.202` (override: `var_ns=x.x.x.x bash ct/yt-player.sh`) |

### Post-install configuration

SSH into the LXC and edit the environment file:

```bash
nano /opt/yt-player/.env
```

Fill in the required secrets (see [Environment Variables](#environment-variables)), then:

```bash
systemctl restart yt-player
```

The app is now available at `http://<LXC_IP>:3000`.

**Paths inside the LXC:**

| Path | Purpose |
|---|---|
| `/opt/yt-player/app` | Application build output |
| `/opt/yt-player/data/yt-player.db` | SQLite database |
| `/opt/yt-player/.env` | Environment / secrets |
| `/opt/yt-player/version` | Installed version tag |

### Optional: Caddy reverse proxy with HTTPS

```bash
# Inside the LXC
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

`/etc/caddy/Caddyfile`:
```
YOUR_LOCAL_DOMAIN {
    reverse_proxy localhost:3000
    tls internal
}
```

```bash
systemctl reload caddy
```

Add a DNS rewrite in AdGuard Home (or your local DNS):
- Domain: `YOUR_LOCAL_DOMAIN` → LXC IP

Update `NUXT_GOOGLE_REDIRECT_URI` in `.env` to `https://YOUR_LOCAL_DOMAIN/api/youtube/callback`, then `systemctl restart yt-player`.

#### Trust Caddy's Root CA (once per device)

```bash
# Copy the CA cert from the LXC to your machine
scp root@<LXC_IP>:/data/caddy/pki/authorities/local/root.crt ~/caddy-home-ca.crt
```

| Device | Steps |
|---|---|
| macOS | Double-click → Keychain Access → set to **Always Trust** |
| Windows | Double-click → Install → **Trusted Root Certification Authorities** |
| Linux | `cp caddy-home-ca.crt /usr/local/share/ca-certificates/ && update-ca-certificates` |
| Android | Settings → Security → **Install CA certificate** |
| iOS | AirDrop or email → Settings → **Profile Downloaded** → install → General → About → Certificate Trust Settings → enable |

---

## Project Structure

```
yt-player/
├── app/                        # Nuxt 4 frontend (srcDir)
│   ├── components/
│   │   ├── AppSearchBar.vue    # Global search with results dropdown
│   │   ├── PlayerIframe.vue    # YouTube iframe + prev/next/random controls
│   │   ├── PlaylistCard.vue    # Playlist grid card
│   │   ├── ShareModal.vue      # Share playlist with another user
│   │   └── VideoList.vue       # Ordered, clickable video list
│   ├── composables/
│   │   ├── usePlayer.ts        # Playback state (current video, next/prev/random)
│   │   ├── usePlaylist.ts      # Playlist CRUD and import
│   │   └── useSearch.ts        # Debounced FTS search
│   ├── layouts/
│   │   ├── auth.vue            # Centered card layout for login/register
│   │   └── default.vue         # App shell with top nav
│   ├── middleware/
│   │   ├── auth.global.ts      # Redirect unauthenticated users to /login
│   │   └── admin.ts            # Block non-admins from /admin
│   └── pages/
│       ├── index.vue           # Playlist dashboard + import flows
│       ├── login.vue
│       ├── register.vue
│       ├── settings.vue        # Profile + YouTube connection
│       ├── shared.vue          # Playlists shared with me
│       ├── admin/index.vue     # User and playlist management
│       └── playlist/[id].vue   # Video list + player
├── server/
│   ├── api/
│   │   ├── auth/               # register, login, logout, me, YouTube OAuth
│   │   ├── playlists/          # CRUD, import, share, fetch-videos, refresh
│   │   ├── search.get.ts       # FTS5 full-text search
│   │   └── admin/              # User and playlist admin endpoints
│   ├── db/
│   │   ├── index.ts            # better-sqlite3 connection (WAL mode)
│   │   └── schema.ts           # Drizzle ORM schema
│   ├── plugins/
│   │   └── database.ts         # CREATE TABLE IF NOT EXISTS on startup
│   └── utils/
│       ├── crypto.ts           # AES-256-GCM token encryption
│       ├── youtube.ts          # YouTube API client + URL parser
│       ├── cache.ts            # TTL helpers (metadata: 24h, videos: 6h)
│       └── requireRole.ts      # requireAuth / requireAdmin guards
├── types/
│   └── auth.d.ts               # nuxt-auth-utils User type augmentation
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── nuxt.config.ts
└── SPEC.md                     # Full project definition and architecture
```

---

## Available Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |
| `pnpm db:push` | Sync Drizzle schema to DB (dev only) |
| `pnpm db:generate` | Generate SQL migration files |
| `pnpm db:studio` | Open Drizzle Studio (visual DB browser) |

---

## Cache Behaviour

There is no automatic cache expiry. All data is fetched on demand and stored indefinitely until the user explicitly refreshes it.

| Data | How to refresh |
|---|---|
| Playlist metadata (title, count) | Refresh button on playlist card |
| Full video list + video metadata | Fetch button on playlist card / playlist page |

Nothing is fetched in the background.
