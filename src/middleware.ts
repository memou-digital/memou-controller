import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'memou_session';
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.JWT_SECRET || 'memou_secret_key_tidb_auth_2026_secure'
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignore static assets and Next internal files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/thumbnails') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/preview') ||
    pathname.startsWith('/api/github/thumbnail') ||
    pathname.startsWith('/api/github/preview')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload && payload.id) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // If user is accessing /login
  if (pathname === '/login') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // All other pages/api routes are protected
  if (!isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      const apiRes = NextResponse.json(
        { error: 'Unauthorized. Sesi Anda telah berakhir atau belum masuk.' },
        { status: 401 }
      );
      if (token) {
        apiRes.cookies.delete(SESSION_COOKIE_NAME);
      }
      return apiRes;
    }

    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    if (token) {
      // User had a token that is now expired (> 1 hour)
      loginUrl.searchParams.set('expired', '1');
    }

    const redirectRes = NextResponse.redirect(loginUrl);
    if (token) {
      redirectRes.cookies.delete(SESSION_COOKIE_NAME);
    }
    return redirectRes;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
