import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

const PUBLIC = [/^\/login/, /^\/voir\//, /^\/signer\//, /^\/api\/(webhooks|forms|share|sign|cron)\//];

export function proxy(request: NextRequest) {
  if (PUBLIC.some((re) => re.test(request.nextUrl.pathname))) return NextResponse.next();
  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
