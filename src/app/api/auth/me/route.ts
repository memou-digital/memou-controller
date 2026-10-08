import { NextRequest, NextResponse } from 'next/server';
import { getSessionUserFromRequest, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) {
    const res = NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  const remainingSeconds = user.exp ? Math.max(0, user.exp - nowInSeconds) : 0;

  return NextResponse.json({
    authenticated: true,
    user,
    expiresAt: user.exp ? user.exp * 1000 : null,
    expiresInSeconds: remainingSeconds,
  });
}
