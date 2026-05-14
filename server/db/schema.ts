import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
  googleId: text('google_id').unique(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: integer('token_expires_at'),
  youtubeConnectedAt: integer('youtube_connected_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
})

export const playlists = sqliteTable('playlists', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  channelTitle: text('channel_title'),
  channelId: text('channel_id'),
  itemCount: integer('item_count').default(0),
  privacyStatus: text('privacy_status'),
  thumbnailUrl: text('thumbnail_url'),
  metadataCachedAt: integer('metadata_cached_at'),
  videosCachedAt: integer('videos_cached_at'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
})

export const userPlaylists = sqliteTable('user_playlists', {
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  playlistId: text('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  customTitle: text('custom_title'),
  addedAt: integer('added_at').notNull().$defaultFn(() => Date.now()),
}, (t) => [primaryKey({ columns: [t.userId, t.playlistId] })])

export const playlistShares = sqliteTable('playlist_shares', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playlistId: text('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  fromUserId: integer('from_user_id').notNull().references(() => users.id),
  toUserId: integer('to_user_id').notNull().references(() => users.id),
  sharedAt: integer('shared_at').notNull().$defaultFn(() => Date.now()),
})

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  channelTitle: text('channel_title'),
  channelId: text('channel_id'),
  thumbnailUrl: text('thumbnail_url'),
  duration: text('duration'),
  publishedAt: integer('published_at'),
  tags: text('tags'),
  cachedAt: integer('cached_at').notNull().$defaultFn(() => Date.now()),
})

export const playlistItems = sqliteTable('playlist_items', {
  id: text('id').primaryKey(),
  playlistId: text('playlist_id').notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull().references(() => videos.id),
  position: integer('position').notNull(),
  addedAt: integer('added_at'),
})

export type User = typeof users.$inferSelect
export type Playlist = typeof playlists.$inferSelect
export type Video = typeof videos.$inferSelect
export type PlaylistItem = typeof playlistItems.$inferSelect
