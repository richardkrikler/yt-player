# YT Player — Project Definition

## Overview

A self-hosted, multi-user YouTube playlist manager. Users authenticate via Google OAuth, connect their YouTube account, and manage private and public playlists through a clean web UI. Video metadata is cached locally in SQLite for fast search, random playback, and offline browsing. Designed to run on a homelab Proxmox server as a persistent service.

---

## Features

| Feature | Detail |
|---|---|
| Private playlist import | Any user can list all their own YouTube playlists via OAuth, then select which to import |
| Public playlist import | Paste any YouTube playlist URL; app extracts the ID and imports as public |
| Metadata cache | Playlist title & video count cached; force-refresh available |
| Video list fetch | Full paginated video list fetched on demand; cached per playlist |
| Playback | Embedded YouTube iframe player with next/previous/random navigation |
| Search | Full-text search across title, description, tags, channel name |
| Sharing | Users can share their playlists with other registered users |
| Multi-user | Role-based access: `admin` and `user` |
| Deployment | Local dev → Proxmox LXC container via Docker Compose |

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Nuxt 4 (Vue 3, TypeScript) — `app/` directory is the default srcDir |
| Runtime | Node.js 24 LTS |
| Package manager | pnpm |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle ORM |
| Auth | `nuxt-auth-utils` (email + password, encrypted cookie sessions) |
| YouTube API | Google APIs (YouTube Data API v3), connected per-user post-login |
| Styling | Nuxt UI (or plain TailwindCSS) |
| Deployment | Docker Compose on Proxmox LXC, Caddy reverse proxy |

---

## Roles & Permissions

### Bootstrap rule
The **first user to register** is automatically assigned the `admin` role. All subsequent registrations default to `user`. This is enforced server-side: on `POST /api/auth/register`, if the `users` table is empty the new user is inserted with `role = 'admin'`.

### `admin`
- Full access to all users, all playlists, and service configuration
- Can create/disable/delete user accounts
- Can force-refresh any playlist cache
- Can see all playlists across all users
- Can revoke shares

### `user`
- Sees only their own playlists (added by them or shared with them)
- Can add public or private playlists to their collection
- Can share their own playlists with other registered users
- Can view a "Shared with me" panel for incoming shares
- Cannot see or interact with other users' playlists unless explicitly shared

### Public playlist deduplication rule
When a user adds a public YouTube playlist that already exists in the `playlists` table (added by another user), the application **reuses the existing row** (same metadata, same cached videos) and only creates a new `user_playlists` entry. No duplicate data is stored. The user sees the playlist in their own collection as normal but has no knowledge of which other user originally added it.

---

## Authentication

### App login
Email + password only. Managed by **`nuxt-auth-utils`** with a custom password handler. Sessions are stored in AES-encrypted, signed HTTP-only cookies. No external provider required to use the app.

### YouTube connection (per-user, optional)
After logging in, users connect their Google/YouTube account from **Settings → Connect YouTube Account**. This triggers a separate Google OAuth 2.0 flow scoped to `youtube.readonly`. The resulting tokens are stored encrypted in the user's DB row. Disconnecting nulls them out.

| User state | Capabilities |
|---|---|
| Logged in, YouTube not connected | Browse & play public playlists already in the system |
| Logged in + YouTube connected | All of the above + list & import their own private YT playlists |

### Auth routes
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (email + password); first user becomes admin |
| POST | `/api/auth/login` | Verify credentials, set session cookie |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user info + role + YouTube connection status |
| GET | `/api/youtube/connect` | Start Google OAuth (YouTube scope); user must be logged in |
| GET | `/api/youtube/callback` | Handle OAuth callback, store encrypted tokens |
| DELETE | `/api/youtube` | Disconnect YouTube (nulls tokens in DB) |

---

## Database Schema

