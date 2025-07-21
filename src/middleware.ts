import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    console.log('Middleware - Path:', req.nextUrl.pathname)
    console.log('Middleware - Has token:', !!req.nextauth.token)
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        // Allow test page
        if (req.nextUrl.pathname === '/test') {
          return true
        }
        // Protect dashboard routes
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return token !== null
        }
        return true
      }
    },
    pages: {
      signIn: '/auth/login',
    }
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/sessions/:path*',
    '/api/research/:path*',
    '/api/tables/:path*',
  ]
}