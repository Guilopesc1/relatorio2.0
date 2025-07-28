import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      profile: string
    } & DefaultSession['user']
  }

  interface User {
    profile: string
  }
}