### `users`
```sql
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT    UNIQUE NOT NULL,
  password_hash         TEXT    NOT NULL,                -- bcrypt
  display_name          TEXT,
  avatar_url            TEXT,
  role                  TEXT    NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  -- YouTube connection (all nullable — only set after Connect flow)
  google_id             TEXT    UNIQUE,
  access_token          TEXT,                            -- AES-256 encrypted
  refresh_token         TEXT,                            -- AES-256 encrypted
  token_expires_at      INTEGER,                         -- unix ms
  youtube_connected_at  INTEGER,                         -- NULL = not connected
  created_at            INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);
```

### `playlists`
```sql
CREATE TABLE playlists (
  id                  TEXT    PRIMARY KEY,                -- YouTube playlist ID (PLxxx...)
  owner_user_id       INTEGER NOT NULL REFERENCES users(id),
  -- owner_user_id = the user whose OAuth token is used to fetch this playlist.
  -- For private playlists: must be the actual YouTube playlist owner.
  -- For public playlists: whichever user added it first.
  title               TEXT    NOT NULL,
  description         TEXT,
  channel_title       TEXT,
  channel_id          TEXT,
  item_count          INTEGER DEFAULT 0,
  privacy_status      TEXT,                               -- 'public' | 'private' | 'unlisted'
  thumbnail_url       TEXT,
  metadata_cached_at  INTEGER,                            -- last refresh of title/count/thumbnail
  videos_cached_at    INTEGER,                            -- NULL = full video list never fetched
  created_at          INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);
```

### `user_playlists`
Tracks which playlists a user has **added to their own collection**.
```sql
CREATE TABLE user_playlists (
  user_id     INTEGER NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  playlist_id TEXT    NOT NULL REFERENCES playlists(id)  ON DELETE CASCADE,
  added_at    INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  PRIMARY KEY (user_id, playlist_id)
);
```

### `playlist_shares`
Tracks explicit shares from one user to another. Shared playlists appear in the recipient's "Shared with me" panel but do **not** create a `user_playlists` row — they remain a separate collection.
```sql
CREATE TABLE playlist_shares (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id   TEXT    NOT NULL REFERENCES playlists(id)  ON DELETE CASCADE,
  from_user_id  INTEGER NOT NULL REFERENCES users(id),
  to_user_id    INTEGER NOT NULL REFERENCES users(id),
  shared_at     INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  UNIQUE(playlist_id, to_user_id)                          -- no duplicate shares
);
```

### `videos`
Deduplicated video metadata. One row per YouTube video ID, regardless of how many playlists contain it.
```sql
CREATE TABLE videos (
  id            TEXT    PRIMARY KEY,                      -- YouTube video ID
  title         TEXT    NOT NULL,
  description   TEXT,
  channel_title TEXT,
  channel_id    TEXT,
  thumbnail_url TEXT,
  duration      TEXT,                                     -- ISO 8601, e.g. PT4M13S
  published_at  INTEGER,                                  -- unix ms
  tags          TEXT,                                     -- JSON array ["tag1","tag2"]
  cached_at     INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);
```

### `playlist_items`
Ordered membership of a video in a playlist.
```sql
CREATE TABLE playlist_items (
  id          TEXT    PRIMARY KEY,                        -- YouTube playlistItem ID
  playlist_id TEXT    NOT NULL REFERENCES playlists(id)  ON DELETE CASCADE,
  video_id    TEXT    NOT NULL REFERENCES videos(id),
  position    INTEGER NOT NULL,
  added_at    INTEGER                                     -- when video was added to YT playlist
);
```

### Full-Text Search (FTS5)
Keeps a search index over video fields. Populated and maintained via triggers.
```sql
CREATE VIRTUAL TABLE videos_fts USING fts5(
  video_id    UNINDEXED,
  title,
  description,
  tags,
  channel_title,
  content     = 'videos',
  content_rowid = 'rowid'
);

CREATE TRIGGER videos_fts_insert AFTER INSERT ON videos BEGIN
  INSERT INTO videos_fts(rowid, video_id, title, description, tags, channel_title)
  VALUES (new.rowid, new.id, new.title, new.description, new.tags, new.channel_title);
END;

CREATE TRIGGER videos_fts_delete AFTER DELETE ON videos BEGIN
  INSERT INTO videos_fts(videos_fts, rowid, video_id, title, description, tags, channel_title)
  VALUES ('delete', old.rowid, old.id, old.title, old.description, old.tags, old.channel_title);
END;

CREATE TRIGGER videos_fts_update AFTER UPDATE ON videos BEGIN
  INSERT INTO videos_fts(videos_fts, rowid, video_id, title, description, tags, channel_title)
  VALUES ('delete', old.rowid, old.id, old.title, old.description, old.tags, old.channel_title);
  INSERT INTO videos_fts(rowid, video_id, title, description, tags, channel_title)
  VALUES (new.rowid, new.id, new.title, new.description, new.tags, new.channel_title);
END;
```

