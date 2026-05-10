import { sqlite } from '../db'

export default defineNitroPlugin(() => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      google_id TEXT UNIQUE,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at INTEGER,
      youtube_connected_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      owner_user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      channel_title TEXT,
      channel_id TEXT,
      item_count INTEGER DEFAULT 0,
      privacy_status TEXT,
      thumbnail_url TEXT,
      metadata_cached_at INTEGER,
      videos_cached_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_playlists (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, playlist_id)
    );

    CREATE TABLE IF NOT EXISTS playlist_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      from_user_id INTEGER NOT NULL REFERENCES users(id),
      to_user_id INTEGER NOT NULL REFERENCES users(id),
      shared_at INTEGER NOT NULL,
      UNIQUE(playlist_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      channel_title TEXT,
      channel_id TEXT,
      thumbnail_url TEXT,
      duration TEXT,
      published_at INTEGER,
      tags TEXT,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_items (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL REFERENCES videos(id),
      position INTEGER NOT NULL,
      added_at INTEGER
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
      video_id UNINDEXED,
      title,
      description,
      tags,
      channel_title,
      content='videos',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS videos_fts_insert AFTER INSERT ON videos BEGIN
      INSERT INTO videos_fts(rowid, video_id, title, description, tags, channel_title)
      VALUES (new.rowid, new.id, new.title, new.description, new.tags, new.channel_title);
    END;

    CREATE TRIGGER IF NOT EXISTS videos_fts_delete AFTER DELETE ON videos BEGIN
      INSERT INTO videos_fts(videos_fts, rowid, video_id, title, description, tags, channel_title)
      VALUES ('delete', old.rowid, old.id, old.title, old.description, old.tags, old.channel_title);
    END;

    CREATE TRIGGER IF NOT EXISTS videos_fts_update AFTER UPDATE ON videos BEGIN
      INSERT INTO videos_fts(videos_fts, rowid, video_id, title, description, tags, channel_title)
      VALUES ('delete', old.rowid, old.id, old.title, old.description, old.tags, old.channel_title);
      INSERT INTO videos_fts(rowid, video_id, title, description, tags, channel_title)
      VALUES (new.rowid, new.id, new.title, new.description, new.tags, new.channel_title);
    END;
  `)
})
