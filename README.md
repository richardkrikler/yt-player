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

## Proxmox LXC Deployment

### 1. Create the LXC

In the Proxmox web UI:
1. Download the **Debian 12** template via **local storage → CT Templates → Templates**
2. **Create CT** — set ID (e.g. `200`), hostname `yt-player`, allocate resources:
   - CPU: 2 cores / RAM: 1 GB / Disk: 10 GB
3. Enable Docker nesting — on the **Proxmox host**:

```bash
nano /etc/pve/lxc/200.conf
```

Add at the bottom:
```
features: keyctl=1,nesting=1
```

4. Start the LXC

### 2. Install Docker

```bash
# Inside the LXC
apt update && apt install -y ca-certificates curl
curl -fsSL https://get.docker.com | sh
```

### 3. Configure AdGuard DNS Rewrite

In AdGuard Home → **Filters → DNS Rewrites → Add DNS Rewrite**:
- Domain: `YOUR_LOCAL_DOMAIN`
- IP: LXC IP address (find with `ip a` inside the LXC)

### 4. Deploy the App

```bash
git clone <repo> /opt/yt-player
cd /opt/yt-player

cp .env.example .env
nano .env
# Set NUXT_GOOGLE_REDIRECT_URI=https://YOUR_LOCAL_DOMAIN/api/youtube/callback
# Set DATABASE_URL=/app/data/yt-player.db

mkdir -p /opt/yt-player/data
docker compose up -d
```

### 5. Install Caddy

```bash
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

### 6. Trust Caddy's Root CA (once per device)

Caddy generates a local root CA at `/data/caddy/pki/authorities/local/root.crt`.

```bash
# Copy to your machine
scp root@<LXC_IP>:/data/caddy/pki/authorities/local/root.crt ~/caddy-home-ca.crt
```

Install it as a trusted root CA on each device:

| Device | Steps |
|---|---|
| macOS | Double-click → Keychain Access → set to **Always Trust** |
| Windows | Double-click → Install → **Trusted Root Certification Authorities** |
| Linux | `cp caddy-home-ca.crt /usr/local/share/ca-certificates/ && update-ca-certificates` |
| Android | Settings → Security → **Install CA certificate** |
| iOS | AirDrop or email the file → Settings → **Profile Downloaded** → install → General → About → Certificate Trust Settings → enable |

### 7. Update OAuth Redirect URI

In Google Cloud Console → Credentials → your OAuth client → add:
`https://YOUR_LOCAL_DOMAIN/api/youtube/callback`

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
