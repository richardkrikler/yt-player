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
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'YT Player' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'theme-color', content: '#030712' },
      ],
    },
  },

  vite: {
    optimizeDeps: {
      include: ['sortablejs'],
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
