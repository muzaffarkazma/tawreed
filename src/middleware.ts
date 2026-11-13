import { NextResponse, type NextRequest } from 'next/server';

// Exposes the request path to server components (used by the auth guard).
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|vendor/).*)'] };
