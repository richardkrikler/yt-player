declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    displayName: string | null
    avatarUrl: string | null
    role: 'admin' | 'user'
    youtubeConnected: boolean
  }
}

export {}