---

## Application Architecture

```
yt-player/
├── server/
│   ├── api/
│   │   ├── auth/           # Google OAuth callbacks
│   │   ├── playlists/      # CRUD, cache refresh, share endpoints
│   │   ├── videos/         # Fetch paginated list, random, search
│   │   └── admin/          # User management (admin only)
│   ├── db/
│   │   ├── schema.ts       # Drizzle schema (mirrors SQL above)
│   │   └── index.ts        # DB connection singleton
│   ├── services/
│   │   ├── youtube.ts      # YouTube Data API v3 wrapper
│   │   ├── cache.ts        # Cache TTL logic, force-refresh
│   │   └── crypto.ts       # AES-256 token encryption/decryption
│   └── middleware/
│       └── auth.ts         # Session + role guards
├── app/
│   ├── pages/
│   │   ├── index.vue       # Playlist dashboard
│   │   ├── playlist/[id].vue  # Video list + player
│   │   └── admin/          # Admin panel
│   ├── components/
│   │   ├── PlaylistCard.vue
│   │   ├── VideoList.vue
│   │   ├── PlayerIframe.vue
│   │   ├── SearchBar.vue
│   │   └── ShareModal.vue
│   └── composables/
│       ├── usePlaylist.ts
│       ├── usePlayer.ts
│       └── useSearch.ts
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## API Endpoints (Server Routes)

### Auth
| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/google` | Redirect to Google OAuth consent |
| GET | `/api/auth/google/callback` | Handle OAuth callback, create/update user |
| POST | `/api/auth/logout` | Clear session |
| GET | `/api/auth/me` | Current user info + role |

### Playlists
| Method | Path | Description |
|---|---|---|
| GET | `/api/playlists` | List user's own playlists |
| GET | `/api/playlists/mine/youtube` | Fetch user's private YT playlists from API (not stored yet) |
| POST | `/api/playlists/import` | Import one or more playlists (by ID array, from mine/youtube step) |
| POST | `/api/playlists/import-url` | Parse a YouTube URL/link, extract ID, import as public playlist |
| DELETE | `/api/playlists/:id` | Remove from user's collection |
| POST | `/api/playlists/:id/refresh` | Force-refresh metadata from YouTube API |
| POST | `/api/playlists/:id/fetch-videos` | Fetch/refresh full video list |
| GET | `/api/playlists/shared` | List playlists shared with current user |
| POST | `/api/playlists/:id/share` | Share playlist with another user by email |
| DELETE | `/api/playlists/:id/share/:userId` | Revoke a share |

