import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('sb-ghohhebflehmrqzgkqlt-auth-token')
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isDriverPage = request.nextUrl.pathname.startsWith('/driver')
  const isPublicFile = request.nextUrl.pathname.match(/\.(png|jpg|ico|json|js|css|svg|webp)$/)

  if (!token && !isLoginPage && !isDriverPage && !isPublicFile) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|_next).*)'],
}