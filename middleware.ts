import { next } from '@vercel/functions';

export const config = {
  matcher: ['/((?!favicon.ico|robots.txt).*)'],
};

export default function middleware(request: Request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  const cronSecret = process.env.CRON_SECRET;

  if (!user || !pass) {
    return new Response('Auth not configured', { status: 500 });
  }

  const header = request.headers.get('authorization');

  if (header) {
    const [scheme, value] = header.split(' ');

    // Vercel cron requests come with: Authorization: Bearer <CRON_SECRET>
    if (scheme === 'Bearer' && cronSecret && value === cronSecret) {
      return next();
    }

    // Browser users come with: Authorization: Basic <base64(user:pass)>
    if (scheme === 'Basic' && value) {
      const decoded = atob(value);
      const idx = decoded.indexOf(':');
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u === user && p === pass) return next();
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Protected"' },
  });
}