### Videos
| Method | Path | Description |
|---|---|---|
| GET | `/api/playlists/:id/videos` | Paginated video list for a playlist |
| GET | `/api/playlists/:id/videos/random` | One random video from playlist |
| GET | `/api/search?q=&playlist=` | FTS5 search, optionally scoped to a playlist |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id` | Update role or disable account |
| DELETE | `/api/admin/users/:id` | Delete user + their playlists |
| GET | `/api/admin/playlists` | All playlists across all users |
| POST | `/api/admin/playlists/:id/refresh` | Force-refresh any playlist |

---

## Playlist Import Flows

### Flow A — Private playlists (authenticated user's own playlists)
1. User clicks **"Import my playlists"**
2. Frontend calls `GET /api/playlists/mine/youtube`
   - Server uses the user's stored OAuth token to call `youtube.playlists.list(mine=true)`
   - Returns the raw list with title, thumbnail, item count, privacy status — **not yet saved to DB**
3. User sees a picker: their YouTube playlists with checkboxes
4. User selects one or more and confirms
5. Frontend calls `POST /api/playlists/import` with `{ ids: ["PLxxx", ...] }`
   - Server fetches full metadata for each ID and inserts into `playlists` + `user_playlists`
   - Full video list is **not** fetched at this stage (lazy — user triggers it explicitly)

### Flow B — Public playlists (URL input)
1. User pastes a YouTube URL into an input field, e.g.:
   - `https://www.youtube.com/playlist?list=PLxxxxx`
   - `https://www.youtube.com/watch?v=yyyyy&list=PLxxxxx`
   - `https://music.youtube.com/playlist?list=PLxxxxx`
   - Raw ID: `PLxxxxx`
2. Frontend extracts the `list=` query parameter (client-side, no round-trip needed)
3. Frontend calls `POST /api/playlists/import-url` with `{ playlistId: "PLxxxxx" }`
   - Server checks if the playlist already exists in `playlists` (deduplication)
   - If yes: inserts only a `user_playlists` row, returns existing metadata
   - If no: fetches metadata via YouTube API (API key, no OAuth required) and inserts both rows
4. Playlist appears in the user's collection

---

## Cache Strategy

| Data | Default TTL | Force-refresh |
|---|---|---|
| Playlist metadata (title, count) | 24 hours | `POST /api/playlists/:id/refresh` |
| Full video list | 6 hours | `POST /api/playlists/:id/fetch-videos` |
| Individual video metadata | 7 days | Triggered when video list is refreshed |

Cache age is determined by `metadata_cached_at` / `videos_cached_at` timestamps on the `playlists` row. No background jobs — refresh is always user- or admin-triggered.

---

## Setup: Google Cloud Console

### 1. Create a Project
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**
3. Name it (e.g. `yt-player`) and click **Create**

### 2. Enable YouTube Data API v3
1. Go to **APIs & Services → Library**
2. Search for `YouTube Data API v3`
3. Click **Enable**

### 3. Configure OAuth Consent Screen
Google OAuth here is used **only** to connect a YouTube account after login — it is not the app login mechanism.

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (or Internal if you have Google Workspace)
3. Fill in app name, support email, developer email
4. Under **Scopes**, add only:
   - `https://www.googleapis.com/auth/youtube.readonly`
5. Under **Test users**, add the Google accounts that will connect their YouTube library while the app is in test mode
6. Save

### 4. Create OAuth 2.0 Credentials
1. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. Application type: **Web application**
3. Add **Authorized redirect URIs**:
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://YOUR_LOCAL_DOMAIN/api/youtube/callback`
4. Click **Create** — copy the **Client ID** and **Client Secret**

### 5. (Optional) Create an API Key for public playlist fallback
1. **Credentials → Create Credentials → API key**
2. Restrict it to **YouTube Data API v3** and your server IP
3. Copy the key — used for fetching public playlists without OAuth

---

## Setup: Local Development

### Prerequisites
- Node.js 24 LTS
- pnpm (`npm i -g pnpm`)
- A Google Cloud project (see above)

### Steps
```bash
# 1. Clone & install
git clone <repo>
cd yt-player
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in values (see .env.example)

# 3. Run database migrations
pnpm db:migrate

# 4. Start dev server
pnpm dev
# → http://localhost:3000
```

### `.env.example`
```env
# App
NUXT_SESSION_SECRET=              # random 32-char string (openssl rand -hex 32)
NUXT_TOKEN_ENCRYPTION_KEY=        # random 32-char string for AES token encryption

# Google OAuth — used only for per-user YouTube connection, not app login
NUXT_GOOGLE_CLIENT_ID=
NUXT_GOOGLE_CLIENT_SECRET=
NUXT_GOOGLE_REDIRECT_URI=http://localhost:3000/api/youtube/callback

# YouTube API key — used for fetching public playlists (no OAuth needed)
NUXT_YOUTUBE_API_KEY=

# Database
DATABASE_URL=./data/yt-player.db
```

