'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function redirectToLogin(router: AppRouterInstance) {
  localStorage.removeItem('user');
  router.replace('/login');
}

export async function handleUnauthorizedResponse(
  response: Response,
  router: AppRouterInstance
) {
  if (response.status === 401) {
    redirectToLogin(router);
    throw new Error('Authentication required');
  }

  return response;
}
