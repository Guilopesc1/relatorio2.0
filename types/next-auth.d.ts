import { DefaultSession } from 'next-auth'
import { UserProfile } from './database'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      profile: UserProfile
    } & DefaultSession['user']
    accessToken?: string
  }

  interface User {
    id: string
    profile: UserProfile
  }

  interface JWT {
    id?: string
    profile?: UserProfile
    accessToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    profile?: UserProfile
    accessToken?: string
  }
}
