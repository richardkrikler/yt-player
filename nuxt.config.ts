export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],

  runtimeConfig: {
    tokenEncryptionKey: '',
    googleClientId: '',
    googleClientSecret: '',
    googleRedirectUri: '',
    youtubeApiKey: '',
    databaseUrl: './data/yt-player.db',
  },

  app: {
    viewTransition: true,
  },

  nitro: {
    externals: {
      external: ['better-sqlite3'],
    },
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        types: ['node'],
      },
    },
  },

  devtools: { enabled: true },
})
