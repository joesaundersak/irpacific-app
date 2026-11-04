import 'next-auth'
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      roleId: string
    } & DefaultSession['user']
  }

  interface User {
    role?: string
    roleId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    roleId: string
  }
}
