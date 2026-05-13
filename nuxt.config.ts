export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],

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
    head: {
      htmlAttrs: { lang: 'en' },
      titleTemplate: '%s — YT Player',
      title: 'YT Player',
    },
  },

  experimental: {
    viewTransition: true,
  },

  nitro: {
    esbuild: {
      options: {
        target: 'es2020',
      },
    },
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
