'use client';

export const ADMIN_SESSION_EXPIRED_EVENT = 'admin-session-expired';

export function redirectToLogin() {
  localStorage.removeItem('user');

  if (typeof window !== 'undefined') {
    window.location.replace('/login');
  }
}

export function notifySessionExpired() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT));
  }
}

export async function handleUnauthorizedResponse(response: Response) {
  if (response.status === 401) {
    notifySessionExpired();
    throw new Error('SESSION_EXPIRED');
  }

  return response;
}
