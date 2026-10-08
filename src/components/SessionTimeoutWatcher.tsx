'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * SessionTimeoutWatcher
 * Proactively monitors the 1-hour session lifetime on the client side.
 * When the session exceeds 1 hour (or expires), it automatically performs logout
 * and redirects the user to /login?expired=1.
 */
export default function SessionTimeoutWatcher() {
  const pathname = usePathname();
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    // Do not run session timer on the login page
    if (pathname === '/login') {
      return;
    }

    let timerId: NodeJS.Timeout | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    let expiresAtTimestamp: number | null = null;

    const performAutoLogout = async () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;

      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.warn('Auto logout request failed, redirecting anyway:', err);
      } finally {
        window.location.href = '/login?expired=1';
      }
    };

    const checkExpiration = () => {
      if (expiresAtTimestamp && Date.now() >= expiresAtTimestamp) {
        performAutoLogout();
      }
    };

    // Fetch session expiration information from server
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          // Already expired or unauthenticated
          performAutoLogout();
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!data || !data.authenticated) {
          return;
        }

        const now = Date.now();
        let targetExpiresAt: number;

        if (typeof data.expiresAt === 'number' && data.expiresAt > 0) {
          targetExpiresAt = data.expiresAt;
        } else if (typeof data.expiresInSeconds === 'number' && data.expiresInSeconds > 0) {
          targetExpiresAt = now + data.expiresInSeconds * 1000;
        } else {
          // Fallback: 1 hour (3600 seconds) from now
          targetExpiresAt = now + 60 * 60 * 1000;
        }

        expiresAtTimestamp = targetExpiresAt;
        const remainingMs = Math.max(0, targetExpiresAt - now);

        // Immediate check if time is already up
        if (remainingMs <= 0) {
          performAutoLogout();
          return;
        }

        // 1. Precise one-shot timer for remaining milliseconds
        timerId = setTimeout(() => {
          performAutoLogout();
        }, remainingMs);

        // 2. Periodic poll every 20 seconds as a safety net against timer throttling
        intervalId = setInterval(checkExpiration, 20000);
      })
      .catch((err) => {
        console.warn('Could not verify session timer:', err);
      });

    // 3. Immediately verify upon tab visibility change or window focus
    // (Crucial if laptop was suspended or browser tab was in background)
    const handleVisibilityOrFocus = () => {
      checkExpiration();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      if (timerId) clearTimeout(timerId);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [pathname]);

  return null;
}