---

## Setup: Proxmox Deployment

An LXC container is used instead of a VM — it shares the Proxmox host kernel, uses significantly less RAM, and boots in seconds. Docker Compose runs inside the LXC with kernel nesting enabled.

### LXC Recommendations
| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 1 core | 2 cores |
| RAM | 512 MB | 1 GB |
| Disk | 4 GB | 10 GB (SQLite + logs + Docker images) |
| Template | Debian 12 (LXC) | Debian 12 (LXC) |

### 1. Create the LXC

In the Proxmox web UI:
1. Download the **Debian 12** LXC template via **local storage → CT Templates → Templates**
2. Click **Create CT**, set ID (e.g. `200`), hostname `yt-player`, allocate resources per table above
3. After creation, open the LXC config on the **Proxmox host** and enable Docker nesting:

```bash
# On the Proxmox host (not inside the LXC)
nano /etc/pve/lxc/200.conf
```
Add at the bottom:
```
features: keyctl=1,nesting=1
```
4. Start the LXC

### 2. Install Docker inside the LXC
```bash
# Inside the LXC (via Proxmox console or SSH)
apt update && apt install -y ca-certificates curl gnupg
curl -fsSL https://get.docker.com | sh
# Docker runs as root inside the LXC — no usermod needed
```

### 3. AdGuard DNS Rewrite
In AdGuard Home, add a DNS rewrite so `YOUR_LOCAL_DOMAIN` resolves to the LXC's local IP:

1. Open AdGuard Home → **Filters → DNS Rewrites → Add DNS Rewrite**
2. Domain: `YOUR_LOCAL_DOMAIN` — IP: `<LXC_IP>` (find it with `ip a` inside the LXC)
3. Save

All devices on the network using AdGuard as their DNS will now resolve `YOUR_LOCAL_DOMAIN` to the LXC.

### 4. Deploy the App
```bash
git clone <repo> /opt/yt-player
cd /opt/yt-player

cp .env.example .env
nano .env
# Set NUXT_GOOGLE_REDIRECT_URI=https://YOUR_LOCAL_DOMAIN/api/youtube/callback

mkdir -p /opt/yt-player/data
docker compose up -d
```

### 5. `docker-compose.yml` (outline — generated during scaffold)
```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data      # SQLite database persists here
    env_file: .env
```

### 6. Reverse Proxy with Caddy + HTTPS
DNS is handled by AdGuard locally — no public DNS validation needed. Caddy issues certificates via its **internal CA**.

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

### 7. Trust Caddy's Root CA (once per device)
Caddy generates a local root CA at `/data/caddy/pki/authorities/local/root.crt`. Copy it to each device and install it as a trusted root — after this, `https://YOUR_LOCAL_DOMAIN` shows a valid padlock with no warnings.

```bash
# Copy the cert out of the LXC to your machine
scp root@<LXC_IP>:/data/caddy/pki/authorities/local/root.crt ~/caddy-home-ca.crt
```

| Device | How to trust |
|---|---|
| macOS | Double-click → Keychain Access → set to **Always Trust** |
| Windows | Double-click → Install → **Trusted Root Certification Authorities** |
| Linux | `cp caddy-home-ca.crt /usr/local/share/ca-certificates/ && update-ca-certificates` |
| Android | Settings → Security → **Install CA certificate** |
| iOS | AirDrop or email the file → Settings → **Profile Downloaded** → install → General → About → Certificate Trust Settings → enable |

### 8. Update OAuth redirect URI
In Google Cloud Console → Credentials → your OAuth client → add:
`https://YOUR_LOCAL_DOMAIN/api/youtube/callback`

---

## Future Work / Nice-to-Have

- [ ] Video list pagination in UI (virtual scroll vs pages)
- [ ] Token refresh: automatic background refresh vs on-demand
- [ ] Admin panel: global cache TTL overrides
- [ ] Playlist reorder / custom sort in UI
- [ ] Watch history per user
