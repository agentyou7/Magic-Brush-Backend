'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export const ADMIN_SESSION_EXPIRED_EVENT = 'admin-session-expired';

export function redirectToLogin(router: AppRouterInstance) {
  localStorage.removeItem('user');
  router.replace('/login');
}

export function notifySessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT));
  }
}

export async function handleUnauthorizedResponse(
  response: Response,
  router: AppRouterInstance
) {
  if (response.status === 401) {
    notifySessionExpired();
    throw new Error('SESSION_EXPIRED');
  }

  return response;
}
