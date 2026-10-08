import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'OWNER_ADMIN' | 'TEAM_MEMBER';
  exp?: number;
}

export const SESSION_COOKIE_NAME = 'memou_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60; // 1 hour (3600 seconds)
const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || process.env.JWT_SECRET || 'memou_secret_key_tidb_auth_2026_secure'
);

/**
 * Sign a new JWT token for the authenticated user (valid for 1 hour)
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

/**
 * Verify an existing JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload || !payload.id || !payload.email) {
      return null;
    }
    return {
      id: payload.id as string,
      name: (payload.name as string) || '',
      email: payload.email as string,
      role: (payload.role as 'OWNER_ADMIN' | 'TEAM_MEMBER') || 'TEAM_MEMBER',
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get current session user from server cookies (Next.js server component / route handler)
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Get session user from NextRequest (for middleware / API routes)
 */
export async function getSessionUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
