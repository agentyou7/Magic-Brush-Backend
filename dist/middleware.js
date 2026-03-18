"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
const server_1 = require("next/server");
function middleware(request) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith('/api/')) {
        return server_1.NextResponse.next();
    }
    // Public routes that don't require authentication
    const publicRoutes = ['/login'];
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));
    if (!isPublicRoute) {
        const token = request.cookies.get('access_token')?.value;
        if (!token) {
            const loginUrl = new URL('/login', request.url);
            return server_1.NextResponse.redirect(loginUrl);
        }
    }
    if (pathname === '/login') {
        const token = request.cookies.get('access_token')?.value;
        if (token) {
            const dashboardUrl = new URL('/admin/dashboard', request.url);
            return server_1.NextResponse.redirect(dashboardUrl);
        }
    }
    return server_1.NextResponse.next();
}
exports.config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
