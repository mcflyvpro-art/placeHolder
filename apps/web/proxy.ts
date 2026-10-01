import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = [/^\/login/, /^\/auth\//, /^\/voir\//, /^\/signer\//, /^\/api\/(webhooks|forms|share|sign|cron)\//];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (PUBLIC.some((re) => re.test(request.nextUrl.pathname))) return response;

  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await sb.auth.getUser();
  const owner = process.env.OWNER_EMAIL?.toLowerCase();
  if (!data.user || data.user.email?.toLowerCase() !== owner) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
